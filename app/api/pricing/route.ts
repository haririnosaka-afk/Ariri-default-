import {NextResponse} from "next/server";
export const dynamic="force-dynamic";

// Perhitungan KAZAMA: 1 detik durasi = 1 unit pemanggilan.
// Acuan harga unit model doubao-seedance-2-5-260628: US$0.0013 per call
// dari pemantau pihak ketiga RelayRouter; belum merupakan tarif resmi terverifikasi.
// Kurs tampilan: Rp18.295 per USD.
const MODEL_ID="doubao-seedance-2-5-260628";
const USD_PER_SECOND_CALL=0.0013;
const USD_TO_IDR=18295;
const IDR_PER_SECOND_CALL=USD_PER_SECOND_CALL*USD_TO_IDR;
const RESOLUTIONS=["480p","720p","1080p"];

export async function GET(){
 const key=process.env.RELAYROUTER_API_KEY;
 const byResolution=Object.fromEntries(RESOLUTIONS.map(res=>[res,IDR_PER_SECOND_CALL]));
 return NextResponse.json({
  configured:!!key,
  connected:!!key,
  rates:{
   [MODEL_ID]:{
    idrPerSecond:IDR_PER_SECOND_CALL,
    byResolution,
    source:"Manual: 1 second = 1 call unit; reference $0.0013/call, unverified",
    verified:false
   }
  },
  currency:"IDR",
  unit:"1 detik = 1 unit pemanggilan",
  exchangeRate:{from:"USD",to:"IDR",rate:USD_TO_IDR,source:"Manual display conversion rate"},
  pricingMode:"manual_per_second_call",
  note:"Estimasi KAZAMA dihitung sendiri: jumlah detik × harga satu unit pemanggilan. Tagihan aktual RelayRouter dapat berbeda."
 });
}
