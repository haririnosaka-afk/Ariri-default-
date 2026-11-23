import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase-server";
export const dynamic="force-dynamic";
export const maxDuration=300;
const BASE=(process.env.PRIVATE_ENGINE_URL||"").replace(/\/+$/,"")+"/api/v1";
function adminDb(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Database token belum dikonfigurasi.");return createClient(url,key,{auth:{persistSession:false}})}
async function currentUser(){const s=await supabaseServer();const {data,error}=await s.auth.getUser();if(error||!data.user)throw Object.assign(new Error("Silakan masuk terlebih dahulu."),{status:401});return data.user}
function isAdmin(email?:string){return !!email&&!!process.env.KAZAMA_ADMIN_EMAIL&&email.toLowerCase()===process.env.KAZAMA_ADMIN_EMAIL.toLowerCase()}
function headers(){const key=process.env.NEXABOT_API_KEY;if(!key)throw new Error("Engine belum dikonfigurasi. Hubungi administrator KAZAMA AI.");return {"x-api-key":key,"Content-Type":"application/json",Accept:"application/json"}}
async function parse(r:Response){const raw=await r.text();let d:any;try{d=raw?JSON.parse(raw):{}}catch{throw new Error("Respons layanan tidak valid ("+r.status+").")}if(!r.ok||d?.ok===false)throw Object.assign(new Error(String(d?.error||d?.message||"Layanan sedang tidak tersedia ("+r.status+").").replace(/nexabot/ig,"layanan")),{status:r.status||502});return d}
export async function GET(req:NextRequest){
 let user:any;try{user=await currentUser()}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:(e as any)?.status||401})}
 const q=req.nextUrl.searchParams,resource=q.get("resource")||"settings";
 try{
  if(resource==="settings")return NextResponse.json({configured:Boolean(process.env.NEXABOT_API_KEY),email:user.email,is_admin:isAdmin(user.email)});
  if(resource==="account"){const db=adminDb();const [{data:profile,error:pe},{data:ledger,error:le}]=await Promise.all([db.from("profiles").select("id,email,balance,created_at").eq("id",user.id).single(),db.from("token_ledger").select("id,amount,kind,description,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30)]);if(pe||le)throw new Error("Dompet belum siap. Admin perlu menjalankan schema Supabase.");return NextResponse.json({profile:{...profile,balance:Number(profile.balance)/2},ledger:(ledger||[]).map((x:any)=>({...x,amount:Number(x.amount)/2}))})}
  if(resource==="notifications"){const {data,error}=await adminDb().from("notifications").select("id,title,message,kind,is_read,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50);if(error)throw error;return NextResponse.json({notifications:data||[]})}
  if(resource==="admin-users"){if(!isAdmin(user.email))return NextResponse.json({ok:false,error:"Akses admin ditolak."},{status:403});const {data,error}=await adminDb().from("profiles").select("id,email,balance,created_at").order("created_at",{ascending:false}).limit(500);if(error)throw error;return NextResponse.json({users:(data||[]).map((x:any)=>({...x,balance:Number(x.balance)/2}))})}
  const h=headers();let url="";
  if(resource==="credit")url=BASE+"/api/credit";
  else if(resource==="voices")url=BASE+"/voices";
  else if(resource==="modes")url=BASE+"/modes";
  else if(resource==="image-models")url=BASE+"/image";
  else if(resource==="job")url=BASE+"/jobs/"+encodeURIComponent(q.get("id")||"");
  else if(resource==="download"){const id=q.get("id")||"",r=await fetch(BASE+"/jobs/"+encodeURIComponent(id)+"/download",{headers:h,cache:"no-store",signal:AbortSignal.timeout(60000)});if(!r.ok)return NextResponse.json({ok:false,error:await r.text()||"Unduhan belum tersedia."},{status:r.status});return new NextResponse(await r.arrayBuffer(),{status:200,headers:{"Content-Type":r.headers.get("content-type")||"video/mp4","Content-Disposition":r.headers.get("content-disposition")||'attachment; filename="kazama-result"',"Cache-Control":"no-store"}})}
  else return NextResponse.json({ok:false,error:"Resource tidak dikenal."},{status:400});
  const d=await parse(await fetch(url,{headers:h,cache:"no-store",signal:AbortSignal.timeout(30000)}));
  if(resource==="credit"){const {data:wallet,error}=await adminDb().from("profiles").select("balance").eq("id",user.id).single();if(error)throw new Error("Dompet belum dibuat. Jalankan schema Supabase.");return NextResponse.json({credit:Number(wallet.balance)/2,balance:Number(wallet.balance)/2,video_credit_cost:d.video_credit_cost??d.credit_cost,video_credit_costs:d.video_credit_costs,voice_credit_cost:d.voice_credit_cost,image_credit_cost:d.image_credit_cost,clone_credit_cost:d.clone_credit_cost})}
  return NextResponse.json(d);
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:(e as any)?.status||502})}
}
export async function POST(req:NextRequest){
 let user:any;try{user=await currentUser()}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:(e as any)?.status||401})}
 let body:any;try{body=await req.json()}catch{return NextResponse.json({ok:false,error:"Body JSON tidak valid."},{status:400})}
 const resource=String(body.resource||"");
 if(resource==="refund"){const reference=String(body.reference||""),jobId=String(body.job_id||"");if(!reference||!jobId)return NextResponse.json({ok:false,error:"Referensi tugas tidak valid."},{status:400});try{const db=adminDb();const {data:linked,error:linkError}=await db.from("generation_jobs").select("provider_job_id").eq("user_id",user.id).eq("token_reference",reference).eq("provider_job_id",jobId).single();if(linkError||!linked)return NextResponse.json({ok:false,error:"Tugas tidak cocok dengan transaksi akun ini."},{status:403});const check=await fetch(BASE+"/jobs/"+encodeURIComponent(jobId),{headers:headers(),cache:"no-store",signal:AbortSignal.timeout(30000)});const data=await parse(check);const job=data.job||data;const status=String(job.status||job.state||"").toLowerCase();if(!["failed","error","cancelled","canceled"].includes(status))return NextResponse.json({ok:false,error:"Refund hanya tersedia jika provider menyatakan tugas gagal."},{status:409});const {data:balance,error}=await db.rpc("refund_token",{p_user_id:user.id,p_reference_id:reference,p_reason:"Generation job "+status});if(error)throw error;return NextResponse.json({ok:true,balance})}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500})}}
 if(resource==="admin-send-notification"){
  if(!isAdmin(user.email))return NextResponse.json({ok:false,error:"Akses admin ditolak."},{status:403});
  const title=String(body.title||"").trim(),message=String(body.message||"").trim(),email=String(body.email||"").trim().toLowerCase();
  if(!title||title.length>100||!message||message.length>2000)return NextResponse.json({ok:false,error:"Judul (maksimal 100 karakter) dan pesan (maksimal 2.000 karakter) wajib diisi."},{status:400});
  try{const db=adminDb();let query=db.from("profiles").select("id");if(email)query=query.eq("email",email);const {data:profiles,error}=await query.limit(500);if(error)throw error;if(!profiles?.length)return NextResponse.json({ok:false,error:email?"Akun pelanggan tidak ditemukan.":"Belum ada pelanggan."},{status:404});const rows=profiles.map((p:any)=>({user_id:p.id,title,message,kind:"admin_message"}));const {error:insertError}=await db.from("notifications").insert(rows);if(insertError)throw insertError;return NextResponse.json({ok:true,sent:rows.length})}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500})}
 }
 if(resource==="notification-read"){
  const id=String(body.id||"");if(!id)return NextResponse.json({ok:false,error:"Notifikasi tidak valid."},{status:400});try{const {error}=await adminDb().from("notifications").update({is_read:true}).eq("id",id).eq("user_id",user.id);if(error)throw error;return NextResponse.json({ok:true})}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500})}
 }
 if(resource==="admin-credit"){
  if(!isAdmin(user.email))return NextResponse.json({ok:false,error:"Akses admin ditolak."},{status:403});
  const email=String(body.email||"").trim().toLowerCase(),amount=Number(body.tokens);
  if(!email||!Number.isInteger(amount)||amount<1||amount>100000)return NextResponse.json({ok:false,error:"Email dan jumlah token tidak valid."},{status:400});
  try{const db=adminDb();const {data:profile,error}=await db.from("profiles").select("id").eq("email",email).single();if(error||!profile)return NextResponse.json({ok:false,error:"Akun pelanggan tidak ditemukan."},{status:404});const {data:balance,error:rpcError}=await db.rpc("admin_add_tokens",{p_user_id:profile.id,p_amount:amount,p_description:"Pembelian token · Rp"+(amount*2000).toLocaleString("id-ID")});if(rpcError)throw rpcError;const {error:noticeError}=await db.from("notifications").insert({user_id:profile.id,title:"Token berhasil ditambahkan",message:amount+" token telah masuk ke akunmu. Saldo terbaru: "+Number(balance)/2+" token.",kind:"token_credit"});if(noticeError)console.error("Token notification insert failed:",noticeError.message);return NextResponse.json({ok:true,balance})}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500})}
 }
 const paths:Record<string,string>={generate:"/api",image:"/image",voice:"/voice","voice-clone":"/voice/clone"};
 if(!paths[resource])return NextResponse.json({ok:false,error:"Aksi tidak dikenal."},{status:400});
 delete body.resource;
 if(resource==="generate"&&["t2v","sfv","i2v","r2v","extend"].includes(String(body.mode||""))){body.model="omni_flash";body.duration=15;if(body.mode==="extend")body.resolution=1080}
 let charged=false,chargeRef="",providerAccepted=false;
 try{
  if(!isAdmin(user.email)){chargeRef=crypto.randomUUID();const {error}=await adminDb().rpc("spend_token",{p_user_id:user.id,p_reference_id:chargeRef,p_cost_units:resource==="image"?1:2});if(error)throw Object.assign(new Error(error.message.includes("insufficient_tokens")?"Token tidak cukup. Silakan isi saldo terlebih dahulu.":error.message),{status:error.message.includes("insufficient_tokens")?402:500});charged=true}
  const h=headers();const r=await fetch(BASE+paths[resource],{method:"POST",headers:h,body:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(resource==="voice"||resource==="image"||resource==="voice-clone"?280000:60000)});const d=await parse(r);providerAccepted=true;
  if(charged&&chargeRef&&d.job_id){const db=adminDb();const jobRow={user_id:user.id,token_reference:chargeRef,provider_job_id:String(d.job_id),provider:"nexabot",status:"queued",model:String(body.model||resource),resolution:String(body.resolution??"standard"),duration_seconds:Number(body.duration??0),aspect_ratio:String(body.ratio??body.aspect??"auto"),prompt:String(body.prompt||body.text||body.input||"")};const {error:linkError}=await db.from("generation_jobs").insert(jobRow);if(linkError){console.error("generation_jobs insert failed:",linkError.message);return NextResponse.json({...d,token_charged:charged,token_reference:chargeRef,tracking_warning:"Tugas sudah diterima provider. Riwayat sedang disinkronkan; jangan generate ulang."},{status:r.status});}}
  return NextResponse.json({...d,token_charged:charged,token_reference:chargeRef},{status:r.status});
 }catch(e){if(charged&&chargeRef&&!providerAccepted){try{await adminDb().rpc("refund_token",{p_user_id:user.id,p_reference_id:chargeRef,p_reason:"Provider request failed"})}catch{}}const providerMessage=e instanceof Error?e.message:String(e);const lowProviderCredit=/(kredit|credit|saldo|balance).{0,50}(tidak cukup|kurang|habis|insufficient|not enough|exhausted)|(insufficient|not enough|exhausted).{0,50}(kredit|credit|saldo|balance)/i.test(providerMessage);if(lowProviderCredit&&!isAdmin(user.email))return NextResponse.json({ok:false,maintenance:true,error:"KAZAMA AI sedang dalam pemeliharaan. Admin sedang mengisi ulang saldo generator. Mohon tunggu beberapa saat dan coba kembali nanti. Token Anda tidak dipotong."},{status:503});return NextResponse.json({ok:false,error:providerMessage},{status:(e as any)?.status||502})}
}
