import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";

function findCost(x:any):{cost:number;currency:string}|null{
 if(!x||typeof x!=="object")return null;
 for(const key of ["amount_usd","cost_usd","total_cost_usd","charged_amount","actual_cost","cost","price"]){
  const value=x[key];
  if(typeof value==="number"&&Number.isFinite(value))return {cost:value,currency:key.includes("usd")||key==="amount_usd"?"USD":String(x.currency||"USD")};
  if(typeof value==="string"&&value.trim()&&Number.isFinite(Number(value)))return {cost:Number(value),currency:key.includes("usd")||key==="amount_usd"?"USD":String(x.currency||"USD")};
 }
 for(const key of ["data","result","usage","billing","task_result","content","output"])if(x[key]){const cost=findCost(x[key]);if(cost)return cost;}
 return null;
}
function findVideo(value:any):string|null{
 if(!value)return null;
 if(typeof value==="string"&&/^https?:\/\//i.test(value)&&/\.mp4(?:$|\?)|\.mov(?:$|\?)/i.test(value))return value;
 if(Array.isArray(value)){for(const item of value){const found=findVideo(item);if(found)return found;}return null;}
 if(typeof value!=="object")return null;
 for(const key of ["video_url","videoUrl","url","download_url"])if(typeof value[key]==="string"&&/^https?:\/\//i.test(value[key])&&(/video|output|url/i.test(key)||/\.mp4(?:$|\?)|\.mov(?:$|\?)/i.test(value[key])))return value[key];
 for(const key of ["data","result","output","content","videos","video","task_result","results"])if(value[key]){const found=findVideo(value[key]);if(found)return found;}
 return null;
}
function errorMessage(value:any):string|null{
 if(!value)return null;
 if(typeof value==="string")return value;
 if(typeof value==="object")return value.message||value.msg||JSON.stringify(value);
 return String(value);
}
export async function GET(req:NextRequest){
 const key=process.env.RELAYROUTER_API_KEY;
 if(!key)return NextResponse.json({error:"API key RelayRouter belum dipasang."},{status:503});
 const id=req.nextUrl.searchParams.get("id");
 if(!id)return NextResponse.json({error:"Task ID diperlukan."},{status:400});
 try{
  const response=await fetch("https://api.relayrouter.ai/api/v3/contents/generations/tasks/"+encodeURIComponent(id),{
   headers:{Authorization:"Bearer "+key,Accept:"application/json"},cache:"no-store",signal:AbortSignal.timeout(25000)
  });
  const raw=await response.text();
  let data:any;
  try{data=raw?JSON.parse(raw):{};}catch{
   console.error("[KAZAMA status] non-JSON response",response.status,raw.slice(0,300));
   return NextResponse.json({error:"RelayRouter mengirim respons status bukan JSON."},{status:502});
  }
  if(!response.ok){
   const message=data?.message||data?.error?.message||data?.error||raw.slice(0,500)||"Gagal mengambil status tugas.";
   return NextResponse.json({error:"RelayRouter ("+response.status+"): "+String(message)},{status:response.status>=400&&response.status<500?response.status:502});
  }
  const root=data.data||data.result||data;
  const billed=findCost(root);
  const status=String(root.status||root.state||"processing").toLowerCase();
  const videoUrl=findVideo(root);
  const failed=["failed","failure","error","cancelled"].includes(status);
  return NextResponse.json({id,status,videoUrl,cost:billed?.cost,currency:billed?.currency,error:failed?errorMessage(root.error||root.message):null});
 }catch(error){
  const message=error instanceof Error?error.message:String(error);
  console.error("[KAZAMA status] request failed",message);
  return NextResponse.json({error:"Tidak dapat memeriksa tugas di RelayRouter: "+message},{status:502});
 }
}