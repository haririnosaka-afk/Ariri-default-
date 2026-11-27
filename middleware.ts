import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function middleware(request: NextRequest) {
  if (request.nextUrl.searchParams.get("utm_source") === "chatgpt.com") {
    const cleanUrl=request.nextUrl.clone();cleanUrl.searchParams.delete("utm_source");return NextResponse.redirect(cleanUrl,308);
  }
  const response=NextResponse.next({request});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,path=request.nextUrl.pathname;
  const isPublicPath=path==="/"||path.startsWith("/login")||path.startsWith("/api/auth")||path==="/api/telegram/webhook"||path.startsWith("/auth/callback")||path==="/api/casaku/webhook";
  if(!url||!anon){if(isPublicPath)return response;return NextResponse.redirect(new URL("/login?setup=1",request.url));}
  const supabase=createServerClient(url,anon,{cookies:{getAll:()=>request.cookies.getAll(),setAll:(cookiesToSet:{name:string;value:string;options?:any}[])=>cookiesToSet.forEach(({name,value,options})=>{request.cookies.set(name,value);response.cookies.set(name,value,options);})}});
  const {data:{user}}=await supabase.auth.getUser();
  if(!user&&!isPublicPath){const target=new URL("/login",request.url);target.searchParams.set("next",path+request.nextUrl.search);return NextResponse.redirect(target);}
  if(user&&path==="/login"){const requested=request.nextUrl.searchParams.get("next")||"/studio";const safe=requested.startsWith("/")&&!requested.startsWith("//")?requested:"/studio";return NextResponse.redirect(new URL(safe,request.url));}
  return response;
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
