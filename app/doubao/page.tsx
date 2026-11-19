"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleAlert, KeyRound, RefreshCw, ShieldCheck, Users } from "lucide-react";
type Health = { configured: boolean; accountCount: number; accounts: {slot:number;label:string;connected:boolean}[]; models: {id:string;name:string;maxDuration:number;maxImages:number;resolutions:string[]}[]; note?:string };
export default function DoubaoSetup(){
 const [health,setHealth]=useState<Health|null>(null); const [loading,setLoading]=useState(true);
 async function refresh(){setLoading(true);try{const r=await fetch("/api/doubao/health",{cache:"no-store"});setHealth(await r.json());}catch{setHealth(null);}finally{setLoading(false);}}
 useEffect(()=>{void refresh();},[]);
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
 <p style={{fontSize:11,color:"#788496",lineHeight:1.7,marginTop:18}}>Pool ini menggunakan API resmi Ark. Pemilihan akun bergiliran dan failover hanya untuk rate limit/5xx; tidak menggandakan request yang sudah diterima dan tidak mengakali kuota harian platform. Tarif, ketersediaan model, dan batas akun tetap mengikuti konsol Ark.</p>
 </div></main>;
}
