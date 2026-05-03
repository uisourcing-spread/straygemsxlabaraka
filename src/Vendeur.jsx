import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase, signIn, signOut, getProfile, fetchAll, createRecord, updateRecord, updateRecordVendor, fetchSettings, writeLog } from "./supabase";

// ─── PALETTES ─────────────────────────────────────────────────────────────────
const DARK = {
  bg:"#0D0D12", surface:"#13131A", surface2:"#1A1A24",
  border:"rgba(139,92,246,0.15)", borderStrong:"rgba(139,92,246,0.4)",
  purple:"#8B5CF6", purpleLight:"#A78BFA", purpleDim:"rgba(139,92,246,0.1)",
  accent:"#C084FC", grey:"#6B7280", greyLight:"#9CA3AF",
  text:"#E5E0F0", textDim:"#7B7490", textMuted:"#4A4560",
  active:"#4ADE80", activeDim:"rgba(74,222,128,0.1)",
  danger:"#EF4444", dangerDim:"rgba(239,68,68,0.08)", amber:"#F59E0B",
};
const LIGHT = {
  bg:"#F5F4F8", surface:"#FFFFFF", surface2:"#EDE9F6",
  border:"rgba(109,40,217,0.15)", borderStrong:"rgba(109,40,217,0.35)",
  purple:"#7C3AED", purpleLight:"#6D28D9", purpleDim:"rgba(109,40,217,0.08)",
  accent:"#9333EA", grey:"#6B7280", greyLight:"#4B5563",
  text:"#1A1523", textDim:"#6B6480", textMuted:"#9CA3AF",
  active:"#16A34A", activeDim:"rgba(22,163,74,0.1)",
  danger:"#DC2626", dangerDim:"rgba(220,38,38,0.06)", amber:"#D97706",
};

// C — palette active, mutée au render par VendeurApp
const C = { ...DARK };
const CAT_COLORS = { Luxury:"#C084FC", Vintage:"#8B5CF6", Workwear:"#6366F1", Streetwear:"#818CF8" };
const CATEGORIES  = ["Luxury","Vintage","Workwear","Streetwear"];
const MONTHS_FR   = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const DAYS_FR     = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
const daysIn = (d) => Math.round((new Date()-new Date(d))/86400000);
const euro   = (n) => `${Number(n||0).toLocaleString("fr-FR")}€`;

// ─── HOOKS ────────────────────────────────────────────────────────────────────
const useIsMobile = () => {
  const [mob, setMob] = useState(window.innerWidth < 768);
  useEffect(()=>{
    const h = ()=>setMob(window.innerWidth<768);
    window.addEventListener("resize",h);
    return ()=>window.removeEventListener("resize",h);
  },[]);
  return mob;
};

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
const Tag = ({children,color}) => (
  <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"0.08em",
    padding:"2px 8px",borderRadius:99,background:`${color}18`,border:`1px solid ${color}40`,color,whiteSpace:"nowrap"}}>
    {children}
  </span>
);

const Spinner = ({label="Chargement..."}) => (
  <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:60,flexDirection:"column",gap:12}}>
    <div style={{width:28,height:28,border:`2px solid ${C.border}`,borderTop:`2px solid ${C.purple}`,
      borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim}}>{label}</div>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

const Toast = ({msg,type}) => (
  <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",
    background:type==="success"?"#1A2E1A":"#2E1A1A",
    border:`1px solid ${type==="success"?"rgba(74,222,128,0.4)":"rgba(239,68,68,0.4)"}`,
    color:type==="success"?C.active:C.danger,
    padding:"12px 24px",borderRadius:99,fontFamily:"'DM Mono',monospace",fontSize:13,
    zIndex:9999,whiteSpace:"nowrap",pointerEvents:"none",boxShadow:"0 8px 32px rgba(0,0,0,0.6)"}}>
    {type==="success"?"✓ ":""}{msg}
  </div>
);

const BackBtn = ({onClick}) => (
  <button onClick={onClick} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",
    fontFamily:"'DM Mono',monospace",fontSize:12,marginBottom:20,padding:0,display:"flex",alignItems:"center",gap:6}}>
    ← Retour
  </button>
);

const StatCard = ({label,value,sub,color}) => (
  <div style={{flex:1,minWidth:120,padding:"14px 16px",background:C.surface,
    border:`1px solid ${C.border}`,borderRadius:4,position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:color||C.purple}}/>
    <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:C.textDim,
      letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:6}}>{label}</div>
    <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:20,fontWeight:700,color:color||C.purpleLight}}>{value}</div>
    {sub&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,marginTop:3}}>{sub}</div>}
  </div>
);

const inp = {width:"100%",background:"#0A0A0F",border:`1px solid rgba(139,92,246,0.15)`,
  borderRadius:6,color:"#E5E0F0",padding:"11px 14px",fontFamily:"'Space Grotesk',sans-serif",
  fontSize:14,outline:"none",boxSizing:"border-box"};

