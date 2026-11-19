import {NextRequest,NextResponse} from "next/server";

export const runtime="nodejs";
export const maxDuration=60;

async function readBody(response:Response){
 const raw=await response.text();
 try{return {data:raw?JSON.parse(raw):{},raw};}
 catch{return {data:null,raw};}
}

export async function POST(req:NextRequest){
 const key=process.env.RELAYROUTER_API_KEY;
 if(!key)return NextResponse.json({error:"RELAYROUTER_API_KEY belum dipasang di Vercel."},{status:503});
 try{
  const form=await req.formData();
  const file=form.get("file");
  if(!(file instanceof File))return NextResponse.json({error:"File gambar tidak ditemukan."},{status:400});
  if(!file.type.startsWith("image/"))return NextResponse.json({error:"Format harus gambar."},{status:400});
  if(file.size>4*1024*1024)return NextResponse.json({error:"Foto setelah kompresi harus di bawah 4 MB agar melewati batas request Vercel."},{status:413});
  const upstream=new FormData();
  upstream.append("file",file,file.name);
  // RelayRouter documents this dedicated image-host URL for Seedance reference images.
  const response=await fetch("https://imageproxy.api-relay.app/api/upload",{
   method:"POST",
   headers:{Authorization:"Bearer "+key},
   body:upstream,
   signal:AbortSignal.timeout(55000)
  });
  const {data,raw}=await readBody(response);
  if(!response.ok){
   const message=data?.message||data?.error||data?.msg||raw.slice(0,500)||"Upload gambar ditolak layanan gambar RelayRouter.";
   console.error("[KAZAMA upload] upstream error",response.status,message);
   return NextResponse.json({error:"Upload foto gagal ("+response.status+"): "+String(message)},{status:502});
  }
  if(!data){
   console.error("[KAZAMA upload] non-JSON response",response.status,raw.slice(0,300));
   return NextResponse.json({error:"Layanan upload RelayRouter mengirim respons yang bukan JSON."},{status:502});
  }
  const url=data.url||data.data?.url||data.data?.[0]?.url||data.result?.url||data.image_url;
  if(typeof url!=="string"||!/^https?:\/\//i.test(url)){
   console.error("[KAZAMA upload] missing image URL",JSON.stringify(data).slice(0,500));
   return NextResponse.json({error:"Upload selesai tetapi RelayRouter tidak memberikan URL gambar yang dapat dibaca."},{status:502});
  }
  return NextResponse.json({url});
 }catch(error){
  const message=error instanceof Error?error.message:String(error);
  console.error("[KAZAMA upload] request failed",message);
  return NextResponse.json({error:"Koneksi upload ke layanan gambar RelayRouter gagal: "+message},{status:502});
 }
}