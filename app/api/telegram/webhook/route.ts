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
    {command:"video",description:"Buat video AI"},
    {command:"i2v",description:"Buat video dari foto"},
    {command:"motion",description:"Motion Control"},
    {command:"image",description:"Buat gambar AI"},
    {command:"music",description:"Buat musik AI"},
    {command:"tts",description:"Teks menjadi ucapan"},
    {command:"voice",description:"Voice Generator"},
    {command:"clone",description:"Voice Cloning"},
    {command:"status",description:"Cek status tugas"},
    {command:"help",description:"Bantuan"}
  ]}).catch(()=>null);
  return say(chatId,
    `Halo${name}! 👋 Selamat datang di KAZAMA AI.\n\nAkun Telegram kamu berdiri sendiri, terpisah dari akun website. Saldo Credit dan riwayat Telegram hanya berlaku di bot ini. Pilih layanan di bawah.`,
    { inline_keyboard: [
      [{ text: "🎬 Video Generator", callback_data: "tool_video" }],
      [{ text: "🖼️ Image Generator", callback_data: "tool_image" }],
      [{ text: "🎭 Motion Control", callback_data: "tool_motion" }],
      [{ text: "🎵 Music Generator", callback_data: "tool_music" }],
      [{ text: "🎙️ Voice Studio", callback_data: "tool_voice" }],
      [{ text: "💳 Saldo Credit", callback_data: "account_balance" }],
      [{ text: "📚 Riwayat Telegram", callback_data: "account_history" }],
      [{ text: "🌐 Buka Website", url: "https://kazamaai.my.id" }],
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

async function sendBalance(chatId: number, telegramUserId: number) {
  const db = dbAdmin();
  const { data: account, error: accountError } = await db.from("telegram_native_accounts")
    .select("user_id").eq("telegram_user_id", telegramUserId).single();
  if (accountError || !account) throw new Error("Akun Telegram belum dibuat. Ketik /start terlebih dahulu.");
  const { data: profile, error } = await db.from("profiles")
    .select("email,balance").eq("id", account.user_id).single();
  if (error || !profile) throw new Error("Data saldo akun tidak dapat dibaca.");
  await say(chatId, `💳 KAZAMA TELEGRAM WALLET\nID Telegram: ${telegramUserId}\nSaldo: ${Number(profile.balance) * 100} Credit\n\nWallet ini terpisah dari akun website.`);
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
  if(bytes.length>2.8*1024*1024)throw new Error("File terlalu besar. Maksimal 2,8 MB per file agar aman diproses.");
  return "data:"+type+";base64,"+bytes.toString("base64");
}
async function posbotCall(origin:string,telegramUserId:number,body:any) {
  const secret=process.env.TELEGRAM_WEBHOOK_SECRET;
  if(!secret) throw new Error("Layanan bot belum dikonfigurasi.");
  const response=await fetch(origin+"/api/posbot",{
    method:"POST",
    headers:{"Content-Type":"application/json","x-kazama-internal-secret":secret,"x-kazama-telegram-user-id":String(telegramUserId)},
    body:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(280000)
  });
  const data=await response.json().catch(()=>({ok:false,error:"Respons KAZAMA tidak valid."}));
  if(!response.ok||data.ok===false)throw new Error(String(data.error||"Generator gagal memproses permintaan."));
  return data;
}
async function showVideoModels(chatId:number,telegramUserId:number,origin:string) {
  const response=await fetch(origin+"/api/posbot?resource=video-models",{
    headers:{"x-kazama-internal-secret":process.env.TELEGRAM_WEBHOOK_SECRET||"","x-kazama-telegram-user-id":String(telegramUserId)},
    cache:"no-store",signal:AbortSignal.timeout(30000)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.ok===false)throw new Error(data.error||"Katalog model video belum tersedia.");
  const models=(Array.isArray(data.models)?data.models:[]).filter((m:any)=>{
    const name=String(m.name||m.title||m.model_key||"");
    return m.model_key && !/seedance/i.test(name+" "+m.model_key);
  });
  if(!models.length)throw new Error("Belum ada model video yang tersedia.");
  const rows=models.slice(0,40).map((m:any)=>[{
    text:(String(m.name||m.title||m.model_key).replace(/nexa\s*bot|pos\s*bot/ig,"").trim().slice(0,42)+" · "+String(m.customer_tokens??"-")+" Credit").slice(0,60),
    callback_data:"vmodel:"+String(m.model_key).slice(0,48)
  }]);
  await say(chatId,"🎬 PILIH MODEL VIDEO\n\nPilih model yang ingin kamu gunakan. Harga Credit ditampilkan di setiap pilihan.",{inline_keyboard:rows});
}
async function generateTelegramVideo(chatId:number,telegramUserId:number,origin:string,model:string,prompt:string) {
  if(!prompt.trim()) throw new Error("Prompt video tidak boleh kosong.");
  await say(chatId,"⏳ Video sedang diproses dengan model pilihanmu. Mohon tunggu…");
  const result=await posbotCall(origin,telegramUserId,{resource:"generate",model,prompt});
  await say(chatId,"✅ Permintaan video diterima!\n\nModel: "+(result.model||model)+"\nBiaya: "+(result.customer_tokens??"-")+" Credit\nID tugas: "+result.job_id+"\nStatus: "+(result.status||"queued")+"\n\nKirim /status untuk memeriksa hasil.");
}
async function runStudio(chatId:number, telegramUserId:number, origin:string, resource:string, payload:any, label:string) {
  await say(chatId,"⏳ "+label+" sedang diproses oleh KAZAMA AI. Mohon tunggu…");
  const result=await studioCall(origin,telegramUserId,{resource,...payload});
  if(result.job_id){
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
  const {data:link,error:linkError}=await db.from("telegram_native_accounts").select("user_id").eq("telegram_user_id",telegramUserId).single();
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
      const url=String(job.url||job.video_url||job.output_url||job.result_url||"");
      if(url&&/^(completed|done|success|succeeded)$/i.test(status)){
        await telegram("sendVideo",{chat_id:chatId,video:url,caption:"✅ Video KAZAMA AI selesai.\nID: "+latest.provider_job_id});
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
    const {data:voices}=await dbAdmin().from("telegram_native_accounts").select("user_id").eq("telegram_user_id",telegramUserId).single();
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
      if(action.startsWith("vmodel:")) {
        const model=action.slice(7);
        await dbAdmin().from("telegram_bot_sessions").upsert({telegram_user_id:Number(callback.from.id),telegram_chat_id:Number(chatId),pending_action:"video_prompt:"+model,created_at:new Date().toISOString()},{onConflict:"telegram_user_id"});
        await say(Number(chatId),"✅ Model dipilih: "+model+"\\n\\nSekarang kirim prompt video yang ingin kamu buat.");
        return NextResponse.json({ok:true});
      }
      if (action === "account_balance") await sendBalance(chatId, Number(callback.from.id));
      else if (action === "account_history") await sendLatestStatus(chatId,Number(callback.from.id),new URL(req.url).origin);
      else {
        const promptActions:Record<string,string>={tool_video:"video",tool_image:"image",tool_music:"music",tool_voice:"voice",tool_tts:"tts"};
        const promptAction=promptActions[action];
        if(promptAction){
          if(promptAction==="video") {
            await showVideoModels(Number(chatId),Number(callback.from.id),new URL(req.url).origin);
          } else {
            const {error:sessionError}=await dbAdmin().from("telegram_bot_sessions").upsert({telegram_user_id:Number(callback.from.id),telegram_chat_id:Number(chatId),pending_action:promptAction,created_at:new Date().toISOString()},{onConflict:"telegram_user_id"});
            if(sessionError)throw new Error("Sesi generator tidak dapat dimulai. Coba pilih menu lagi.");
            const titles:Record<string,string>={image:"🖼️ IMAGE GENERATOR",music:"🎵 MUSIC GENERATOR",voice:"🎙️ VOICE STUDIO",tts:"🗣️ TEXT TO SPEECH"};
            const hints:Record<string,string>={image:"Kirim deskripsi gambar yang ingin kamu buat.",music:"Kirim ide atau deskripsi musik yang ingin kamu buat.",voice:"Kirim teks yang ingin diubah menjadi suara.",tts:"Kirim teks yang ingin dibacakan."};
            await say(chatId,titles[promptAction]+"\\n\\n"+hints[promptAction]+"\\n\\nKetik /menu untuk membatalkan dan kembali ke menu.");
          }
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
    if(text && !text.startsWith("/")){
      const db=dbAdmin();
      const {data:session}=await db.from("telegram_bot_sessions").select("pending_action").eq("telegram_user_id",Number(message.from?.id)).maybeSingle();
      if(session?.pending_action){
        await db.from("telegram_bot_sessions").delete().eq("telegram_user_id",Number(message.from?.id));
        const pendingAction=String(session.pending_action);
        if(pendingAction.startsWith("video_prompt:")){
          const selectedModel=pendingAction.slice("video_prompt:".length);
          await generateTelegramVideo(chatId,Number(message.from?.id),new URL(req.url).origin,selectedModel,text);
        } else {
          await handleGeneration(chatId,Number(message.from?.id),new URL(req.url).origin,pendingAction,text,message);
        }
        return NextResponse.json({ok:true});
      }
    }
    if (/^\/(start|menu)(?:\s|$)/i.test(text)) { await dbAdmin().from("telegram_bot_sessions").delete().eq("telegram_user_id",Number(message.from?.id)); await sendMenu(chatId, message.from?.first_name || ""); }
    else if (/^\/help(?:\s|$)/i.test(text)) {
      await say(chatId, "Perintah KAZAMA AI:\n/start atau /menu — menu utama\n/saldo — cek Credit\n/video PROMPT — buat video\n/i2v PROMPT + foto — video dari foto\n/motion PROMPT — album video + foto\n/image PROMPT — buat gambar\n/music PROMPT — buat musik\n/tts TEKS — teks ke ucapan\n/voice TEKS — voice generator\n/clone — voice cloning dengan audio\n/status — cek tugas terakhir\n/help — bantuan");
    } else if (text === "/saldo" || text.startsWith("/saldo ")) {
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
