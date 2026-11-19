"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,CheckCircle2,CircleAlert,KeyRound,RefreshCw,ShieldCheck,Users} from "lucide-react";
type Health={configured:boolean;accountCount:number;accounts:{slot:number;label:string;connected:boolean}[];models:{id:string;name:string;maxDuration:number;maxImages:number;resolutions:string[]}[]};
type Job={id:string;slot:number;status:string;videoUrl?:string;lastFrameUrl?:string;error?:string};
const field:React.CSSProperties={width:"100%",padding:11,borderRadius:8,background:"#151b25",color:"#fff",border:"1px solid #344052",marginTop:5};
const label:React.CSSProperties={display:"block",fontSize:12,margin:"13px 0 5px",color:"#d5dbea"};
export default function DoubaoSetup(){
 const[health,setHealth]=useState<Health|null>(null),[loading,setLoading]=useState(true),[accessCode,setAccessCode]=useState("");
 const[prompt,setPrompt]=useState(""),[model,setModel]=useState("doubao-seedance-2-5-260628"),[mode,setMode]=useState("reference"),[taskType,setTaskType]=useState("auto");
 const[duration,setDuration]=useState("30"),[resolution,setResolution]=useState("720p"),[ratio,setRatio]=useState("16:9");
 const[imageUrls,setImageUrls]=useState(""),[videoUrls,setVideoUrls]=useState(""),[audioUrls,setAudioUrls]=useState("");
 const[generateAudio,setGenerateAudio]=useState(true),[watermark,setWatermark]=useState(false),[returnLastFrame,setReturnLastFrame]=useState(false),[outputFormat,setOutputFormat]=useState("mp4");
 const[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[job,setJob]=useState<Job|null>(null);
 const flash=model==="doubao-seedance-2-5-flash-261115",maxImages=flash?10:30,maxVideos=flash?5:10,maxAudios=flash?5:10;
 const split=(s:string)=>s.split(/[\n,]+/).map(x=>x.trim()).filter(Boolean);
 async function refresh(){setLoading(true);try{const r=await fetch("/api/doubao/health",{cache:"no-store"});setHealth(await r.json())}catch{setHealth(null)}finally{setLoading(false)}}
 useEffect(()=>{void refresh()},[]);
 useEffect(()=>{if(!job?.id||job.videoUrl||["failed","error","cancelled","expired","succeeded"].includes(job.status.toLowerCase()))return;const timer=setInterval(async()=>{try{const r=await fetch("/api/doubao/status?id="+encodeURIComponent(job.id)+"&slot="+job.slot,{headers:{"x-kazama-pool-code":accessCode}});const d=await r.json();setJob(p=>p?{...p,status:String(d.status||p.status),videoUrl:d.videoUrl||p.videoUrl,lastFrameUrl:d.lastFrameUrl||p.lastFrameUrl,error:d.error||p.error}:p)}catch{}},8000);return()=>clearInterval(timer)},[job?.id,job?.slot,job?.status,job?.videoUrl,accessCode]);
 function updateMode(v:string){setMode(v);if(v!=="reference"){setTaskType("reference");setRatio("adaptive")}else{setTaskType("auto")}}
 async function generate(){
  const images=split(imageUrls),videos=split(videoUrls),audios=split(audioUrls);
  if(!prompt.trim()&&!images.length&&!videos.length&&!audios.length){setNotice("Masukkan prompt atau bahan referensi.");return}
  if(mode==="first"&&images.length!==1){setNotice("Mode frame pertama perlu tepat 1 URL foto.");return}
  if(mode==="first_last"&&images.length!==2){setNotice("Mode frame awal+akhir perlu tepat 2 URL foto.");return}
  if(mode==="reference"&&(images.length>maxImages||videos.length>maxVideos||audios.length>maxAudios)){setNotice("Jumlah referensi melebihi batas model.");return}
  setBusy(true);setNotice("Mengirim tugas ke Seedance...");setJob(null);
  try{const r=await fetch("/api/doubao/generate",{method:"POST",headers:{"Content-Type":"application/json","x-kazama-pool-code":accessCode},body:JSON.stringify({model,mode,taskType,prompt,duration:Number(duration),resolution,ratio,imageUrls:images,videoUrls:videos,audioUrls:audios,generateAudio,watermark,returnLastFrame,outputFormat})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Generate gagal.");setJob({id:d.id,slot:d.providerSlot,status:d.status||"queued"});setNotice("Task diterima. Status akan diperbarui otomatis.")}catch(e){setNotice(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 const example=['[','  {','    "label": "Ark 1",','    "apiKey": "ISI_API_KEY_ARK",','    "baseUrl": "https://ark.cn-beijing.volces.com/api/v3"','  }',']'].join("\n");
 return <main style={{minHeight:"100vh",background:"#090b10",color:"#f1f3f8",fontFamily:"Arial,sans-serif",padding:"24px 16px"}}><div style={{maxWidth:900,margin:"0 auto"}}>
 <Link href="/" style={{color:"#b8a5ff",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:8,fontSize:13}}><ArrowLeft size={16}/> Kembali ke KAZAMA AI</Link>
 <div style={{marginTop:26,display:"flex",alignItems:"center",gap:12}}><div style={{background:"#29233e",padding:12,borderRadius:12,color:"#c5b7ff"}}><Users/></div><div><div style={{fontSize:11,letterSpacing:2,color:"#b8a5ff"}}>KAZAMA AI · SEEDANCE STUDIO</div><h1 style={{fontSize:29,margin:"7px 0 0"}}>Seedance 2.5 Generator</h1></div></div>
 <p style={{color:"#9aa4b5",lineHeight:1.7,fontSize:14}}>Generator multimodal untuk teks, foto, video, dan audio referensi. Input bahan menggunakan URL HTTPS publik yang dapat diakses Ark.</p>
 <section style={{marginTop:18,padding:18,border:"1px solid #293141",borderRadius:14,background:"#10141c"}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><b>Status API Account Pool</b><button onClick={refresh} disabled={loading} style={{background:"#242039",color:"#d8ceff",border:"1px solid #55477e",borderRadius:8,padding:"8px 11px",display:"flex",alignItems:"center",gap:7}}><RefreshCw size={14}/>{loading?"Memeriksa":"Perbarui"}</button></div>
 {health?.configured?<p style={{color:"#72e2c0",fontSize:13}}><CheckCircle2 size={15} style={{verticalAlign:"middle"}}/> {health.accountCount} API Key tersimpan di server</p>:<p style={{color:"#e8c37b",fontSize:13}}><CircleAlert size={15} style={{verticalAlign:"middle"}}/> API Key belum dipasang</p>}
 <label style={label}>Kode akses privat KAZAMA Pool</label><input type="password" value={accessCode} onChange={e=>setAccessCode(e.target.value)} placeholder="Masukkan DOUBAO_POOL_ACCESS_CODE" style={field}/>
 <details style={{marginTop:14,color:"#c3cbd8",fontSize:13}}><summary style={{cursor:"pointer",color:"#c5b7ff"}}><KeyRound size={14} style={{verticalAlign:"middle"}}/> Cara menghubungkan API Ark</summary><ol style={{lineHeight:1.8,paddingLeft:20}}><li>Buat API Key Ark di <a href="https://ark.volcengine.com/region:cn-beijing/apikey" target="_blank" rel="noreferrer" style={{color:"#b8a5ff"}}>halaman API Key</a>.</li><li>Vercel → Project kazama-ai → Settings → Environment Variables.</li><li>Tambahkan <code>DOUBAO_ARK_API_KEYS</code> dengan format berikut, lalu Save dan Redeploy.</li><li>Tambahkan <code>DOUBAO_POOL_ACCESS_CODE</code> berisi kode privat pilihanmu.</li></ol><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",background:"#090e16",padding:12,borderRadius:8,fontSize:11,color:"#bdebd9"}}>{example}</pre><div style={{display:"flex",gap:8,padding:10,background:"#1b202a",borderRadius:8,color:"#e7c98d",fontSize:12}}><ShieldCheck size={17}/><span>Gunakan API Key Ark, bukan password Doubao, OTP, cookie, atau token sesi. Jangan kirim API Key ke chat.</span></div></details>
 </section>
 <section style={{marginTop:16,padding:18,border:"1px solid #514477",borderRadius:14,background:"#111522"}}>
 <h2 style={{fontSize:18,margin:"0 0 12px"}}>Pengaturan video</h2>
 <label style={label}>Model Seedance</label><select value={model} onChange={e=>{const f=e.target.value==="doubao-seedance-2-5-flash-261115";setModel(e.target.value);if(f&&["1080p","4k"].includes(resolution))setResolution("720p")}} style={field}><option value="doubao-seedance-2-5-260628">Seedance 2.5 Standard · sampai 30 foto · 4K</option><option value="doubao-seedance-2-5-flash-261115">Seedance 2.5 Flash · sampai 10 foto · 720p</option></select>
 <label style={label}>Mode input</label><select value={mode} onChange={e=>updateMode(e.target.value)} style={field}><option value="reference">Multimodal reference (foto + video + audio)</option><option value="first">Image-to-video · frame pertama</option><option value="first_last">Image-to-video · frame pertama + terakhir</option></select>
 <label style={label}>Jenis tugas multimodal</label><select value={taskType} onChange={e=>{setTaskType(e.target.value);if(["edit","extend"].includes(e.target.value))setRatio("adaptive");if(e.target.value==="edit")setDuration("-1")}} disabled={mode!=="reference"} style={field}><option value="auto">Otomatis · model menentukan</option><option value="reference">Reference · buat video baru dari referensi</option><option value="edit">Edit · ubah video referensi</option><option value="extend">Extend · perpanjang video referensi</option></select>
 <label style={label}>Prompt / instruksi adegan</label><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Jelaskan gerakan, karakter, suasana, urutan adegan, kamera, dan audio..." style={{...field,minHeight:110,lineHeight:1.5}}/>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:10}}>
 <div><label style={label}>Durasi</label><select value={duration} onChange={e=>setDuration(e.target.value)} style={field}><option value="-1">Otomatis (model memilih)</option>{[4,5,6,8,10,12,15,20,25,30].map(n=><option key={n} value={n}>{n} detik</option>)}</select></div>
 <div><label style={label}>Resolusi</label><select value={resolution} onChange={e=>setResolution(e.target.value)} style={field}>{(flash?["480p","720p"]:["480p","720p","1080p","4k"]).map(n=><option key={n}>{n}</option>)}</select></div>
 <div><label style={label}>Rasio video</label><select value={ratio} onChange={e=>setRatio(e.target.value)} disabled={mode!=="reference"||taskType==="edit"||taskType==="extend"} style={field}>{["adaptive","16:9","9:16","1:1","4:3","3:4","21:9"].map(n=><option key={n}>{n}</option>)}</select></div>
 <div><label style={label}>Format hasil</label><select value={outputFormat} onChange={e=>setOutputFormat(e.target.value)} style={field}><option value="mp4">MP4 · kompatibel</option><option value="mov">MOV · editing profesional</option></select></div>
 </div>
 <div style={{marginTop:14,padding:12,background:"#171d29",borderRadius:9,fontSize:12,color:"#aab5c6",lineHeight:1.6}}>Batas input {flash?"Flash":"Standard"}: {maxImages} foto, {maxVideos} video, {maxAudios} audio. Foto/video/audio harus berupa URL HTTPS publik. Edit membutuhkan video referensi, rasio adaptive, dan durasi otomatis.</div>
 <label style={label}>URL foto referensi · satu URL per baris</label><textarea value={imageUrls} onChange={e=>setImageUrls(e.target.value)} placeholder={"https://.../foto1.jpg\nhttps://.../foto2.jpg"} style={{...field,minHeight:78}}/>
 <label style={label}>URL video referensi · MP4/MOV</label><textarea value={videoUrls} onChange={e=>setVideoUrls(e.target.value)} placeholder={"https://.../video.mp4"} style={{...field,minHeight:62}}/>
 <label style={label}>URL audio referensi · WAV/MP3</label><textarea value={audioUrls} onChange={e=>setAudioUrls(e.target.value)} placeholder={"https://.../audio.mp3"} style={{...field,minHeight:62}}/>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10,marginTop:14,fontSize:12}}>
 <label style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" checked={generateAudio} onChange={e=>setGenerateAudio(e.target.checked)}/> Buat audio sinkron (suara, efek, musik)</label>
 <label style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" checked={watermark} onChange={e=>setWatermark(e.target.checked)}/> Tambahkan watermark AI</label>
 <label style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" checked={returnLastFrame} onChange={e=>setReturnLastFrame(e.target.checked)}/> Minta gambar frame terakhir</label>
 </div>
 <button onClick={generate} disabled={busy||!health?.configured||!accessCode} style={{width:"100%",marginTop:18,padding:14,border:0,borderRadius:9,background:"#b8a5ff",color:"#161222",fontWeight:700,opacity:busy||!health?.configured||!accessCode?0.5:1}}>{busy?"Mengirim...":"Generate Seedance"}</button>
 {notice&&<p style={{fontSize:12,color:"#e7c98d",lineHeight:1.6}}>{notice}</p>}
 {job&&<div style={{marginTop:14,padding:13,border:"1px solid #344052",borderRadius:9,fontSize:12}}><b>Status: {job.status}</b><div style={{color:"#929eaf",marginTop:5}}>Task ID: {job.id}</div>{job.error&&<p style={{color:"#ff9da6"}}>{job.error}</p>}{job.videoUrl&&<><video src={job.videoUrl} controls playsInline style={{width:"100%",marginTop:12,borderRadius:8}}/><a href={job.videoUrl} target="_blank" rel="noreferrer" style={{display:"inline-block",marginTop:9,color:"#c5b7ff"}}>Buka / simpan video</a></>}{job.lastFrameUrl&&<div><p>Frame terakhir</p><img src={job.lastFrameUrl} alt="Frame terakhir" style={{maxWidth:"100%",borderRadius:8}}/></div>}</div>}
 </section>
 <p style={{fontSize:11,color:"#788496",lineHeight:1.7,marginTop:18}}>KAZAMA menggunakan API resmi Volcengine Ark. Pengaturan yang tidak didukung untuk kombinasi model/mode tertentu akan ditolak. Tarif, akses model, kuota, dan ketersediaan mengikuti akun Ark.</p>
 </div></main>
}