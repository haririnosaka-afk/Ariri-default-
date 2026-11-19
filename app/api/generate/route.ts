import {NextRequest,NextResponse} from "next/server";

export const maxDuration=60;

const MODEL={id:"doubao-seedance-2-5-260628",name:"Seedance 2.5",minDuration:4,maxDuration:30,resolutions:["480p","720p","1080p"],maxImages:30};

async function readBody(response:Response){
 const raw=await response.text();
 try{return {data:raw?JSON.parse(raw):{},raw};}
 catch{return {data:null,raw};}
}

export async function POST(req:NextRequest){
 const key=process.env.RELAYROUTER_API_KEY;
 if(!key)return NextResponse.json({error:"API key RelayRouter belum dipasang di Vercel (RELAYROUTER_API_KEY)."}, {status:503});
 let body:any;
 try{body=await req.json();}catch{return NextResponse.json({error:"Data permintaan tidak valid. Muat ulang halaman lalu coba lagi."},{status:400});}

 const model=String(body.model||MODEL.id);
 if(model!==MODEL.id){
  return NextResponse.json({error:"Saat ini endpoint video resmi RelayRouter yang terdokumentasi untuk KAZAMA adalah Seedance 2.5. Model lain tidak akan dikirim ke endpoint yang salah."},{status:400});
 }
 const prompt=String(body.prompt||"").trim();
 const duration=Number(body.duration);
 const ratio=String(body.ratio||"16:9");
 const resolution=String(body.resolution||"720p");
 const urls=Array.isArray(body.imageUrls)?body.imageUrls.filter((value:any)=>typeof value==="string"&&/^https?:\/\//i.test(value)):[];
 if(!prompt)return NextResponse.json({error:"Prompt wajib diisi."},{status:400});
 if(!Number.isInteger(duration)||duration<MODEL.minDuration||duration>MODEL.maxDuration)return NextResponse.json({error:"Seedance 2.5 mendukung durasi 4–30 detik."},{status:400});
 if(urls.length>MODEL.maxImages)return NextResponse.json({error:"Seedance 2.5 maksimal 30 foto referensi."},{status:400});
 if(!["16:9","4:3","1:1","3:4","9:16","21:9","adaptive"].includes(ratio))return NextResponse.json({error:"Rasio tidak valid."},{status:400});
 if(!MODEL.resolutions.includes(resolution))return NextResponse.json({error:"Resolusi harus 480p, 720p, atau 1080p."},{status:400});

 const content:any[]=[{type:"text",text:prompt},...urls.map((url:string)=>({type:"image_url",role:"reference_image",image_url:{url}}))];
 const payload={model:MODEL.id,content,duration,generate_audio:!!body.generateAudio,output_format:"mp4",ratio,resolution,watermark:false};
 try{
  const response=await fetch("https://api.relayrouter.ai/api/v3/contents/generations/tasks",{
   method:"POST",
   headers:{Authorization:"Bearer "+key,"Content-Type":"application/json",Accept:"application/json"},
   body:JSON.stringify(payload),
   signal:AbortSignal.timeout(55000)
  });
  const {data,raw}=await readBody(response);
  if(!response.ok){
   const message=data?.message||data?.error?.message||data?.error||data?.msg||raw.slice(0,700)||"RelayRouter menolak permintaan.";
   console.error("[KAZAMA generate] RelayRouter rejected request",response.status,message);
   return NextResponse.json({error:"RelayRouter ("+response.status+"): "+String(message),details:data||raw.slice(0,700)},{status:response.status>=400&&response.status<500?response.status:502});
  }
  if(!data){
   console.error("[KAZAMA generate] non-JSON response",response.status,raw.slice(0,500));
   return NextResponse.json({error:"RelayRouter mengirim respons bukan JSON. Periksa endpoint dan status layanan."},{status:502});
  }
  const taskId=data.id||data.task_id||data.data?.id||data.data?.task_id;
  if(!taskId){
   console.error("[KAZAMA generate] missing task id",JSON.stringify(data).slice(0,700));
   return NextResponse.json({error:"RelayRouter merespons tetapi tidak mengirim Task ID.",details:data},{status:502});
  }
  return NextResponse.json({ok:true,id:String(taskId),model:MODEL.id,status:data.status||data.data?.status||"queued"});
 }catch(error){
  const message=error instanceof Error?error.message:String(error);
  console.error("[KAZAMA generate] request failed",message);
  return NextResponse.json({error:"Koneksi server KAZAMA ke RelayRouter gagal: "+message},{status:502});
 }
}