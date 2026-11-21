import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase-server";

function adminDb(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Database token belum dikonfigurasi.");return createClient(url,key,{auth:{persistSession:false}})}
async function currentUser(){const s=await supabaseServer();const {data,error}=await s.auth.getUser();if(error||!data.user)throw Object.assign(new Error("Silakan masuk terlebih dahulu."),{status:401});return data.user}
function isAdmin(email?:string){return !!email&&!!process.env.KAZAMA_ADMIN_EMAIL&&email.toLowerCase()===process.env.KAZAMA_ADMIN_EMAIL.toLowerCase()}
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const BASE = (process.env.PRIVATE_ENGINE_URL || "").replace(/\/+$/, "") + "/api/v1";
function headers(){const key=process.env.NEXABOT_API_KEY;if(!key)throw new Error("Engine belum dikonfigurasi. Hubungi administrator KAZAMA AI.");return {"x-api-key":key,"Content-Type":"application/json",Accept:"application/json"};}
async function parse(r:Response){const raw=await r.text();let d:any;try{d=raw?JSON.parse(raw):{};}catch{throw new Error("Respons layanan tidak valid ("+r.status+").");}if(!r.ok||d?.ok===false)throw Object.assign(new Error(String(d?.error||d?.message||"Layanan sedang tidak tersedia ("+r.status+").").replace(/nexabot/ig,"layanan").replace(/https?:\/\/[^\s]+/ig,"")),{status:r.status||502});return d;}
export async function GET(req:NextRequest){
const q=req.nextUrl.searchParams,resource=q.get("resource")||"settings";
if(resource==="settings")return NextResponse.json({configured:Boolean(process.env.NEXABOT_API_KEY)});
let h;try{h=headers()}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e),configured:false},{status:503})}
try{
let url="";
if(resource==="account"){
 const db=adminDb();const [{data:profile,error:pe},{data:ledger,error:le}]=await Promise.all([db.from("profiles").select("id,email,balance,is_admin,created_at").eq("id",user.id).single(),db.from("token_ledger").select("id,amount,kind,description,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30)]);
 if(pe||le)throw new Error("Profil atau dompet belum siap. Pastikan schema Supabase sudah dijalankan.");
 return NextResponse.json({profile,ledger});
}
if(resource==="admin-users"){
 if(!isAdmin(user.email))return NextResponse.json({ok:false,error:"Akses admin ditolak."},{status:403});
 const db=adminDb();const {data,error}=await db.from("profiles").select("id,email,balance,created_at").order("created_at",{ascending:false}).limit(500);
 if(error)throw error;return NextResponse.json({users:data||[]});
}
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
const r=await fetch(url,{headers:h,cache:"no-store",signal:AbortSignal.timeout(30000)});const d=await parse(r);
if(resource==="credit"){const db=adminDb();const {data:wallet,error}=await db.from("profiles").select("balance").eq("id",user.id).single();if(error)throw new Error("Dompet belum dibuat. Jalankan SQL schema Supabase.");return NextResponse.json({credit:wallet.balance,balance:wallet.balance,video_credit_cost:d.video_credit_cost??d.credit_cost,video_credit_costs:d.video_credit_costs,voice_credit_cost:d.voice_credit_cost,image_credit_cost:d.image_credit_cost,clone_credit_cost:d.clone_credit_cost});}
return NextResponse.json(d);
}catch(e){const status=(e as any)?.status||502;return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status})}
}
export async function POST(req:NextRequest){
let h;try{h=headers()}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e),configured:false},{status:503})}
let body:any;try{body=await req.json()}catch{return NextResponse.json({ok:false,error:"Body JSON tidak valid."},{status:400})}
const resource=String(body.resource||"");
const paths:Record<string,string>={generate:"/api",image:"/image",voice:"/voice","voice-clone":"/voice/clone"};
if(!paths[resource])return NextResponse.json({ok:false,error:"Aksi tidak dikenal."},{status:400});
delete body.resource;
if(resource==="generate"&&["t2v","sfv","i2v","r2v","extend"].includes(String(body.mode||""))){body.model="omni_flash";body.duration=15;if(body.mode==="extend")body.resolution=1080;}
try{const r=await fetch(BASE+paths[resource],{method:"POST",headers:h,body:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(resource==="voice"||resource==="image"||resource==="voice-clone"?280000:60000)});const d=await parse(r);return NextResponse.json(d,{status:r.status})}
catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:(e as any)?.status||502})}
}
