import {NextResponse} from "next/server";
export const dynamic="force-dynamic";
const BASE_CALL_USD:Record<string,number>={
 "doubao-seedance-2-0-260128":0.0013,
 "doubao-seedance-2-0-fast-260128":0.00097,
 "doubao-seedance-2-0-mini-260615":0.00097,
 "doubao-seedance-2-5-260628":0.0013
};
const IDS=Object.keys(BASE_CALL_USD);
function readRate(model:any):number|null{
 const p=model?.pricing||model?.prices||model||{};
 const raw=p.usd_per_second??p.price_per_second??p.video_price_per_second??p.video_sec_price??p.video_sec_micro;
 if(typeof raw==="number"&&Number.isFinite(raw))return p.video_sec_micro===raw?raw/1_000_000:raw;
 if(typeof raw==="string"&&raw.trim()&&Number.isFinite(Number(raw)))return Number(raw);
 return null;
}
export async function GET(){
 const key=process.env.RELAYROUTER_API_KEY;
 const fallbackRates=Object.fromEntries(IDS.map(id=>[id,{usdPerSecond:BASE_CALL_USD[id]/5,source:"Estimated from observed 5-second call quote; not confirmed by RelayRouter"}]));
 if(!key)return NextResponse.json({configured:false,connected:false,rates:fallbackRates,message:"API key belum dipasang. Estimasi memakai tarif referensi."});
 try{
  const r=await fetch("https://api.relayrouter.ai/v1/models",{headers:{Authorization:"Bearer "+key,Accept:"application/json"},cache:"no-store"});
  const d=await r.json();if(!r.ok)return NextResponse.json({configured:true,connected:false,httpStatus:r.status,rates:fallbackRates,message:r.status===401?"API Key ditolak RelayRouter. Periksa API Token.":r.status===403?"Akses API ditolak atau model tidak diizinkan.":"RelayRouter gagal merespons katalog model."},{status:200});
  const rows=Array.isArray(d)?d:Array.isArray(d.data)?d.data:Array.isArray(d.models)?d.models:[];
  const rates:Record<string,{usdPerSecond:number|null;source:string}>={};
  for(const id of IDS){const m=rows.find((x:any)=>(x.id||x.name)===id);const live=m?readRate(m):null;rates[id]=live!==null?{usdPerSecond:live,source:"RelayRouter model catalog"}:fallbackRates[id];}
  return NextResponse.json({configured:true,connected:true,httpStatus:r.status,rates,source:"RelayRouter catalog with reference fallback",updatedAt:new Date().toISOString()});
 }catch{return NextResponse.json({configured:true,connected:false,rates:fallbackRates,message:"Gagal menghubungi katalog RelayRouter. Estimasi memakai tarif referensi."},{status:200});}
}