// ─── STATS DASHBOARD ──────────────────────────────────────────────────────────
function StatsDashboard({items,isMobile,onClose,monthlyGoal=500}) {
  const [period,setPeriod] = useState("month");
  const [offset,setOffset] = useState(0);
  const [streakOpen,setStreakOpen] = useState(null);

  const sold   = useMemo(()=>items.filter(i=>i.status==="sold"),[items]);
  const active = useMemo(()=>items.filter(i=>i.status==="active"),[items]);

  const range = useMemo(()=>{
    const now = new Date();
    if(period==="day"){
      const d = new Date(now); d.setDate(now.getDate()+offset);
      const s = new Date(d); s.setHours(0,0,0,0);
      const e = new Date(d); e.setHours(23,59,59,999);
      const label = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")} — ${DAYS_FR[d.getDay()]}`;
      return {start:s,end:e,label};
    }
    if(period==="week"){
      const dow = (now.getDay()+6)%7;
      const mon = new Date(now); mon.setDate(now.getDate()-dow+offset*7); mon.setHours(0,0,0,0);
      const sun = new Date(mon); sun.setDate(mon.getDate()+6); sun.setHours(23,59,59,999);
      const f = d=>`${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
      return {start:mon,end:sun,label:`${f(mon)} → ${f(sun)}`};
    }
    const base = new Date(now.getFullYear(),now.getMonth()+offset,1);
    const s = new Date(base); s.setHours(0,0,0,0);
    const e = new Date(base.getFullYear(),base.getMonth()+1,0); e.setHours(23,59,59,999);
    return {start:s,end:e,label:`${MONTHS_FR[base.getMonth()]} ${base.getFullYear()}`};
  },[period,offset]);

  const minOffset = period==="month"?-1:period==="week"?-4:-30;

  const periodSold = useMemo(()=>sold.filter(i=>{
    if(!i.saleDate) return false;
    const d = new Date(i.saleDate);
    return d>=range.start && d<=range.end;
  }),[sold,range]);

  const periodDep = useMemo(()=>items.filter(i=>{
    if(!i.depositDate) return false;
    const d = new Date(i.depositDate);
    return d>=range.start && d<=range.end;
  }),[items,range]);

  const ca        = useMemo(()=>periodSold.reduce((a,i)=>a+(i.finalPrice||i.sellPrice),0),[periodSold]);
  const avgBasket = periodSold.length ? Math.round(ca/periodSold.length) : 0;
  const avgDelay  = useMemo(()=>{
    if(period==="day") return null;
    // Délai = saleDate - depositDate (temps réel en dépôt avant vente)
    const w = periodSold.filter(i=>i.depositDate&&i.saleDate);
    if(!w.length) return 0;
    return Math.round(w.reduce((a,i)=>{
      const days = Math.round((new Date(i.saleDate)-new Date(i.depositDate))/86400000);
      return a + Math.max(0, days);
    },0)/w.length);
  },[periodSold,period]);
  const convRate  = periodDep.length ? Math.round((periodSold.length/periodDep.length)*100) : null;
  const starPiece = useMemo(()=>{
    const w = periodSold.filter(i=>i.depositDate&&i.saleDate);
    if(!w.length) return null;
    return w.sort((a,b)=>
      (new Date(a.saleDate)-new Date(a.depositDate))-(new Date(b.saleDate)-new Date(b.depositDate))
    )[0];
  },[periodSold]);

  // Objectif — toujours mois en cours, indépendant de la période sélectionnée
  const currentMonthLabel = useMemo(()=>{
    const now = new Date();
    return `${MONTHS_FR[now.getMonth()]} ${now.getFullYear()}`;
  },[]);

  const monthCA = useMemo(()=>{
    const now = new Date();
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    s.setHours(0,0,0,0);
    const e = new Date(now.getFullYear(), now.getMonth()+1, 0);
    e.setHours(23,59,59,999);
    return sold.filter(i=>i.saleDate&&new Date(i.saleDate)>=s&&new Date(i.saleDate)<=e)
      .reduce((a,i)=>a+(i.finalPrice||i.sellPrice),0);
  },[sold]);

  const goalPct   = Math.min(100, monthCA>0&&monthlyGoal>0 ? Math.round((monthCA/monthlyGoal)*100) : 0);
  const goalDiff  = monthCA - monthlyGoal;
  const goalColor = goalPct>=150?C.accent:goalPct>=100?C.active:goalPct>=60?C.amber:C.danger;

  // Streak — mois consécutifs où l'objectif est atteint (sur 12 mois glissants)
  const streak = useMemo(()=>{
    const now = new Date();
    let count = 0;
    // On remonte mois par mois jusqu'à 12 mois
    for(let i=1; i<=12; i++){
      const y = now.getMonth()-i < 0 ? now.getFullYear()-1 : now.getFullYear();
      const m = ((now.getMonth()-i)+12)%12;
      const s = new Date(y,m,1); s.setHours(0,0,0,0);
      const e = new Date(y,m+1,0); e.setHours(23,59,59,999);
      const mCA = sold.filter(j=>j.saleDate&&new Date(j.saleDate)>=s&&new Date(j.saleDate)<=e)
        .reduce((a,j)=>a+(j.finalPrice||j.sellPrice),0);
      if(mCA>=monthlyGoal) count++;
      else break; // streak interrompu
    }
    // Ajoute le mois en cours si objectif atteint
    if(goalPct>=100) count++;
    return count;
  },[sold,monthlyGoal,goalPct]);

  const PBtn = ({p,l}) => (
    <button onClick={()=>{setPeriod(p);setOffset(0);}} style={{
      background:period===p?C.purple:"none",border:`1px solid ${period===p?C.purple:C.border}`,
      color:period===p?"#fff":C.textDim,padding:"5px 12px",borderRadius:2,cursor:"pointer",
      fontFamily:"'DM Mono',monospace",fontSize:11}}>{l}</button>
  );

  const body = (
    <>
      {/* Objectif mois en cours */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:16,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:C.textDim,letterSpacing:"0.1em"}}>OBJECTIF — {currentMonthLabel}</div>
          <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:700,color:goalColor}}>
            {euro(monthCA)} / {euro(monthlyGoal)}
          </div>
        </div>

        {/* Jauge principale — dégradé apaisante → oppressante */}
        <div style={{height:12,background:"rgba(139,92,246,0.08)",borderRadius:6,overflow:"hidden",position:"relative",marginBottom:6}}>
          <div style={{
            width:`${goalPct}%`,height:"100%",borderRadius:6,
            transition:"width 0.6s cubic-bezier(0.34,1.56,0.64,1)",
            background:goalPct>=150
              ? `linear-gradient(90deg,#6D28D9,#C084FC,#E0AAFF)` // exceptionnel — violet lumineux
              : goalPct>=100
              ? `linear-gradient(90deg,#1A5C35,#2D9E5A,#4ADE80)` // atteint — vert apaisant
              : goalPct>=75
              ? `linear-gradient(90deg,#78400A,#B45309,#F59E0B)` // proche — ambre chaud
              : goalPct>=50
              ? `linear-gradient(90deg,#7C2020,#B91C1C,#EF4444)` // sous obj — rouge
              : `linear-gradient(90deg,#450A0A,#991B1B,#DC2626)`, // loin — rouge sombre oppressant
          }}/>
          <div style={{position:"absolute",top:0,right:0,width:2,height:"100%",background:"rgba(255,255,255,0.12)"}}/>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:goalColor,fontWeight:600}}>
            {goalPct>=150?"exceptionnel":goalPct>=100?"objectif atteint":goalPct>=75?"bonne progression":"en dessous"}
            {" · "}
            <span style={{color:goalDiff>=0?C.active:C.danger}}>{goalDiff>=0?"+":""}{euro(goalDiff)}</span>
          </div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim}}>{goalPct}%</div>
        </div>

        {/* Streak */}
        <div style={{paddingTop:12,borderTop:`1px solid ${C.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:C.textDim,letterSpacing:"0.1em"}}>STREAK — MOIS CONSÉCUTIFS</div>
            <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:700,
              color:streak>=12?C.accent:streak>=6?C.purpleLight:streak>=3?C.active:C.textDim}}>
              {streak} mois
            </div>
          </div>

          {/* Paliers cliquables */}
          <div style={{display:"flex",gap:6}}>
            {[
              {label:"3 mois",target:3,
               bgOn:"rgba(74,222,128,0.08)",bgOff:"rgba(239,68,68,0.05)",
               colOn:C.active,colOff:streak===0?"#7A1E1E":streak>=2?"#B45309":C.danger,
               barOn:`linear-gradient(90deg,#1A5C35,${C.active})`,
               barOff:streak>=2?`linear-gradient(90deg,#78400A,${C.amber})`:`linear-gradient(90deg,#450A0A,#DC2626)`},
              {label:"6 mois",target:6,
               bgOn:"rgba(139,92,246,0.08)",bgOff:"rgba(239,68,68,0.05)",
               colOn:C.purpleLight,colOff:streak>=3?"#B45309":C.danger,
               barOn:`linear-gradient(90deg,#4C1D95,${C.purpleLight})`,
               barOff:streak>=3?`linear-gradient(90deg,#78400A,${C.amber})`:`linear-gradient(90deg,#450A0A,#DC2626)`},
              {label:"12 mois",target:12,
               bgOn:"rgba(192,132,252,0.08)",bgOff:"rgba(239,68,68,0.05)",
               colOn:C.accent,colOff:streak>=6?"#7C3AED":C.danger,
               barOn:`linear-gradient(90deg,#6D28D9,${C.accent})`,
               barOff:streak>=6?`linear-gradient(90deg,#4C1D95,${C.purpleLight})`:`linear-gradient(90deg,#450A0A,#DC2626)`},
            ].map(({label,target,bgOn,bgOff,colOn,colOff,barOn,barOff})=>{
              const done    = streak >= target;
              const pctBar  = Math.min(100, Math.round((streak/target)*100));
              const col     = done ? colOn : colOff;
              const bg      = done ? bgOn : bgOff;
              const bar     = done ? barOn : barOff;
              const remaining = Math.max(0, target - streak);
              return (
                <div key={target}
                  onClick={()=>setStreakOpen(s=>s===target?null:target)}
                  style={{flex:1,background:bg,
                    border:`1px solid ${done?col+"40":col+"30"}`,
                    borderRadius:4,padding:"8px 10px",cursor:"pointer",
                    transition:"all 0.2s"}}>
                  {/* Mini jauge */}
                  <div style={{height:4,background:"rgba(139,92,246,0.08)",borderRadius:2,marginBottom:6,overflow:"hidden"}}>
                    <div style={{width:`${pctBar}%`,height:"100%",borderRadius:2,
                      background:bar,transition:"width 0.5s"}}/>
                  </div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:col,fontWeight:600,marginBottom:2}}>{label}</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:done?col:C.textDim}}>
                    {done?"✓ atteint":`${streak}/${target} · encore ${remaining}`}
                  </div>

                  {/* Détail au clic */}
                  {streakOpen===target && (
                    <div style={{marginTop:10,paddingTop:8,borderTop:`1px solid ${col}20`}}>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:C.textDim,marginBottom:6}}>
                        PROGRESSION VERS {target} MOIS
                      </div>
                      {/* Grande jauge détail */}
                      <div style={{height:10,background:"rgba(139,92,246,0.06)",borderRadius:5,overflow:"hidden",marginBottom:6}}>
                        <div style={{width:`${pctBar}%`,height:"100%",borderRadius:5,
                          background:bar,transition:"width 0.6s cubic-bezier(0.34,1.56,0.64,1)"}}/>
                      </div>
                      <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:11,fontWeight:700,color:col,marginBottom:4}}>
                        {streak} / {target} mois consécutifs
                      </div>
                      {!done && (
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:C.textDim,lineHeight:1.6}}>
                          Objectif mensuel : {euro(monthlyGoal)}<br/>
                          Encore {remaining} mois à {euro(monthlyGoal)}+ pour débloquer ce palier.
                        </div>
                      )}
                      {done && (
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:col,lineHeight:1.6}}>
                          Palier {target} mois atteint — continue !
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Period */}
      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
        <PBtn p="day" l="Jour"/>
        <PBtn p="week" l="Semaine"/>
        <PBtn p="month" l="Mois"/>
        <div style={{display:"flex",gap:6,marginLeft:"auto",alignItems:"center"}}>
          <button onClick={()=>setOffset(o=>Math.max(minOffset,o-1))} disabled={offset<=minOffset}
            style={{background:"none",border:`1px solid ${C.border}`,color:offset<=minOffset?C.textMuted:C.textDim,
              padding:"4px 10px",borderRadius:2,cursor:offset<=minOffset?"not-allowed":"pointer",
              fontFamily:"'DM Mono',monospace",fontSize:12}}>←</button>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.purpleLight,minWidth:90,textAlign:"center"}}>{range.label}</span>
          <button onClick={()=>setOffset(o=>Math.min(0,o+1))} disabled={offset>=0}
            style={{background:"none",border:`1px solid ${C.border}`,color:offset>=0?C.textMuted:C.textDim,
              padding:"4px 10px",borderRadius:2,cursor:offset>=0?"not-allowed":"pointer",
              fontFamily:"'DM Mono',monospace",fontSize:12}}>→</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        <StatCard label={period==="day"?"Ventes aujourd'hui":"CA brut"} value={period==="day"?`${periodSold.length}`:euro(ca)} sub={period!=="day"?`${periodSold.length} vente${periodSold.length>1?"s":""}`:undefined} color={C.purpleLight}/>
        {period!=="day"&&<StatCard label="Panier moyen" value={periodSold.length?euro(avgBasket):"—"} color={C.accent}/>}
        {period!=="day"&&avgDelay!==null&&<StatCard label="Délai écoul. moy." value={`${avgDelay}j`} color="#818CF8"/>}
        {convRate!==null&&periodDep.length>0&&<StatCard label="Taux dépôt→vente" value={`${convRate}%`} color={convRate>=50?C.active:C.amber}/>}
      </div>

      {/* Star */}
      {starPiece&&(
        <div style={{background:C.purpleDim,border:`1px solid ${C.border}`,borderRadius:4,padding:14,marginBottom:14}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:C.textDim,letterSpacing:"0.1em",marginBottom:8}}>⭐ PIÈCE VENDUE LE PLUS VITE</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:600,color:C.text}}>{starPiece.name}</div>
              <div style={{display:"flex",gap:6,marginTop:4}}>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim}}>{starPiece.ref}</span>
                <Tag color={CAT_COLORS[starPiece.category]||C.grey}>{starPiece.category}</Tag>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:15,fontWeight:700,color:C.purpleLight}}>{euro(starPiece.finalPrice||starPiece.sellPrice)}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.active}}>
                vendu en {Math.round((new Date(starPiece.saleDate)-new Date(starPiece.depositDate))/86400000)}j
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock par catégorie */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:14}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:C.textDim,letterSpacing:"0.1em",marginBottom:10}}>STOCK PAR CATÉGORIE</div>
        {CATEGORIES.map(cat=>{
          const n = active.filter(i=>i.category===cat).length;
          if(!n) return null;
          return (
            <div key={cat} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:CAT_COLORS[cat],flexShrink:0}}/>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.greyLight,flex:1}}>{cat}</span>
              <div style={{width:60,height:4,background:"rgba(139,92,246,0.1)",borderRadius:2}}>
                <div style={{width:`${Math.round(n/Math.max(active.length,1)*100)}%`,height:"100%",background:CAT_COLORS[cat],borderRadius:2}}/>
              </div>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:CAT_COLORS[cat],fontWeight:700,minWidth:16,textAlign:"right"}}>{n}</span>
            </div>
          );
        })}
        {active.length===0&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim}}>Aucun stock actif</div>}
      </div>
    </>
  );

  if(isMobile) return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:2000,display:"flex",flexDirection:"column"}}>
      <div style={{background:C.bg,flex:1,overflowY:"auto",padding:"20px 16px 32px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:16,color:C.purpleLight}}>📊 Stats</div>
          <button onClick={onClose} style={{background:"none",border:`1px solid ${C.border}`,color:C.textDim,
            padding:"6px 14px",borderRadius:4,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12}}>✕ Fermer</button>
        </div>
        {body}
      </div>
    </div>
  );

  return (
    <div style={{width:340,flexShrink:0,borderRight:`1px solid ${C.border}`,padding:"20px 16px",overflowY:"auto",background:C.bg}}>
      <div style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:14,color:C.purpleLight,marginBottom:16}}>📊 Stats</div>
      {body}
    </div>
  );
}

