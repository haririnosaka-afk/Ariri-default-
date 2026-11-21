"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Sparkles, LogIn, UserPlus, Mail, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [code,setCode]=useState("");
  const [signup,setSignup]=useState(false);
  const [verifyMode,setVerifyMode]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  function client(){
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if(!url||!key) throw new Error("Konfigurasi login belum lengkap. Hubungi admin KAZAMA AI.");
    return createBrowserClient(url,key);
  }
  async function submit(e:React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const supabase=client();
      if(verifyMode){
        const result=await supabase.auth.verifyOtp({email:email.trim(),token:code.trim(),type:"signup"});
        if(result.error) throw result.error;
        location.href="/";
        return;
      }
      if(signup){
        const result=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:location.origin+"/auth/callback"}});
        if(result.error) throw result.error;
        if(result.data.session) location.href="/";
        else {setVerifyMode(true);setMessage("Kode verifikasi telah dikirim ke email. Masukkan 6 digit kode untuk mengaktifkan akun.");}
      } else {
        const result=await supabase.auth.signInWithPassword({email:email.trim(),password});
        if(result.error) throw result.error;
        location.href="/";
      }
    } catch(e) { setError(e instanceof Error?e.message:"Tidak dapat memproses permintaan."); }
    finally { setBusy(false); }
  }
  async function googleLogin(){
    setBusy(true);setError("");setMessage("");
    try{
      const {error}=await client().auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+"/auth/callback"}});
      if(error)throw error;
    }catch(e){setError(e instanceof Error?e.message:"Login Google gagal.");setBusy(false);}
  }
  async function resendCode(){
    setBusy(true);setError("");setMessage("");
    try{
      const {error}=await client().auth.resend({type:"signup",email:email.trim()});
      if(error)throw error;
      setMessage("Kode verifikasi baru telah dikirim. Periksa kotak masuk dan folder spam.");
    }catch(e){setError(e instanceof Error?e.message:"Gagal mengirim ulang kode.");}
    finally{setBusy(false);}
  }
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#080a10",color:"#f4f5fb",padding:20,fontFamily:"Arial,sans-serif"}}>
    <form onSubmit={submit} style={{width:"100%",maxWidth:420,background:"#111621",border:"1px solid #283244",borderRadius:22,padding:30}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:28}}><div style={{background:"#b8a6ff",color:"#171326",padding:12,borderRadius:12}}><Sparkles/></div><div><b style={{fontSize:19}}>KAZAMA AI</b><div style={{fontSize:10,color:"#929db0",letterSpacing:2}}>CREATIVE STUDIO</div></div></div>
      <h1 style={{fontSize:27,margin:"0 0 8px"}}>{verifyMode?"Verifikasi email":signup?"Buat akun":"Selamat datang kembali"}</h1>
      <p style={{color:"#929db0",fontSize:14,marginBottom:24}}>{verifyMode?"Masukkan kode verifikasi yang dikirim ke emailmu.": "Masuk untuk menggunakan studio dan saldo token pribadimu."}</p>
      <label style={{display:"block",fontSize:12,marginBottom:7}}>EMAIL</label>
      <input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@email.com" disabled={verifyMode} style={inputStyle}/>
      {!verifyMode&&<><label style={{display:"block",fontSize:12,margin:"16px 0 7px"}}>PASSWORD</label><input required minLength={8} type="password" autoComplete={signup?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimal 8 karakter" style={inputStyle}/></>}
      {verifyMode&&<><label style={{display:"block",fontSize:12,margin:"16px 0 7px"}}>KODE VERIFIKASI</label><input required inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={e=>setCode(e.target.value.replace(/\\D/g,""))} placeholder="Masukkan kode dari email" style={inputStyle}/></>}
      {error&&<p style={{color:"#ff8291",fontSize:13}}>{error}</p>}{message&&<p style={{color:"#73e1bd",fontSize:13}}>{message}</p>}
      <button disabled={busy} style={buttonStyle}>{verifyMode?<ShieldCheck size={17}/>:signup?<UserPlus size={17}/>:<LogIn size={17}/>} {busy?"Memproses...":verifyMode?"Verifikasi kode":signup?"Daftar akun":"Masuk"}</button>
      {verifyMode?<button type="button" disabled={busy} onClick={resendCode} style={secondaryStyle}>Kirim ulang kode</button>:<>
        <div style={{display:"flex",alignItems:"center",gap:12,color:"#657084",fontSize:11,margin:"18px 0"}}><span style={{height:1,background:"#283244",flex:1}}/>ATAU<span style={{height:1,background:"#283244",flex:1}}/></div>
        <button type="button" disabled={busy} onClick={googleLogin} style={googleStyle}><GoogleMark/> Lanjutkan dengan Google</button>
        <button type="button" onClick={()=>{setSignup(!signup);setError("");setMessage("")}} style={secondaryStyle}>{signup?"Sudah punya akun? Masuk":"Belum punya akun? Daftar"}</button>
      </>}
      <p style={{color:"#657084",fontSize:11,textAlign:"center",marginTop:14}}>Akun baru dimulai dengan saldo 0 token.</p>
    </form>
  </main>;
}
function GoogleMark(){return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 37.95 46.98 31.83 46.98 24.55z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.55 2.56 10.78z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.44-4.89 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>}
const inputStyle:React.CSSProperties={width:"100%",padding:13,border:"1px solid #283244",borderRadius:10,background:"#080a10",color:"#f4f5fb",outline:"none"};
const buttonStyle:React.CSSProperties={width:"100%",marginTop:22,padding:14,border:0,borderRadius:12,background:"#b8a6ff",color:"#171326",fontWeight:700,display:"flex",justifyContent:"center",gap:9,alignItems:"center"};
const googleStyle:React.CSSProperties={...buttonStyle,marginTop:0,background:"#f4f5fb",color:"#202534"};
const secondaryStyle:React.CSSProperties={width:"100%",padding:14,background:"transparent",border:0,color:"#b8a6ff",marginTop:8};
