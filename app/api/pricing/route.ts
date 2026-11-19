import {NextResponse} from "next/server";
export const dynamic="force-dynamic";
const IDS=["doubao-seedance-2-0-260128","doubao-seedance-2-0-fast-260128","doubao-seedance-2-0-mini-260615","doubao-seedance-2-5-260628"];
const RESOLUTIONS=["480p","720p","1080p","4k"];
function readRate(p:any):number|null{
 if(!p||typeof p!=="object")return null;
 const raw=p.usd_per_second??p.price_per_second??p.video_price_per_second??p.video_sec_price??p.video_sec_micro;
 if(typeof raw==="number"&&Number.isFinite(raw))return p.video_sec_micro===raw?raw/1_000_000:raw;
 if(typeof raw==="string"&&raw.trim()&&Number.isFinite(Number(raw)))return Number(raw);
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
  // Fallback estimates based on publicly indexed RelayRouter.ai Seedance call prices.
  // The listing is not an authenticated billing quote; divide its 5-second reference
  // amount by 5 so the UI can estimate proportionally by requested video duration.
  const fallbackPerFiveSeconds:Record<string,number>={
   "doubao-seedance-2-0-260128":0.0013,
   "doubao-seedance-2-0-fast-260128":0.00097,
   "doubao-seedance-2-0-mini-260615":0.00097,
   "doubao-seedance-2-5-260628":0.0013
  };
  for(const id of IDS){
   if(rates[id]?.usdPerSecond==null){
    const perSecond=fallbackPerFiveSeconds[id]/5;
    // Resolution scales the estimate by rendered pixel count relative to 720p.
    // Public listing exposes a per-call reference, not an official resolution tariff.
    const pixelScale:Record<string,number>={"480p":(854*480)/(1280*720),"720p":1,"1080p":(1920*1080)/(1280*720),"4k":(3840*2160)/(1280*720)};
    const byResolution:Record<string,number|null>={};
    for(const res of RESOLUTIONS)byResolution[res]=perSecond*pixelScale[res];
    rates[id]={usdPerSecond:perSecond,byResolution,source:"RelayRouter.ai public call-price reference scaled by resolution pixels",estimated:true} as any;
   }
  }
  return NextResponse.json({configured:true,connected:true,httpStatus:r.status,rates,source:"RelayRouter catalog with public-price fallback estimate",updatedAt:new Date().toISOString()});
 }catch{return NextResponse.json({configured:true,connected:false,rates:{},message:"Gagal menghubungi katalog RelayRouter."});}
}