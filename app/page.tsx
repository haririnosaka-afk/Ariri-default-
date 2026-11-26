"use client";

import { useEffect, useState } from "react";
import { Sparkles, LoaderCircle } from "lucide-react";

export default function Home() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/studio?resource=settings", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          window.location.href = "/login";
          return;
        }
        const data = await response.json();
        if (!data?.email && active) window.location.href = "/login";
      })
      .catch(() => {
        if (active) window.location.href = "/login";
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <main style={{minHeight:"100vh",background:"#08090d",color:"#f5f5f7",display:"grid",placeItems:"center",padding:"24px",fontFamily:"Arial, sans-serif"}}>
      <section style={{width:"min(100%,720px)",textAlign:"center",padding:"64px 28px",border:"1px solid #252630",borderRadius:24,background:"linear-gradient(145deg,#11121a,#0b0c11)"}}>
        <div style={{width:58,height:58,margin:"0 auto 24px",display:"grid",placeItems:"center",borderRadius:18,background:"#191a28",color:"#b7a4ff"}}>
          <Sparkles size={27}/>
        </div>
        <div style={{fontSize:12,letterSpacing:".24em",color:"#a99be8",fontWeight:700}}>KAZAMA AI</div>
        <h1 style={{fontSize:"clamp(30px,6vw,52px)",lineHeight:1.08,margin:"18px 0 14px",fontWeight:700}}>Studio baru sedang disiapkan.</h1>
        <p style={{maxWidth:480,margin:"0 auto",color:"#a5a6b2",fontSize:15,lineHeight:1.8}}>Tampilan lama sudah dipisahkan. Kita akan membangun pengalaman KAZAMA AI yang baru dari dasar.</p>
        <div style={{marginTop:30,minHeight:24,color:"#858694",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:9}}>
          {checking ? <><LoaderCircle size={15} style={{animation:"kazama-spin 1s linear infinite"}}/> Memeriksa sesi akun…</> : "Workspace siap untuk desain ulang"}
        </div>
      </section>
      <style>{`@keyframes kazama-spin{to{transform:rotate(360deg)}}`}</style>
    </main>
  );
}