// ─── SELL VIEW ────────────────────────────────────────────────────────────────
function SellView({item,onConfirm,onBack,loading,isLaBaraka=false,showChannel=true}) {
  const today = new Date().toISOString().split("T")[0];
  const [saleDate,setSaleDate]         = useState(today);
  const [channel,setChannel]           = useState("store");
  const [paymentMethod,setPaymentMethod] = useState("CB");
  const [hasRed,setHasRed]             = useState(false);
  const [finalPrice,setFinalPrice]     = useState(String(item.sellPrice));
  const priceNum  = parseFloat(finalPrice)||0;
  const reduction = item.sellPrice>0?Math.round(((item.sellPrice-priceNum)/item.sellPrice)*100):0;
  const valid     = priceNum>0&&saleDate;
  return (
    <div>
      <BackBtn onClick={onBack}/>
      <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:17,fontWeight:700,color:C.text,marginBottom:4}}>Enregistrer une vente</div>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,marginBottom:16}}>{item.ref} — {item.name}</div>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:16,marginBottom:12}}>
        <div style={{marginBottom:14}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:6}}>DATE DE VENTE</div>
          <input type="date" value={saleDate} onChange={e=>setSaleDate(e.target.value)} style={inp}/>
        </div>
        {/* Vendor : CB/Espèces uniquement | Admin : les deux */}
        {showChannel && (
          <div style={{marginBottom:14}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:10}}>CANAL</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {["store","online"].map(ch=>(
                <button key={ch} onClick={()=>setChannel(ch)} style={{padding:"10px",borderRadius:8,cursor:"pointer",
                  border:`1px solid ${channel===ch?C.purple:C.border}`,
                  background:channel===ch?C.purpleDim:"transparent",
                  color:channel===ch?C.purpleLight:C.textDim,
                  fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:600}}>
                  {ch==="store"?"🏬 Store":"🌐 Online"}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{marginBottom:14}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:10}}>PAIEMENT</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {["CB","Espèces"].map(pm=>(
              <button key={pm} onClick={()=>setPaymentMethod(pm)} style={{padding:"10px",borderRadius:8,cursor:"pointer",
                border:`1px solid ${paymentMethod===pm?C.purple:C.border}`,
                background:paymentMethod===pm?C.purpleDim:"transparent",
                color:paymentMethod===pm?C.purpleLight:C.textDim,
                fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:600}}>
                {pm==="CB"?"💳 CB":"💵 Espèces"}
              </button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:hasRed?12:0}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em"}}>RÉDUCTION ?</div>
          <button onClick={()=>{setHasRed(!hasRed);if(hasRed)setFinalPrice(String(item.sellPrice));}} style={{
            background:hasRed?C.purpleDim:"none",border:`1px solid ${hasRed?C.purple:C.border}`,
            color:hasRed?C.purpleLight:C.textDim,padding:"4px 14px",borderRadius:99,cursor:"pointer",
            fontFamily:"'DM Mono',monospace",fontSize:11}}>{hasRed?"Oui":"Non"}</button>
        </div>
        {hasRed&&<>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:6}}>PRIX FINAL (€)</div>
          <input type="number" value={finalPrice} onChange={e=>setFinalPrice(e.target.value)}
            style={{...inp,color:C.purpleLight,fontSize:20,fontWeight:700,textAlign:"center"}}/>
          {priceNum>0&&reduction!==0&&(
            <div style={{marginTop:8,padding:"8px 12px",background:"rgba(245,158,11,0.08)",
              border:"1px solid rgba(245,158,11,0.2)",borderRadius:6,fontFamily:"'DM Mono',monospace",
              fontSize:12,color:C.amber,textAlign:"center"}}>
              {reduction>0?`- ${reduction}% de remise`:`+ ${Math.abs(reduction)}% au-dessus catalogue`}
            </div>
          )}
        </>}
      </div>
      <div style={{background:C.purpleDim,border:`1px solid ${C.border}`,borderRadius:10,
        padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim}}>PRIX ENREGISTRÉ</div>
          <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:22,fontWeight:700,color:C.purpleLight}}>
            {euro(hasRed?priceNum:item.sellPrice)}
          </div>
        </div>
        {hasRed&&reduction>0&&<div style={{textAlign:"right"}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim}}>REMISE</div>
          <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:16,fontWeight:700,color:C.amber}}>-{reduction}%</div>
        </div>}
      </div>
      <button onClick={()=>onConfirm({...item,status:"sold",saleDate,channel,
        finalPrice:hasRed&&priceNum!==item.sellPrice?priceNum:null,
        paymentMethod})}
        disabled={!valid||loading}
        style={{width:"100%",background:valid&&!loading?`linear-gradient(135deg,${C.purple},${C.accent})`:"#1A1A24",
          border:"none",color:valid&&!loading?"#fff":C.textDim,padding:"13px",borderRadius:8,
          cursor:valid&&!loading?"pointer":"not-allowed",fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:600}}>
        {loading?"Enregistrement...":"Confirmer la vente"}
      </button>
    </div>
  );
}

