import {NextResponse} from "next/server";
export const dynamic="force-dynamic";
const IDS=["doubao-seedance-2-5-260628"];
const RESOLUTIONS=["480p","720p","1080p"];
function readRate(p:any):number|null{
 if(p===null||p===undefined)return null;
 if(typeof p==="number"&&Number.isFinite(p))return p;
 if(typeof p==="string"&&p.trim()&&Number.isFinite(Number(p)))return Number(p);
 if(typeof p!=="object")return null;
 const candidates=[
  ["usd_per_second",p.usd_per_second],["usdPerSecond",p.usdPerSecond],
  ["price_per_second",p.price_per_second],["pricePerSecond",p.pricePerSecond],
  ["video_price_per_second",p.video_price_per_second],["videoPricePerSecond",p.videoPricePerSecond],
  ["per_second",p.per_second],["perSecond",p.perSecond],
  ["video_sec_price",p.video_sec_price],["video_sec_micro",p.video_sec_micro]
 ] as const;
 for(const [key,raw] of candidates){
  if(typeof raw==="number"&&Number.isFinite(raw))return key==="video_sec_micro"?raw/1_000_000:raw;
  if(typeof raw==="string"&&raw.trim()&&Number.isFinite(Number(raw)))return key==="video_sec_micro"?Number(raw)/1_000_000:Number(raw);
 }
 for(const key of ["video","video_generation","videoGeneration","pricing","rates"]){
  const nested=readRate(p[key]);
  if(nested!==null)return nested;
 }
 return null;
}
export async function GET(){
 const key=process.env.RELAYROUTER_API_KEY;
 if(!key)return NextResponse.json({configured:false,connected:false,rates:{},message:"API key belum dipasang."});
 try{
  const r=await fetch("https://api.relayrouter.ai/v1/models",{headers:{Authorization:"Bearer "+key,Accept:"application/json"},cache:"no-store"});
  const d=await r.json();
  if(!r.ok)return NextResponse.json({configured:true,connected:false,httpStatus:r.status,rates:{},message:r.status===401?"API Key ditolak RelayRouter. Periksa API Token.":r.status===403?"Akses API ditolak atau model tidak diizinkan.":"RelayRouter gagal merespons katalog model."});
  const rows=Array.isArray(d)?d:Array.isArray(d.data)?d.data:Array.isArray(d.models)?d.models:[];
  const rates:Record<string,{usdPerSecond:number|null;byResolution:Record<string,number|null>;source:string}>={};
  for(const id of IDS){
   const m=rows.find((x:any)=>(x.id||x.name)===id);
   const pricing=m?.pricing||m?.prices||m||{};
   const byResolution:Record<string,number|null>={};
   for(const res of RESOLUTIONS)byResolution[res]=readRate(pricing?.[res]||pricing?.resolutions?.[res]||pricing);
   rates[id]={usdPerSecond:readRate(pricing),byResolution,source:m?"RelayRouter model catalog":"Model not returned by API catalog"};
  }
  return NextResponse.json({configured:true,connected:true,httpStatus:r.status,rates,source:"Live RelayRouter model catalog only; no estimated fallback",updatedAt:new Date().toISOString()});
 }catch{return NextResponse.json({configured:true,connected:false,rates:{},message:"Gagal menghubungi katalog RelayRouter."});}
}