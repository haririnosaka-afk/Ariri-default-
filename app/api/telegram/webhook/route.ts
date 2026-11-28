const TELEGRAM_IMAGE_MODELS=[
 ["nano_banana_2","Nano Banana 2"],["nano_banana_2_lite","Nano Banana 2 Lite"],["nano_banana_pro","Nano Banana Pro"],["nano_banana","Nano Banana"],
 ["gpt_image_2","GPT Image 2"],["gpt_image_2_5_flare","GPT Image 2.5 Flare"],["gpt_image_2_5_sunburst","GPT Image 2.5 Sunburst"],
 ["mai_image_26_flash","MAI Image 2.6 Flash"],["mai_image_26","MAI Image 2.6"],["mai_image_25","MAI Image 2.5"],["mai_image_25_pro","MAI Image 2.5 Pro"]
] as const;
const TELEGRAM_IMAGE_ASPECTS=["auto","21:9","16:9","3:2","4:3","5:4","1:1","4:5","3:4","2:3","9:16","4:1","1:4","8:1","1:8"];
const TELEGRAM_IMAGE_SIZES=["0.5K","1K","2K","4K"];
const TELEGRAM_IMAGE_OUTPUTS=["landscape_4_3","landscape_16_9","square_hd","square","portrait_4_3","portrait_16_9","auto"];
const TELEGRAM_VOICES=["Achernar","Achird","Algenib","Algieba","Alnilam","Aoede","Autonoe","Callirrhoe","Charon","Despina","Enceladus","Erinome","Fenrir","Gacrux","Iapetus","Kore","Laomedeia","Leda","Orus","Puck","Pulcherrima","Rasalgethi","Sadachbia","Sadaltager","Schedar","Sulafat","Umbriel","Vindemiatrix","Zephyr","Zubenelgenubi"];
async function saveTelegramFlow(userId:number,chatId:number,state:string){
 const {error}=await dbAdmin().from("telegram_video_sessions").upsert({telegram_user_id:userId,telegram_chat_id:chatId,pending_action:state,created_at:new Date().toISOString()},{onConflict:"telegram_user_id"});
 if(error)throw new Error("Pengaturan layanan tidak dapat disimpan.");
}
async function readTelegramFlow(userId:number){
 const {data,error}=await dbAdmin().from("telegram_video_sessions").select("pending_action").eq("telegram_user_id",userId).maybeSingle();
 if(error)throw error;return String(data?.pending_action||"");
}
async function clearTelegramFlow(userId:number){await dbAdmin().from("telegram_video_sessions").delete().eq("telegram_user_id",userId);}
async function studioGet(origin:string,telegramUserId:number,resource:string){
 const response=await fetch(origin+"/api/studio?resource="+encodeURIComponent(resource),{headers:{"x-kazama-internal-secret":process.env.TELEGRAM_WEBHOOK_SECRET!,"x-kazama-telegram-user-id":String(telegramUserId)},cache:"no-store",signal:AbortSignal.timeout(30000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.ok===false)throw new Error(data.error||"Katalog KAZAMA tidak dapat dimuat.");return data;
}
async function showImageModels(chatId:number){
 await say(chatId,"🖼️ IMAGE GENERATOR · TEXT TO IMAGE\n\nPilih IMAGE MODEL seperti di website KAZAMA AI:",{inline_keyboard:TELEGRAM_IMAGE_MODELS.map(([id,label])=>[{text:label,callback_data:"imodel:"+id}])});
}
async function showTtsVoices(chatId:number){
 const rows=TELEGRAM_VOICES.reduce((a:string[][],v,i)=>{if(i%2===0)a.push([v]);else a[a.length-1].push(v);return a;},[]).map(row=>row.map(v=>({text:v,callback_data:"ttsvoice:"+v})));
 await say(chatId,"🗣️ TEXT TO SPEECH\n\nPilih VOICE. Pilihan mengikuti daftar website:",{inline_keyboard:rows});
}
async function showVoiceLibrary(chatId:number,telegramUserId:number,origin:string){
 const data=await studioGet(origin,telegramUserId,"voices");const voices=Array.isArray(data.voices)?data.voices:[];
 if(!voices.length){await say(chatId,"Katalog Voice belum tersedia saat ini.");return;}
 const rows:any[][]=[];for(const v of voices.slice(0,40)){const id=String(v.voice_id||v.id||"");if(!id)continue;const label=String(v.name||id).slice(0,28);if(rows.length&&rows[rows.length-1].length===1)rows[rows.length-1].push({text:label,callback_data:"voicepick:"+id});else rows.push([{text:label,callback_data:"voicepick:"+id}]);}
 await say(chatId,"📚 VOICE LIBRARY\n\nPilih voice untuk digunakan di Voice Generator:",{inline_keyboard:rows});
}
async function showVideoModels(chatId:number,telegramUserId:number,origin:string) {
  await say(chatId,"🎬 PILIH MODEL VIDEO\\n\\nPilih model video yang ingin kamu gunakan:",{
    inline_keyboard:[[
      {text:"Omni Flash 1.2 · Video Generator",callback_data:"vmodel:omni_flash"}
    ]]
  });
}
async function saveVideoSession(telegramUserId:number,chatId:number,pendingAction:string) {
  const {error}=await dbAdmin().from("telegram_video_sessions").upsert({telegram_user_id:telegramUserId,telegram_chat_id:chatId,pending_action:pendingAction,created_at:new Date().toISOString()},{onConflict:"telegram_user_id"});
  if(error) {
    console.error("KAZAMA saveVideoSession Supabase error:", {message:error.message,code:error.code,details:error.details,hint:error.hint});
    throw new Error("Pengaturan video gagal disimpan ke database ("+String(error.code||"unknown")+"). Admin sedang memperbaikinya.");
  }
}
async function generateTelegramVideo(chatId:number,telegramUserId:number,origin:string,model:string,mode:string,prompt:string,ratio:number,resolution:number,media?:string[]) {
  if(!prompt.trim()) throw new Error("Prompt video tidak boleh kosong.");
  if(model!=="omni_flash") throw new Error("Model video tidak tersedia di NexaBot.");
  if(!["t2v","sfv","i2v","r2v"].includes(mode)) throw new Error("Mode video tidak tersedia.");
  if(mode==="i2v"&&(!media||media.length<1||media.length>3))throw new Error("Mode Image to Video menerima 1–3 foto referensi.");
  if(mode==="sfv"&&(!media||media.length!==1))throw new Error("Mode Start Frame Video membutuhkan tepat 1 foto pembuka.");
  if(mode==="r2v"&&(!media||media.length<1))throw new Error("Mode Video to Video membutuhkan video referensi.");
  const modeLabel=mode==="t2v"?"Text to Video":mode==="sfv"?"Start Frame Video":mode==="i2v"?"Image to Video":"Video to Video";
  await say(chatId,"⏳ Video Omni Flash 1.2 ("+modeLabel+") sedang diproses oleh KAZAMA AI. Mohon tunggu…");
  const result=await studioCall(origin,telegramUserId,{resource:"generate",model:"omni_flash",mode,prompt,ratio,resolution,duration:15,...(media?.length?{media}:{})});
  await say(chatId,"✅ Permintaan video diterima!\\n\\nModel: "+(result.model_label||"Omni Flash 1.2")+"\\nMode: "+modeLabel+"\\nDurasi: "+(mode==="r2v"?"10":"15")+" detik\\nRasio: "+(ratio===1?"Landscape · 16:9":"Portrait · 9:16")+"\\nResolusi: "+resolution+"p\\nID tugas: "+(result.job_id||"-")+"\\nStatus: "+(result.status||"queued")+"\\n\\nKetik /status untuk memeriksa hasil.");
}
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function dbAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Database belum dikonfigurasi.");
  return createClient(url, key, { auth: { persistSession: false } });
}
const API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

async function telegram(method: string, payload: Record<string, unknown>) {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error("Bot token belum dikonfigurasi.");
  const response = await fetch(`${API()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.description || "Telegram API error.");
  return data;
}
async function say(chatId: number, text: string, replyMarkup?: any) {
  return telegram("sendMessage", { chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) });
}
async function ensureTelegramAccount(telegramUserId:number, from:any, chatId:number=telegramUserId) {
  const db=dbAdmin();
  const {data:linked}=await db.from("telegram_account_links").select("user_id").eq("telegram_user_id",telegramUserId).maybeSingle();
  if(linked?.user_id) return linked.user_id as string;
  const {data:existing}=await db.from("telegram_native_accounts").select("user_id").eq("telegram_user_id",telegramUserId).maybeSingle();
  if(existing?.user_id) return existing.user_id as string;
  const email=`tg-${telegramUserId}@telegram.kazamaai.my.id`;
  const password=cryptoRandomPassword();
  let user:any=null;
  const created=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:from?.first_name||"Telegram User",telegram_user_id:String(telegramUserId)}});
  if(created.error) {
    const listed=await db.auth.admin.listUsers({page:1,perPage:1000});
    if(listed.error) throw new Error("Akun Telegram gagal dibuat.");
    user=listed.data.users.find((u:any)=>u.email===email);
    if(!user) throw new Error("Akun Telegram gagal dibuat: "+created.error.message);
  } else user=created.data.user;
  if(!user?.id) throw new Error("Akun Telegram tidak dapat dibuat.");
  const {error}=await db.from("telegram_native_accounts").upsert({
    telegram_user_id:telegramUserId,user_id:user.id,telegram_chat_id:chatId,
    telegram_username:from?.username||null
  },{onConflict:"telegram_user_id"});
  if(error) throw new Error("Akun Telegram gagal disimpan.");
  return user.id as string;
}
function cryptoRandomPassword(){return randomBytes(32).toString("hex")+"Aa1!";}
async function sendMenu(chatId: number, firstName = "") {
  const name = firstName ? ` ${firstName}` : "";
  await telegram("setMyCommands",{commands:[
    {command:"start",description:"Buka menu utama"},
    {command:"menu",description:"Tampilkan layanan"},
    {command:"saldo",description:"Lihat saldo Credit"},
    {command:"link",description:"Tautkan akun website KAZAMA"},
    {command:"video",description:"Buat video AI"},
    {command:"i2v",description:"Buat video dari foto"},
    {command:"motion",description:"Motion Control"},
    {command:"image",description:"Free AI Image"},
    {command:"editor",description:"AI Image Editor"},
    {command:"library",description:"Voice Library"},
    {command:"credits",description:"Harga dan saldo Credit"},
    {command:"music",description:"Buat musik AI"},
    {command:"tts",description:"Teks menjadi ucapan"},
    {command:"voice",description:"Voice Generator"},
    {command:"clone",description:"Voice Cloning"},
    {command:"status",description:"Cek status tugas"},
    {command:"help",description:"Bantuan"}
  ]}).catch(()=>null);
  return say(chatId,
    `Halo${name}! 👋 Selamat datang di KAZAMA AI.\n\nAgar saldo Credit dan riwayat sama dengan website, tautkan akun KAZAMA AI melalui kode dari menu Akun website. Kirim /link KODE ke bot.`,
    { inline_keyboard: [
      [{ text: "🎬 Video Generator", callback_data: "tool_video" }],
      [{ text: "🖼️ Free AI Image", callback_data: "tool_image" }],
      [{ text: "🪄 AI Image Editor", callback_data: "tool_editor" }],
      [{ text: "🎵 Music Generator", callback_data: "tool_music" }],
      [{ text: "🗣️ Text to Speech", callback_data: "tool_tts" }],
      [{ text: "🎙️ Voice Generator", callback_data: "tool_voice" }],
      [{ text: "🎤 Voice Cloning", callback_data: "tool_clone" }],
      [{ text: "📚 Voice Library", callback_data: "tool_library" }],
      [{ text: "🎭 Motion Control", callback_data: "tool_motion" }],
      [{ text: "💳 Pricing & Credits", callback_data: "account_credits" }],
      [{ text: "👤 My Account / Saldo", callback_data: "account_balance" }],
      [{ text: "📂 My Creations", callback_data: "account_history" }],
      [{ text: "🌐 Buka Website", url: "https://kazamaai.my.id" }]
    ] }
  );
}
async function checkRequiredGroup(chatId:number, telegramUserId:number):Promise<boolean> {
  const db=dbAdmin();
  const {data:config,error}=await db.from("telegram_bot_config").select("required_group_chat_id,required_group_invite_link,required_group_title").eq("id",1).single();
  if(error||!config?.required_group_chat_id){
    await say(chatId,"🔒 Akses KAZAMA AI belum diaktifkan. Admin perlu menambahkan @KazamaAIBot sebagai admin di grup KAZAMA AI INFO, lalu kirim satu pesan di grup tersebut.");
    return false;
  }
  try {
    const result=await telegram("getChatMember",{chat_id:config.required_group_chat_id,user_id:telegramUserId});
    const status=String(result.result?.status||"left");
    const allowed=status==="creator"||status==="administrator"||status==="member"||(status==="restricted"&&result.result?.is_member===true);
    if(allowed)return true;
  } catch {}
  await say(chatId,"🔐 Untuk menggunakan KAZAMA AI, kamu wajib bergabung ke grup resmi KAZAMA AI INFO terlebih dahulu. Setelah bergabung, tekan tombol Cek Keanggotaan.",{
    inline_keyboard:[
      [{text:"📢 Gabung KAZAMA AI INFO",url:config.required_group_invite_link||"https://t.me/+U-_-JOE6PgZiNGNl"}],
      [{text:"🔄 Cek Keanggotaan",callback_data:"check_join"}]
    ]
  });
  return false;
}

async function linkTelegramAccount(chatId:number,telegramUserId:number,code:string,username?:string) {
  const normalized=String(code||"").trim().toUpperCase();
  if(!/^[A-F0-9]{10}$/.test(normalized))throw new Error("Format kode tautan tidak valid. Buat kode baru dari menu Akun website.");
  const hash=createHash("sha256").update(normalized).digest("hex");
  const db=dbAdmin();
  const {data:entry,error}=await db.from("telegram_link_codes").select("user_id,expires_at").eq("code_hash",hash).gt("expires_at",new Date().toISOString()).maybeSingle();
  if(error||!entry)throw new Error("Kode tautan salah atau kedaluwarsa. Buat kode baru dari menu Akun website.");
  const {error:linkError}=await db.from("telegram_account_links").upsert({
    telegram_user_id:telegramUserId,user_id:entry.user_id,telegram_chat_id:chatId,
    telegram_username:username||null,linked_at:new Date().toISOString()
  },{onConflict:"telegram_user_id"});
  if(linkError)throw new Error("Akun website sudah tertaut ke akun Telegram lain atau proses tautan gagal. Hubungi admin KAZAMA.");
  await db.from("telegram_link_codes").delete().eq("code_hash",hash);
  await say(chatId,"✅ Akun KAZAMA AI berhasil ditautkan. Saldo Credit dan riwayat generasi sekarang menggunakan akun website yang sama.");
}

async function sendBalance(chatId: number, telegramUserId: number) {
  const db = dbAdmin();
  const {data:account,error:accountError}=await db.from("telegram_account_links").select("user_id").eq("telegram_user_id",telegramUserId).single();
  if(accountError||!account)throw new Error("Akun belum ditautkan. Login ke website KAZAMA AI, buat kode tautan dari menu Akun, lalu kirim /link KODE ke bot.");
  const {data:profile,error}=await db.from("profiles").select("email,balance").eq("id",account.user_id).single();
  if(error||!profile)throw new Error("Data saldo akun tidak dapat dibaca.");
  await say(chatId,`💳 KAZAMA AI WALLET\nSaldo: ${Number(profile.balance)*100} Credit\n\nSaldo ini tersinkron dengan akun website KAZAMA AI.`);
}


const ENGINE_BASE = (process.env.PRIVATE_ENGINE_URL || "").replace(/\/+$/, "") + "/api/v1";
function engineHeaders() {
  const key = process.env.NEXABOT_API_KEY;
  if (!key) throw new Error("Generator sedang tidak tersedia. Hubungi admin KAZAMA.");
  return { "x-api-key": key, "Content-Type": "application/json", Accept: "application/json" };
}
async function engineJson(path: string, init: RequestInit = {}) {
  const response = await fetch(ENGINE_BASE + path, { ...init, headers: engineHeaders(), cache: "no-store", signal: AbortSignal.timeout(60000) });
  const raw = await response.text();
  let data: any;
  try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error("Respons generator tidak valid."); }
  if (!response.ok || data?.ok === false) throw new Error(String(data?.error || data?.message || "Generator gagal menerima permintaan."));
  return data;
}
async function studioCall(origin:string, telegramUserId:number, body:any) {
  const secret=process.env.TELEGRAM_WEBHOOK_SECRET;
  if(!secret) throw new Error("Layanan bot belum dikonfigurasi.");
  const response=await fetch(origin+"/api/studio",{
    method:"POST",headers:{"Content-Type":"application/json","x-kazama-internal-secret":secret,"x-kazama-telegram-user-id":String(telegramUserId)},
    body:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(280000)
  });
  const data=await response.json().catch(()=>({ok:false,error:"Respons KAZAMA tidak valid."}));
  if(!response.ok||data.ok===false)throw new Error(String(data.error||"Generator gagal memproses permintaan."));
  return data;
}
async function telegramFileData(fileId:string) {
  const token=process.env.TELEGRAM_BOT_TOKEN!;
  const info=await fetch(API()+"/getFile?file_id="+encodeURIComponent(fileId),{cache:"no-store"});
  const meta=await info.json();
  if(!meta.ok||!meta.result?.file_path)throw new Error("File Telegram tidak dapat dibaca.");
  const file=await fetch("https://api.telegram.org/file/bot"+token+"/"+meta.result.file_path,{cache:"no-store"});
  if(!file.ok)throw new Error("Gagal mengunduh file dari Telegram.");
  const type=file.headers.get("content-type")||"application/octet-stream";
  const bytes=Buffer.from(await file.arrayBuffer());
  if(bytes.length>3*1024*1024)throw new Error("File terlalu besar. Maksimal 3 MB per file agar sesuai batas upload website.");
  return "data:"+type+";base64,"+bytes.toString("base64");
}
async function runStudio(chatId:number, telegramUserId:number, origin:string, resource:string, payload:any, label:string) {
  await say(chatId,"⏳ "+label+" sedang diproses oleh KAZAMA AI. Mohon tunggu…");
  const result=await studioCall(origin,telegramUserId,{resource,...payload});
  if(resource==="voice-clone"){const voiceId=String(result.voice?.voice_id||result.voice_id||result.id||"");if(!voiceId)throw new Error("Voice clone diproses tetapi voice_id tidak ditemukan.");await say(chatId,"✅ VOICE CLONING BERHASIL\\nNama: "+String(payload.name||"Custom Voice")+"\\nVoice ID: "+voiceId+"\\n\\nVoice ini sekarang tersedia di Voice Library KAZAMA AI.");return;}\n  if(result.job_id){
    await say(chatId,"✅ Permintaan diterima!\n\nLayanan: "+label+"\nID tugas: "+result.job_id+"\nStatus: "+(result.status||"queued")+"\n\nGunakan /status untuk memeriksa hasil.");
  } else {
    const url=String(result.url||result.audio_url||result.image_url||result.data?.url||"");
    if(!url)throw new Error("KAZAMA belum mengembalikan file hasil. Periksa /status sebelum mengirim ulang agar tidak membuat tugas ganda.");
    if(resource==="image")await telegram("sendPhoto",{chat_id:chatId,photo:url,caption:"🖼️ Hasil Image Generator · KAZAMA AI"});
    else if(resource==="voice")await telegram("sendAudio",{chat_id:chatId,audio:url,caption:"🎙️ Hasil Voice Generator · KAZAMA AI"});
    else await telegram("sendAudio",{chat_id:chatId,audio:url,caption:"🎵 Hasil audio · KAZAMA AI"});
  }
}
async function sendLatestStatus(chatId:number, telegramUserId:number, origin:string) {
  const db=dbAdmin();
  const {data:link,error:linkError}=await db.from("telegram_account_links").select("user_id").eq("telegram_user_id",telegramUserId).single();
  if(linkError||!link)throw new Error("Ketik /start untuk membuat akun Telegram.");
  const {data:jobs,error}=await db.from("generation_jobs").select("provider_job_id,model,prompt,status,created_at").eq("user_id",link.user_id).order("created_at",{ascending:false}).limit(5);
  if(error||!jobs?.length){await say(chatId,"Belum ada tugas generator di riwayat akunmu.");return;}
  const latest=jobs[0];
  if(latest?.provider_job_id){
    try{
      const secret=process.env.TELEGRAM_WEBHOOK_SECRET!;
      const response=await fetch(origin+"/api/studio?resource=job&id="+encodeURIComponent(latest.provider_job_id),{headers:{"x-kazama-internal-secret":secret,"x-kazama-telegram-user-id":String(telegramUserId)},cache:"no-store",signal:AbortSignal.timeout(30000)});
      const data=await response.json();
      const job=data.job||data.data||data;
      const status=String(job.status||job.state||latest.status||"processing");
      const url=String(job.url||job.video_url||job.audio_url||job.image_url||job.output_url||job.result_url||"");
      if(url&&/^(completed|done|success|succeeded)$/i.test(status)){
        if(["music","tts"].includes(String(latest.model||"")))await telegram("sendAudio",{chat_id:chatId,audio:url,caption:"✅ Audio KAZAMA AI selesai.\\nID: "+latest.provider_job_id});
        else if(String(latest.model||"")==="image")await telegram("sendPhoto",{chat_id:chatId,photo:url,caption:"✅ Gambar KAZAMA AI selesai.\\nID: "+latest.provider_job_id});
        else await telegram("sendVideo",{chat_id:chatId,video:url,caption:"✅ Video KAZAMA AI selesai.\\nID: "+latest.provider_job_id});
        return;
      }
      await say(chatId,"📽️ TUGAS TERAKHIR\n\nModel: "+(latest.model||"KAZAMA Generator")+"\nStatus: "+status+"\nID: "+latest.provider_job_id+"\n\nKirim /status lagi beberapa saat untuk memperbarui.");
      return;
    }catch(e){console.error("Telegram status check:",e);}
  }
  const lines=jobs.map((j:any,i:number)=>`${i+1}. ${j.model||"KAZAMA Generator"} · ${j.status||"queued"}\nID: ${j.provider_job_id}`);
  await say(chatId,"📚 RIWAYAT GENERATOR\n\n"+lines.join("\n\n"));
}
async function handleGeneration(chatId:number, telegramUserId:number, origin:string, command:string, prompt:string, message:any) {
  if(!prompt.trim() && !["clone"].includes(command)) { await say(chatId,"Tulis prompt setelah perintah.\nContoh: /"+command+" cinematic shot of a city at sunset"); return; }
  if(command==="motion") {
    const videoId=message.video?.file_id||message.document?.file_id;
    const photoId=message.photo?.[message.photo.length-1]?.file_id;
    if(!videoId||!photoId)throw new Error("Lampirkan satu video sumber dan satu foto identitas, lalu beri caption /motion PROMPT.");
    const media=[await telegramFileData(videoId),await telegramFileData(photoId)];
    return runStudio(chatId,telegramUserId,origin,"generate",{mode:"r2v",prompt:prompt||"Recreate the source motion while preserving the identity from the reference photo.",media,ratio:1,resolution:1080,duration:10},"Motion Control");
  }
  if(command==="i2v") {
    const photoId=message.photo?.[message.photo.length-1]?.file_id;
    if(!photoId)throw new Error("Lampirkan satu foto dengan caption /i2v PROMPT.");
    const media=[await telegramFileData(photoId)];
    return runStudio(chatId,telegramUserId,origin,"generate",{mode:"i2v",prompt,media,ratio:1,resolution:1080,duration:15},"Image to Video");
  }
  if(command==="video") { await showVideoModels(chatId,telegramUserId,origin); return; }
  if(command==="image") return runStudio(chatId,telegramUserId,origin,"image",{model:"nano_banana_2",prompt,aspect:"auto",resolution:"1K"},"Image Generator");
  if(command==="music") return runStudio(chatId,telegramUserId,origin,"generate",{mode:"music",prompt},"Music Generator");
  if(command==="tts") return runStudio(chatId,telegramUserId,origin,"generate",{mode:"tts",prompt,voice:"Achernar"},"Text to Speech");
  if(command==="voice") {
    const {data:voices}=await dbAdmin().from("telegram_account_links").select("user_id").eq("telegram_user_id",telegramUserId).single();
    if(!voices)throw new Error("Ketik /start untuk membuat akun Telegram.");
    const catalog=await fetch(origin+"/api/studio?resource=voices",{headers:{"x-kazama-internal-secret":process.env.TELEGRAM_WEBHOOK_SECRET!,"x-kazama-telegram-user-id":String(telegramUserId)},cache:"no-store"});
    const voiceData=await catalog.json().catch(()=>({}));
    const first=(voiceData.voices||voiceData.data?.voices||[])[0];
    const voiceId=first?.voice_id||first?.id;
    if(!voiceId)throw new Error("Katalog Voice belum tersedia.");
    return runStudio(chatId,telegramUserId,origin,"voice",{text:prompt,voice_id:voiceId,language_code:"id-ID",speed:1},"Voice Generator");
  }
  if(command==="clone") {
    const audio=message.voice?.file_id||message.audio?.file_id||message.document?.file_id;
    if(!audio)throw new Error("Kirim file audio 15–60 detik dengan caption /clone Nama Voice.");
    const data=await telegramFileData(audio);
    return runStudio(chatId,telegramUserId,origin,"voice-clone",{audio:data,name:prompt||"Telegram Voice",gender:"female"},"Voice Cloning");
  }
}

export async function POST(req: NextRequest) {
  let errorChatId:number|undefined;
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const supplied = req.headers.get("x-telegram-bot-api-secret-token");
  if (!expected || supplied !== expected) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const update = await req.json();
    if (update.callback_query) {
      const callback = update.callback_query;
      await telegram("answerCallbackQuery", { callback_query_id: callback.id });
      const chatId = callback.message?.chat?.id;
      if (!chatId) return NextResponse.json({ ok: true });
      errorChatId = Number(chatId);
      const action = String(callback.data || "");
      if(action==="check_join") {
        if(await checkRequiredGroup(Number(chatId),Number(callback.from?.id))) {
          await ensureTelegramAccount(Number(callback.from?.id),callback.from||{},Number(chatId));
          await say(Number(chatId),"✅ Keanggotaan grup terverifikasi. Akun Telegram kamu siap digunakan. Ketik /menu untuk membuka layanan.");
        }
        return NextResponse.json({ok:true});
      }
      if(!(await checkRequiredGroup(Number(chatId),Number(callback.from?.id)))) return NextResponse.json({ok:true});
      await ensureTelegramAccount(Number(callback.from?.id),callback.from||{},Number(chatId));
      if(action.startsWith("imodel:")){
        const model=action.slice(7);if(!TELEGRAM_IMAGE_MODELS.some(x=>x[0]===model))throw new Error("Image model tidak tersedia.");
        await saveTelegramFlow(Number(callback.from.id),Number(chatId),"image_setup:"+model);
        const opts=(model.startsWith("gpt_image")||model.startsWith("mai_image"))?TELEGRAM_IMAGE_OUTPUTS:TELEGRAM_IMAGE_ASPECTS;
        await say(Number(chatId),"ASPECT RATIO / OUTPUT SIZE\\n\\nPilih pengaturan gambar sesuai model:",{inline_keyboard:opts.map(x=>[{text:x,callback_data:"iaspect:"+x}])});
        return NextResponse.json({ok:true});
      }
      if(action.startsWith("iaspect:")){
        const aspect=action.slice(8),state=await readTelegramFlow(Number(callback.from.id));
        if(!state.startsWith("image_setup:"))throw new Error("Sesi Image Generator kedaluwarsa.");
        const model=state.split(":")[1];
        if(model==="nano_banana_2"||model==="nano_banana_pro"){
          await saveTelegramFlow(Number(callback.from.id),Number(chatId),"image_size:"+model+":"+aspect);
          await say(Number(chatId),"RESOLUTION\\n\\nPilih ukuran output:",{inline_keyboard:TELEGRAM_IMAGE_SIZES.map(x=>[{text:x,callback_data:"isize:"+x}])});
        }else{
          await saveTelegramFlow(Number(callback.from.id),Number(chatId),"image_prompt:"+model+":"+aspect+":auto");
          await say(Number(chatId),"IMAGE PROMPT\\n\\nDescribe the image you want to create...\\n\\nKirim prompt gambar dalam satu pesan.");
        }
        return NextResponse.json({ok:true});
      }
      if(action.startsWith("isize:")){
        const size=action.slice(6);if(!TELEGRAM_IMAGE_SIZES.includes(size))throw new Error("Ukuran gambar tidak valid.");
        const state=await readTelegramFlow(Number(callback.from.id));if(!state.startsWith("image_size:"))throw new Error("Sesi Image Generator kedaluwarsa.");
        const [,model,aspect]=state.split(":");await saveTelegramFlow(Number(callback.from.id),Number(chatId),"image_prompt:"+model+":"+aspect+":"+size);
        await say(Number(chatId),"IMAGE PROMPT\\n\\nDescribe the image you want to create...\\n\\nKirim prompt gambar dalam satu pesan.");
        return NextResponse.json({ok:true});
      }
      if(action.startsWith("ttsvoice:")){
        const voice=action.slice(8);if(!TELEGRAM_VOICES.includes(voice))throw new Error("Voice TTS tidak tersedia.");
        await saveTelegramFlow(Number(callback.from.id),Number(chatId),"tts_prompt:"+voice);
        await say(Number(chatId),"TEXT TO SPEAK\\n\\nTulis teks maksimal 5.000 karakter yang ingin diubah menjadi audio.\\nVoice: "+voice+"\\nBiaya: 200 Credit.");
        return NextResponse.json({ok:true});
      }
      if(action.startsWith("voicepick:")){
        const voiceId=action.slice(10);if(!voiceId||voiceId.length>120)throw new Error("Voice tidak valid.");
        await saveTelegramFlow(Number(callback.from.id),Number(chatId),"voice_config:"+JSON.stringify({voice_id:voiceId}));
        await say(Number(chatId),"VOICE GENERATOR · PENGATURAN\\n\\nKirim parameter dalam SATU pesan dengan format:\\nLANGUAGE,SPEED,STABILITY,SIMILARITY,STYLE\\n\\nContoh: id-ID,1,0.5,0.75,0\\n\\nLanguage: id-ID / en-US / en-GB / ja-JP / ko-KR\\nSpeed: 0.5–2 (step 0.1)\\nStability, Similarity Boost, Style: 0–1 (step 0.05)\\nVoice ID: "+voiceId);
        return NextResponse.json({ok:true});
      }
      if(action==="tool_editor"){
        await say(Number(chatId),"AI IMAGE EDITOR\\n\\nWebsite KAZAMA saat ini hanya menyediakan upload foto, instruksi edit, dan preview lokal. Tombol Generate Edit masih dinonaktifkan karena endpoint gambar belum menerima foto input. Telegram tidak akan mengklaim fitur edit AI sudah aktif.");
        return NextResponse.json({ok:true});
      }
      if(action==="tool_library"){await showVoiceLibrary(Number(chatId),Number(callback.from.id),new URL(req.url).origin);return NextResponse.json({ok:true});}
      if(action==="tool_clone"){
        await saveTelegramFlow(Number(callback.from.id),Number(chatId),"clone_name");
        await say(Number(chatId),"VOICE NAME\\n\\nMasukkan nama voice yang ingin dibuat.");
        return NextResponse.json({ok:true});
      }
      if(action==="clonegender:female"||action==="clonegender:male"){
        const state=await readTelegramFlow(Number(callback.from.id));if(!state.startsWith("clone_gender:"))throw new Error("Sesi Voice Cloning kedaluwarsa.");
        const gender=action.slice("clonegender:".length),name=state.slice("clone_gender:".length);
        await saveTelegramFlow(Number(callback.from.id),Number(chatId),"clone_audio:"+name+":"+gender);
        await say(Number(chatId),"VOICE CLONING\\nNama: "+decodeURIComponent(name)+"\\nGender: "+gender+"\\nKirim sampel audio 15–60 detik (WAV/MP3 atau voice note).");
        return NextResponse.json({ok:true});
      }
      if(action==="account_credits"){
        const d=await studioGet(new URL(req.url).origin,Number(callback.from.id),"credit");
        await say(Number(chatId),"PRICING & CREDITS\\n\\nSaldo tersedia: "+Number(d.credit??d.balance??0).toLocaleString("id-ID")+" Credit\\nFree AI Image: 100 Credit / gambar\\nVideo Generator: 100 Credit / video\\nMusic Generator: 200 Credit / generate\\nText to Speech: 200 Credit / generate\\nVoice Generator: 200 Credit / generate\\nVoice Cloning: 200 Credit / generate\\n\\nPAKET TOP UP\\n500 Credit · Rp5.000\\n2.500 Credit · Rp25.000\\n5.000 Credit · Rp50.000\\n10.100 Credit · Rp100.000\\n\\nPaket dan pembayaran QRIS tersedia di website KAZAMA AI.");
        return NextResponse.json({ok:true});
      }
      if(action.startsWith("vmodel:")) {
        const model=action.slice(7);
        if(model!=="omni_flash")throw new Error("Model video tidak tersedia.");
        await say(Number(chatId),"⚙️ PILIH MODE VIDEO\\n\\nSamakan dengan pilihan di web KAZAMA:",{inline_keyboard:[
          [{text:"Text to Video · T2V",callback_data:"vmode:t2v"}],
          [{text:"Start Frame Video · SFV",callback_data:"vmode:sfv"}],
          [{text:"Image to Video · I2V",callback_data:"vmode:i2v"}],
          [{text:"Video to Video · R2V",callback_data:"vmode:r2v"}]
        ]});
        return NextResponse.json({ok:true});
      }
      if(action.startsWith("vmode:")) {
        const mode=action.slice(6);
        if(!["t2v","sfv","i2v","r2v"].includes(mode))throw new Error("Mode video tidak valid.");
        await saveVideoSession(Number(callback.from.id),Number(chatId),"video_ratio:"+mode);
        await say(Number(chatId),"📐 PILIH ASPECT RATIO\\n\\nPilih rasio output video:",{inline_keyboard:[
          [{text:"Landscape · 16:9",callback_data:"vratio:1"}],
          [{text:"Portrait · 9:16",callback_data:"vratio:2"}]
        ]});
        return NextResponse.json({ok:true});
      }
      if(action.startsWith("vratio:")) {
        const ratio=Number(action.slice(7));
        if(![1,2].includes(ratio))throw new Error("Rasio video tidak valid.");
        const {data:session}=await dbAdmin().from("telegram_video_sessions").select("pending_action").eq("telegram_user_id",Number(callback.from.id)).maybeSingle();
        const pending=String(session?.pending_action||"");
        if(!pending.startsWith("video_ratio:"))throw new Error("Sesi pilihan mode sudah kedaluwarsa. Mulai lagi dari menu Video Generator.");
        const mode=pending.slice("video_ratio:".length);
        await saveVideoSession(Number(callback.from.id),Number(chatId),"video_resolution:"+mode+":"+ratio);
        await say(Number(chatId),"🎞️ PILIH RESOLUSI\\n\\nPilih kualitas video:",{inline_keyboard:[
          [{text:"720p · HD",callback_data:"vres:720"}],
          [{text:"1080p · Full HD",callback_data:"vres:1080"}]
        ]});
        return NextResponse.json({ok:true});
      }
      if(action.startsWith("vres:")) {
        const resolution=Number(action.slice(5));
        if(![720,1080].includes(resolution))throw new Error("Resolusi video tidak valid.");
        const {data:session}=await dbAdmin().from("telegram_video_sessions").select("pending_action").eq("telegram_user_id",Number(callback.from.id)).maybeSingle();
        const pending=String(session?.pending_action||"");
        if(!pending.startsWith("video_resolution:"))throw new Error("Sesi pilihan rasio sudah kedaluwarsa. Mulai lagi dari menu Video Generator.");
        const parts=pending.split(":");
        const mode=parts[1],ratio=Number(parts[2]);
        await saveVideoSession(Number(callback.from.id),Number(chatId),"video_prompt:"+mode+":"+ratio+":"+resolution);
        const hint=mode==="t2v"?"Sekarang kirim prompt teks video.":mode==="sfv"?"Sekarang kirim tepat satu foto sebagai frame pembuka, dengan prompt pada caption.":mode==="i2v"?"Sekarang kirim 1–3 foto referensi sekaligus dalam satu album, lalu tulis prompt video pada caption foto pertama.":"Sekarang kirim satu video referensi dengan caption berisi prompt video."
        await say(Number(chatId),"✅ Pengaturan video siap\\nModel: Omni Flash 1.2\\nMode: "+mode.toUpperCase()+"\\nDurasi: "+(mode==="r2v"?"10":"15")+" detik\\nRasio: "+(ratio===1?"Landscape · 16:9":"Portrait · 9:16")+"\\nResolusi: "+resolution+"p\\n\\n"+hint+"\\nKetik /menu untuk membatalkan.");
        return NextResponse.json({ok:true});
      }
      if (action === "account_balance") await sendBalance(chatId, Number(callback.from.id));
      else if (action === "account_history") await sendLatestStatus(chatId,Number(callback.from.id),new URL(req.url).origin);
      else {
        const promptActions:Record<string,string>={tool_video:"video",tool_music:"music"};
        const promptAction=promptActions[action];
        if(promptAction){
          if(promptAction==="video") await showVideoModels(Number(chatId),Number(callback.from.id),new URL(req.url).origin);
          else {
            await saveTelegramFlow(Number(callback.from.id),Number(chatId),"music_prompt");
            await say(Number(chatId),"MUSIC GENERATOR\\n\\nMUSIC DESCRIPTION\\nGenre, mood, instruments, tempo, atmosphere, and structure...\\n\\nKirim deskripsi musik. Biaya: 200 Credit.");
          }
        } else if(action==="tool_image"){await showImageModels(Number(chatId));
        } else if(action==="tool_tts"){await showTtsVoices(Number(chatId));
        } else if(action==="tool_voice"){await showVoiceLibrary(Number(chatId),Number(callback.from.id),new URL(req.url).origin);
        } else if(action==="tool_motion"){
          await say(chatId,"🎭 MOTION CONTROL\n\nKirim satu video sumber dan satu foto identitas sebagai satu album Telegram. Beri caption album: /motion diikuti prompt gerakan yang diinginkan.");
        } else if(action==="tool_clone"){
          await say(chatId,"🎙️ VOICE CLONING\n\nKirim file audio 15–60 detik dengan caption /clone diikuti nama voice.");
        } else await say(chatId,"Pilih layanan dari /menu.");
      }
      return NextResponse.json({ ok: true });
    }

    const message = update.message;
    const chatId = message?.chat?.id;
    if (chatId) errorChatId=Number(chatId);
    const text = String(message?.text || message?.caption || "").trim();
    if (!chatId) return NextResponse.json({ ok: true });
    if(message.chat?.type==="group"||message.chat?.type==="supergroup") {
      if(String(message.chat?.title||"").trim().toLowerCase()==="kazama ai info") {
        const {error:configError}=await dbAdmin().from("telegram_bot_config").update({
          required_group_chat_id:Number(chatId),
          required_group_title:String(message.chat.title),
          required_group_invite_link:"https://t.me/+U-_-JOE6PgZiNGNl",
          updated_at:new Date().toISOString()
        }).eq("id",1);
        if(configError)throw new Error("Grup wajib belum bisa disimpan.");
        await say(Number(chatId),"✅ Grup KAZAMA AI INFO berhasil dikenali sebagai grup wajib KAZAMA AI. Pastikan bot tetap menjadi admin agar pengecekan anggota berfungsi.");
      }
      return NextResponse.json({ok:true});
    }
    if(!(await checkRequiredGroup(Number(chatId),Number(message.from?.id)))) return NextResponse.json({ok:true});
    await ensureTelegramAccount(Number(message.from?.id),message.from||{},Number(chatId));
    if (message?.media_group_id && message.photo?.length) {
      const db=dbAdmin();
      const {data:videoSession}=await db.from("telegram_video_sessions").select("pending_action").eq("telegram_user_id",Number(message.from?.id)).maybeSingle();
      const pending=String(videoSession?.pending_action||"");
      if(pending.startsWith("video_prompt:i2v:")){
        const fileId=message.photo[message.photo.length-1].file_id;
        const caption=String(message.caption||"").trim();
        const {error:appendError}=await db.rpc("append_telegram_i2v_photo",{
          p_media_group_id:String(message.media_group_id),p_telegram_user_id:Number(message.from?.id),
          p_telegram_chat_id:Number(chatId),p_file_id:fileId,p_prompt:caption
        });
        if(appendError)throw appendError;
        await new Promise(resolve=>setTimeout(resolve,2500));
        const groupId=String(message.media_group_id);
        const {data:group,error:readError}=await db.from("telegram_media_groups").select("photo_file_ids,prompt,status,telegram_user_id").eq("media_group_id",groupId).maybeSingle();
        if(readError)throw readError;
        if(group&&group.status==="pending"&&Number(group.telegram_user_id)===Number(message.from?.id)){
          const {data:claimed,error:claimError}=await db.from("telegram_media_groups").update({status:"processing"}).eq("media_group_id",groupId).eq("status","pending").select("photo_file_ids,prompt").maybeSingle();
          if(claimError)throw claimError;
          if(claimed){
            const ids=Array.isArray(claimed.photo_file_ids)?claimed.photo_file_ids.map((x:any)=>String(x)).slice(0,3):[];
            const prompt=String(claimed.prompt||"").trim();
            if(!prompt)throw new Error("Prompt belum ditemukan. Kirim ulang album 1–3 foto dengan prompt pada caption foto pertama.");
            if(ids.length<1||ids.length>3)throw new Error("Mode Image to Video menerima 1–3 foto referensi.");
            const media=await Promise.all(ids.map((id:string)=>telegramFileData(id)));
            const [,mode,ratioText,resolutionText]=pending.split(":");
            await db.from("telegram_media_groups").delete().eq("media_group_id",groupId);
            await db.from("telegram_video_sessions").delete().eq("telegram_user_id",Number(message.from?.id));
            await generateTelegramVideo(Number(chatId),Number(message.from?.id),new URL(req.url).origin,"omni_flash",mode,prompt,Number(ratioText),Number(resolutionText),media);
          }
        }
        return NextResponse.json({ok:true});
      }
    }
    if (message?.media_group_id && (message.video || message.photo?.length)) {
      const db=dbAdmin();
      const groupId=String(message.media_group_id);
      const {data:existingGroup}=await db.from("telegram_media_groups").select("media_group_id").eq("media_group_id",groupId).maybeSingle();
      const caption=String(message.caption||"").trim();
      if(!existingGroup&&!caption.toLowerCase().startsWith("/motion"))return NextResponse.json({ok:true});
      const separator=caption.indexOf(" ");
      let incomingPrompt=separator>=0?caption.slice(separator+1).trim():"";
      const patch:any={media_group_id:groupId,telegram_user_id:Number(message.from?.id),telegram_chat_id:Number(chatId)};
      if(incomingPrompt)patch.prompt=incomingPrompt;
      if(message.video)patch.video_file_id=message.video.file_id;
      if(message.photo?.length)patch.photo_file_id=message.photo[message.photo.length-1].file_id;
      const {error:upsertError}=await db.from("telegram_media_groups").upsert(patch,{onConflict:"media_group_id"});
      if(upsertError)throw upsertError;
      const {data:group,error:readError}=await db.from("telegram_media_groups").select("*").eq("media_group_id",groupId).single();
      if(readError||!group)throw new Error("Media album belum dapat dibaca.");
      if(group.video_file_id&&group.photo_file_id){
        const media=[await telegramFileData(group.video_file_id),await telegramFileData(group.photo_file_id)];
        await db.from("telegram_media_groups").delete().eq("media_group_id",groupId);
        await runStudio(Number(chatId),Number(message.from?.id),new URL(req.url).origin,"generate",{mode:"r2v",prompt:group.prompt||"Preserve the reference identity and recreate the source video's motion.",media,ratio:1,resolution:1080,duration:10},"Motion Control");
      } else {
        await say(Number(chatId),"📎 Media diterima. Kirim video sumber dan foto identitas sebagai satu album Telegram (pilih keduanya sekaligus), lalu beri caption /motion di album tersebut.");
      }
      return NextResponse.json({ok:true});
    }
    if(message.audio||message.voice||message.document?.mime_type?.startsWith("audio/")){
      const uid=Number(message.from?.id),flow=await readTelegramFlow(uid);
      if(flow.startsWith("clone_audio:")){
        const [,name,gender]=flow.split(":");const fileId=message.audio?.file_id||message.voice?.file_id||message.document?.file_id;
        const duration=Number(message.voice?.duration||message.audio?.duration||message.document?.duration||0);if(duration&&(duration<15||duration>60))throw new Error("Durasi sampel harus 15–60 detik.");const audio=await telegramFileData(fileId);await clearTelegramFlow(uid);
        await runStudio(Number(chatId),uid,new URL(req.url).origin,"voice-clone",{audio,name:decodeURIComponent(name||"My cloned voice"),gender},"Voice Cloning");
        return NextResponse.json({ok:true});
      }
    }
    if(message.photo?.length||message.video){
      const db=dbAdmin();
      const {data:videoSession}=await db.from("telegram_video_sessions").select("pending_action").eq("telegram_user_id",Number(message.from?.id)).maybeSingle();
      const videoAction=String(videoSession?.pending_action||"");
      if(videoAction.startsWith("video_prompt:")){
        const [,mode,ratioText,resolutionText]=videoAction.split(":");
        if(mode==="t2v"){
          await db.from("telegram_video_sessions").delete().eq("telegram_user_id",Number(message.from?.id));
          await generateTelegramVideo(Number(chatId),Number(message.from?.id),new URL(req.url).origin,"omni_flash",mode,text,Number(ratioText),Number(resolutionText));
        } else {
          await say(Number(chatId),mode==="i2v"?"Untuk mode Image to Video, lampirkan 1–3 foto referensi. Tulis prompt pada caption foto pertama.":"Untuk mode Video to Video, lampirkan video referensi dengan prompt pada caption.");
        }
        return NextResponse.json({ok:true});
      }
      const {data:session}=await db.from("telegram_bot_sessions").select("pending_action").eq("telegram_user_id",Number(message.from?.id)).maybeSingle();
      if(session?.pending_action){
        const pendingAction=String(session.pending_action);
        await db.from("telegram_bot_sessions").delete().eq("telegram_user_id",Number(message.from?.id));
        await handleGeneration(chatId,Number(message.from?.id),new URL(req.url).origin,pendingAction,text,message);
        return NextResponse.json({ok:true});
      }
    }
    if(text && !text.startsWith("/")){
      const uid=Number(message.from?.id),flow=await readTelegramFlow(uid);
      if(flow.startsWith("image_prompt:")){
        const [,model,aspect,size]=flow.split(":");await clearTelegramFlow(uid);
        const body:any={model,prompt:text};
        if(model.startsWith("gpt_image")||model.startsWith("mai_image"))body.image_size=aspect;
        else{body.aspect=aspect;if(model==="nano_banana_2"||model==="nano_banana_pro")body.resolution=size;}
        await runStudio(Number(chatId),uid,new URL(req.url).origin,"image",body,"Free AI Image");return NextResponse.json({ok:true});
      }
      if(flow==="music_prompt"){
        await clearTelegramFlow(uid);await runStudio(Number(chatId),uid,new URL(req.url).origin,"generate",{mode:"music",prompt:text},"Music Generator");return NextResponse.json({ok:true});
      }
      if(flow.startsWith("tts_prompt:")){
        const voice=flow.slice("tts_prompt:".length);if(text.length>5000)throw new Error("Teks maksimal 5.000 karakter.");
        await clearTelegramFlow(uid);await runStudio(Number(chatId),uid,new URL(req.url).origin,"generate",{mode:"tts",prompt:text,voice},"Text to Speech");return NextResponse.json({ok:true});
      }
      if(flow.startsWith("voice_config:")){
        const cfg=JSON.parse(flow.slice("voice_config:".length));const parts=text.split(",").map(x=>x.trim());
        const langs=["id-ID","en-US","en-GB","ja-JP","ko-KR"];
        if(parts.length!==5||!langs.includes(parts[0])||!Number.isFinite(Number(parts[1]))||Number(parts[1])<0.5||Number(parts[1])>2||parts.slice(2).some(x=>!Number.isFinite(Number(x))||Number(x)<0||Number(x)>1||Math.round(Number(x)*20)!==Number(x)*20))throw new Error("Format tidak valid. Contoh: id-ID,1,0.5,0.75,0");
        await saveTelegramFlow(uid,Number(chatId),"voice_prompt:"+JSON.stringify({...cfg,language_code:parts[0],speed:Number(parts[1]),stability:Number(parts[2]),similarity_boost:Number(parts[3]),style:Number(parts[4])}));
        await say(Number(chatId),"TEXT · MAX 5,000 CHARACTERS\\n\\nKirim naskah yang akan diucapkan (maksimal 5.000 karakter). Parameter voice sudah disimpan.");
        return NextResponse.json({ok:true});
      }
      if(flow.startsWith("voice_prompt:")){
        if(text.length>5000)throw new Error("Teks maksimal 5.000 karakter.");
        const cfg=JSON.parse(flow.slice("voice_prompt:".length));await clearTelegramFlow(uid);
        await runStudio(Number(chatId),uid,new URL(req.url).origin,"voice",{text,voice_id:cfg.voice_id,language_code:cfg.language_code,speed:cfg.speed,stability:cfg.stability,similarity_boost:cfg.similarity_boost,style:cfg.style},"Voice Generator");
        return NextResponse.json({ok:true});
      }
      if(flow==="clone_name"){
        if(!text.trim()||text.length>80)throw new Error("Nama voice wajib diisi (maksimal 80 karakter).");
        await saveTelegramFlow(uid,Number(chatId),"clone_gender:"+encodeURIComponent(text.trim()));
        await say(Number(chatId),"VOICE GENDER:",{inline_keyboard:[[{text:"Female",callback_data:"clonegender:female"},{text:"Male",callback_data:"clonegender:male"}]]});
        return NextResponse.json({ok:true});
      }
      const videoFlow=await readTelegramFlow(uid);
      if(videoFlow.startsWith("video_prompt:")){
        const [,mode,ratioText,resolutionText]=videoFlow.split(":");
        if(mode==="t2v"){await clearTelegramFlow(uid);await generateTelegramVideo(Number(chatId),uid,new URL(req.url).origin,"omni_flash",mode,text,Number(ratioText),Number(resolutionText));}
        else await say(Number(chatId),mode==="i2v"?"Untuk mode Image to Video, lampirkan 1–3 foto referensi sekaligus dalam satu album. Tulis prompt pada caption foto pertama.":"Untuk mode Video to Video, lampirkan video referensi dengan prompt pada caption.");
        return NextResponse.json({ok:true});
      }
      const db=dbAdmin();
      const {data:session}=await db.from("telegram_bot_sessions").select("pending_action").eq("telegram_user_id",uid).maybeSingle();
      if(session?.pending_action){
        const pendingAction=String(session.pending_action);await db.from("telegram_bot_sessions").delete().eq("telegram_user_id",uid);
        await handleGeneration(Number(chatId),uid,new URL(req.url).origin,pendingAction,text,message);
        return NextResponse.json({ok:true});
      }
    }
    if (/^\/(start|menu)(?:\s|$)/i.test(text)) { await dbAdmin().from("telegram_bot_sessions").delete().eq("telegram_user_id",Number(message.from?.id)); await clearTelegramFlow(Number(message.from?.id)); await sendMenu(chatId, message.from?.first_name || ""); }
    else if (/^\/help(?:\s|$)/i.test(text)) {
      await say(chatId, "Perintah KAZAMA AI:\n/start atau /menu — menu utama\n/link KODE — tautkan akun website\n/saldo — cek Credit\n/video PROMPT — buat video\n/i2v PROMPT + foto — video dari foto\n/motion PROMPT — album video + foto\n/image PROMPT — buat gambar\n/music PROMPT — buat musik\n/tts TEKS — teks ke ucapan\n/voice TEKS — voice generator\n/clone — voice cloning dengan audio\n/status — cek tugas terakhir\n/help — bantuan");
    } else if(/^\\/editor(?:@KazamaAIBot)?$/i.test(text)){await say(Number(chatId),"AI IMAGE EDITOR\\n\\nWebsite KAZAMA saat ini hanya menyediakan upload foto, instruksi edit, dan preview lokal. Generate Edit masih dinonaktifkan karena endpoint belum mendukung foto input.");
    } else if(/^\\/library(?:@KazamaAIBot)?$/i.test(text)){await showVoiceLibrary(Number(chatId),Number(message.from?.id),new URL(req.url).origin);
    } else if(/^\\/credits(?:@KazamaAIBot)?$/i.test(text)){const d=await studioGet(new URL(req.url).origin,Number(message.from?.id),"credit");await say(Number(chatId),"PRICING & CREDITS\\nSaldo: "+Number(d.credit??d.balance??0).toLocaleString("id-ID")+" Credit\\nFree AI Image: 100 Credit\\nVideo Generator: 100 Credit\\nMusic / TTS / Voice / Voice Cloning: 200 Credit per generate\\nPaket top up dan QRIS: buka website KAZAMA AI.");
    } else if(/^\\/clone(?:@KazamaAIBot)?$/i.test(text)){await saveTelegramFlow(Number(message.from?.id),Number(chatId),"clone_name");await say(Number(chatId),"VOICE NAME\\n\\nMasukkan nama voice yang ingin dibuat.");
    } else if (/^\/link(?:@KazamaAIBot)?\s+/i.test(text)) { const code=text.replace(/^\/link(?:@KazamaAIBot)?\s+/i,"").trim(); await linkTelegramAccount(Number(chatId),Number(message.from?.id),code,message.from?.username); }
    else if (text === "/saldo" || text.startsWith("/saldo ")) {
      await sendBalance(chatId, Number(message.from?.id));
    } else if (/^\/(video|image|music|tts|voice|clone|motion|i2v)(?:@KazamaAIBot)?(?:\s|$)/i.test(text)) {
      const match=text.match(/^\/(video|image|music|tts|voice|clone|motion|i2v)(?:@KazamaAIBot)?(?:\s+([\s\S]*))?$/i)!;
      await handleGeneration(chatId,Number(message.from?.id),new URL(req.url).origin,match[1].toLowerCase(),match[2]||message.caption||"",message);
    } else if (text === "/status" || text.startsWith("/status ")) {
      await sendLatestStatus(chatId, Number(message.from?.id),new URL(req.url).origin);
    } else {
      await say(chatId, "Gunakan /menu, /saldo, /video PROMPT, /i2v PROMPT, /motion PROMPT, /image PROMPT, /music PROMPT, /tts TEKS, /voice TEKS, /clone, atau /status.");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("KAZAMA Telegram webhook:", error);
    if(errorChatId) { try { await say(errorChatId,"⚠️ Permintaan belum berhasil diproses. "+(error instanceof Error?error.message:"Silakan coba lagi beberapa saat.")); } catch {} }
    return NextResponse.json({ ok: true });
  }
}
