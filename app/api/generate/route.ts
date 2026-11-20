import { NextRequest, NextResponse } from "next/server";
export const maxDuration=60;
const MODELS:Record<string,{label:string;min:number;max:number;durations:number[];resolutions:string[]}>={
"seedance-2.0-fast":{label:"Dola Seedance 2.0 Fast",min:5,max:15,durations:[5,10,15],resolutions:["720p"]},
"seedance-2.5":{label:"Dola Seedance 2.5",min:5,max:30,durations:[5,10,30],resolutions:["720p","1080p"]},
"doubao-seedance-2.0-mini":{label:"Doubao Seedance 2.0 Mini",min:4,max:15,durations:[],resolutions:["720p"]},
"doubao-seedance-2.0-fast":{label:"Doubao Seedance 2.0 Fast",min:4,max:15,durations:[],resolutions:["720p"]},
"doubao-seedance-2.0":{label:"Doubao Seedance 2.0",min:4,max:15,durations:[],resolutions:["720p"]},
"doubao-seedance-2.5":{label:"Doubao Seedance 2.5",min:4,max:30,durations:[],resolutions:["720p"]}};
export async function POST(req:NextRequest){
let base=process.env.DOLA_POOL_BASE_URL||"";while(base.endsWith("/"))base=base.slice(0,-1);const key=process.env.DOLA_POOL_API_KEY;
if(!base||!key)return NextResponse.json({error:"Dola Pool belum dikonfigurasi. Tambahkan DOLA_POOL_BASE_URL dan DOLA_POOL_API_KEY di Vercel."},{status:503});
let body:any;try{body=await req.json()}catch{return NextResponse.json({error:"Data permintaan tidak valid."},{status:400})}
const model=String(body.model||"seedance-2.0-fast"),cfg=MODELS[model],prompt=String(body.prompt||"").trim(),duration=Number(body.duration),ratio=String(body.ratio||"16:9"),resolution=String(body.resolution||"720p");
const images=Array.isArray(body.imageUrls)?body.imageUrls.filter((v:unknown)=>typeof v==="string"&&(v.startsWith("https://")||v.startsWith("http://")||v.startsWith("data:image/"))):[];
if(!cfg)return NextResponse.json({error:"Model tidak tersedia."},{status:400});if(!prompt)return NextResponse.json({error:"Prompt wajib diisi."},{status:400});
if(!Number.isInteger(duration)||duration<cfg.min||duration>cfg.max||(cfg.durations.length>0&&!cfg.durations.includes(duration)))return NextResponse.json({error:cfg.label+" mendukung durasi "+(cfg.durations.length?cfg.durations.join("/"):(cfg.min+"–"+cfg.max))+" detik."},{status:400});
if(!["16:9","9:16","1:1","4:3","3:4","21:9"].includes(ratio))return NextResponse.json({error:"Rasio tidak valid."},{status:400});if(!cfg.resolutions.includes(resolution))return NextResponse.json({error:"Resolusi tidak didukung model."},{status:400});if(images.length>30)return NextResponse.json({error:"Maksimal 30 foto referensi."},{status:400});
const size=ratio==="16:9"?"1280x720":ratio==="9:16"?"720x1280":ratio==="1:1"?"1024x1024":ratio==="4:3"?"1440x1080":ratio==="3:4"?"1080x1440":"1680x720";
try{const response=await fetch(base+"/v1/videos/generations",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({model,prompt,duration,size,ratio,resolution,reference_images:images,generate_audio:body.generateAudio===true}),signal:AbortSignal.timeout(55000)});
const raw=await response.text();let data:any;try{data=raw?JSON.parse(raw):{}}catch{return NextResponse.json({error:"Respons Dola Pool bukan JSON.",details:raw.slice(0,250)},{status:502})}
if(!response.ok)return NextResponse.json({error:"Dola Pool ("+response.status+"): "+String(data?.detail||data?.message||data?.error||raw.slice(0,350))},{status:response.status>=400&&response.status<500?response.status:502});
const id=data?.id||data?.task_id||data?.data?.id;if(!id)return NextResponse.json({error:"Dola Pool tidak mengembalikan ID tugas."},{status:502});
return NextResponse.json({ok:true,id:String(id),status:data.status||"queued",model,duration,resolution,ratio,progress:data.progress||null});
}catch(error){return NextResponse.json({error:"Koneksi Dola Pool gagal: "+(error instanceof Error?error.message:String(error))},{status:502})}}
