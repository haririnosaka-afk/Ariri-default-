import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const MODELS = [
{id:"seedance-2.0-fast",name:"Dola · Seedance 2.0 Fast",minDuration:5,maxDuration:15,durations:[5,10],resolutions:["720p"],maxImages:30,route:"Dola Pool"},
{id:"seedance-2.5",name:"Dola · Seedance 2.5",minDuration:5,maxDuration:30,durations:[5,10,30],resolutions:["720p","1080p"],maxImages:30,route:"Dola Pool"},
{id:"doubao-seedance-2.0-mini",name:"Doubao · Seedance 2.0 Mini",minDuration:4,maxDuration:15,durations:[4,5,6,8,10,12,15],resolutions:["720p"],maxImages:30,route:"Doubao Pool"},
{id:"doubao-seedance-2.0-fast",name:"Doubao · Seedance 2.0 Fast",minDuration:4,maxDuration:15,durations:[4,5,6,8,10,12,15],resolutions:["720p"],maxImages:30,route:"Doubao Pool"},
{id:"doubao-seedance-2.0",name:"Doubao · Seedance 2.0",minDuration:4,maxDuration:15,durations:[4,5,6,8,10,12,15],resolutions:["720p"],maxImages:30,route:"Doubao Pool"},
{id:"doubao-seedance-2.5",name:"Doubao · Seedance 2.5",minDuration:4,maxDuration:30,durations:[4,5,6,8,10,12,15,20,25,30],resolutions:["720p"],maxImages:30,route:"Doubao Pool"},{id:"agnes-video-2.5-flash",name:"Agnes · Video 2.5 Flash",minDuration:4,maxDuration:12,durations:[4,5,6,7,8,9,10,11,12],resolutions:["720P"],maxImages:0,route:"Agnes AI"}];
export async function GET(){const configured=Boolean(process.env.DOLA_POOL_BASE_URL&&process.env.DOLA_POOL_API_KEY);return NextResponse.json({configured,connected:configured,models:MODELS,count:MODELS.length,provider:"Dola Pool",routing:"provider-managed",note:configured?"Dola Pool settings are present.":"Tambahkan DOLA_POOL_BASE_URL dan DOLA_POOL_API_KEY di Vercel."})}
