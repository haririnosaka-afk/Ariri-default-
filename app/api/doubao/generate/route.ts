import { NextRequest, NextResponse } from "next/server";
import { getDoubaoSlots, nextDoubaoSlot } from "@/lib/doubao-pool";
export const runtime = "nodejs";
export const maxDuration = 60;
async function parse(response: Response) { const raw = await response.text(); try { return { data: raw ? JSON.parse(raw) : {}, raw }; } catch { return { data: null as any, raw }; } }
const isHttps = (v: unknown) => typeof v === "string" && /^https:\/\//i.test(v);
export async function POST(req: NextRequest) {
 const expectedCode=process.env.DOUBAO_POOL_ACCESS_CODE;
 if(!expectedCode)return NextResponse.json({error:"DOUBAO_POOL_ACCESS_CODE belum diatur di Vercel."},{status:503});
 if(req.headers.get("x-kazama-pool-code")!==expectedCode)return NextResponse.json({error:"Kode akses pool salah."},{status:401});
 const slots=getDoubaoSlots(); if(!slots.length)return NextResponse.json({error:"Pool Doubao belum dikonfigurasi."},{status:503});
 let b:any;try{b=await req.json()}catch{return NextResponse.json({error:"Body JSON tidak valid."},{status:400})}
 const model=String(b.model||"doubao-seedance-2-5-260628"),flash=model==="doubao-seedance-2-5-flash-261115";
 if(!flash&&model!=="doubao-seedance-2-5-260628")return NextResponse.json({error:"Model tidak didukung."},{status:400});
 const mode=String(b.mode||"reference"),taskType=String(b.taskType||"auto"),prompt=String(b.prompt||"").trim();
 const duration=Number(b.duration??30),resolution=String(b.resolution||"720p"),ratio=String(b.ratio||"adaptive");
 const images=Array.isArray(b.imageUrls)?b.imageUrls.filter(isHttps):[],videos=Array.isArray(b.videoUrls)?b.videoUrls.filter(isHttps):[],audios=Array.isArray(b.audioUrls)?b.audioUrls.filter(isHttps):[];
 const maxImages=flash?10:30,maxVideos=flash?5:10,maxAudios=flash?5:10;
 if(!prompt&&!images.length&&!videos.length&&!audios.length)return NextResponse.json({error:"Masukkan prompt atau minimal satu bahan referensi."},{status:400});
 if(images.length>maxImages||videos.length>maxVideos||audios.length>maxAudios)return NextResponse.json({error:"Jumlah bahan referensi melebihi batas model."},{status:400});
 if(mode==="first"&&images.length!==1)return NextResponse.json({error:"Mode frame pertama membutuhkan tepat 1 URL gambar."},{status:400});
 if(mode==="first_last"&&images.length!==2)return NextResponse.json({error:"Mode frame pertama + terakhir membutuhkan tepat 2 URL gambar."},{status:400});
 if(mode!=="reference"&&(videos.length||audios.length))return NextResponse.json({error:"Mode frame tidak dapat dicampur dengan referensi video/audio."},{status:400});
 if(mode!=="reference"&&images.length>2)return NextResponse.json({error:"Mode frame hanya menerima 1 atau 2 gambar."},{status:400});
 if(!Number.isInteger(duration)||!(duration===-1||(duration>=4&&duration<=30)))return NextResponse.json({error:"Durasi harus 4–30 detik atau Otomatis (-1)."}, {status:400});
 if(taskType==="edit"||taskType==="extend"){if(!videos.length)return NextResponse.json({error:"Edit/extend wajib memiliki minimal satu video referensi."},{status:400});if(ratio!=="adaptive")return NextResponse.json({error:"Edit/extend hanya mendukung rasio adaptive."},{status:400});if(taskType==="edit"&&duration!==-1)return NextResponse.json({error:"Mode edit video harus memakai durasi Otomatis (-1)."}, {status:400});}
 if(mode!=="reference"&&ratio!=="adaptive")return NextResponse.json({error:"Mode frame Seedance 2.5 hanya mendukung rasio adaptive."},{status:400});
 if(taskType!=="auto"&&taskType!=="reference"&&taskType!=="edit"&&taskType!=="extend")return NextResponse.json({error:"Jenis tugas tidak valid."},{status:400});
 if(taskType==="edit"||taskType==="extend"){if(mode!=="reference")return NextResponse.json({error:"Edit/extend harus memakai mode referensi multimodal."},{status:400});}
 if(!["16:9","9:16","1:1","4:3","3:4","21:9","adaptive"].includes(ratio))return NextResponse.json({error:"Rasio tidak valid."},{status:400});
 if(!(flash?["480p","720p"]:["480p","720p","1080p","4k"]).includes(resolution))return NextResponse.json({error:"Resolusi tidak didukung model."},{status:400});
 if(b.draft&&flash)return NextResponse.json({error:"Draft hanya tersedia untuk Seedance 2.5 Standard."},{status:400});
 if(b.draft&&resolution!=="480p")return NextResponse.json({error:"Draft hanya mendukung 480p."},{status:400});
 const content:any[]=[];
 if(prompt)content.push({type:"text",text:prompt});
 if(mode==="first"){content.push({type:"image_url",role:"first_frame",image_url:{url:images[0]}})}
 else if(mode==="first_last"){content.push({type:"image_url",role:"first_frame",image_url:{url:images[0]}},{type:"image_url",role:"last_frame",image_url:{url:images[1]}})}
 else {for(const url of images)content.push({type:"image_url",role:"reference_image",image_url:{url}});for(const url of videos)content.push({type:"video_url",role:"reference_video",video_url:{url}});for(const url of audios)content.push({type:"audio_url",role:"reference_audio",audio_url:{url}})}
 const payload:any={model,content,resolution,ratio,duration,generate_audio:Boolean(b.generateAudio),watermark:Boolean(b.watermark),output_format:b.outputFormat==="mov"?"mov":"mp4",return_last_frame:Boolean(b.returnLastFrame)};
 if(mode==="reference")payload.omni_reference_task_type=taskType;
 if(b.draft)payload.draft=true;
 const first=nextDoubaoSlot(),order=Array.from({length:slots.length},(_,o)=>(first+o)%slots.length);let lastError="Tidak ada akun yang dapat memproses permintaan.";
 for(const slotIndex of order){const slot=slots[slotIndex];try{const response=await fetch(slot.baseUrl+"/contents/generations/tasks",{method:"POST",headers:{Authorization:"Bearer "+slot.apiKey,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(55000)});const {data,raw}=await parse(response);if(response.ok){const id=data?.id||data?.task_id||data?.data?.id;if(!id)return NextResponse.json({error:"Ark tidak mengembalikan task ID.",details:data||raw.slice(0,300)},{status:502});return NextResponse.json({ok:true,id:String(id),status:data?.status||"queued",provider:"doubao-ark",providerSlot:slotIndex,model,accountLabel:slot.label})}lastError=String(data?.message||data?.error?.message||data?.error||raw.slice(0,300)||"Ark menolak request.");if(response.status!==429)return NextResponse.json({error:"Doubao Ark ("+response.status+"): "+lastError,providerSlot:slotIndex},{status:response.status>=500?502:response.status})}catch(e){return NextResponse.json({error:"Koneksi terputus; status penerimaan belum pasti, tidak mencoba akun lain agar tidak menimbulkan tagihan ganda. "+(e instanceof Error?e.message:String(e))},{status:502})}}
 return NextResponse.json({error:"Semua akun pool sedang terkena rate limit. "+lastError},{status:503});
}