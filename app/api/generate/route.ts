import { NextRequest, NextResponse } from "next/server";
export const maxDuration=60;
export async function POST(req:NextRequest){
 const key=process.env.RELAYROUTER_API_KEY; if(!key) return NextResponse.json({error:"API key belum dipasang di Vercel (RELAYROUTER_API_KEY)."}, {status:503});
 const body=await req.json(); const {model,prompt,seconds,ratio,resolution,image}=body;
 if(!model||!prompt?.trim()) return NextResponse.json({error:"Pilih model dan isi prompt."},{status:400});
 // Unified video route. Provider-specific models may require a dedicated RelayRouter route.
 const payload:any={model,prompt,seconds:String(seconds||5),size:ratio==="9:16"?"720x1280":ratio==="1:1"?"720x720":"1280x720"};
 if(image) payload.input_reference=image;
 try { const r=await fetch("https://api.relayrouter.ai/v1/videos",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(payload)}); const data=await r.json(); if(!r.ok) return NextResponse.json({error:data?.error?.message||data?.message||"RelayRouter rejected the request",details:data},{status:r.status}); return NextResponse.json({ok:true,...data}); } catch { return NextResponse.json({error:"RelayRouter tidak dapat dihubungi."},{status:502}); }
}
