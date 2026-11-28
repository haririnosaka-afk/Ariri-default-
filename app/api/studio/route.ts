import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase-server";
export const dynamic="force-dynamic";
export const maxDuration=300;
const BASE=(process.env.PRIVATE_ENGINE_URL||"").replace(/\/+$/,"")+"/api/v1";
function adminDb(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Database token belum dikonfigurasi.");return createClient(url,key,{auth:{persistSession:false}})}
async function currentUser(req?:NextRequest){
 const internal=req?.headers.get("x-kazama-internal-secret");
 if(internal && internal===process.env.TELEGRAM_WEBHOOK_SECRET){
  const telegramId=Number(req?.headers.get("x-kazama-telegram-user-id")||0);
  if(!Number.isSafeInteger(telegramId)||telegramId<=0)throw Object.assign(new Error("Identitas Telegram tidak valid."),{status:401});
  const db=adminDb();
  const {data:link}=await db.from("telegram_account_links").select("user_id").eq("telegram_user_id",telegramId).maybeSingle();
  let userId=link?.user_id as string|undefined;
  if(!userId){
   const {data:native}=await db.from("telegram_native_accounts").select("user_id").eq("telegram_user_id",telegramId).maybeSingle();
   userId=native?.user_id as string|undefined;
  }
  if(!userId)throw Object.assign(new Error("Akun Telegram belum tersedia. Ketik /start untuk membuat akun."),{status:401});
  const {data:profile,error:profileError}=await db.from("profiles").select("id,email").eq("id",userId).single();
  if(profileError||!profile)throw Object.assign(new Error("Dompet akun Telegram belum siap. Hubungi admin KAZAMA."),{status:401});
  return {id:profile.id,email:profile.email||("tg-"+telegramId+"@telegram.kazamaai.my.id"),source:"telegram"};
 }
 const s=await supabaseServer();const {data,error}=await s.auth.getUser();if(error||!data.user)throw Object.assign(new Error("Silakan masuk terlebih dahulu."),{status:401});return {...data.user,source:"website"}
}

function maskActivityName(value:string){
 const compact=String(value||"Pengguna").trim().replace(/\\s+/g,"");
 if(!compact)return "Pengguna";
 if(compact.length<=4)return compact.slice(0,Math.min(3,compact.length-1))+"*"+compact.slice(-1);
 return compact.slice(0,3)+"*".repeat(Math.min(12,compact.length-4))+compact.slice(-1);
}
function elapsedLabel(startedAt:string){
 const seconds=Math.max(1,Math.floor((Date.now()-new Date(startedAt).getTime())/1000));
 const minutes=Math.floor(seconds/60),rest=seconds%60;
 return minutes>0?minutes+" menit "+rest+" detik":rest+" detik";
}
async function announceSuccessfulVideo(user:any,providerJobId:string,providerData:any){
 try{
  const status=String(providerData?.job?.status||providerData?.status||providerData?.state||"").toLowerCase();
  if(!["completed","complete","done","success","succeeded","finished"].includes(status))return;
  const db=adminDb();
  const {data:job,error:jobError}=await db.from("generation_jobs").select("id,user_id,source,model,resolution,duration_seconds,created_at").eq("user_id",user.id).eq("provider_job_id",providerJobId).maybeSingle();
  if(jobError||!job||!String(job.model||"").toLowerCase().includes("omni"))return;
  const {data:config}=await db.from("telegram_bot_config").select("activity_group_chat_id").eq("id",1).maybeSingle();
  const groupId=Number(config?.activity_group_chat_id||0);
  if(!groupId||!process.env.TELEGRAM_BOT_TOKEN)return;
  const [{data:profile},{data:linked},{data:native}]=await Promise.all([
   db.from("profiles").select("display_name").eq("id",user.id).maybeSingle(),
   db.from("telegram_account_links").select("telegram_username").eq("user_id",user.id).maybeSingle(),
   db.from("telegram_native_accounts").select("telegram_username").eq("user_id",user.id).maybeSingle()
  ]);
  const display=String(profile?.display_name||linked?.telegram_username||native?.telegram_username||"Pengguna");
  const {error:insertError}=await db.from("kazama_activity_events").upsert({
   job_id:job.id,user_id:user.id,source:job.source==="telegram"?"telegram":"website",
   masked_name:maskActivityName(display),model:String(job.model||"Omni"),
   duration_seconds:Number(job.duration_seconds||15),credit_cost:1
  },{onConflict:"job_id",ignoreDuplicates:true});
  if(insertError)throw insertError;
  const {data:event,error:eventError}=await db.from("kazama_activity_events").select("id,masked_name,source,model,duration_seconds,credit_cost,created_at,delivery_status").eq("job_id",job.id).single();
  if(eventError||!event||event.delivery_status==="sent")return;
  const {data:claim}=await db.from("kazama_activity_events").update({delivery_status:"sending"}).eq("id",event.id).eq("delivery_status","pending").select("id").maybeSingle();
  if(!claim)return;
  const sourceLabel=event.source==="telegram"?"Bot Telegram":"Website";
  const modelLabel=String(event.model||"").toLowerCase().includes("omni")?"Omni Flash 1.2":event.model;
  const message="🎬 Video KAZAMA AI berhasil dibuat!\\n\\n"+
   "👤 Pengguna: "+event.masked_name+"\\n"+
   "⏱️ Durasi generate: "+elapsedLabel(job.created_at||event.created_at)+"\\n"+
   "💳 Biaya generate: "+event.credit_cost+" token\\n"+
   "🏆 Video sukses ke-"+event.id.toLocaleString("id-ID")+"\\n"+
   "🎬 Model: "+modelLabel+"\\n"+
   "📍 Diproses melalui: "+sourceLabel+"\\n\\n"+
   "🤖 KAZAMA AI";
  const response=await fetch("https://api.telegram.org/bot"+process.env.TELEGRAM_BOT_TOKEN+"/sendMessage",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({chat_id:groupId,text:message}),cache:"no-store",signal:AbortSignal.timeout(15000)
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.ok)throw new Error(result.description||"Telegram activity message failed");
  await db.from("kazama_activity_events").update({delivery_status:"sent",telegram_sent_at:new Date().toISOString()}).eq("id",event.id);
 }catch(error){console.error("KAZAMA live activity:",error);}
}

function isAdmin(email?:string){return !!email&&!!process.env.KAZAMA_ADMIN_EMAIL&&email.toLowerCase()===process.env.KAZAMA_ADMIN_EMAIL.toLowerCase()}
function headers(){const key=process.env.NEXABOT_API_KEY;if(!key)throw new Error("Engine belum dikonfigurasi. Hubungi administrator KAZAMA AI.");return {"x-api-key":key,"Content-Type":"application/json",Accept:"application/json"}}
async function parse(r:Response){const raw=await r.text();let d:any;try{d=raw?JSON.parse(raw):{}}catch{throw new Error("Respons layanan tidak valid ("+r.status+").")}if(!r.ok||d?.ok===false)throw Object.assign(new Error(String(d?.error||d?.message||"Layanan sedang tidak tersedia ("+r.status+").").replace(/nexabot/ig,"layanan")),{status:r.status||502});return d}
export async function GET(req:NextRequest){
 let user:any;try{user=await currentUser(req)}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:(e as any)?.status||401})}
 const q=req.nextUrl.searchParams,resource=q.get("resource")||"settings";
 try{
  if(resource==="settings")return NextResponse.json({configured:Boolean(process.env.NEXABOT_API_KEY),email:user.email,is_admin:isAdmin(user.email)});
  if(resource==="account"){const db=adminDb();const [{data:profile,error:pe},{data:ledger,error:le}]=await Promise.all([db.from("profiles").select("id,email,balance,created_at").eq("id",user.id).single(),db.from("token_ledger").select("id,amount,kind,description,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30)]);if(pe||le)throw new Error("Dompet belum siap. Admin perlu menjalankan schema Supabase.");return NextResponse.json({profile:{...profile,balance:Number(profile.balance)*100},ledger:(ledger||[]).map((x:any)=>({...x,amount:Number(x.amount)*100}))})}
  if(resource==="notifications"){const {data,error}=await adminDb().from("notifications").select("id,title,message,kind,is_read,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50);if(error)throw error;return NextResponse.json({notifications:data||[]})}
  if(resource==="admin-users"){if(!isAdmin(user.email))return NextResponse.json({ok:false,error:"Akses admin ditolak."},{status:403});const {data,error}=await adminDb().from("profiles").select("id,email,balance,created_at").order("created_at",{ascending:false}).limit(500);if(error)throw error;return NextResponse.json({users:(data||[]).map((x:any)=>({...x,balance:Number(x.balance)*100}))})}
  const h=headers();let url="";
  if(resource==="credit")url=BASE+"/api/credit";
  else if(resource==="voices")url=BASE+"/voices";
  else if(resource==="modes")url=BASE+"/modes";
  else if(resource==="image-models")url=BASE+"/image";
  else if(resource==="job")url=BASE+"/jobs/"+encodeURIComponent(q.get("id")||"");
  else if(resource==="download"||resource==="preview"){const id=q.get("id")||"",r=await fetch(BASE+"/jobs/"+encodeURIComponent(id)+"/download",{headers:h,cache:"no-store",signal:AbortSignal.timeout(60000)});if(!r.ok)return NextResponse.json({ok:false,error:await r.text()||"File hasil belum tersedia."},{status:r.status});const contentType=r.headers.get("content-type")||"video/mp4";const disposition=resource==="preview"?'inline; filename="kazama-result"':r.headers.get("content-disposition")||'attachment; filename="kazama-result"';return new NextResponse(await r.arrayBuffer(),{status:200,headers:{"Content-Type":contentType,"Content-Disposition":disposition,"Cache-Control":"no-store"}})}
  else return NextResponse.json({ok:false,error:"Resource tidak dikenal."},{status:400});
  const d=await parse(await fetch(url,{headers:h,cache:"no-store",signal:AbortSignal.timeout(30000)}));
  if(resource==="credit"){const {data:wallet,error}=await adminDb().from("profiles").select("balance").eq("id",user.id).single();if(error)throw new Error("Dompet belum dibuat. Jalankan schema Supabase.");return NextResponse.json({credit:Number(wallet.balance)*100,balance:Number(wallet.balance)*100,video_credit_cost:d.video_credit_cost??d.credit_cost,video_credit_costs:d.video_credit_costs,voice_credit_cost:d.voice_credit_cost,image_credit_cost:d.image_credit_cost,clone_credit_cost:d.clone_credit_cost})}
  if(resource==="job")await announceSuccessfulVideo(user,String(q.get("id")||""),d);
  return NextResponse.json(d);
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:(e as any)?.status||502})}
}
export async function POST(req:NextRequest){
 let user:any;try{user=await currentUser(req)}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:(e as any)?.status||401})}
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
  if(!email||!Number.isInteger(amount)||amount<100||amount>10000000||amount%100!==0)return NextResponse.json({ok:false,error:"Email dan jumlah token tidak valid."},{status:400});
  try{const db=adminDb();const {data:profile,error}=await db.from("profiles").select("id").eq("email",email).single();if(error||!profile)return NextResponse.json({ok:false,error:"Akun pelanggan tidak ditemukan."},{status:404});const {data:balance,error:rpcError}=await db.rpc("admin_add_tokens",{p_user_id:profile.id,p_amount:amount/100,p_description:"Top Up Credit · Rp"+(amount*10).toLocaleString("id-ID")});if(rpcError)throw rpcError;const {error:noticeError}=await db.from("notifications").insert({user_id:profile.id,title:"Credit berhasil ditambahkan",message:amount.toLocaleString("id-ID")+" Credit telah masuk ke akunmu. Saldo terbaru: "+Number(balance)*100+" Credit.",kind:"token_credit"});if(noticeError)console.error("Token notification insert failed:",noticeError.message);return NextResponse.json({ok:true,balance})}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500})}
 }
 const paths:Record<string,string>={generate:"/api",image:"/image",voice:"/voice","voice-clone":"/voice/clone"};
 if(!paths[resource])return NextResponse.json({ok:false,error:"Aksi tidak dikenal."},{status:400});
 delete body.resource;
 if(resource==="generate"&&["t2v","sfv","i2v","r2v","extend"].includes(String(body.mode||""))){body.model="omni_flash";body.duration=body.mode==="r2v"?10:15;if(body.mode==="extend")body.resolution=1080}
 let charged=false,chargeRef="",providerAccepted=false;
 try{
  if(!isAdmin(user.email)){chargeRef=crypto.randomUUID();const videoModes=["t2v","sfv","i2v","r2v","extend"];const creditUnits=resource==="image"?1:resource==="generate"&&videoModes.includes(String(body.mode||""))?1:2;const {error}=await adminDb().rpc("spend_token",{p_user_id:user.id,p_reference_id:chargeRef,p_cost_units:creditUnits});if(error)throw Object.assign(new Error(error.message.includes("insufficient_tokens")?"Token tidak cukup. Silakan isi saldo terlebih dahulu.":error.message),{status:error.message.includes("insufficient_tokens")?402:500});charged=true}
  const h=headers();const r=await fetch(BASE+paths[resource],{method:"POST",headers:h,body:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(resource==="voice"||resource==="image"||resource==="voice-clone"?280000:60000)});const d=await parse(r);providerAccepted=true;
  if(d.job_id){const db=adminDb();const jobRow={user_id:user.id,source:user.source==="telegram"?"telegram":"website",token_reference:chargeRef||("admin-"+crypto.randomUUID()),provider_job_id:String(d.job_id),provider_task_id:String(d.job_id),provider:"nexabot",status:"queued",model:String(body.model||body.mode||resource),resolution:String(body.resolution??"standard"),duration_seconds:Number(body.duration??0),aspect_ratio:String(body.ratio??body.aspect??"auto"),prompt:String(body.prompt||body.text||body.input||"")};const {error:linkError}=await db.from("generation_jobs").insert(jobRow);if(linkError){console.error("generation_jobs insert failed:",linkError.message);return NextResponse.json({...d,token_charged:charged,token_reference:chargeRef,tracking_warning:"Tugas sudah diterima provider. Riwayat sedang disinkronkan; jangan generate ulang."},{status:r.status});}}
  return NextResponse.json({...d,token_charged:charged,token_reference:chargeRef},{status:r.status});
 }catch(e){if(charged&&chargeRef&&!providerAccepted){try{await adminDb().rpc("refund_token",{p_user_id:user.id,p_reference_id:chargeRef,p_reason:"Provider request failed"})}catch{}}const providerMessage=e instanceof Error?e.message:String(e);const lowProviderCredit=/(kredit|credit|saldo|balance).{0,50}(tidak cukup|kurang|habis|insufficient|not enough|exhausted)|(insufficient|not enough|exhausted).{0,50}(kredit|credit|saldo|balance)/i.test(providerMessage);if(lowProviderCredit&&!isAdmin(user.email))return NextResponse.json({ok:false,maintenance:true,error:"KAZAMA AI sedang dalam pemeliharaan. Admin sedang mengisi ulang saldo generator. Mohon tunggu beberapa saat dan coba kembali nanti. Token Anda tidak dipotong."},{status:503});return NextResponse.json({ok:false,error:providerMessage},{status:(e as any)?.status||502})}
}
