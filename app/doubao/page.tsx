"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleAlert, KeyRound, RefreshCw, ShieldCheck, Users } from "lucide-react";
type Health = { configured: boolean; accountCount: number; accounts: {slot:number;label:string;connected:boolean}[]; models: {id:string;name:string;maxDuration:number;maxImages:number;resolutions:string[]}[]; note?:string };
export default function DoubaoSetup(){
 const [health,setHealth]=useState<Health|null>(null); const [loading,setLoading]=useState(true);
 const [prompt,setPrompt]=useState(""); const [model,setModel]=useState("doubao-seedance-2-5-260628"); const [duration,setDuration]=useState("30"); const [resolution,setResolution]=useState("720p"); const [ratio,setRatio]=useState("16:9"); const [imageUrls,setImageUrls]=useState(""); const [generateAudio,setGenerateAudio]=useState(false); const [busy,setBusy]=useState(false); const [notice,setNotice]=useState(""); const [job,setJob]=useState<{id:string;slot:number;status:string;videoUrl?:string;error?:string}|null>(null);
 const flash=model==="doubao-seedance-2-5-flash-261115";
 async function refresh(){setLoading(true);try{const r=await fetch("/api/doubao/health",{cache:"no-store"});setHealth(await r.json());}catch{setHealth(null);}finally{setLoading(false);}}
 useEffect(()=>{void refresh();},[]);
 useEffect(()=>{if(!job?.id||job.videoUrl||["failed","error","cancelled","expired","succeeded"].includes(job.status.toLowerCase()))return;const timer=setInterval(async()=>{try{const r=await fetch("/api/doubao/status?id="+encodeURIComponent(job.id)+"&slot="+job.slot);const d=await r.json();setJob(p=>p?{...p,status:String(d.status||p.status),videoUrl:d.videoUrl||p.videoUrl,error:d.error||p.error}:p);}catch{}},8000);return()=>clearInterval(timer);},[job?.id,job?.slot,job?.status,job?.videoUrl]);
 async function generate(){if(!prompt.trim()){setNotice("Prompt wajib diisi.");return;}if(!health?.configured){setNotice("Hubungkan API Key Ark terlebih dahulu.");return;}setBusy(true);setNotice("Mengirim tugas ke pool Doubao...");try{const urls=imageUrls.split(/\\n|,/).map(x=>x.trim()).filter(Boolean);const r=await fetch("/api/doubao/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model,prompt,duration:Number(duration),resolution,ratio,imageUrls:urls,generateAudio})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Generate gagal.");setJob({id:d.id,slot:d.providerSlot,status:d.status||"queued"});setNotice("Tugas diterima. KAZAMA akan memeriksa hasil otomatis.");}catch(e){setNotice(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 const example = [
 "[",
 "  {",
 '    "label": "Akun Doubao 1",',
 '    "apiKey": "ISI_API_KEY_ARK_DI_SINI",',
 '    "baseUrl": "https://ark.cn-beijing.volces.com/api/v3"',
 "  },",
 "  {",
 '    "label": "Akun Doubao 2",',
 '    "apiKey": "API_KEY_KEDUA_JIKA_PUNYA",',
 '    "baseUrl": "https://ark.cn-beijing.volces.com/api/v3"',
 "  }",
 "]"
 ].join("\n");
 return <main style={{minHeight:"100vh",background:"#090b10",color:"#f1f3f8",fontFamily:"Arial,sans-serif",padding:"24px 16px"}}><div style={{maxWidth:850,margin:"0 auto"}}>
 <Link href="/" style={{color:"#b8a5ff",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:8,fontSize:13}}><ArrowLeft size={16}/> Kembali ke KAZAMA AI</Link>
 <div style={{marginTop:28,display:"flex",alignItems:"center",gap:12}}><div style={{background:"#29233e",padding:12,borderRadius:12,color:"#c5b7ff"}}><Users/></div><div><div style={{fontSize:11,letterSpacing:2,color:"#b8a5ff"}}>KAZAMA AI · PROVIDER MANAGER</div><h1 style={{fontSize:30,margin:"7px 0 0"}}>Doubao Account Pool</h1></div></div>
 <p style={{color:"#9aa4b5",lineHeight:1.7,fontSize:14,maxWidth:720}}>Kelola beberapa API Key Ark yang memang kamu miliki atau berwenang gunakan. Scheduler memilih akun secara bergiliran dan mencoba akun lain jika terkena rate limit atau gangguan server.</p>
 <section style={{marginTop:22,padding:20,border:"1px solid #293141",borderRadius:14,background:"#10141c"}}>
 <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><h2 style={{fontSize:17,margin:0}}>Status koneksi</h2><button onClick={refresh} disabled={loading} style={{background:"#242039",color:"#d8ceff",border:"1px solid #55477e",borderRadius:8,padding:"9px 12px",display:"inline-flex",alignItems:"center",gap:8}}><RefreshCw size={14}/>{loading?"Memeriksa...":"Perbarui"}</button></div>
 {health?.configured?<div style={{marginTop:16,display:"flex",alignItems:"center",gap:10,color:"#72e2c0"}}><CheckCircle2 size={19}/><b>{health.accountCount} API Key terpasang di server</b></div>:<div style={{marginTop:16,display:"flex",alignItems:"center",gap:10,color:"#e8c37b"}}><CircleAlert size={19}/><b>Belum ada akun/API Key terhubung</b></div>}
 {health?.accounts?.map(a=><div key={a.slot} style={{marginTop:9,padding:12,background:"#151b25",borderRadius:8,display:"flex",justifyContent:"space-between",fontSize:13}}><span>{a.label}</span><span style={{color:"#72e2c0"}}>Key tersimpan di server</span></div>)}
 </section>
 <section style={{marginTop:16,padding:20,border:"1px solid #293141",borderRadius:14,background:"#10141c"}}>
 <div style={{display:"flex",alignItems:"center",gap:9}}><KeyRound size={18} color="#b8a5ff"/><h2 style={{fontSize:17,margin:0}}>Cara memasukkan akun Doubao</h2></div>
 <ol style={{color:"#c0c8d5",fontSize:13,lineHeight:1.9,paddingLeft:20}}><li>Buat atau buka akun <b>Volcengine Ark</b> yang memiliki akses Seedance 2.5.</li><li>Buat API Key di <a href="https://ark.volcengine.com/region:cn-beijing/apikey" target="_blank" rel="noreferrer" style={{color:"#b8a5ff"}}>halaman API Key Ark</a>.</li><li>Buka Vercel → Project <b>kazama-ai</b> → Settings → Environment Variables.</li><li>Tambahkan variable bernama <code style={{color:"#e7dfff"}}>DOUBAO_ARK_API_KEYS</code> dan isi dengan JSON di bawah. Tambahkan satu objek untuk setiap API Key yang kamu miliki.</li><li>Pilih Production, Save, lalu lakukan Redeploy.</li><li>Kembali ke halaman ini dan tekan Perbarui.</li></ol>
 <pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",background:"#090e16",border:"1px solid #293141",borderRadius:9,padding:14,color:"#bdebd9",fontSize:12,lineHeight:1.7}}>{example}</pre>
 <div style={{display:"flex",gap:9,alignItems:"flex-start",padding:12,background:"#1b202a",borderRadius:9,color:"#e7c98d",fontSize:12,lineHeight:1.6}}><ShieldCheck size={18} style={{flexShrink:0}}/><span><b>Penting:</b> Masukkan API Key Ark, bukan password Doubao, kode OTP, Cookie, atau token sesi browser. API Key disimpan sebagai Environment Variable di server dan tidak ditampilkan di halaman ini. Akun Doubao biasa tanpa akses Ark API tidak dapat dihubungkan lewat cara resmi ini.</span></div>
 </section>
 <section style={{marginTop:16,padding:20,border:"1px solid #293141",borderRadius:14,background:"#10141c"}}><h2 style={{fontSize:17,marginTop:0}}>Model yang disiapkan</h2>{(health?.models||[{id:"doubao-seedance-2-5-260628",name:"Seedance 2.5",maxDuration:30,maxImages:30,resolutions:["480p","720p","1080p","4k"]},{id:"doubao-seedance-2-5-flash-261115",name:"Seedance 2.5 Flash",maxDuration:30,maxImages:10,resolutions:["480p","720p"]}]).map(m=><div key={m.id} style={{padding:"12px 0",borderTop:"1px solid #293141"}}><b>{m.name}</b><div style={{fontSize:12,color:"#98a3b4",marginTop:6}}>{m.maxDuration}s max · {m.maxImages} foto referensi · {m.resolutions.join(" / ")}</div><code style={{fontSize:11,color:"#b8a5ff"}}>{m.id}</code></div>)}</section>
<section style={{marginTop:16,padding:20,border:"1px solid #514477",borderRadius:14,background:"#111522"}}>
 <h2 style={{fontSize:18,marginTop:0}}>Uji generator melalui Account Pool</h2>
 <p style={{fontSize:12,color:"#9aa4b5",lineHeight:1.6}}>Setelah API Key terpasang, kamu bisa menguji satu request langsung melalui akun pool ini.</p>
 <label style={{display:"block",fontSize:12,margin:"12px 0 6px"}}>Model</label><select value={model} onChange={e=>{setModel(e.target.value);setResolution(e.target.value==="doubao-seedance-2-5-flash-261115"?"720p":resolution);}} style={{width:"100%",padding:11,borderRadius:8,background:"#151b25",color:"#fff",border:"1px solid #344052"}}><option value="doubao-seedance-2-5-260628">Seedance 2.5</option><option value="doubao-seedance-2-5-flash-261115">Seedance 2.5 Flash</option></select>
 <label style={{display:"block",fontSize:12,margin:"12px 0 6px"}}>Prompt</label><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Tuliskan adegan video..." style={{width:"100%",minHeight:110,padding:12,borderRadius:8,background:"#151b25",color:"#fff",border:"1px solid #344052"}}/>
 <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:9,marginTop:12}}><div><label style={{fontSize:11}}>Durasi</label><select value={duration} onChange={e=>setDuration(e.target.value)} style={{width:"100%",padding:10,marginTop:5,background:"#151b25",color:"#fff",border:"1px solid #344052",borderRadius:8}}>{[4,5,6,8,10,12,15,20,25,30].map(n=><option key={n} value={n}>{n}s</option>)}</select></div><div><label style={{fontSize:11}}>Resolusi</label><select value={resolution} onChange={e=>setResolution(e.target.value)} style={{width:"100%",padding:10,marginTop:5,background:"#151b25",color:"#fff",border:"1px solid #344052",borderRadius:8}}>{(flash?["480p","720p"]:["480p","720p","1080p","4k"]).map(n=><option key={n}>{n}</option>)}</select></div><div><label style={{fontSize:11}}>Rasio</label><select value={ratio} onChange={e=>setRatio(e.target.value)} style={{width:"100%",padding:10,marginTop:5,background:"#151b25",color:"#fff",border:"1px solid #344052",borderRadius:8}}>{["16:9","9:16","1:1","4:3","3:4","21:9","adaptive"].map(n=><option key={n}>{n}</option>)}</select></div></div>
 <label style={{display:"block",fontSize:12,margin:"12px 0 6px"}}>URL foto referensi (opsional, pisahkan baris atau koma)</label><textarea value={imageUrls} onChange={e=>setImageUrls(e.target.value)} placeholder="https://...jpg" style={{width:"100%",minHeight:65,padding:12,borderRadius:8,background:"#151b25",color:"#fff",border:"1px solid #344052"}}/>
 <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,marginTop:12}}><input type="checkbox" checked={generateAudio} onChange={e=>setGenerateAudio(e.target.checked)}/> Generate audio</label>
 <button onClick={generate} disabled={busy||!health?.configured} style={{width:"100%",marginTop:15,padding:14,border:0,borderRadius:9,background:"#b8a5ff",color:"#161222",fontWeight:700,opacity:busy||!health?.configured?0.55:1}}>{busy?"Mengirim...":"Generate melalui Doubao Pool"}</button>
 {notice&&<p style={{fontSize:12,color:"#e7c98d",lineHeight:1.6}}>{notice}</p>}
 {job&&<div style={{marginTop:12,padding:12,border:"1px solid #344052",borderRadius:9,fontSize:12}}><b>Status: {job.status}</b><div style={{color:"#929eaf",marginTop:5}}>Task ID: {job.id}</div>{job.error&&<p style={{color:"#ff9da6"}}>{job.error}</p>}{job.videoUrl&&<video src={job.videoUrl} controls playsInline style={{width:"100%",marginTop:12,borderRadius:8}}/>}</div>}
 </section>
  <p style={{fontSize:11,color:"#788496",lineHeight:1.7,marginTop:18}}>Pool ini menggunakan API resmi Ark. Pemilihan akun bergiliran dan failover hanya untuk rate limit/5xx; tidak menggandakan request yang sudah diterima dan tidak mengakali kuota harian platform. Tarif, ketersediaan model, dan batas akun tetap mengikuti konsol Ark.</p>
 </div></main>;
}