// ─── EDIT / DEPOSIT SHARED FORM ───────────────────────────────────────────────
function ItemForm({item,onSave,onBack,loading,isDeposit}) {
  const today = new Date().toISOString().split("T")[0];
  const isSold = !isDeposit && item?.status === "sold";
  const [form,setForm] = useState({
    ref:item?.ref||"",name:item?.name||"",category:item?.category||"Luxury",
    sellPrice:String(item?.sellPrice||""),depositDate:item?.depositDate||today,
  });
  const set = (k,v)=>setForm(p=>({...p,[k]:v}));
  const valid = (!isDeposit||form.ref.trim())&&form.name&&parseFloat(form.sellPrice)>0&&form.depositDate;

  const fieldStyle = (disabled) => ({
    ...inp,
    opacity: disabled ? 0.45 : 1,
    cursor: disabled ? "not-allowed" : "text",
    background: disabled ? "rgba(139,92,246,0.04)" : "#0A0A0F",
  });

  return (
    <div>
      <BackBtn onClick={onBack}/>
      <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:17,fontWeight:700,color:C.text,marginBottom:4}}>
        {isDeposit?"Déposer une pièce":"Modifier la pièce"}
      </div>
      {item&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,marginBottom:isSold?8:16}}>{item.ref}</div>}

      {/* Alerte pièce vendue */}
      {isSold&&(
        <div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.2)",
          borderRadius:6,padding:"10px 12px",marginBottom:14,
          fontFamily:"'DM Mono',monospace",fontSize:10,color:"rgba(239,68,68,0.7)",lineHeight:1.6}}>
          ⚠ Pièce vendue — prix catalogue et date de dépôt non modifiables.<br/>
          Contacte l'admin pour toute correction rétroactive.
        </div>
      )}

      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:16,marginBottom:12}}>
        {isDeposit&&(
          <div style={{marginBottom:14}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:6}}>RÉFÉRENCE *</div>
            <input style={{...inp,textTransform:"uppercase"}} value={form.ref} placeholder="SG-021"
              onChange={e=>set("ref",e.target.value.toUpperCase())}/>
          </div>
        )}
        <div style={{marginBottom:14}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:6}}>NOM DE LA PIÈCE *</div>
          <input style={inp} value={form.name} placeholder="Ex: Bomber Avirex" onChange={e=>set("name",e.target.value)}/>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:6}}>CATÉGORIE</div>
          <select style={{...inp,cursor:"pointer"}} value={form.category} onChange={e=>set("category",e.target.value)}>
            {CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em"}}>PRIX DE VENTE (€) *</div>
            {isSold&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"rgba(239,68,68,0.5)"}}>🔒 non modifiable</div>}
          </div>
          <input type="number" style={fieldStyle(isSold)} value={form.sellPrice}
            placeholder="0" disabled={isSold}
            onChange={e=>!isSold&&set("sellPrice",e.target.value)}/>
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em"}}>DATE DE DÉPÔT *</div>
            {isSold&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"rgba(239,68,68,0.5)"}}>🔒 non modifiable</div>}
          </div>
          <input type="date" style={{...fieldStyle(isSold),marginBottom:0}} value={form.depositDate}
            disabled={isSold}
            onChange={e=>!isSold&&set("depositDate",e.target.value)}/>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <button onClick={onBack} style={{background:"none",border:`1px solid ${C.border}`,color:C.textDim,
          padding:"12px",borderRadius:8,cursor:"pointer",fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:600}}>Annuler</button>
        <button onClick={()=>onSave({...item,...form,ref:form.ref.trim(),
          sellPrice:isSold?item.sellPrice:parseFloat(form.sellPrice),
          depositDate:isSold?item.depositDate:form.depositDate,
          status:item?.status||"active"})}
          disabled={!valid||loading}
          style={{background:valid&&!loading?`linear-gradient(135deg,${C.purple},${C.accent})`:"#1A1A24",
            border:"none",color:valid&&!loading?"#fff":C.textDim,padding:"12px",borderRadius:8,
            cursor:valid&&!loading?"pointer":"not-allowed",fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:600}}>
          {loading?"Enregistrement...":isDeposit?"Déposer":"Sauvegarder"}
        </button>
      </div>
    </div>
  );
}

