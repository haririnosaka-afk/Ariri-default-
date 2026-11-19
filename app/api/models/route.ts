import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
 const key=process.env.RELAYROUTER_API_KEY;
 if(!key) return NextResponse.json({configured:false,models:[]});
 try { const r=await fetch("https://api.relayrouter.ai/v1/models",{headers:{Authorization:`Bearer ${key}`},cache:"no-store"}); const data=await r.json(); if(!r.ok) return NextResponse.json({configured:true,error:data?.error?.message||"Model list unavailable",models:[]},{status:r.status}); const models=(data?.data||[]).filter((m:any)=>/video|seedance|kling|veo|sora|wan|vidu|luma|pixverse|hailuo|doubao/i.test(m.id+" "+(m.name||""))); return NextResponse.json({configured:true,models}); } catch { return NextResponse.json({configured:true,error:"Could not connect to RelayRouter",models:[]},{status:502}); }
}
