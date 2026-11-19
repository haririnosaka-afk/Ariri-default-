import {NextRequest,NextResponse} from "next/server";
export const maxDuration=60;
const MODELS:Record<string,{name:string;minDuration:number;maxDuration:number;resolutions:string[];maxImages:number}>={
 "doubao-seedance-2-0-260128":{name:"Seedance 2.0",minDuration:5,maxDuration:15,resolutions:["480p","720p","1080p","4k"],maxImages:9},
 "doubao-seedance-2-0-fast-260128":{name:"Seedance 2.0 Fast",minDuration:5,maxDuration:15,resolutions:["480p","720p"],maxImages:9},
 "doubao-seedance-2-0-mini-260615":{name:"Seedance 2.0 Mini",minDuration:5,maxDuration:15,resolutions:["480p","720p"],maxImages:9},
 "doubao-seedance-2-5-260628":{name:"Seedance 2.5",minDuration:4,maxDuration:30,resolutions:["480p","720p","1080p"],maxImages:30}
};
export async function POST(req:NextRequest){
 const key=process.env.RELAYROUTER_API_KEY;
 if(!key)return NextResponse.json({error:"API key RelayRouter belum dipasang di Vercel."},{status:503});
 const b=await req.json();const model=String(b.model||"doubao-seedance-2-5-260628");const spec=MODELS[model];
 if(!spec)return NextResponse.json({error:"Model Seedance tidak dikenal."},{status:400});
 const prompt=String(b.prompt||"").trim();const duration=Number(b.duration);const ratio=String(b.ratio||"16:9");const resolution=String(b.resolution||"720p");
 const urls=Array.isArray(b.imageUrls)?b.imageUrls.filter((x:any)=>typeof x==="string"&&x.startsWith("http")):[];
 if(!prompt)return NextResponse.json({error:"Prompt wajib diisi."},{status:400});
 if(!Number.isInteger(duration)||duration<spec.minDuration||duration>spec.maxDuration)return NextResponse.json({error:spec.name+" mendukung durasi 4–"+spec.maxDuration+" detik."},{status:400});
 if(urls.length>spec.maxImages)return NextResponse.json({error:spec.name+" maksimal "+spec.maxImages+" foto referensi."},{status:400});
 if(!["16:9","4:3","1:1","3:4","9:16","21:9","adaptive"].includes(ratio))return NextResponse.json({error:"Rasio tidak valid."},{status:400});
 if(!spec.resolutions.includes(resolution))return NextResponse.json({error:"Resolusi "+resolution+" tidak didukung oleh "+spec.name+"."},{status:400});
 const content:any[]=[{type:"text",text:prompt},...urls.map((url:string)=>({type:"image_url",role:"reference_image",image_url:{url}}))];
 const payload:any={model,content,duration,generate_audio:!!b.generateAudio,output_format:"mp4",ratio,resolution,watermark:false};
  if(model==="doubao-seedance-2-5-260628")payload.omni_reference_task_type="auto";
 try{
  const r=await fetch("https://api.relayrouter.ai/api/v3/contents/generations/tasks",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const d=await r.json();if(!r.ok)return NextResponse.json({error:d?.message||d?.error?.message||"RelayRouter menolak permintaan.",details:d},{status:r.status});
  const taskId=d.id||d.task_id||d.data?.id||d.data?.task_id;if(!taskId)return NextResponse.json({error:"RelayRouter tidak mengembalikan task ID.",details:d},{status:502});
  return NextResponse.json({ok:true,id:taskId,model,status:d.status||d.data?.status||"queued",raw:d});
 }catch{return NextResponse.json({error:"Gagal menghubungi RelayRouter."},{status:502});}
}