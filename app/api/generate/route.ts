import {NextRequest,NextResponse} from "next/server";
export const maxDuration=60;
async function readBody(response:Response){const raw=await response.text();try{return {data:raw?JSON.parse(raw):{},raw};}catch{return {data:null,raw};}}
function collectModels(payload:any):any[]{if(Array.isArray(payload))return payload;for(const key of ["data","models","result"]){const value=payload?.[key];if(Array.isArray(value))return value;if(value&&typeof value==="object")for(const nested of ["data","models","items"])if(Array.isArray(value[nested]))return value[nested];}return [];}
export async function POST(req:NextRequest){
 const key=process.env.RELAYROUTER_API_KEY;
 if(!key)return NextResponse.json({error:"API key RelayRouter belum dipasang di Vercel (RELAYROUTER_API_KEY)."}, {status:503});
 let body:any;try{body=await req.json();}catch{return NextResponse.json({error:"Data permintaan tidak valid."},{status:400});}
 const model=String(body.model||"").trim();
 if(!model||!/seedance/i.test(model))return NextResponse.json({error:"Pilih model Seedance dari katalog RelayRouter."},{status:400});
 try{
  const cr=await fetch("https://api.relayrouter.ai/v1/models",{headers:{Authorization:"Bearer "+key,Accept:"application/json"},cache:"no-store",signal:AbortSignal.timeout(12000)});
  const raw=await cr.text();let catalog:any={};try{catalog=raw?JSON.parse(raw):{};}catch{}
  if(!cr.ok)return NextResponse.json({error:"Gagal membaca katalog RelayRouter (HTTP "+cr.status+"). "+raw.slice(0,250)},{status:502});
  const ids=collectModels(catalog).map((x:any)=>typeof x==="string"?x:String(x?.id||x?.name||""));
  if(!ids.includes(model))return NextResponse.json({error:"Model tidak tersedia untuk API key ini. Perbarui katalog model."},{status:400});
 }catch(e){return NextResponse.json({error:"Pemeriksaan katalog gagal: "+(e instanceof Error?e.message:String(e))},{status:502});}
 const prompt=String(body.prompt||"").trim(),duration=Number(body.duration),ratio=String(body.ratio||"16:9"),resolution=String(body.resolution||"720p"),outputFormat=String(body.outputFormat||"mp4"),referenceMode=String(body.omniReferenceTaskType||"auto"),watermark=!!body.watermark;
 const urls=Array.isArray(body.imageUrls)?body.imageUrls.filter((v:any)=>typeof v==="string"&&/^https?:\/\//i.test(v)):[];
 const is25=/2[-_.]?5|2\.5/i.test(model),maxDuration=is25?30:15;
 if(!prompt)return NextResponse.json({error:"Prompt wajib diisi."},{status:400});
 if(!Number.isInteger(duration)||!(duration===-1||(duration>=4&&duration<=maxDuration)))return NextResponse.json({error:"Durasi untuk model ini harus 4–"+maxDuration+" detik atau Auto."},{status:400});
 if(urls.length>30)return NextResponse.json({error:"KAZAMA menerima maksimal 30 foto; batas model sebenarnya tetap mengikuti validasi RelayRouter."},{status:400});
 if(!["16:9","4:3","1:1","3:4","9:16","21:9","adaptive"].includes(ratio))return NextResponse.json({error:"Rasio tidak valid."},{status:400});
 if(!["480p","720p","1080p","4k"].includes(resolution))return NextResponse.json({error:"Resolusi tidak valid."},{status:400});
 if(!["mp4","mov"].includes(outputFormat))return NextResponse.json({error:"Format keluaran harus MP4 atau MOV."},{status:400});
 if(!["auto","reference"].includes(referenceMode))return NextResponse.json({error:"Mode referensi tidak valid."},{status:400});
 const content:any[]=[{type:"text",text:prompt},...urls.map((url:string)=>({type:"image_url",role:"reference_image",image_url:{url}}))];
 const payload={model,content,duration,generate_audio:!!body.generateAudio,omni_reference_task_type:referenceMode,output_format:outputFormat,ratio,resolution,watermark};
 try{
  const response=await fetch("https://api.relayrouter.ai/api/v3/contents/generations/tasks",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(55000)});
  const {data,raw}=await readBody(response);
  if(!response.ok){const message=data?.message||data?.error?.message||data?.error||data?.msg||raw.slice(0,700)||"RelayRouter menolak permintaan.";console.error("[KAZAMA generate]",response.status,message);return NextResponse.json({error:"RelayRouter ("+response.status+"): "+String(message),details:data||raw.slice(0,700)},{status:response.status>=400&&response.status<500?response.status:502});}
  if(!data)return NextResponse.json({error:"RelayRouter mengirim respons bukan JSON."},{status:502});
  const taskId=data.id||data.task_id||data.data?.id||data.data?.task_id;
  if(!taskId)return NextResponse.json({error:"RelayRouter tidak mengirim Task ID.",details:data},{status:502});
  return NextResponse.json({ok:true,id:String(taskId),model,status:data.status||data.data?.status||"queued"});
 }catch(e){const message=e instanceof Error?e.message:String(e);console.error("[KAZAMA generate]",message);return NextResponse.json({error:"Koneksi ke RelayRouter gagal: "+message},{status:502});}
}