// ─── MOBILE STOCK CARDS ───────────────────────────────────────────────────────
function MobileStock({items,onSell,onEdit}) {
  const [cat,setCat]   = useState("all");
  const [search,setSrch] = useState("");
  const [hlOld,setHlOld] = useState(false);
  const [hlNew,setHlNew] = useState(false);

  const stock = useMemo(()=>items.filter(i=>i.status==="active"),[items]);
  const wd = useMemo(()=>stock.filter(i=>i.depositDate),[stock]);
  const maxD = wd.length?Math.max(...wd.map(i=>daysIn(i.depositDate))):0;
  const minD = wd.length?Math.min(...wd.map(i=>daysIn(i.depositDate))):0;
  const oldIds = wd.filter(i=>daysIn(i.depositDate)===maxD).map(i=>i.id);
  const newIds = wd.filter(i=>daysIn(i.depositDate)===minD).map(i=>i.id);

  const filtered = useMemo(()=>stock.filter(i=>
    (cat==="all"||i.category===cat)&&
    (i.name.toLowerCase().includes(search.toLowerCase())||i.ref.toLowerCase().includes(search.toLowerCase()))
  ),[stock,cat,search]);

  const scrollTo = (ids)=>{ const el=document.getElementById(`mv-${ids[0]}`); if(el)el.scrollIntoView({behavior:"smooth",block:"center"}); };

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:16,fontWeight:700,color:C.text}}>Stock — {stock.length} pièces</div>
        <div style={{width:8,height:8,borderRadius:"50%",background:C.active}}/>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:10}}>
        <button onClick={()=>{setHlOld(h=>!h);setHlNew(false);setTimeout(()=>scrollTo(oldIds),50);}}
          style={{flex:1,background:hlOld?"rgba(239,68,68,0.1)":"none",border:`1px solid ${hlOld?"rgba(239,68,68,0.5)":C.border}`,
            color:hlOld?C.danger:C.textDim,padding:"7px",borderRadius:8,cursor:"pointer",
            fontFamily:"'DM Mono',monospace",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:hlOld?C.danger:"rgba(239,68,68,0.4)",display:"inline-block"}}/>
          + anciens · {maxD}j ({oldIds.length})
        </button>
        <button onClick={()=>{setHlNew(h=>!h);setHlOld(false);setTimeout(()=>scrollTo(newIds),50);}}
          style={{flex:1,background:hlNew?"rgba(74,222,128,0.08)":"none",border:`1px solid ${hlNew?"rgba(74,222,128,0.4)":C.border}`,
            color:hlNew?C.active:C.textDim,padding:"7px",borderRadius:8,cursor:"pointer",
            fontFamily:"'DM Mono',monospace",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:hlNew?C.active:"rgba(74,222,128,0.3)",display:"inline-block"}}/>
          + récents · {minD}j ({newIds.length})
        </button>
      </div>
      <input value={search} onChange={e=>setSrch(e.target.value)} placeholder="Rechercher..."
        style={{...inp,background:C.surface2,marginBottom:10}}/>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
        {["all",...CATEGORIES].map(c=>(
          <button key={c} onClick={()=>setCat(c)} style={{
            background:cat===c?C.purple:"none",border:`1px solid ${cat===c?C.purple:C.border}`,
            color:cat===c?"#fff":C.textDim,padding:"5px 10px",borderRadius:99,cursor:"pointer",
            fontFamily:"'DM Mono',monospace",fontSize:11}}>{c==="all"?"Tout":c}</button>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.length===0&&<div style={{textAlign:"center",padding:40,color:C.textDim,fontFamily:"'DM Mono',monospace",fontSize:12}}>Aucune pièce</div>}
        {filtered.map(item=>{
          const isOld=hlOld&&oldIds.includes(item.id);
          const isNew=hlNew&&newIds.includes(item.id);
          const days=item.depositDate?daysIn(item.depositDate):null;
          return (
            <div key={item.id} id={`mv-${item.id}`}
              style={{background:isOld?"rgba(239,68,68,0.07)":isNew?"rgba(74,222,128,0.06)":C.surface,
                border:`1px solid ${isOld?"rgba(239,68,68,0.4)":isNew?"rgba(74,222,128,0.35)":C.border}`,
                borderRadius:10,padding:14,
                boxShadow:isOld?"inset 3px 0 0 rgba(239,68,68,0.6)":isNew?"inset 3px 0 0 rgba(74,222,128,0.6)":"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:600,color:C.text,
                    marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim}}>{item.ref}</span>
                    <Tag color={CAT_COLORS[item.category]||C.grey}>{item.category}</Tag>
                    {(isOld||isNew)&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:10,fontWeight:700,
                      color:isOld?C.danger:C.active,background:isOld?"rgba(239,68,68,0.1)":"rgba(74,222,128,0.1)",
                      padding:"2px 8px",borderRadius:99}}>{isOld?"⬆":"⬇"} {days}j</span>}
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
                  <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:17,fontWeight:700,color:C.purpleLight}}>{euro(item.sellPrice)}</div>
                  {!isOld&&!isNew&&days!==null&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim}}>{days}j en rayon</div>}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <button onClick={()=>onSell(item)} style={{background:C.activeDim,border:"1px solid rgba(74,222,128,0.3)",
                  color:C.active,padding:"9px",borderRadius:6,cursor:"pointer",
                  fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:600}}>✓ Vendu</button>
                <button onClick={()=>onEdit(item)} style={{background:C.purpleDim,border:`1px solid ${C.border}`,
                  color:C.purpleLight,padding:"9px",borderRadius:6,cursor:"pointer",
                  fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:600}}>✎ Modifier</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DESKTOP STOCK TABLE ──────────────────────────────────────────────────────
