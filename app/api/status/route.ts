import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
function findCost(x:any):{cost:number;currency:string}|null{\n if(!x||typeof x!=="object")return null;\n for(const k of ["cost_usd","total_cost_usd","charged_amount","actual_cost","cost","price"]){const v=x[k];if(typeof v==="number"&&Number.isFinite(v))return {cost:v,currency:k.includes("usd")?"USD":String(x.currency||"USD")};if(typeof v==="string"&&v.trim()&&Number.isFinite(Number(v)))return {cost:Number(v),currency:k.includes("usd")?"USD":String(x.currency||"USD")};}\n for(const k of ["data","result","usage","billing","task_result"])if(x[k]){const c=findCost(x[k]);if(c)return c;}\n return null;\n}\nfunction findVideo(x:any):string|null{
 if(!x||typeof x!=="object")return null;
 if(typeof x.video_url==="string")return x.video_url;
 if(typeof x.url==="string"&&/\.mp4|video/i.test(x.url))return x.url;
 if(Array.isArray(x))for(const item of x){const v=findVideo(item);if(v)return v;}
 for(const k of ["data","result","output","content","videos","video","task_result"])if(x[k]){const v=findVideo(x[k]);if(v)return v;}
 return null;
}
export async function GET(req:NextRequest){
 const key=process.env.RELAYROUTER_API_KEY;
 if(!key)return NextResponse.json({error:"API key belum dipasang."},{status:503});
 const id=req.nextUrl.searchParams.get("id");
 if(!id)return NextResponse.json({error:"Task ID diperlukan."},{status:400});
 try{
  const r=await fetch("https://api.relayrouter.ai/api/v3/contents/generations/tasks/"+encodeURIComponent(id),{headers:{Authorization:"Bearer "+key},cache:"no-store"});
  const d=await r.json();
  if(!r.ok)return NextResponse.json({error:d?.message||d?.error?.message||"Gagal mengambil status.",details:d},{status:r.status});
  const root=d.data||d.result||d;
  const billed=findCost(root);\n  return NextResponse.json({id,status:root.status||root.state||"processing",videoUrl:findVideo(root),cost:billed?.cost,currency:billed?.currency,error:root.error||null,raw:d});
 }catch{return NextResponse.json({error:"Gagal memeriksa status tugas."},{status:502});}
}