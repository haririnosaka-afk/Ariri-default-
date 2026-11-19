import {NextResponse} from "next/server";
export const dynamic="force-dynamic";

// Acuan sementara dari pemantau harga pihak ketiga untuk model RelayRouter
// doubao-seedance-2-5-260628: $0.00027/detik (belum terverifikasi).
// Konversi tampilan memakai kurs jual e-Rate BCA 19 Nov 2026: Rp18.295/USD.
const MODEL_ID="doubao-seedance-2-5-260628";
const USD_PER_SECOND=0.00027;
const USD_TO_IDR=18295;
const IDR_PER_SECOND=USD_PER_SECOND*USD_TO_IDR;
const RESOLUTIONS=["480p","720p","1080p"];

export async function GET(){
 const key=process.env.RELAYROUTER_API_KEY;
 const byResolution=Object.fromEntries(RESOLUTIONS.map(res=>[res,IDR_PER_SECOND]));
 return NextResponse.json({
  configured:!!key,
  connected:!!key,
  rates:{
   [MODEL_ID]:{
    idrPerSecond:IDR_PER_SECOND,
    byResolution,
    source:"Indicative manual rate based on third-party RelayRouter listing; unverified",
    verified:false
   }
  },
  currency:"IDR",
  exchangeRate:{from:"USD",to:"IDR",rate:USD_TO_IDR,source:"BCA e-Rate sell, 19 Nov 2026"},
  pricingMode:"manual_reference",
  note:"Tarif rupiah adalah estimasi dari acuan pihak ketiga yang belum terverifikasi; tagihan akhir RelayRouter dapat berbeda."
 });
}
