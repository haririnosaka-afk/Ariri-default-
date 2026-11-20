import { NextRequest, NextResponse } from "next/server";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){
let base=process.env.DOLA_POOL_BASE_URL||"";while(base.endsWith("/"))base=base.slice(0,-1);const key=process.env.DOLA_POOL_API_KEY;
if(!base||!key)return NextResponse.json({error:"Dola Pool belum dikonfigurasi."},{status:503});
const id=req.nextUrl.searchParams.get("id");if(!id)return NextResponse.json({error:"Task ID diperlukan."},{status:400});
try{const response=await fetch(base+"/v1/videos/"+encodeURIComponent(id),{headers:{Authorization:"Bearer "+key,Accept:"application/json"},cache:"no-store",signal:AbortSignal.timeout(20000)});
const raw=await response.text();let data:any;try{data=raw?JSON.parse(raw):{}}catch{return NextResponse.json({error:"Respons status Dola Pool bukan JSON."},{status:502})}
if(!response.ok)return NextResponse.json({error:"Dola Pool ("+response.status+"): "+String(data?.detail||data?.message||data?.error||raw.slice(0,250))},{status:response.status>=400&&response.status<500?response.status:502});
return NextResponse.json({id,status:String(data.status||"processing").toLowerCase(),videoUrl:data.video_url||data.videoUrl||null,error:data.error||null,progress:data.progress||null,duration:data.duration||data.video_duration||null,model:data.model||null,resolution:data.resolution||null});
}catch(error){return NextResponse.json({error:"Gagal memeriksa tugas: "+(error instanceof Error?error.message:String(error))},{status:502})}}