function DesktopTable({items,onSell,onEdit,hlOldIds,hlNewIds}) {
  return (
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",minWidth:680}}>
        <thead>
          <tr style={{borderBottom:`1px solid ${C.border}`}}>
            {["Réf","Pièce","Catégorie","Prix","Dépôt","Jours","Actions"].map(h=>(
              <th key={h} style={{padding:"10px 12px",textAlign:"left",fontFamily:"'DM Mono',monospace",
                fontSize:10,color:C.textDim,letterSpacing:"0.1em",fontWeight:500,whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length===0&&(
            <tr><td colSpan={7} style={{padding:40,textAlign:"center",fontFamily:"'DM Mono',monospace",fontSize:12,color:C.textDim}}>Aucune pièce</td></tr>
          )}
          {items.map((item,idx)=>{
            const days=item.depositDate?daysIn(item.depositDate):null;
            const isOld=hlOldIds.includes(item.id);
            const isNew=hlNewIds.includes(item.id);
            const bg=isOld?"rgba(239,68,68,0.07)":isNew?"rgba(74,222,128,0.06)":idx%2===0?"transparent":"rgba(139,92,246,0.02)";
            return (
              <tr key={item.id} id={`dt-${item.id}`}
                style={{borderBottom:`1px solid rgba(139,92,246,0.06)`,background:bg,
                  boxShadow:isOld?"inset 3px 0 0 rgba(239,68,68,0.7)":isNew?"inset 3px 0 0 rgba(74,222,128,0.7)":"none"}}
                onMouseEnter={e=>{if(!isOld&&!isNew)e.currentTarget.style.background="rgba(139,92,246,0.04)";}}
                onMouseLeave={e=>{if(!isOld&&!isNew)e.currentTarget.style.background=bg;}}>
                <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim}}>{item.ref}</td>
                <td style={{padding:"10px 12px",fontSize:13,fontWeight:500,color:C.text,maxWidth:200,
                  whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</td>
                <td style={{padding:"10px 12px"}}><Tag color={CAT_COLORS[item.category]||C.grey}>{item.category}</Tag></td>
                <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,color:C.purpleLight,fontWeight:600}}>{euro(item.sellPrice)}</td>
                <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim}}>{item.depositDate||"—"}</td>
                <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:11,
                  color:isOld?C.danger:isNew?C.active:days>30?C.amber:C.textDim,fontWeight:(isOld||isNew)?700:400}}>
                  {days!==null?`${days}j`:"—"}{isOld?" ⬆":isNew?" ⬇":""}
                </td>
                <td style={{padding:"10px 12px",whiteSpace:"nowrap"}}>
                  <button onClick={()=>onSell(item)} style={{background:C.activeDim,border:"1px solid rgba(74,222,128,0.3)",
                    color:C.active,padding:"4px 12px",borderRadius:4,cursor:"pointer",
                    fontFamily:"'DM Mono',monospace",fontSize:11,marginRight:6}}>✓ Vendu</button>
                  <button onClick={()=>onEdit(item)} style={{background:C.purpleDim,border:`1px solid ${C.border}`,
                    color:C.purpleLight,padding:"4px 10px",borderRadius:4,cursor:"pointer",
                    fontFamily:"'DM Mono',monospace",fontSize:11}}>✎</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
function VendeurApp({ profile, onSignOut }) {
  const isMobile = useIsMobile();
  const [items,setItems]     = useState([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving]   = useState(false);
  const [error,setError]     = useState(null);
  const [screen,setScreen]   = useState("stock");
  const [selected,setSelected] = useState(null);
  const [toast,setToast]     = useState(null);
  const [showStats,setShowStats] = useState(false);
  const [monthlyGoal,setMonthlyGoal] = useState(500);
  // Feature flag par org — disabled par défaut, activé via settings key 'payment_method_enabled'
  // TODO session 3 : ajouter toggle dans Config Dashboard pour activer/désactiver
  const [paymentMethodEnabled, setPaymentMethodEnabled] = useState(false);
  const isVendor = profile?.role === "vendor";
  // vendor + feature activée → CB/Espèces | admin → les deux | vendor sans feature → canal
  const showPaymentMethod = paymentMethodEnabled && isVendor;
  const showChannel       = !isVendor || !paymentMethodEnabled;
  const [filterCat,setFilterCat] = useState("all");
  const [filterStatus,setFilterStatus] = useState("active");
  const [search,setSearch]   = useState("");
  const [hlOld,setHlOld]     = useState(false);
  const [hlNew,setHlNew]     = useState(false);
  const [theme,setTheme]     = useState(()=>localStorage.getItem("sg-theme")||"dark");

  // Applique la palette active avant chaque render
  Object.assign(C, theme==="light" ? LIGHT : DARK);

  const showToast = (msg,type="success")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const load = useCallback(async()=>{
    setLoading(true); setError(null);
    try {
      const [data, settings] = await Promise.all([fetchAll(), fetchSettings()]);
      setItems(data);
      if (settings.monthly_goal) {
        const g = parseFloat(settings.monthly_goal);
        if (!isNaN(g) && g > 0) setMonthlyGoal(g);
      }
      if (settings.payment_method_enabled) {
        setPaymentMethodEnabled(settings.payment_method_enabled === 'true');
      }
    }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ load(); },[load]);

  const active = useMemo(()=>items.filter(i=>i.status==="active"),[items]);
  const wd = useMemo(()=>active.filter(i=>i.depositDate),[active]);
  const maxD = wd.length?Math.max(...wd.map(i=>daysIn(i.depositDate))):0;
  const minD = wd.length?Math.min(...wd.map(i=>daysIn(i.depositDate))):0;
  const oldIds = wd.filter(i=>daysIn(i.depositDate)===maxD).map(i=>i.id);
  const newIds = wd.filter(i=>daysIn(i.depositDate)===minD).map(i=>i.id);

  const scrollTo = (ids,prefix)=>{ if(!ids.length)return; const el=document.getElementById(`${prefix}${ids[0]}`); if(el)el.scrollIntoView({behavior:"smooth",block:"center"}); };

  const filteredItems = useMemo(()=>items.filter(i=>
    (filterStatus==="all"||i.status===filterStatus)&&
    (filterCat==="all"||i.category===filterCat)&&
    (search===""||i.name.toLowerCase().includes(search.toLowerCase())||i.ref.toLowerCase().includes(search.toLowerCase()))
  ),[items,filterStatus,filterCat,search]);

  const goBack = ()=>{ setScreen("stock"); setSelected(null); };

  // Vendeur — utilise updateRecordVendor (champs restreints)
  const handleSell = async (data)=>{ setSaving(true); try { const u=await updateRecordVendor(data.id,data); setItems(p=>p.map(i=>i.id===u.id?u:i)); writeLog("item.sold",{ref:data.ref,name:data.name,price:data.finalPrice||data.sellPrice,channel:data.channel}); showToast(`${data.name} vendu`); goBack(); } catch(e){ showToast(e.message,"error"); } finally{ setSaving(false); }};
  const handleEdit = async (data)=>{
    // Blocage côté UI — une pièce vendue ne peut pas être modifiée par le vendeur
    if(data.status==="sold"){ showToast("Modification rétroactive réservée à l'admin","error"); goBack(); return; }
    setSaving(true);
    try {
      const u=await updateRecordVendor(data.id,data);
      setItems(p=>p.map(i=>i.id===u.id?u:i));
      writeLog("item.updated",{ref:data.ref,name:data.name,fields:["name","category"]});
      showToast("Pièce mise à jour");
      goBack();
    } catch(e){ showToast(e.message,"error"); }
    finally{ setSaving(false); }
  };
  // Dépôt — passe le profil pour lier organisation
  const handleDeposit = async (data)=>{ setSaving(true); try { const c=await createRecord(data, profile); setItems(p=>[...p,c]); writeLog("item.deposit",{ref:data.ref,name:data.name,price:data.sellPrice}); showToast(`${data.ref} déposé`); goBack(); } catch(e){ showToast(e.message,"error"); } finally{ setSaving(false); }};

  const globalStyle = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=DM+Mono:wght@400;500&display=swap');*{box-sizing:border-box;}input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.5);}select option{background:#13131A;}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0D0D12}::-webkit-scrollbar-thumb{background:#2D2D40;border-radius:2px}`;

  const errorBlock = error&&!loading&&(
    <div style={{background:C.dangerDim,border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,
      padding:"14px 16px",fontFamily:"'DM Mono',monospace",fontSize:12,color:C.danger}}>
      ⚠ {error}
      <button onClick={load} style={{display:"block",marginTop:8,background:C.danger,border:"none",
        color:"#fff",padding:"6px 16px",borderRadius:4,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11}}>Réessayer</button>
    </div>
  );

  // ── MOBILE ─────────────────────────────────────────────────────────────────
  if(isMobile) {
    const NavBtn = ({id,icon,label}) => (
      <button onClick={()=>{setScreen(id);setSelected(null);}} style={{flex:1,padding:"10px 0",
        background:"none",border:"none",color:screen===id?C.purpleLight:C.textMuted,cursor:"pointer",
        display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
        <span style={{fontSize:18}}>{icon}</span>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"0.08em"}}>{label}</span>
      </button>
    );
    return (
      <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:"'Space Grotesk',sans-serif",maxWidth:480,margin:"0 auto"}}>
        <style>{globalStyle}</style>
        {toast&&<Toast msg={toast.msg} type={toast.type}/>}
        {showStats&&<StatsDashboard items={items} isMobile onClose={()=>setShowStats(false)} monthlyGoal={monthlyGoal}/>}
        <div style={{padding:"16px 20px 12px",borderBottom:`1px solid ${C.border}`,
          display:"flex",alignItems:"center",justifyContent:"space-between",
          position:"sticky",top:0,background:C.bg,zIndex:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={()=>setShowStats(true)} style={{background:C.purpleDim,border:`1px solid ${C.border}`,
              color:C.purpleLight,width:30,height:30,borderRadius:6,cursor:"pointer",fontSize:15,
              display:"flex",alignItems:"center",justifyContent:"center"}}>📊</button>
            <div style={{width:6,height:6,borderRadius:"50%",background:C.purple}}/>
            <span style={{fontWeight:700,fontSize:14,letterSpacing:"0.06em"}}>LA BARAKA</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={load} style={{background:"none",border:`1px solid ${C.border}`,color:C.textDim,
              padding:"3px 10px",borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10}}>⟳</button>
            <div style={{width:6,height:6,borderRadius:"50%",background:C.active}}/>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.active}}>{active.length}</span>
            <button
              onClick={()=>{const t=theme==="dark"?"light":"dark";setTheme(t);localStorage.setItem("sg-theme",t);}}
              style={{background:"none",border:`1px solid ${C.border}`,color:C.textDim,
                padding:"3px 8px",borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:13}}
              title={theme==="dark"?"Thème jour":"Thème nuit"}>
              {theme==="dark"?"☀":"🌙"}
            </button>
            <button onClick={onSignOut} style={{background:"none",border:`1px solid ${C.border}`,color:C.textDim,
              padding:"3px 8px",borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11}} title="Déconnexion">⎋</button>
          </div>
        </div>
        <div style={{padding:"16px 16px 96px"}}>
          {loading&&<Spinner/>}
          {errorBlock}
          {!loading&&!error&&<>
            {screen==="stock"&&<MobileStock items={items} onSell={i=>{setSelected(i);setScreen("sell");}} onEdit={i=>{setSelected(i);setScreen("edit");}}/>}
            {screen==="sell"&&selected&&<SellView item={selected} onConfirm={handleSell} onBack={goBack} loading={saving} isLaBaraka={showPaymentMethod} showChannel={showChannel}/>}
            {screen==="edit"&&selected&&<ItemForm item={selected} onSave={handleEdit} onBack={goBack} loading={saving} isDeposit={false}/>}
            {screen==="deposit"&&<ItemForm onSave={handleDeposit} onBack={goBack} loading={saving} isDeposit/>}
          </>}
        </div>
        <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",
          width:"100%",maxWidth:480,background:C.surface,borderTop:`1px solid ${C.border}`,
          display:"flex",padding:"4px 0 8px"}}>
          <NavBtn id="stock" icon="🏷" label="STOCK"/>
          <NavBtn id="deposit" icon="＋" label="DÉPOSER"/>
        </div>
      </div>
    );
  }

  // ── DESKTOP ────────────────────────────────────────────────────────────────
  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:"'Space Grotesk',sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{globalStyle}</style>
      {toast&&<Toast msg={toast.msg} type={toast.type}/>}

      {/* Header */}
      <div style={{borderBottom:`1px solid ${C.border}`,padding:"0 32px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:58}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:C.purple,boxShadow:`0 0 10px ${C.purple}`}}/>
            <span style={{fontWeight:700,fontSize:15,letterSpacing:"0.06em"}}>LA BARAKA</span>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim}}>× Straygems</span>
            <button onClick={load} style={{background:"none",border:`1px solid ${C.border}`,color:C.textDim,
              padding:"3px 10px",borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,marginLeft:8}}>
              {loading?"⟳ sync...":"⟳ sync"}
            </button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:C.active}}/>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.active}}>{active.length} actifs</span>
            <button onClick={()=>setShowStats(s=>!s)} style={{
              background:showStats?C.purpleDim:"none",border:`1px solid ${showStats?C.borderStrong:C.border}`,
              color:showStats?C.purpleLight:C.textDim,padding:"6px 14px",borderRadius:3,cursor:"pointer",
              fontFamily:"'DM Mono',monospace",fontSize:11}}>
              📊 {showStats?"Masquer":"Stats"}
            </button>
            <button
              onClick={()=>{const t=theme==="dark"?"light":"dark";setTheme(t);localStorage.setItem("sg-theme",t);}}
              title={theme==="dark"?"Thème jour":"Thème nuit"}
              style={{background:"none",border:`1px solid ${C.border}`,color:C.textDim,
                padding:"7px 10px",borderRadius:3,cursor:"pointer",
                fontFamily:"'DM Mono',monospace",fontSize:14,lineHeight:1}}>
              {theme==="dark"?"☀":"🌙"}
            </button>
            <button onClick={()=>{ setScreen("deposit"); setSelected(null); }} style={{
              background:`linear-gradient(135deg,${C.purple},${C.accent})`,
              border:"none",color:"#fff",padding:"7px 18px",borderRadius:3,
              cursor:"pointer",fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:600}}>
              + Déposer
            </button>
            <button onClick={onSignOut} title="Déconnexion" style={{
              background:"none",border:`1px solid ${C.border}`,color:C.textDim,
              padding:"7px 10px",borderRadius:3,cursor:"pointer",
              fontFamily:"'DM Mono',monospace",fontSize:12}}>⎋</button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{display:"flex",flex:1,overflow:"hidden",minHeight:0}}>
        {/* Stats sidebar */}
        {showStats&&<StatsDashboard items={items} isMobile={false} onClose={()=>setShowStats(false)} monthlyGoal={monthlyGoal}/>}

        {/* Main */}
        <div style={{flex:1,padding:"24px 32px",overflowY:"auto"}}>
          {loading&&<Spinner/>}
          {errorBlock}
          {!loading&&!error&&<>
            {(screen==="sell"||screen==="edit"||screen==="deposit")&&(
              <div style={{maxWidth:480}}>
                {screen==="sell"&&selected&&<SellView item={selected} onConfirm={handleSell} onBack={goBack} loading={saving} isLaBaraka={showPaymentMethod} showChannel={showChannel}/>}
                {screen==="edit"&&selected&&<ItemForm item={selected} onSave={handleEdit} onBack={goBack} loading={saving} isDeposit={false}/>}
                {screen==="deposit"&&<ItemForm onSave={handleDeposit} onBack={goBack} loading={saving} isDeposit/>}
              </div>
            )}
            {screen==="stock"&&<>
              {/* Filters bar */}
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..."
                  style={{...inp,width:180,padding:"7px 12px",fontSize:13}}/>
                <div style={{width:1,height:20,background:C.border}}/>
                {["all",...CATEGORIES].map(c=>(
                  <button key={c} onClick={()=>setFilterCat(c)} style={{
                    background:filterCat===c?C.purpleDim:"none",border:`1px solid ${filterCat===c?C.borderStrong:C.border}`,
                    color:filterCat===c?C.purpleLight:C.textDim,padding:"5px 12px",borderRadius:2,cursor:"pointer",
                    fontFamily:"'DM Mono',monospace",fontSize:11}}>{c==="all"?"Tout":c}</button>
                ))}
                <div style={{width:1,height:20,background:C.border}}/>
                {["all","active","sold"].map(s=>(
                  <button key={s} onClick={()=>setFilterStatus(s)} style={{
                    background:filterStatus===s?C.purpleDim:"none",border:`1px solid ${filterStatus===s?C.borderStrong:C.border}`,
                    color:filterStatus===s?C.purpleLight:C.textDim,padding:"5px 12px",borderRadius:2,cursor:"pointer",
                    fontFamily:"'DM Mono',monospace",fontSize:11}}>{s==="all"?"Tous":s==="active"?"En stock":"Vendus"}</button>
                ))}
                <div style={{width:1,height:20,background:C.border}}/>
                <button onClick={()=>{setHlOld(h=>!h);setHlNew(false);setTimeout(()=>scrollTo(oldIds,"dt-"),50);}}
                  style={{background:hlOld?"rgba(239,68,68,0.1)":"none",border:`1px solid ${hlOld?"rgba(239,68,68,0.5)":C.border}`,
                    color:hlOld?C.danger:C.textDim,padding:"5px 12px",borderRadius:2,cursor:"pointer",
                    fontFamily:"'DM Mono',monospace",fontSize:11,display:"flex",alignItems:"center",gap:5}}>
                  <span style={{width:7,height:7,borderRadius:"50%",background:hlOld?C.danger:"rgba(239,68,68,0.4)",display:"inline-block"}}/>
                  + anciens · {maxD}j
                </button>
                <button onClick={()=>{setHlNew(h=>!h);setHlOld(false);setTimeout(()=>scrollTo(newIds,"dt-"),50);}}
                  style={{background:hlNew?"rgba(74,222,128,0.08)":"none",border:`1px solid ${hlNew?"rgba(74,222,128,0.4)":C.border}`,
                    color:hlNew?C.active:C.textDim,padding:"5px 12px",borderRadius:2,cursor:"pointer",
                    fontFamily:"'DM Mono',monospace",fontSize:11,display:"flex",alignItems:"center",gap:5}}>
                  <span style={{width:7,height:7,borderRadius:"50%",background:hlNew?C.active:"rgba(74,222,128,0.3)",display:"inline-block"}}/>
                  + récents · {minD}j
                </button>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,marginLeft:"auto"}}>{filteredItems.length} pièces</span>
              </div>
              <DesktopTable items={filteredItems}
                onSell={i=>{setSelected(i);setScreen("sell");}}
                onEdit={i=>{setSelected(i);setScreen("edit");}}
                hlOldIds={hlOld?oldIds:[]}
                hlNewIds={hlNew?newIds:[]}/>
            </>}
          </>}
        </div>
      </div>
    </div>
  );
}

