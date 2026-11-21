"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Sparkles, LogIn, UserPlus } from "lucide-react";

export default function LoginPage() {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [signup,setSignup]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  async function submit(e:React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      if(!url||!key) throw new Error("Konfigurasi login belum lengkap. Hubungi admin KAZAMA AI.");
      const supabase=createBrowserClient(url,key);
      const result=signup
        ? await supabase.auth.signUp({email,password,options:{emailRedirectTo:location.origin}})
        : await supabase.auth.signInWithPassword({email,password});
      if(result.error) throw result.error;
      if(signup && !result.data.session) setMessage("Pendaftaran berhasil. Periksa email untuk verifikasi, lalu masuk.");
      else location.href="/";
    } catch(e) { setError(e instanceof Error?e.message:"Tidak dapat masuk."); }
    finally { setBusy(false); }
  }
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#080a10",color:"#f4f5fb",padding:20,fontFamily:"Arial,sans-serif"}}>
    <form onSubmit={submit} style={{width:"100%",maxWidth:420,background:"#111621",border:"1px solid #283244",borderRadius:22,padding:30}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:28}}><div style={{background:"#b8a6ff",color:"#171326",padding:12,borderRadius:12}}><Sparkles/></div><div><b style={{fontSize:19}}>KAZAMA AI</b><div style={{fontSize:10,color:"#929db0",letterSpacing:2}}>CREATIVE STUDIO</div></div></div>
      <h1 style={{fontSize:27,margin:"0 0 8px"}}>{signup?"Buat akun":"Selamat datang kembali"}</h1>
      <p style={{color:"#929db0",fontSize:14,marginBottom:24}}>Masuk untuk menggunakan studio dan saldo token pribadimu.</p>
      <label style={{display:"block",fontSize:12,marginBottom:7}}>EMAIL</label><input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@email.com" style={inputStyle}/>
      <label style={{display:"block",fontSize:12,margin:"16px 0 7px"}}>PASSWORD</label><input required minLength={8} type="password" autoComplete={signup?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimal 8 karakter" style={inputStyle}/>
      {error&&<p style={{color:"#ff8291",fontSize:13}}>{error}</p>}{message&&<p style={{color:"#73e1bd",fontSize:13}}>{message}</p>}
      <button disabled={busy} style={{width:"100%",marginTop:22,padding:14,border:0,borderRadius:12,background:"#b8a6ff",color:"#171326",fontWeight:700,display:"flex",justifyContent:"center",gap:9,alignItems:"center"}}>{signup?<UserPlus size={17}/>:<LogIn size={17}/>} {busy?"Memproses...":signup?"Daftar akun":"Masuk"}</button>
      <button type="button" onClick={()=>{setSignup(!signup);setError("");setMessage("")}} style={{width:"100%",padding:14,background:"transparent",border:0,color:"#b8a6ff",marginTop:8}}>{signup?"Sudah punya akun? Masuk":"Belum punya akun? Daftar"}</button>
      <p style={{color:"#657084",fontSize:11,textAlign:"center",marginTop:14}}>Akun baru dimulai dengan saldo 0 token.</p>
    </form>
  </main>;
}
const inputStyle:React.CSSProperties={width:"100%",padding:13,border:"1px solid #283244",borderRadius:10,background:"#080a10",color:"#f4f5fb",outline:"none"};
