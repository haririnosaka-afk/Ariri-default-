import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const BASE = "https://nexabot.id/api/v1";
function headers(){const key=process.env.NEXABOT_API_KEY;if(!key)throw new Error("NEXABOT_API_KEY belum diatur di Vercel.");return {"x-api-key":key,"Content-Type":"application/json",Accept:"application/json"};}
async function parse(r:Response){const raw=await r.text();let d:any;try{d=raw?JSON.parse(raw):{};}catch{throw new Error("Respons NexaBot tidak valid ("+r.status+").");}if(!r.ok||d?.ok===false)throw Object.assign(new Error(String(d?.error||d?.message||"NexaBot API gagal ("+r.status+").")),{status:r.status||502});return d;}
export async function GET(req:NextRequest){
const q=req.nextUrl.searchParams,resource=q.get("resource")||"settings";
if(resource==="settings")return NextResponse.json({configured:Boolean(process.env.NEXABOT_API_KEY),provider:"NexaBot",baseUrl:"https://nexabot.id"});if(resource==="members"){try{const r=await fetch(BASE+"/public/members",{cache:"no-store",signal:AbortSignal.timeout(15000)});const d=await r.json();return NextResponse.json(d,{status:r.status})}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:502})}}
let h;try{h=headers()}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e),configured:false},{status:503})}
try{
let url="";
if(resource==="credit")url=BASE+"/api/credit";
else if(resource==="voices")url=BASE+"/voices";
else if(resource==="modes")url=BASE+"/modes";
else if(resource==="image-models")url=BASE+"/image";
else if(resource==="job")url=BASE+"/jobs/"+encodeURIComponent(q.get("id")||"");
else if(resource==="download"){
const id=q.get("id")||"",r=await fetch(BASE+"/jobs/"+encodeURIComponent(id)+"/download",{headers:h,cache:"no-store",signal:AbortSignal.timeout(60000)});
if(!r.ok){const d=await r.text();return NextResponse.json({ok:false,error:d||"Unduhan belum tersedia."},{status:r.status})}
const blob=await r.arrayBuffer();return new NextResponse(blob,{status:200,headers:{"Content-Type":r.headers.get("content-type")||"video/mp4","Content-Disposition":r.headers.get("content-disposition")||'attachment; filename="kazama-result"',"Cache-Control":"no-store"}});
}else return NextResponse.json({ok:false,error:"Resource tidak dikenal."},{status:400});
const r=await fetch(url,{headers:h,cache:"no-store",signal:AbortSignal.timeout(30000)});const d=await parse(r);return NextResponse.json(d);
}catch(e){const status=(e as any)?.status||502;return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status})}
}
export async function POST(req:NextRequest){
let h;try{h=headers()}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e),configured:false},{status:503})}
let body:any;try{body=await req.json()}catch{return NextResponse.json({ok:false,error:"Body JSON tidak valid."},{status:400})}
const resource=String(body.resource||"");
const paths:Record<string,string>={generate:"/api",image:"/image",voice:"/voice","voice-clone":"/voice/clone"};
if(!paths[resource])return NextResponse.json({ok:false,error:"Aksi tidak dikenal."},{status:400});
delete body.resource;
try{const r=await fetch(BASE+paths[resource],{method:"POST",headers:h,body:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(resource==="voice"||resource==="image"||resource==="voice-clone"?280000:60000)});const d=await parse(r);return NextResponse.json(d,{status:r.status})}
catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:(e as any)?.status||502})}
}