// ─── VENDOR LOGIN GATE ────────────────────────────────────────────────────────
function VendeurLogin({ onUnlock }) {
  const [email,setEmail]       = useState("");
  const [password,setPassword] = useState("");
  const [error,setError]       = useState("");
  const [loading,setLoading]   = useState(false);
  const [shake,setShake]       = useState(false);

  const tryLogin = async () => {
    if (!email || !password) return;
    setLoading(true); setError("");
    try {
      const { user } = await signIn(email, password);
      const profile  = await getProfile(user.id);
      // Un admin ne peut pas accéder à la vue vendeur via ce login
      if (profile.role === "admin") {
        await signOut();
        throw new Error("Utilise le dashboard admin");
      }
      writeLog("auth.login", { role: "vendor", email: user.email });
      onUnlock(profile);
    } catch(e) {
      setError(e.message);
      setShake(true);
      setTimeout(()=>setShake(false), 500);
    } finally { setLoading(false); }
  };

  const C2 = { bg:"#0D0D12", surface:"#13131A", purple:"#8B5CF6", accent:"#C084FC", text:"#E5E0F0", textDim:"#7B7490", danger:"#EF4444" };

  return (
    <div style={{background:C2.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Space Grotesk',sans-serif",padding:16}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
      `}</style>
      <div style={{background:C2.surface,border:"1px solid rgba(139,92,246,0.3)",borderRadius:12,
        padding:"36px 28px",width:"100%",maxWidth:360,textAlign:"center",
        animation:shake?"shake 0.4s ease":"none"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:6}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:C2.purple,boxShadow:"0 0 10px #8B5CF6"}}/>
          <span style={{fontWeight:700,fontSize:15,letterSpacing:"0.06em",color:C2.text}}>LA BARAKA</span>
        </div>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C2.textDim,letterSpacing:"0.1em",marginBottom:28}}>ACCÈS VENDEUR</div>
        <div style={{marginBottom:12,textAlign:"left"}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C2.textDim,letterSpacing:"0.1em",marginBottom:6}}>EMAIL</div>
          <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setError("");}}
            onKeyDown={e=>e.key==="Enter"&&tryLogin()} placeholder="vendeur@labaraka.com" autoFocus
            style={{width:"100%",background:"#0A0A0F",border:"1px solid rgba(139,92,246,0.2)",borderRadius:6,
              color:C2.text,padding:"11px 14px",fontFamily:"'Space Grotesk',sans-serif",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
        </div>
        <div style={{marginBottom:20,textAlign:"left"}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C2.textDim,letterSpacing:"0.1em",marginBottom:6}}>MOT DE PASSE</div>
          <input type="password" value={password} onChange={e=>{setPassword(e.target.value);setError("");}}
            onKeyDown={e=>e.key==="Enter"&&tryLogin()} placeholder="••••••••••••"
            style={{width:"100%",background:"#0A0A0F",border:`1px solid ${error?"rgba(239,68,68,0.5)":"rgba(139,92,246,0.2)"}`,
              borderRadius:6,color:C2.text,padding:"11px 14px",fontFamily:"'Space Grotesk',sans-serif",
              fontSize:14,outline:"none",boxSizing:"border-box",letterSpacing:"0.12em"}}/>
        </div>
        {error&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C2.danger,marginBottom:12}}>{error}</div>}
        <button onClick={tryLogin} disabled={loading} style={{
          width:"100%",background:loading?"#1A1A24":`linear-gradient(135deg,${C2.purple},${C2.accent})`,
          border:"none",color:loading?"#7B7490":"#fff",padding:"12px",borderRadius:6,
          cursor:loading?"not-allowed":"pointer",fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:600}}>
          {loading?"Connexion...":"Entrer"}
        </button>
      </div>
    </div>
  );
}

// ─── WRAPPER AUTH ─────────────────────────────────────────────────────────────
export default function Vendeur() {
  const [session,setSession]   = useState(null);
  const [profile,setProfile]   = useState(null);
  const [checking,setChecking] = useState(true);

  useEffect(()=>{
    // Vérifie session existante + refresh automatique du token
    supabase.auth.getSession().then(async ({ data: { session } })=>{
      if(session) {
        try {
          const p = await getProfile(session.user.id);
          if(p.role !== "admin") { setSession(session); setProfile(p); }
          else await signOut(); // admin ne peut pas accéder à /vendeur
        } catch(e) { await signOut(); }
      }
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session)=>{
      if(event==="SIGNED_OUT") { setSession(null); setProfile(null); }
      if(event==="TOKEN_REFRESHED" && session) {
        // Token rafraîchi automatiquement — on met à jour la session
        setSession(session);
      }
    });

    return ()=>subscription.unsubscribe();
  },[]);

  const handleUnlock = useCallback((profile)=>{
    setProfile(profile);
    supabase.auth.getSession().then(({ data: { session } })=>setSession(session));
  },[]);

  const handleSignOut = useCallback(async ()=>{
    await signOut();
    setSession(null);
    setProfile(null);
  },[]);

  if(checking) return (
    <div style={{background:"#0D0D12",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:28,height:28,border:"2px solid rgba(139,92,246,0.15)",borderTop:"2px solid #8B5CF6",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if(!session) return <VendeurLogin onUnlock={handleUnlock}/>;
  return <VendeurApp key="vendeur-app" profile={profile} onSignOut={handleSignOut}/>;
}
