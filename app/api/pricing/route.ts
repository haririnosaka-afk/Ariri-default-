import {NextResponse} from "next/server";
export const dynamic="force-dynamic";

// Acuan sementara dari pemantau harga pihak ketiga untuk model RelayRouter
// doubao-seedance-2-5-260628: $0.0013 per call, dinormalisasi oleh sumber
// menjadi sekitar $0.00027/detik (basis 5 detik). Bukan tarif resmi terverifikasi.
const MODEL_ID="doubao-seedance-2-5-260628";
const USD_PER_SECOND=0.00027;
const RESOLUTIONS=["480p","720p","1080p"];

export async function GET(){
 const key=process.env.RELAYROUTER_API_KEY;
 const byResolution=Object.fromEntries(RESOLUTIONS.map(res=>[res,USD_PER_SECOND]));
 return NextResponse.json({
  configured:!!key,
  connected:!!key,
  rates:{
   [MODEL_ID]:{
    usdPerSecond:USD_PER_SECOND,
    byResolution,
    source:"Indicative manual rate based on third-party RelayRouter listing; unverified",
    verified:false
   }
  },
  pricingMode:"manual_reference",
  note:"Tarif acuan sementara. Harga akhir RelayRouter dapat berbeda dan tidak dijamin."
 });
}
