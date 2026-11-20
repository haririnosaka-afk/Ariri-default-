import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(){const configured=Boolean(process.env.DOLA_POOL_BASE_URL&&process.env.DOLA_POOL_API_KEY);return NextResponse.json({configured,connected:configured,provider:"Dola Pool",pricingMode:"provider_actual_usage",hasRates:false,rates:{},note:configured?"Biaya mengikuti kuota akun dan model pada Dola Pool.":"Dola Pool belum dikonfigurasi."})}
