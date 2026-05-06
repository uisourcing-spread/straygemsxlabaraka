import { useState, useMemo, useEffect, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area
} from "recharts";
import { supabase, signIn, signOut, getProfile, fetchAll, createRecord, updateRecord, deleteRecord, fetchLoyers, upsertLoyer, fetchSettings, upsertSetting, fetchTeam, updateProfile, assignItemAuthor, revokeVendor, inviteVendor, writeLog, fetchLogs } from "./supabase";

// ─── LOGIN GATE ───────────────────────────────────────────────────────────────
function LoginGate({ onUnlock }) {
  const [email,setEmail]     = useState("");
  const [password,setPassword] = useState("");
  const [error,setError]     = useState("");
  const [loading,setLoading] = useState(false);
  const [shake,setShake]     = useState(false);

  const tryLogin = async () => {
    if (!email || !password) return;
    setLoading(true); setError("");
    try {
      const { user } = await signIn(email, password);
      const profile = await getProfile(user.id);
      if (profile.role !== "admin" && profile.role !== "owner") {
        await signOut();
        throw new Error("Accès réservé à l'administrateur");
      }
      writeLog("auth.login", { role: profile.role, email: user.email });
      onUnlock(profile);
    } catch(e) {
      setError(e.message);
      setShake(true);
      setTimeout(()=>setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{background:"#0D0D12",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Space Grotesk',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
      `}</style>
      <div style={{
        background:"#13131A", border:"1px solid rgba(139,92,246,0.3)",
        borderRadius:12, padding:"40px 36px", width:380, textAlign:"center",
        animation: shake ? "shake 0.4s ease" : "none"
      }}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:8}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:"#8B5CF6",boxShadow:"0 0 12px #8B5CF6"}}/>
          <span style={{fontWeight:700,fontSize:16,letterSpacing:"0.06em",color:"#E5E0F0"}}>STRAYGEMS</span>
        </div>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#7B7490",letterSpacing:"0.1em",marginBottom:32}}>ACCÈS DASHBOARD ADMIN</div>
        <div style={{marginBottom:12,textAlign:"left"}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#7B7490",letterSpacing:"0.1em",marginBottom:6}}>EMAIL</div>
          <input
            type="email" value={email} onChange={e=>{setEmail(e.target.value);setError("");}}
            onKeyDown={e=>e.key==="Enter"&&tryLogin()}
            placeholder="admin@straygems.io" autoFocus
            style={{width:"100%",background:"#0A0A0F",border:"1px solid rgba(139,92,246,0.2)",
              borderRadius:6,color:"#E5E0F0",padding:"11px 14px",
              fontFamily:"'Space Grotesk',sans-serif",fontSize:14,
              outline:"none",boxSizing:"border-box"}}
          />
        </div>
        <div style={{marginBottom:20,textAlign:"left"}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#7B7490",letterSpacing:"0.1em",marginBottom:6}}>MOT DE PASSE</div>
          <input
            type="password" value={password} onChange={e=>{setPassword(e.target.value);setError("");}}
            onKeyDown={e=>e.key==="Enter"&&tryLogin()}
            placeholder="••••••••••••"
            style={{width:"100%",background:"#0A0A0F",border:`1px solid ${error?"rgba(239,68,68,0.5)":"rgba(139,92,246,0.2)"}`,
              borderRadius:6,color:"#E5E0F0",padding:"11px 14px",
              fontFamily:"'Space Grotesk',sans-serif",fontSize:14,
              outline:"none",boxSizing:"border-box",letterSpacing:"0.15em"}}
          />
        </div>
        {error && <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#EF4444",marginBottom:12}}>{error}</div>}
        <button onClick={tryLogin} disabled={loading} style={{
          width:"100%",background:loading?"#1A1A24":"linear-gradient(135deg,#8B5CF6,#C084FC)",
          border:"none",color:loading?"#7B7490":"#fff",padding:"12px",borderRadius:6,
          cursor:loading?"not-allowed":"pointer",fontFamily:"'Space Grotesk',sans-serif",
          fontSize:14,fontWeight:600
        }}>{loading?"Connexion...":"Entrer"}</button>
      </div>
    </div>
  );
}

// ─── PALETTES ─────────────────────────────────────────────────────────────────
const DARK = {
  bg:"#0D0D12", surface:"#13131A", surface2:"#1A1A24",
  border:"rgba(139,92,246,0.18)", borderStrong:"rgba(139,92,246,0.4)",
  purple:"#8B5CF6", purpleLight:"#A78BFA", purpleDim:"rgba(139,92,246,0.12)",
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

// C — palette active, mutée au render par DashboardApp
const C = { ...DARK };
const CAT_COLORS_DEFAULT = { Luxury:"#C084FC", Vintage:"#8B5CF6", Workwear:"#6366F1", Streetwear:"#818CF8" };
const MONTHS_FR  = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const DEFAULT_CATEGORIES = ["Luxury","Vintage","Workwear","Streetwear"];

// ─── UTILS ────────────────────────────────────────────────────────────────────
const pct  = (b,s) => s ? Math.round(((s-b)/s)*100) : 0;
const euro = (n)   => `${Number(n||0).toLocaleString("fr-FR")}€`;
const getMonth    = (d) => d ? parseInt(d.split("-")[1])-1 : null;
const daysElapsed = (a,b) => Math.round((new Date(b||Date.now())-new Date(a))/86400000);
// Frais SumUp 1.76% uniquement sur CB
const calcSumup = (item) => {
  const price = item.finalPrice || item.sellPrice || 0;
  return (item.paymentMethod === "Especes" || item.paymentMethod === "Espèces") ? 0 : price * 0.0176;
};

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
const Tag = ({children,color}) => (
  <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"0.1em",
    padding:"2px 8px",borderRadius:2,background:`${color}18`,border:`1px solid ${color}50`,color}}>
    {children}
  </span>
);

const Stat = ({label,value,sub,color}) => (
  <div style={{flex:1,minWidth:130,padding:"18px 20px",background:C.surface,
    border:`1px solid ${C.border}`,borderRadius:4,position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:color||C.purple}}/>
    <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,
      letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>{label}</div>
    <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:26,fontWeight:700,color:color||C.purpleLight}}>{value}</div>
    {sub && <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,marginTop:4}}>{sub}</div>}
  </div>
);

const SectionTitle = ({children,icon}) => (
  <div style={{display:"flex",alignItems:"center",gap:10,margin:"32px 0 16px"}}>
    <span style={{fontSize:16}}>{icon}</span>
    <h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:15,color:C.text,margin:0,
      fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>{children}</h2>
    <div style={{flex:1,height:1,background:`linear-gradient(90deg,${C.border},transparent)`}}/>
  </div>
);

const CTip = ({active,payload,label,isCount}) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:"#0D0D12",border:`1px solid ${C.borderStrong}`,
      padding:"10px 14px",fontFamily:"'DM Mono',monospace",fontSize:12,borderRadius:4}}>
      <div style={{color:C.purpleLight,marginBottom:6,fontWeight:700}}>{label}</div>
      {payload.map((p,i)=>{
        const isEuro = !isCount && (p.name.includes("€")||p.name.toLowerCase().includes("ca")||p.name.toLowerCase().includes("profit"));
        const isPct  = p.name.includes("%");
        const isDay  = p.name.includes("(j)");
        const val    = isEuro?euro(p.value):isPct?`${p.value}%`:isDay?`${p.value}j`:p.value;
        return <div key={i} style={{color:p.color||C.text}}>{p.name}: <strong>{val}</strong></div>;
      })}
    </div>
  );
};

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

const Spinner = () => (
  <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,flexDirection:"column",gap:16}}>
    <div style={{width:32,height:32,border:`2px solid ${C.border}`,borderTop:`2px solid ${C.purple}`,
      borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:C.textDim}}>Chargement Airtable...</div>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

// ─── MODAL AJOUT/ÉDITION ──────────────────────────────────────────────────────
const EMPTY = {ref:"",name:"",category:"Vintage",buyPrice:"",sellPrice:"",
  finalPrice:"",depositDate:"",saleDate:"",channel:"store",status:"active",notes:""};

const Modal = ({item,onClose,onSave,loading,categories=DEFAULT_CATEGORIES}) => {
  const [f,setF] = useState(item ? {
    ...item, buyPrice:String(item.buyPrice||""), sellPrice:String(item.sellPrice||""),
    finalPrice:String(item.finalPrice||""),
  } : EMPTY);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const isEdit = !!item?.id;
  const valid  = f.ref&&f.name&&f.sellPrice&&f.depositDate;

  const inp = {background:"#0A0A0F",border:`1px solid ${C.border}`,borderRadius:3,
    color:C.text,padding:"9px 12px",fontFamily:"'DM Mono',monospace",fontSize:13,
    width:"100%",outline:"none",boxSizing:"border-box"};

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:1000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.surface,border:`1px solid ${C.borderStrong}`,borderRadius:8,
        padding:24,width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h3 style={{fontFamily:"'Space Grotesk',sans-serif",color:C.purpleLight,margin:0,fontSize:16}}>
            {isEdit ? "✎ Modifier la pièce" : "+ Nouveau dépôt"}
          </h3>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.grey,cursor:"pointer",fontSize:20}}>×</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>RÉFÉRENCE *</label>
            <input style={inp} value={f.ref} onChange={e=>set("ref",e.target.value.toUpperCase())} placeholder="SG-021"/></div>
          <div><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>CATÉGORIE</label>
            <select style={{...inp,cursor:"pointer"}} value={f.category} onChange={e=>set("category",e.target.value)}>
              {categories.map(c=><option key={c}>{c}</option>)}
            </select></div>
          <div style={{gridColumn:"1/-1"}}><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>NOM DE LA PIÈCE *</label>
            <input style={inp} value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Ex: Bomber Avirex Leather"/></div>
          <div><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>PRIX ACHAT — PA (€)</label>
            <input style={inp} type="number" value={f.buyPrice} onChange={e=>set("buyPrice",e.target.value)}/></div>
          <div><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>PRIX VENTE — PV (€) *</label>
            <input style={inp} type="number" value={f.sellPrice} onChange={e=>set("sellPrice",e.target.value)}/></div>
          <div><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>DATE DE DÉPÔT *</label>
            <input style={inp} type="date" value={f.depositDate} onChange={e=>set("depositDate",e.target.value)}/></div>
          <div><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>STATUT</label>
            <select style={{...inp,cursor:"pointer"}} value={f.status} onChange={e=>set("status",e.target.value)}>
              <option value="active">Actif</option><option value="sold">Vendu</option>
            </select></div>
          {f.status==="sold" && <>
            <div><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>DATE DE VENTE</label>
              <input style={inp} type="date" value={f.saleDate} onChange={e=>set("saleDate",e.target.value)}/></div>
            <div><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>CANAL</label>
              <select style={{...inp,cursor:"pointer"}} value={f.channel} onChange={e=>set("channel",e.target.value)}>
                <option value="store">Store</option><option value="online">Online</option>
              </select></div>
            <div><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>PRIX FINAL (si réduction)</label>
              <input style={inp} type="number" value={f.finalPrice} onChange={e=>set("finalPrice",e.target.value)} placeholder="Laisser vide si aucune"/></div>
          </>}
          <div style={{gridColumn:"1/-1"}}><label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>NOTES</label>
            <textarea style={{...inp,height:60,resize:"vertical"}} value={f.notes} onChange={e=>set("notes",e.target.value)}/></div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{background:"none",border:`1px solid ${C.border}`,color:C.textDim,
            padding:"8px 20px",borderRadius:3,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:13}}>Annuler</button>
          <button onClick={()=>onSave({...f,buyPrice:parseFloat(f.buyPrice)||0,
            sellPrice:parseFloat(f.sellPrice)||0,finalPrice:parseFloat(f.finalPrice)||null})}
            disabled={!valid||loading}
            style={{background:valid&&!loading?`linear-gradient(135deg,${C.purple},${C.accent})`:"#1A1A24",
              border:"none",color:valid&&!loading?"#fff":C.textDim,padding:"8px 24px",borderRadius:3,
              cursor:valid&&!loading?"pointer":"not-allowed",fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:600}}>
            {loading?"Enregistrement...":isEdit?"Sauvegarder":"Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── EDITABLE TABLE ROW ───────────────────────────────────────────────────────
const InventoryTable = ({items, onEdit, onDelete, highlightOldIds=[], highlightNewIds=[], catColors={}, tableMode="full", onTableModeChange}) => {
  const [confirmDelete,setConfirmDelete] = useState(null);

  const LITE_COLS = ["Réf","Pièce","PV","Statut",""];
  const FULL_COLS = ["Réf","Pièce","Catégorie","PA","PV","Marge","Dépôt","Vente","Canal","Délai","Statut",""];
  const cols = tableMode === "lite" ? LITE_COLS : FULL_COLS;

  return (
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4}}>
      {/* Switch LITE / FULL */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"8px 12px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",background:C.surface2,border:`1px solid ${C.border}`,borderRadius:3,overflow:"hidden"}}>
          {[["lite","LITE"],["full","FULL"]].map(([m,l])=>(
            <button key={m} onClick={()=>onTableModeChange(m)} style={{
              background:tableMode===m?"rgba(139,92,246,0.15)":"none",
              border:"none",
              color:tableMode===m?C.purpleLight:C.textDim,
              padding:"4px 12px",cursor:"pointer",
              fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"0.08em",
              transition:"all 0.15s"
            }}>{l}</button>
          ))}
        </div>
      </div>
      {confirmDelete && (
        <div style={{padding:"12px 16px",background:C.dangerDim,
          borderBottom:`1px solid rgba(239,68,68,0.2)`,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:C.danger}}>Supprimer cette pièce ? Irréversible.</span>
          <button onClick={()=>{onDelete(confirmDelete);setConfirmDelete(null);}}
            style={{background:C.danger,border:"none",color:"#fff",padding:"4px 14px",
              borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12}}>Confirmer</button>
          <button onClick={()=>setConfirmDelete(null)}
            style={{background:"none",border:`1px solid ${C.border}`,color:C.textDim,padding:"4px 14px",
              borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12}}>Annuler</button>
        </div>
      )}
      <div className="db-table-scroll">
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:tableMode==="lite"?0:900}}>
          <thead>
            <tr style={{borderBottom:`1px solid ${C.border}`}}>
              {cols.map(h=>(
                <th key={h} style={{padding:"10px 12px",textAlign:"left",fontFamily:"'DM Mono',monospace",
                  fontSize:10,color:C.textDim,letterSpacing:"0.1em",fontWeight:500,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item,idx)=>{
              const effectiveSell = item.finalPrice || item.sellPrice;
              const m = pct(item.buyPrice, effectiveSell);
              const d = daysElapsed(item.depositDate, item.saleDate||null);
              const isOld = highlightOldIds.includes(item.id);
              const isNew = highlightNewIds.includes(item.id);
              const baseBg = idx%2===0?"transparent":"rgba(139,92,246,0.02)";
              const hlBg   = isOld?"rgba(239,68,68,0.07)":isNew?"rgba(74,222,128,0.06)":baseBg;
              return (
                <tr key={item.id}
                  id={`inv-row-${item.id}`}
                  style={{borderBottom:`1px solid rgba(139,92,246,0.06)`,
                    background:hlBg,
                    boxShadow: isOld?"inset 3px 0 0 rgba(239,68,68,0.7)":isNew?"inset 3px 0 0 rgba(74,222,128,0.7)":"none",
                    transition:"background 0.2s"}}
                  onMouseEnter={e=>{if(!isOld&&!isNew)e.currentTarget.style.background="rgba(139,92,246,0.04)";}}
                  onMouseLeave={e=>{if(!isOld&&!isNew)e.currentTarget.style.background=hlBg;}}>
                  <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,whiteSpace:"nowrap"}}>{item.ref}</td>
                  <td style={{padding:"10px 12px",fontSize:13,fontWeight:500,color:C.text,maxWidth:tableMode==="lite"?140:180,
                    whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</td>
                  {tableMode==="full" && <>
                    <td style={{padding:"10px 12px"}}>
                      <Tag color={catColors[item.category]||C.grey}>{item.category||"—"}</Tag>
                    </td>
                    <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,color:C.greyLight}}>{euro(item.buyPrice)}</td>
                  </>}
                  <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,color:C.purpleLight,fontWeight:600,whiteSpace:"nowrap"}}>
                    {euro(item.sellPrice)}
                    {item.finalPrice && item.finalPrice!==item.sellPrice && (
                      <span style={{color:C.amber,marginLeft:6,fontSize:10}}>→{euro(item.finalPrice)}</span>
                    )}
                  </td>
                  {tableMode==="full" && <>
                    <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:600,
                      color:m>=60?C.active:m>=45?C.purpleLight:C.grey}}>{item.buyPrice?`${m}%`:"—"}</td>
                    <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:11,color:C.grey,whiteSpace:"nowrap"}}>{item.depositDate||"—"}</td>
                    <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:11,color:C.grey,whiteSpace:"nowrap"}}>{item.saleDate||"—"}</td>
                    <td style={{padding:"10px 12px"}}>
                      {item.channel
                        ? <Tag color={item.channel==="store"?C.purple:"#6366F1"}>{item.channel}</Tag>
                        : <span style={{color:C.textDim,fontFamily:"'DM Mono',monospace",fontSize:11}}>—</span>}
                    </td>
                    <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontSize:11}}>
                      <span style={{
                        color:isOld?C.danger:isNew?C.active:item.status==="sold"?(d<=21?C.active:d<=45?C.purpleLight:C.amber):C.textDim,
                        fontWeight:(isOld||isNew)?700:400}}>
                        {item.depositDate?(item.status==="sold"?`${d}j`:`${d}j en stock`):"—"}
                        {(isOld||isNew)&&item.status==="active"&&<span style={{marginLeft:6,fontSize:10}}>{isOld?"⬆ + ancien":"⬇ + récent"}</span>}
                      </span>
                    </td>
                  </>}
                  <td style={{padding:"10px 12px"}}>
                    <Tag color={item.status==="sold"?C.purple:C.active}>{item.status==="sold"?"Vendu":"Actif"}</Tag>
                  </td>
                  <td style={{padding:"10px 12px",whiteSpace:"nowrap"}}>
                    <button onClick={()=>onEdit(item)}
                      style={{background:"none",border:`1px solid ${C.border}`,color:C.purpleLight,
                        padding:"3px 10px",borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,marginRight:6}}>✎</button>
                    <button onClick={()=>setConfirmDelete(item.id)}
                      style={{background:"none",border:"1px solid rgba(239,68,68,0.2)",color:C.danger,
                        padding:"3px 10px",borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11}}>✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── LOYER MODAL ─────────────────────────────────────────────────────────────
function LoyerModal({ data, onSave, onClose }) {
  const [val, setVal] = useState(String(data.current));
  const parsed = parseFloat(val);
  const valid  = !isNaN(parsed) && parsed >= 0;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:2000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#13131A",border:`1px solid rgba(139,92,246,0.4)`,
        borderRadius:10,padding:28,width:320}}>
        <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:16,fontWeight:700,
          color:"#A78BFA",marginBottom:6}}>Modifier le loyer</div>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#7B7490",marginBottom:20}}>
          {data.label}
        </div>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#7B7490",
          letterSpacing:"0.1em",marginBottom:6}}>MONTANT (€)</div>
        <input
          type="number" min="0" value={val}
          onChange={e=>setVal(e.target.value)}
          autoFocus
          onKeyDown={e=>e.key==="Enter"&&valid&&onSave(data.year,data.month,val)}
          style={{width:"100%",background:"#0A0A0F",border:`1px solid rgba(139,92,246,0.4)`,
            borderRadius:6,color:"#A78BFA",padding:"12px 16px",
            fontFamily:"'Space Grotesk',sans-serif",fontSize:24,fontWeight:700,
            outline:"none",boxSizing:"border-box",textAlign:"center",marginBottom:8}}
        />
        {data.current !== parseFloat(val||0) && valid && (
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#7B7490",
            marginBottom:16,textAlign:"center"}}>
            {parseFloat(val)>data.current
              ? `+${euro(parseFloat(val)-data.current)} vs loyer de base`
              : parseFloat(val)===0 ? "Loyer offert ce mois"
              : `-${euro(data.current-parseFloat(val))} vs loyer de base`}
          </div>
        )}
        <div style={{display:"flex",gap:8,marginTop:16}}>
          <button onClick={onClose} style={{flex:1,background:"none",
            border:`1px solid rgba(139,92,246,0.18)`,color:"#7B7490",
            padding:"10px",borderRadius:6,cursor:"pointer",
            fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:600}}>
            Annuler
          </button>
          <button onClick={()=>valid&&onSave(data.year,data.month,val)}
            disabled={!valid}
            style={{flex:1,background:valid?"linear-gradient(135deg,#8B5CF6,#C084FC)":"#1A1A24",
              border:"none",color:valid?"#fff":"#7B7490",
              padding:"10px",borderRadius:6,cursor:valid?"pointer":"not-allowed",
              fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:600}}>
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
function DashboardApp({ profile, onSignOut }) {
  const [items,setItems]           = useState([]);
  const [loading,setLoading]       = useState(true);
  const [saving,setSaving]         = useState(false);
  const [error,setError]           = useState(null);
  const [view,setView]             = useState("dashboard");
  const [period,setPeriod]         = useState("monthly");
  const [modal,setModal]           = useState(null); // null | "new" | item
  const [filterCat,setFilterCat]   = useState("all");
  const [filterSt,setFilterSt]     = useState("all");
  const [toast,setToast]           = useState(null);
  const [monthlyFee,setMonthlyFee] = useState(100);
  const [feeInput,setFeeInput]     = useState("100");
  const [partnerName,setPartnerName]   = useState("La Baraka");
  const [partnerInput,setPartnerInput] = useState("La Baraka");
  const [maxSlots,setMaxSlots]     = useState(40);
  const [maxSlotsInput,setMaxSlotsInput] = useState("40");
  const [settingsSaved,setSettingsSaved] = useState(false);
  const [monthlyGoal,setMonthlyGoal]     = useState(500);
  const [goalInput,setGoalInput]         = useState("500");
  const [urssafRate,setUrssafRate]       = useState(0.22);
  const [urssafInput,setUrssafInput]     = useState("22");
  const [team,setTeam]                   = useState([]);
  const [teamLoading,setTeamLoading]     = useState(false);
  const [editingVendor,setEditingVendor] = useState(null); // id du vendeur en cours d'édition
  const [inviteEmail,setInviteEmail]     = useState("");
  const [inviteName,setInviteName]       = useState("");
  const [inviting,setInviting]           = useState(false);
  const [logs,setLogs]                   = useState([]);
  const [logsLoading,setLogsLoading]     = useState(false);
  const [logsFilter,setLogsFilter]       = useState("all");
  const [weekOffset,setWeekOffset]       = useState(0);
  const [monthOffset,setMonthOffset]     = useState(0);
  const [quarterOffset,setQuarterOffset] = useState(0);
  const [yearOffset,setYearOffset]       = useState(0);
  const [loyersMap,setLoyersMap]         = useState({});
  const [roiMode,setRoiMode]             = useState("pct");
  const [roiOpen,setRoiOpen]             = useState(false);
  const [showPencils,setShowPencils]     = useState(true);
  const [loyerModal,setLoyerModal]       = useState(null);
  const [categories,setCategories]       = useState(DEFAULT_CATEGORIES);
  const [catColors,setCatColors]         = useState({...CAT_COLORS_DEFAULT});
  const [newCatInput,setNewCatInput]     = useState("");
  const [catWarning,setCatWarning]       = useState(null);
  const [highlightOld,setHighlightOld]   = useState(false);
  const [highlightNew,setHighlightNew]   = useState(false);
  const [theme,setTheme]                 = useState(()=>localStorage.getItem("sg-theme")||"dark");
  const [tableMode,setTableMode]         = useState("lite"); // "lite" | "full"

  // Applique la palette active avant chaque render (module-level C mutable)
  Object.assign(C, theme==="light" ? LIGHT : DARK);

  const showToast = (msg,type="success") => {
    setToast({msg,type});
    setTimeout(()=>setToast(null),3000);
  };

  // ── Load ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [data, loyers, settings] = await Promise.all([fetchAll(), fetchLoyers(), fetchSettings()]);
      setItems(data);
      setLoyersMap(loyers);
      if (settings.monthly_goal) {
        const g = parseFloat(settings.monthly_goal);
        if (!isNaN(g)) { setMonthlyGoal(g); setGoalInput(String(g)); }
      }
      if (settings.partner_name) {
        setPartnerName(settings.partner_name);
        setPartnerInput(settings.partner_name);
      }
      if (settings.urssaf_rate) {
        const r = parseFloat(settings.urssaf_rate);
        if (!isNaN(r) && r >= 0 && r <= 1) { setUrssafRate(r); setUrssafInput(String(Math.round(r*100))); }
      }
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(()=>{ load(); },[load]);

  // ── Loyer par mois ────────────────────────────────────────────────────────
  const loadTeam = useCallback(async () => {
    setTeamLoading(true);
    try {
      const data = await fetchTeam();
      setTeam(data);
    } catch(e) {
      showToast(e.message, "error");
    } finally {
      setTeamLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await fetchLogs();
      setLogs(data);
    } catch(e) {
      showToast(e.message, "error");
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const getLoyerForMonth = (year, month) => {
    const key = `${year}-${String(month).padStart(2,"0")}`;
    return loyersMap[key] !== undefined ? loyersMap[key] : monthlyFee;
  };

  const handleSaveLoyer = async (year, month, amount) => {
    try {
      await upsertLoyer(year, month, parseFloat(amount));
      const key = `${year}-${String(month).padStart(2,"0")}`;
      setLoyersMap(prev => ({ ...prev, [key]: parseFloat(amount) }));
      setLoyerModal(null);
      showToast(`Loyer ${key} mis à jour`);
    } catch(e) {
      showToast(e.message, "error");
    }
  };

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const handleSave = async (formData) => {
    setSaving(true);
    try {
      if (formData.id) {
        const updated = await updateRecord(formData.id, formData);
        setItems(prev=>prev.map(i=>i.id===updated.id?updated:i));
        showToast("Pièce mise à jour");
        if (formData.status === "sold") {
          writeLog("item.sold", { ref: formData.ref, name: formData.name, price: formData.finalPrice||formData.sellPrice, channel: formData.channel });
        }
      } else {
        const created = await createRecord(formData, profile);
        setItems(prev=>[...prev, created]);
        showToast(`${formData.ref} ajouté`);
        writeLog("item.deposit", { ref: formData.ref, name: formData.name, price: formData.sellPrice });
      }
      setModal(null);
    } catch(e) {
      showToast(e.message,"error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setSaving(true);
    try {
      await deleteRecord(id);
      setItems(prev=>prev.filter(i=>i.id!==id));
      showToast("Pièce supprimée");
    } catch(e) {
      showToast(e.message,"error");
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    const fee = parseFloat(feeInput);
    if (!isNaN(fee)&&fee>=0) setMonthlyFee(fee);
    if (partnerInput.trim()) {
      setPartnerName(partnerInput.trim());
      await upsertSetting("partner_name", partnerInput.trim());
    }
    const slots = parseInt(maxSlotsInput);
    if (!isNaN(slots)&&slots>0) setMaxSlots(slots);
    const goal = parseFloat(goalInput);
    if (!isNaN(goal)&&goal>0) {
      setMonthlyGoal(goal);
      await upsertSetting("monthly_goal", goal);
    }
    const urssafPct = parseFloat(urssafInput);
    if (!isNaN(urssafPct) && urssafPct >= 0 && urssafPct <= 100) {
      const rate = urssafPct / 100;
      setUrssafRate(rate);
      await upsertSetting("urssaf_rate", rate);
    }
    setSettingsSaved(true);
    setTimeout(()=>setSettingsSaved(false),2000);
  };

  // ── Derived data ─────────────────────────────────────────────────────────
  const sold   = useMemo(()=>items.filter(i=>i.status==="sold"),[items]);
  const active = useMemo(()=>items.filter(i=>i.status==="active"),[items]);
  const activeValue = useMemo(()=>active.reduce((a,i)=>a+i.sellPrice,0),[active]);

  // ── Monthly data (déclaré tôt car utilisé dans periodNetProfit) ──────────
  const monthlyData = useMemo(()=>{
    const map={};
    items.forEach(i=>{
      if(i.depositDate){
        const m=getMonth(i.depositDate);
        const k=`2025-${String(m+1).padStart(2,"0")}`;
        if(!map[k]) map[k]={month:MONTHS_FR[m],deposits:0,sold:0,revenue:0,profit:0,margins:[],days:[]};
        map[k].deposits++;
      }
      if(i.status==="sold"&&i.saleDate){
        const m=getMonth(i.saleDate);
        const k=`2025-${String(m+1).padStart(2,"0")}`;
        if(!map[k]) map[k]={month:MONTHS_FR[m],deposits:0,sold:0,revenue:0,profit:0,margins:[],days:[]};
        const fp=i.finalPrice||i.sellPrice;
        map[k].sold++;
        map[k].revenue+=fp;
        map[k].profit+=(fp-i.buyPrice);
        map[k].margins.push(pct(i.buyPrice,fp));
        if(i.depositDate) map[k].days.push(daysElapsed(i.depositDate,i.saleDate));
      }
    });
    return Object.keys(map).sort().map(k=>({
      ...map[k],
      sumupFees: map[k].items ? map[k].items.reduce((a,i)=>a+calcSumup(i),0) : 0,
      get urssaf(){ return this.revenue * 0.22; }, // taux stocké mais non dispo ici — utilisé dans periodUrssaf
      netProfit:map[k].profit-monthlyFee,
      avgMargin:map[k].margins.length?Math.round(map[k].margins.reduce((a,v)=>a+v,0)/map[k].margins.length):0,
      avgDays:map[k].days.length?Math.round(map[k].days.reduce((a,v)=>a+v,0)/map[k].days.length):0,
    }));
  },[items,monthlyFee]);

  // ── Helper dates période ──────────────────────────────────────────────────
  const getPeriodDates = (p, wOff, mOff, qOff, yOff) => {
    const now = new Date();
    if (p === "weekly") {
      const dow = (now.getDay()+6)%7;
      const mon = new Date(now);
      mon.setDate(now.getDate()-dow+wOff*7);
      mon.setHours(0,0,0,0);
      const sun = new Date(mon);
      sun.setDate(mon.getDate()+6);
      sun.setHours(23,59,59,999);
      return {start:mon, end:sun};
    }
    if (p === "monthly") {
      const d = new Date(now.getFullYear(), now.getMonth()+mOff, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      start.setHours(0,0,0,0);
      const end = new Date(d.getFullYear(), d.getMonth()+1, 0);
      end.setHours(23,59,59,999);
      return {start, end};
    }
    if (p === "quarterly") {
      const currentQ = Math.floor(now.getMonth()/3);
      const targetQ  = currentQ + qOff;
      const year     = now.getFullYear() + Math.floor(targetQ/4);
      const q        = ((targetQ % 4) + 4) % 4;
      const start    = new Date(year, q*3, 1);
      start.setHours(0,0,0,0);
      const end      = new Date(year, q*3+3, 0);
      end.setHours(23,59,59,999);
      return {start, end};
    }
    if (p === "annual") {
      const year  = now.getFullYear() + yOff;
      const start = new Date(year, 0, 1);
      start.setHours(0,0,0,0);
      const end   = new Date(year, 11, 31);
      end.setHours(23,59,59,999);
      return {start, end};
    }
    return {start: new Date(0), end: new Date()};
  };

  // ── Period sold ───────────────────────────────────────────────────────────
  const periodSold = useMemo(()=>{
    const {start, end} = getPeriodDates(period, weekOffset, monthOffset, quarterOffset, yearOffset);
    return sold.filter(i=>{
      if(!i.saleDate) return false;
      const d = new Date(i.saleDate);
      return d>=start && d<=end;
    });
  },[sold, period, weekOffset, monthOffset, quarterOffset, yearOffset]);

  // ── KPIs période ──────────────────────────────────────────────────────────
  // ── Chiffre d'Affaires (CA) — prix de vente réels encaissés ──────────────
  const periodRevenue   = useMemo(()=>periodSold.reduce((a,i)=>a+(i.finalPrice||i.sellPrice),0),[periodSold]);
  // ── Marge brute — CA - coût d'achat ───────────────────────────────────────
  const periodProfit    = useMemo(()=>periodSold.reduce((a,i)=>a+(i.finalPrice||i.sellPrice)-i.buyPrice,0),[periodSold]);
  const periodAvgMargin = useMemo(()=>periodSold.length?Math.round(periodSold.reduce((a,i)=>a+pct(i.buyPrice,i.finalPrice||i.sellPrice),0)/periodSold.length):0,[periodSold]);
  const periodAvgBasket = useMemo(()=>periodSold.length?Math.round(periodRevenue/periodSold.length):0,[periodSold,periodRevenue]);
  const periodAvgDays   = useMemo(()=>{
    const w=periodSold.filter(i=>i.depositDate&&i.saleDate);
    return w.length?Math.round(w.reduce((a,i)=>a+daysElapsed(i.depositDate,i.saleDate),0)/w.length):0;
  },[periodSold]);

  // ── Charges déduites sur la période ───────────────────────────────────────
  const periodSumupFees = useMemo(()=>periodSold.reduce((a,i)=>a+calcSumup(i),0),[periodSold]);
  const periodUrssaf    = useMemo(()=>periodRevenue * urssafRate,[periodRevenue,urssafRate]);
  const periodRent      = useMemo(()=>{
    if(period==="weekly")     return monthlyFee / 30 * 7;
    if(period==="monthly")    return monthlyFee * monthlyData.length;
    if(period==="quarterly")  return monthlyFee * 3;
    if(period==="annual")     return monthlyFee * 12;
    return 0;
  },[period,monthlyFee,monthlyData]);

  // ── Résultat net — Marge brute - loyer - URSSAF - SumUp ──────────────────
  const periodNetProfit = useMemo(()=>
    periodProfit - periodRent - periodUrssaf - periodSumupFees,
  [periodProfit,periodRent,periodUrssaf,periodSumupFees]);

  // ── Camemberts période ────────────────────────────────────────────────────
  const periodCatData = useMemo(()=>{
    const map={};
    periodSold.forEach(i=>{
      if(!map[i.category])map[i.category]={name:i.category,count:0,revenue:0};
      map[i.category].count++;
      map[i.category].revenue+=(i.finalPrice||i.sellPrice);
    });
    return Object.values(map);
  },[periodSold]);

  const periodChannelData = useMemo(()=>[
    {name:"Store", value:periodSold.filter(i=>i.channel==="store").length},
    {name:"Online",value:periodSold.filter(i=>i.channel==="online").length},
  ],[periodSold]);

  const periodMarginDist = useMemo(()=>{
    const b={"<40%":0,"40-50%":0,"50-60%":0,"60-70%":0,">70%":0};
    periodSold.forEach(i=>{
      const m=pct(i.buyPrice,i.finalPrice||i.sellPrice);
      if(m<40)b["<40%"]++;else if(m<50)b["40-50%"]++;else if(m<60)b["50-60%"]++;else if(m<70)b["60-70%"]++;else b[">70%"]++;
    });
    return Object.entries(b).map(([name,value])=>({name,value}));
  },[periodSold]);

  // ── Totaux globaux pour ROI loyer ─────────────────────────────────────────
  const totalRevenue = useMemo(()=>sold.reduce((a,i)=>a+(i.finalPrice||i.sellPrice),0),[sold]);
  const totalProfit  = useMemo(()=>sold.reduce((a,i)=>a+(i.finalPrice||i.sellPrice)-i.buyPrice,0),[sold]);

  // ── Helpers data par période ──────────────────────────────────────────────
  const buildSlice = (slices) => slices.map(({label, start, end}) => {
    const s = new Date(start); s.setHours(0,0,0,0);
    const e = new Date(end);   e.setHours(23,59,59,999);
    const sliceSold = sold.filter(i => {
      if (!i.saleDate) return false;
      const d = new Date(i.saleDate);
      return d >= s && d <= e;
    });
    const sliceDep = items.filter(i => {
      if (!i.depositDate) return false;
      const d = new Date(i.depositDate);
      return d >= s && d <= e;
    });
    const revenue   = sliceSold.reduce((a,i)=>a+(i.finalPrice||i.sellPrice),0);
    const profit     = sliceSold.reduce((a,i)=>a+(i.finalPrice||i.sellPrice)-i.buyPrice,0);
    const sumupFees  = sliceSold.reduce((a,i)=>a+calcSumup(i),0);
    const margins    = sliceSold.map(i=>pct(i.buyPrice,i.finalPrice||i.sellPrice));
    const days       = sliceSold.filter(i=>i.depositDate).map(i=>daysElapsed(i.depositDate,i.saleDate));
    return {
      label, revenue, profit, sumupFees, netProfit: profit,
      deposits: sliceDep.length,
      sold: sliceSold.length,
      avgMargin: margins.length ? Math.round(margins.reduce((a,v)=>a+v,0)/margins.length) : 0,
      avgDays:   days.length    ? Math.round(days.reduce((a,v)=>a+v,0)/days.length)       : 0,
    };
  });

  // Mensuel → semaines du mois sélectionné
  const monthWeeklyData = useMemo(()=>{
    const now  = new Date();
    const base = new Date(now.getFullYear(), now.getMonth()+monthOffset, 1);
    const year = base.getFullYear();
    const month = base.getMonth();
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const slices = [];
    let weekNum = 1;
    let day = 1;
    while (day <= daysInMonth) {
      const start = new Date(year, month, day);
      const end   = new Date(year, month, Math.min(day+6, daysInMonth));
      const f = d => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
      slices.push({ label: `S${weekNum} ${f(start)}`, start, end });
      day += 7;
      weekNum++;
    }
    return buildSlice(slices);
  },[items, sold, monthOffset]);

  // Trimestriel → 3 mois du trimestre sélectionné
  const quarterMonthData = useMemo(()=>{
    const now      = new Date();
    const currentQ = Math.floor(now.getMonth()/3);
    const targetQ  = currentQ + quarterOffset;
    const year     = now.getFullYear() + Math.floor(targetQ/4);
    const q        = ((targetQ % 4) + 4) % 4;
    const slices   = [0,1,2].map(i => {
      const m     = q*3 + i;
      const start = new Date(year, m, 1);
      const end   = new Date(year, m+1, 0);
      return { label: `${MONTHS_FR[m]} ${year}`, start, end };
    });
    return buildSlice(slices);
  },[items, sold, quarterOffset]);

  // Annuel → 12 mois de l'année sélectionnée
  const annualMonthlyData = useMemo(()=>{
    const year   = new Date().getFullYear() + yearOffset;
    const slices = Array.from({length:12}, (_,m) => ({
      label: MONTHS_FR[m],
      start: new Date(year, m, 1),
      end:   new Date(year, m+1, 0),
    }));
    return buildSlice(slices);
  },[items, sold, yearOffset]);

  // ── Weekly data ───────────────────────────────────────────────────────────
  const DAYS_FR = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  const weeklyData = useMemo(()=>{
    const now = new Date();
    const dayOfWeek = (now.getDay()+6)%7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + weekOffset*7);
    monday.setHours(0,0,0,0);
    const slices = Array.from({length:7}, (_,i) => {
      const day = new Date(monday);
      day.setDate(monday.getDate()+i);
      const f = d => `${DAYS_FR[i]} ${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
      return { label: f(day), start: day, end: day };
    });
    return buildSlice(slices);
  },[items, sold, weekOffset]);

  const weekLabel = useMemo(()=>{
    const now = new Date();
    const dow = (now.getDay()+6)%7;
    const mon = new Date(now);
    mon.setDate(now.getDate()-dow+weekOffset*7);
    const sun = new Date(mon);
    sun.setDate(mon.getDate()+6);
    const f = d=>`${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
    return `${f(mon)} → ${f(sun)}`;
  },[weekOffset]);

  const monthLabel = useMemo(()=>{
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth()+monthOffset, 1);
    return `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
  },[monthOffset]);

  const quarterLabel = useMemo(()=>{
    const now = new Date();
    const currentQ = Math.floor(now.getMonth()/3);
    const targetQ  = currentQ + quarterOffset;
    const year     = now.getFullYear() + Math.floor(targetQ/4);
    const q        = ((targetQ % 4) + 4) % 4;
    return `Q${q+1} ${year}`;
  },[quarterOffset]);

  const yearLabel = useMemo(()=>{
    return String(new Date().getFullYear() + yearOffset);
  },[yearOffset]);

  const filteredItems = useMemo(()=>items.filter(i=>
    (filterCat==="all"||i.category===filterCat)&&
    (filterSt==="all"||i.status===filterSt)
  ),[items,filterCat,filterSt]);

  const chartData = period==="weekly"    ? weeklyData
                  : period==="monthly"   ? monthWeeklyData
                  : period==="quarterly" ? quarterMonthData
                  : annualMonthlyData;
  const xKey = "label";

  // ── NAV HELPERS ──────────────────────────────────────────────────────────
  const navBtn=(id,label)=>(
    <button onClick={()=>{ setView(id); if(id==="team") loadTeam(); if(id==="settings") loadLogs(); }} style={{
      background:view===id?C.purpleDim:"none",
      border:view===id?`1px solid ${C.borderStrong}`:`1px solid transparent`,
      color:view===id?C.purpleLight:C.textDim,
      padding:"7px 18px",borderRadius:3,cursor:"pointer",
      fontFamily:"'DM Mono',monospace",fontSize:12,letterSpacing:"0.08em",transition:"all 0.2s"
    }}>{label}</button>
  );
  const periodBtn=(id,label)=>(
    <button onClick={()=>setPeriod(id)} style={{
      background:period===id?C.purple:"none",
      border:`1px solid ${period===id?C.purple:C.border}`,
      color:period===id?"#fff":C.textDim,
      padding:"5px 14px",borderRadius:2,cursor:"pointer",
      fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.08em",
    }}>{label}</button>
  );

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:"'Space Grotesk',sans-serif"}}>
      <style dangerouslySetInnerHTML={{__html:`
        @media(max-width:768px){
          .db-header-inner{flex-wrap:wrap;height:auto;padding:10px 0;gap:8px;}
          .db-nav{display:none!important;}
          .db-mobile-nav{display:flex!important;}
          .db-kpis{flex-direction:column;}
          .db-kpis>div{min-width:100%!important;}
          .db-charts-row{grid-template-columns:1fr!important;}
          .db-pad{padding:16px!important;}
          .db-main-pad{padding:16px!important;}
          .db-stats-row{flex-wrap:wrap;}
          .db-stats-row>div{min-width:calc(50% - 6px)!important;flex:1 1 calc(50% - 6px)!important;}
          .db-hide-mobile{display:none!important;}
          .db-roi-cards{flex-direction:column!important;}
          .db-roi-cards>div{min-width:100%!important;}
          .db-settings-grid{grid-template-columns:1fr!important;}
        }
        @media(max-width:480px){
          .db-stats-row>div{min-width:100%!important;flex:1 1 100%!important;}
        }
        .db-mobile-nav{display:none;}
        .db-table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;}
        .db-table-scroll::-webkit-scrollbar{height:3px;}
        .db-table-scroll::-webkit-scrollbar-thumb{background:rgba(139,92,246,0.3);border-radius:2px;}
        .db-tabs-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
        .db-tabs-scroll::-webkit-scrollbar{display:none;}
      `}}/>
      {toast && <Toast msg={toast.msg} type={toast.type}/>}
      {modal && <Modal item={modal==="new"?null:modal} onClose={()=>setModal(null)} onSave={handleSave} loading={saving} categories={categories}/>}
      {loyerModal && <LoyerModal data={loyerModal} onSave={handleSaveLoyer} onClose={()=>setLoyerModal(null)}/>}

      {/* Header */}
      <div style={{borderBottom:`1px solid ${C.border}`,padding:"0 32px"}}>
        <div className="db-header-inner" style={{maxWidth:1280,margin:"0 auto",display:"flex",alignItems:"center",
          justifyContent:"space-between",height:60}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:C.purple,boxShadow:`0 0 12px ${C.purple}`}}/>
            <span style={{fontWeight:700,fontSize:15,letterSpacing:"0.06em"}}>STRAYGEMS</span>
            <span style={{color:C.textDim,fontSize:12,fontFamily:"'DM Mono',monospace"}}>/ {partnerName}</span>
            <button onClick={load} title="Sync" style={{background:"none",border:`1px solid ${C.border}`,
              color:C.textDim,padding:"3px 10px",borderRadius:2,cursor:"pointer",
              fontFamily:"'DM Mono',monospace",fontSize:11,marginLeft:8}}>
              {loading?"⟳ sync...":"⟳ sync"}
            </button>
          </div>
          <div className="db-nav" style={{display:"flex",gap:4}}>
            {navBtn("dashboard","Dashboard")}
            {navBtn("inventory","Inventaire")}
            {navBtn("team","Équipe")}
            {navBtn("settings","⚙ Config")}
          </div>
          {/* Nav mobile — barre d'onglets scrollable */}
          <div className="db-mobile-nav db-tabs-scroll" style={{width:"100%",gap:0,borderTop:`1px solid ${C.border}`,marginTop:4}}>
            {[["dashboard","Dashboard"],["inventory","Inventaire"],["team","Équipe"],["settings","Config"]].map(([id,label])=>(
              <button key={id} onClick={()=>{ setView(id); if(id==="team") loadTeam(); if(id==="settings") loadLogs(); }} style={{
                flex:1,minWidth:70,background:view===id?C.purpleDim:"none",
                border:"none",borderTop:view===id?`2px solid ${C.purple}`:"2px solid transparent",
                color:view===id?C.purpleLight:C.textDim,
                padding:"8px 4px",cursor:"pointer",
                fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"0.06em",whiteSpace:"nowrap"
              }}>{label}</button>
            ))}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button
              onClick={()=>{const t=theme==="dark"?"light":"dark";setTheme(t);localStorage.setItem("sg-theme",t);}}
              title={theme==="dark"?"Thème jour":"Thème nuit"}
              style={{background:"none",border:`1px solid ${C.border}`,color:C.textDim,
                padding:"8px 10px",borderRadius:3,cursor:"pointer",
                fontFamily:"'DM Mono',monospace",fontSize:14,lineHeight:1}}>
              {theme==="dark"?"☀":"🌙"}
            </button>
            <button onClick={()=>setModal("new")} style={{
              background:`linear-gradient(135deg,${C.purple},${C.accent})`,
              border:"none",color:"#fff",padding:"8px 20px",borderRadius:3,
              cursor:"pointer",fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:600}}>
              + Déposer
            </button>
            <button onClick={onSignOut} title="Déconnexion" style={{
              background:"none",border:`1px solid ${C.border}`,color:C.textDim,
              padding:"8px 12px",borderRadius:3,cursor:"pointer",
              fontFamily:"'DM Mono',monospace",fontSize:12}}>⎋</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1280,margin:"0 auto",padding:"28px 32px"}} className="db-main-pad">
        {error && (
          <div style={{background:C.dangerDim,border:`1px solid rgba(239,68,68,0.3)`,borderRadius:4,
            padding:"12px 16px",marginBottom:20,fontFamily:"'DM Mono',monospace",fontSize:12,color:C.danger,
            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            ⚠ Erreur de connexion : {error}
            <button onClick={load} style={{background:C.danger,border:"none",color:"#fff",
              padding:"4px 12px",borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11}}>Réessayer</button>
          </div>
        )}

        {loading && <Spinner/>}

        {!loading && view==="dashboard" && <>
          {/* KPIs */}
          <div className="db-kpis db-stats-row" style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <Stat label="Chiffre d'affaires"  value={euro(periodRevenue)}   sub={`${periodSold.length} pièces vendues`}/>
            <Stat label="Marge brute"          value={euro(periodProfit)}    sub={`${periodAvgMargin}% sur CA`} color={C.purpleLight}/>
            <Stat label="Résultat net"          value={euro(periodNetProfit)} sub={`loyer+URSSAF+SumUp déduits`} color={periodNetProfit>=0?C.accent:C.danger}/>
            <Stat label="Panier moyen"     value={euro(periodAvgBasket)} sub="prix de vente moyen"/>
            {period!=="weekly" && (
              <div style={{display:"flex",gap:8,flexWrap:"wrap",width:"100%",marginTop:4}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#7B7490",display:"flex",gap:16,flexWrap:"wrap",padding:"8px 12px",background:"rgba(139,92,246,0.04)",border:"1px solid rgba(139,92,246,0.1)",borderRadius:4}}>
                  <span>📍 Loyer <span style={{color:"#A78BFA"}}>{euro(periodRent)}</span></span>
                  <span>🏛 URSSAF <span style={{color:"#A78BFA"}}>{Math.round(urssafRate*100)}% → {euro(periodUrssaf)}</span></span>
                  <span>💳 SumUp <span style={{color:"#A78BFA"}}>{euro(periodSumupFees)}</span></span>
                </div>
              </div>
            )}
            <Stat label="Délai écoulement moyen" value={`${periodAvgDays}j`}   sub="dépôt → vente" color="#818CF8"/>
            <Stat label="Stock actif"      value={`${active.length}`}    sub={`valeur ${euro(activeValue)}`} color={C.active}/>
          </div>

          {/* Period selector */}
          <div style={{display:"flex",alignItems:"center",gap:8,margin:"28px 0 4px",flexWrap:"wrap"}}>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,marginRight:4}}>PÉRIODE :</span>
            {periodBtn("weekly","Hebdo")}
            {periodBtn("monthly","Mensuel")}
            {periodBtn("quarterly","Trimestriel")}
            {periodBtn("annual","Annuel")}

            {/* Navigation hebdo */}
            {period==="weekly" && (
              <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:12}}>
                <button onClick={()=>setWeekOffset(w=>w-1)} style={{background:"none",border:`1px solid ${C.border}`,color:C.textDim,padding:"4px 10px",borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12}}>←</button>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.purpleLight}}>{weekLabel}</span>
                <button onClick={()=>setWeekOffset(w=>Math.min(0,w+1))} disabled={weekOffset===0} style={{background:"none",border:`1px solid ${C.border}`,color:weekOffset===0?C.textMuted:C.textDim,padding:"4px 10px",borderRadius:2,cursor:weekOffset===0?"not-allowed":"pointer",fontFamily:"'DM Mono',monospace",fontSize:12}}>→</button>
                {weekOffset!==0 && <button onClick={()=>setWeekOffset(0)} style={{background:C.purpleDim,border:`1px solid ${C.border}`,color:C.purpleLight,padding:"4px 10px",borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11}}>Cette semaine</button>}
              </div>
            )}

            {/* Navigation mensuelle */}
            {period==="monthly" && (
              <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:12}}>
                <button onClick={()=>setMonthOffset(m=>m-1)} style={{background:"none",border:`1px solid ${C.border}`,color:C.textDim,padding:"4px 10px",borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12}}>←</button>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.purpleLight}}>{monthLabel}</span>
                <button onClick={()=>setMonthOffset(m=>Math.min(0,m+1))} disabled={monthOffset===0} style={{background:"none",border:`1px solid ${C.border}`,color:monthOffset===0?C.textMuted:C.textDim,padding:"4px 10px",borderRadius:2,cursor:monthOffset===0?"not-allowed":"pointer",fontFamily:"'DM Mono',monospace",fontSize:12}}>→</button>
                {monthOffset!==0 && <button onClick={()=>setMonthOffset(0)} style={{background:C.purpleDim,border:`1px solid ${C.border}`,color:C.purpleLight,padding:"4px 10px",borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11}}>Ce mois</button>}
              </div>
            )}

            {/* Navigation trimestrielle */}
            {period==="quarterly" && (
              <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:12}}>
                <button onClick={()=>setQuarterOffset(q=>q-1)} style={{background:"none",border:`1px solid ${C.border}`,color:C.textDim,padding:"4px 10px",borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12}}>←</button>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.purpleLight}}>{quarterLabel}</span>
                <button onClick={()=>setQuarterOffset(q=>Math.min(0,q+1))} disabled={quarterOffset===0} style={{background:"none",border:`1px solid ${C.border}`,color:quarterOffset===0?C.textMuted:C.textDim,padding:"4px 10px",borderRadius:2,cursor:quarterOffset===0?"not-allowed":"pointer",fontFamily:"'DM Mono',monospace",fontSize:12}}>→</button>
                {quarterOffset!==0 && <button onClick={()=>setQuarterOffset(0)} style={{background:C.purpleDim,border:`1px solid ${C.border}`,color:C.purpleLight,padding:"4px 10px",borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11}}>Ce trimestre</button>}
              </div>
            )}

            {/* Navigation annuelle */}
            {period==="annual" && (
              <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:12}}>
                <button onClick={()=>setYearOffset(y=>y-1)} style={{background:"none",border:`1px solid ${C.border}`,color:C.textDim,padding:"4px 10px",borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12}}>←</button>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.purpleLight}}>{yearLabel}</span>
                <button onClick={()=>setYearOffset(y=>Math.min(0,y+1))} disabled={yearOffset===0} style={{background:"none",border:`1px solid ${C.border}`,color:yearOffset===0?C.textMuted:C.textDim,padding:"4px 10px",borderRadius:2,cursor:yearOffset===0?"not-allowed":"pointer",fontFamily:"'DM Mono',monospace",fontSize:12}}>→</button>
                {yearOffset!==0 && <button onClick={()=>setYearOffset(0)} style={{background:C.purpleDim,border:`1px solid ${C.border}`,color:C.purpleLight,padding:"4px 10px",borderRadius:2,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11}}>Cette année</button>}
              </div>
            )}
          </div>

          {/* Area CA + profit */}
          <SectionTitle icon="📈">Évolution CA & Profit</SectionTitle>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:"20px 8px"}}>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{top:10,right:20,left:0,bottom:0}}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.purple} stopOpacity={0.3}/><stop offset="95%" stopColor={C.purple} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gPro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.accent} stopOpacity={0.25}/><stop offset="95%" stopColor={C.accent} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)"/>
                <XAxis dataKey={xKey} tick={{fontFamily:"'DM Mono',monospace",fontSize:11,fill:C.textDim}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontFamily:"'DM Mono',monospace",fontSize:11,fill:C.textDim}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}€`}/>
                <Tooltip content={<CTip/>}/>
                <Legend wrapperStyle={{fontFamily:"'DM Mono',monospace",fontSize:11}}/>
                <Area type="monotone" dataKey="revenue" name="CA (€)" stroke={C.purple} fill="url(#gRev)" strokeWidth={2} dot={{fill:C.purple,r:3}}/>
                <Area type="monotone" dataKey="netProfit" name="Résultat net (€)" stroke={C.accent} fill="url(#gPro)" strokeWidth={2} dot={{fill:C.accent,r:3}} strokeDasharray="4 2"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Bar dépôts vs ventes */}
          <SectionTitle icon="📦">Dépôts vs Ventes</SectionTitle>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:"20px 8px"}}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{top:10,right:20,left:0,bottom:0}} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)" vertical={false}/>
                <XAxis dataKey={xKey} tick={{fontFamily:"'DM Mono',monospace",fontSize:11,fill:C.textDim}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontFamily:"'DM Mono',monospace",fontSize:11,fill:C.textDim}} axisLine={false} tickLine={false} allowDecimals={false}/>
                <Tooltip content={<CTip isCount/>}/>
                <Legend wrapperStyle={{fontFamily:"'DM Mono',monospace",fontSize:11}}/>
                <Bar dataKey="deposits" name="Déposées" fill="#7C3AED" radius={[2,2,0,0]}/>
                <Bar dataKey="sold" name="Vendues" fill={C.purple} radius={[2,2,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Marge + délai */}
          <SectionTitle icon="⚡">Marge moyenne & Délai écoulement</SectionTitle>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:"20px 8px"}}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{top:10,right:20,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)"/>
                <XAxis dataKey={xKey} tick={{fontFamily:"'DM Mono',monospace",fontSize:11,fill:C.textDim}} axisLine={false} tickLine={false}/>
                <YAxis yAxisId="l" tick={{fontFamily:"'DM Mono',monospace",fontSize:11,fill:C.textDim}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
                <YAxis yAxisId="r" orientation="right" tick={{fontFamily:"'DM Mono',monospace",fontSize:11,fill:C.textDim}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}j`}/>
                <Tooltip content={<CTip/>}/>
                <Legend wrapperStyle={{fontFamily:"'DM Mono',monospace",fontSize:11}}/>
                <Line yAxisId="l" type="monotone" dataKey="avgMargin" name="Marge avg%" stroke={C.purple} strokeWidth={2} dot={{fill:C.purple,r:4}}/>
                <Line yAxisId="r" type="monotone" dataKey="avgDays" name="Délai avg (j)" stroke="#6366F1" strokeWidth={2} dot={{fill:"#6366F1",r:4}} strokeDasharray="5 3"/>
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Camemberts */}
          <SectionTitle icon="🥧">Répartition — {period==="weekly"?weekLabel:period==="monthly"?monthLabel:period==="quarterly"?quarterLabel:yearLabel}</SectionTitle>
          <div className="db-charts-row" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            {[
              {title:"VENTES PAR CATÉGORIE",data:periodCatData,dkey:"count",nkey:"name",colors:periodCatData.map(e=>catColors[e.name]||C.grey)},
              {title:"CANAL DE VENTE",data:periodChannelData,dkey:"value",nkey:"name",colors:[C.purple,"#6366F1"]},
            ].map(({title,data,dkey,nkey,colors})=>(
              <div key={title} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:20}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,letterSpacing:"0.1em",marginBottom:12}}>{title}</div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={data} dataKey={dkey} nameKey={nkey} cx="50%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={3}>
                      {data.map((_,i)=><Cell key={i} fill={colors[i]||C.purple}/>)}
                    </Pie>
                    <Tooltip
                      contentStyle={{background:"#0D0D12",border:`1px solid ${C.borderStrong}`,fontFamily:"'DM Mono',monospace",fontSize:13,borderRadius:4}}
                      itemStyle={{color:C.purpleLight,fontWeight:600}}
                      labelStyle={{color:C.accent,fontWeight:700,marginBottom:4}}
                    />
                    <Legend wrapperStyle={{fontFamily:"'DM Mono',monospace",fontSize:11}}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ))}
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:20}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,letterSpacing:"0.1em",marginBottom:12}}>DISTRIBUTION DES MARGES</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={periodMarginDist} margin={{top:0,right:0,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)" vertical={false}/>
                  <XAxis dataKey="name" tick={{fontFamily:"'DM Mono',monospace",fontSize:10,fill:C.textDim}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontFamily:"'DM Mono',monospace",fontSize:10,fill:C.textDim}} axisLine={false} tickLine={false} allowDecimals={false}/>
                  <Tooltip contentStyle={{background:"#0D0D12",border:`1px solid ${C.borderStrong}`,fontFamily:"'DM Mono',monospace",fontSize:12}} itemStyle={{color:"#6D28D9",fontWeight:700}} labelStyle={{color:C.purpleLight}}/>
                  <Bar dataKey="value" name="Pièces" radius={[2,2,0,0]}>
                    {periodMarginDist.map((_,i)=>{
                      const h=260+i*12; const l=50+i*6;
                      return <Cell key={i} fill={"hsl("+h+",70%,"+l+"%)"}/>;}
                    )}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ROI Loyer */}
          {period !== "weekly" && (()=>{
            // Récupère l'année/mois cible selon période
            const now = new Date();

            // Construit les cartes avec loyer personnalisé par mois
            const buildCards = (monthsArr) => monthsArr.map(m => {
              const d = new Date(m.label.includes(" ") ? m.label : `${m.label} ${now.getFullYear()+yearOffset}`);
              // Récupère année/mois depuis le label ou depuis les données
              let yr, mo;
              if (period==="monthly") {
                const base = new Date(now.getFullYear(), now.getMonth()+monthOffset, 1);
                yr = base.getFullYear(); mo = base.getMonth()+1;
              } else if (period==="quarterly") {
                const parts = m.label.split(" ");
                yr = parseInt(parts[1]); mo = MONTHS_FR.indexOf(parts[0])+1;
              } else {
                yr = now.getFullYear()+yearOffset; mo = MONTHS_FR.indexOf(m.label)+1;
              }
              const loyer = getLoyerForMonth(yr, mo);
              return { label:m.label, profit:m.profit, loyer, netProfit:m.profit-loyer, yr, mo };
            });

            const cards = period==="monthly"
              ? [{ label:monthLabel, profit:periodProfit,
                   loyer: getLoyerForMonth(
                     new Date(now.getFullYear(),now.getMonth()+monthOffset,1).getFullYear(),
                     new Date(now.getFullYear(),now.getMonth()+monthOffset,1).getMonth()+1
                   ),
                   yr: new Date(now.getFullYear(),now.getMonth()+monthOffset,1).getFullYear(),
                   mo: new Date(now.getFullYear(),now.getMonth()+monthOffset,1).getMonth()+1,
                   get netProfit(){ return this.profit - this.loyer; }
                }]
              : period==="quarterly" ? buildCards(quarterMonthData)
              : buildCards(annualMonthlyData);

            const totalLoyerPeriod = cards.reduce((a,c)=>a+c.loyer,0);
            const totalProfitBrut  = cards.reduce((a,c)=>a+c.profit,0);
            const totalNetPeriod   = totalProfitBrut - totalLoyerPeriod;
            const roiPct           = totalLoyerPeriod>0 ? Math.round((totalProfitBrut/totalLoyerPeriod)*100) : 0;
            const roiCoef          = totalLoyerPeriod>0 ? (totalProfitBrut/totalLoyerPeriod).toFixed(1) : "—";
            const roiOk            = roiMode==="pct" ? roiPct>=50 : parseFloat(roiCoef)>=3;
            const netOk            = totalNetPeriod >= 0;

            // Calcul ROI carte
            const cardRoi = (c) => {
              if(c.loyer===0) return {pct:100,coef:"∞",ok:true};
              const p = Math.round((c.profit/c.loyer)*100);
              const x = (c.profit/c.loyer).toFixed(1);
              const ok = roiMode==="pct"?p>=50:parseFloat(x)>=3;
              return {pct:p,coef:x,ok};
            };

            // TOP 3 — calculé sur annualMonthlyData ou quarterMonthData ou la période entière
            const allMonths = annualMonthlyData.length ? buildCards(annualMonthlyData) : cards;
            const top3Roi   = [...allMonths].filter(c=>c.profit>0)
              .sort((a,b)=>b.profit/Math.max(b.loyer,1)-a.profit/Math.max(a.loyer,1)).slice(0,3);
            const top3Sales = [...allMonths].filter(c=>c.profit>0)
              .sort((a,b)=>{
                const aSold=sold.filter(i=>i.saleDate&&new Date(i.saleDate).getMonth()+1===a.mo&&new Date(i.saleDate).getFullYear()===a.yr).length;
                const bSold=sold.filter(i=>i.saleDate&&new Date(i.saleDate).getMonth()+1===b.mo&&new Date(i.saleDate).getFullYear()===b.yr).length;
                return bSold-aSold;
              }).slice(0,3);
            const top3Net   = [...allMonths].filter(c=>c.netProfit>0)
              .sort((a,b)=>b.netProfit-a.netProfit).slice(0,3);

            const pencilBtn = (yr,mo,label,loyer) => showPencils ? (
              <button onClick={()=>setLoyerModal({year:yr,month:mo,label,current:loyer})}
                title="Modifier le loyer"
                style={{position:"absolute",top:8,right:8,background:"none",border:"none",
                  color:"rgba(167,139,250,0.5)",cursor:"pointer",fontSize:12,padding:2,
                  lineHeight:1,transition:"color 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.color="#A78BFA"}
                onMouseLeave={e=>e.currentTarget.style.color="rgba(167,139,250,0.5)"}>
                ✎
              </button>
            ) : null;

            return (
              <>
                <SectionTitle icon="💸">Rentabilité loyer — {period==="monthly"?monthLabel:period==="quarterly"?quarterLabel:yearLabel}</SectionTitle>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:20}}>

                  {/* Controls */}
                  <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
                    {/* Switch ROI mode */}
                    <div style={{display:"flex",gap:4}}>
                      {[["pct","ROI %"],["coef","Coefficient ×"]].map(([m,l])=>(
                        <button key={m} onClick={()=>setRoiMode(m)} style={{
                          background:roiMode===m?C.purple:"none",
                          border:`1px solid ${roiMode===m?C.purple:C.border}`,
                          color:roiMode===m?"#fff":C.textDim,
                          padding:"4px 12px",borderRadius:2,cursor:"pointer",
                          fontFamily:"'DM Mono',monospace",fontSize:11}}>
                          {l}
                        </button>
                      ))}
                    </div>
                    {/* Toggle crayons */}
                    <button onClick={()=>setShowPencils(p=>!p)} style={{
                      background:"none",border:`1px solid ${C.border}`,
                      color:C.textDim,padding:"4px 12px",borderRadius:2,cursor:"pointer",
                      fontFamily:"'DM Mono',monospace",fontSize:11,marginLeft:"auto"}}>
                      {showPencils?"Masquer ✎":"Afficher ✎"}
                    </button>
                    {/* Toggle accordéon */}
                    <button onClick={()=>setRoiOpen(o=>!o)} style={{
                      background:C.purpleDim,border:`1px solid ${C.border}`,
                      color:C.purpleLight,padding:"4px 14px",borderRadius:2,cursor:"pointer",
                      fontFamily:"'DM Mono',monospace",fontSize:11}}>
                      {roiOpen?"▲ Masquer détail":"▼ Détail mois"}
                    </button>
                  </div>

                  {/* Synthèse période */}
                  <div style={{display:"flex",gap:20,flexWrap:"wrap",padding:"14px 16px",
                    background:"rgba(139,92,246,0.04)",borderRadius:4,
                    border:`1px solid ${C.border}`,marginBottom:roiOpen?14:0}}>
                    <div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,marginBottom:3}}>PROFIT BRUT</div>
                      <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:20,fontWeight:700,color:C.purpleLight}}>{euro(totalProfitBrut)}</div>
                    </div>
                    <div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,marginBottom:3}}>LOYER CUMULÉ</div>
                      <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:20,fontWeight:700,color:C.danger}}>{euro(totalLoyerPeriod)}</div>
                    </div>
                    <div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,marginBottom:3}}>PROFIT NET</div>
                      <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:20,fontWeight:700,color:netOk?C.active:C.danger}}>
                        {!netOk&&"⚠ "}{euro(totalNetPeriod)}
                      </div>
                    </div>
                    <div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,marginBottom:3}}>
                        {roiMode==="pct"?"ROI PÉRIODE":"COEFFICIENT PÉRIODE"}
                      </div>
                      <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:20,fontWeight:700,color:roiOk?C.active:C.danger}}>
                        {!roiOk&&"⚠ "}{roiMode==="pct"?`${roiPct}%`:`×${roiCoef}`}
                      </div>
                    </div>
                  </div>

                  {/* Accordéon détail mois */}
                  {roiOpen && (
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {cards.map((c,idx)=>{
                        const {pct,coef,ok} = cardRoi(c);
                        const netCardOk = c.netProfit >= 0;
                        return (
                          <div key={idx} style={{flex:1,minWidth:110,padding:"12px 14px",position:"relative",
                            background:ok?"rgba(139,92,246,0.08)":"rgba(239,68,68,0.06)",
                            border:`1px solid ${ok?C.border:"rgba(239,68,68,0.25)"}`,borderRadius:4}}>
                            {pencilBtn(c.yr, c.mo, c.label, c.loyer)}
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,marginBottom:6,paddingRight:20}}>{c.label}</div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,marginBottom:2}}>Loyer : <span style={{color:C.purpleLight}}>{euro(c.loyer)}</span></div>
                            <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:700,
                              color:netCardOk?C.purpleLight:C.danger,marginBottom:4}}>
                              {!netCardOk&&"⚠ "}{euro(c.netProfit)}
                            </div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:700,
                              color:ok?C.active:C.danger}}>
                              {!ok&&"⚠ "}{roiMode==="pct"?`${pct}%`:`×${coef}`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* OBJECTIF */}
                {(()=>{
                  // Mois à analyser selon période
                  const objSlices = period==="monthly"
                    ? [{ label:monthLabel, ca:periodRevenue }]
                    : period==="quarterly"
                    ? quarterMonthData.map(m=>({ label:m.label, ca:m.revenue }))
                    : annualMonthlyData.map(m=>({ label:m.label, ca:m.revenue }));

                  const totalObj     = monthlyGoal * objSlices.length;
                  const totalCA      = objSlices.reduce((a,m)=>a+m.ca,0);
                  const totalPct     = totalObj>0 ? Math.min(Math.round((totalCA/totalObj)*100),150) : 0;
                  const totalDiff    = totalCA - totalObj;
                  const moisAtteints = objSlices.filter(m=>m.ca>=monthlyGoal).length;

                  const barColor = (ca) => {
                    const p = monthlyGoal>0 ? ca/monthlyGoal : 0;
                    if(p>=1.5) return C.accent;
                    if(p>=1)   return C.active;
                    if(p>=0.6) return C.amber;
                    return C.danger;
                  };

                  return (
                    <>
                      <SectionTitle icon="🎯">Objectif — {period==="monthly"?monthLabel:period==="quarterly"?quarterLabel:yearLabel}</SectionTitle>
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:20,marginBottom:16}}>

                        {/* Jauge globale période */}
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em"}}>
                            {period==="monthly"?"CA vs objectif":`${moisAtteints}/${objSlices.length} mois atteints`}
                          </div>
                          <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:700,
                            color:barColor(totalCA/Math.max(objSlices.length,1))}}>
                            {euro(totalCA)} / {euro(totalObj)}
                            <span style={{fontSize:11,fontWeight:400,color:totalDiff>=0?C.active:C.danger,marginLeft:8}}>
                              {totalDiff>=0?"+":""}{euro(totalDiff)}
                            </span>
                          </div>
                        </div>

                        {/* Jauge principale — style jeu vidéo */}
                        <div style={{height:14,background:"rgba(139,92,246,0.08)",borderRadius:7,
                          overflow:"hidden",position:"relative",marginBottom:12}}>
                          <div style={{
                            width:`${Math.min(totalPct,100)}%`,height:"100%",borderRadius:7,
                            transition:"width 0.7s cubic-bezier(0.34,1.56,0.64,1)",
                            background:totalPct>=150?`linear-gradient(90deg,${C.purple},${C.accent})`:
                                       totalPct>=100?`linear-gradient(90deg,#1A6B3A,${C.active})`:
                                       totalPct>=60?`linear-gradient(90deg,#7A5010,${C.amber})`:
                                       `linear-gradient(90deg,#6B1515,${C.danger})`,
                          }}/>
                          {/* Marqueur objectif */}
                          <div style={{position:"absolute",top:0,right:0,width:2,height:"100%",
                            background:"rgba(255,255,255,0.2)"}}/>
                        </div>

                        {/* Détail mois par mois — trimestriel et annuel uniquement */}
                        {period!=="monthly" && (
                          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                            {objSlices.map((m,idx)=>{
                              const pct = monthlyGoal>0 ? Math.min(Math.round((m.ca/monthlyGoal)*100),150) : 0;
                              const diff = m.ca - monthlyGoal;
                              const col  = barColor(m.ca);
                              return (
                                <div key={idx} style={{flex:1,minWidth:60,
                                  background:m.ca>=monthlyGoal?"rgba(74,222,128,0.05)":"rgba(239,68,68,0.04)",
                                  border:`1px solid ${m.ca>=monthlyGoal?"rgba(74,222,128,0.2)":"rgba(239,68,68,0.15)"}`,
                                  borderRadius:4,padding:"8px 10px"}}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:C.textDim,marginBottom:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.label}</div>
                                  {/* Mini jauge */}
                                  <div style={{height:4,background:"rgba(139,92,246,0.08)",borderRadius:2,marginBottom:6,overflow:"hidden"}}>
                                    <div style={{width:`${Math.min(pct,100)}%`,height:"100%",borderRadius:2,
                                      background:col,transition:"width 0.5s"}}/>
                                  </div>
                                  <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:11,fontWeight:700,color:col}}>{euro(m.ca)}</div>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:diff>=0?C.active:C.danger,marginTop:2}}>
                                    {diff>=0?"+":""}{euro(diff)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}

                {/* TOP 3 */}
                <SectionTitle icon="🏆">Top 3 mois</SectionTitle>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:32}}>
                  {[
                    {title:"Meilleur ROI loyer",emoji:"📈",items:top3Roi,val:c=>roiMode==="pct"?`${Math.round(c.profit/Math.max(c.loyer,1)*100)}%`:`×${(c.profit/Math.max(c.loyer,1)).toFixed(1)}`},
                    {title:"Plus de ventes",emoji:"🏷",items:top3Sales,val:c=>{
                      const n=sold.filter(i=>i.saleDate&&new Date(i.saleDate).getMonth()+1===c.mo&&new Date(i.saleDate).getFullYear()===c.yr).length;
                      return `${n} vente${n>1?"s":""}`;
                    }},
                    {title:"Meilleur résultat net",emoji:"💜",items:top3Net,val:c=>euro(c.netProfit)},
                  ].map(({title,emoji,items,val})=>(
                    <div key={title} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:16}}>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,
                        letterSpacing:"0.1em",marginBottom:12}}>{emoji} {title.toUpperCase()}</div>
                      {items.length===0 && <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim}}>Aucune donnée</div>}
                      {items.map((c,i)=>(
                        <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                          padding:"6px 0",borderBottom:i<items.length-1?`1px solid ${C.border}`:"none"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,
                              color:["#C084FC","#A78BFA","#8B5CF6"][i],fontWeight:700}}>#{i+1}</span>
                            <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,color:C.text}}>{c.label}</span>
                          </div>
                          <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,
                            color:["#C084FC","#A78BFA","#8B5CF6"][i],fontWeight:700}}>{val(c)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </>}

        {!loading && view==="inventory" && (()=>{
          const activeItems = filteredItems.filter(i=>i.status==="active"&&i.depositDate);
          const maxDays = activeItems.length ? Math.max(...activeItems.map(i=>daysElapsed(i.depositDate,null))) : 0;
          const minDays = activeItems.length ? Math.min(...activeItems.map(i=>daysElapsed(i.depositDate,null))) : 0;
          const oldIds  = activeItems.filter(i=>daysElapsed(i.depositDate,null)===maxDays).map(i=>i.id);
          const newIds  = activeItems.filter(i=>daysElapsed(i.depositDate,null)===minDays).map(i=>i.id);

          const scrollTo = (ids) => {
            if(!ids.length) return;
            const el = document.getElementById(`inv-row-${ids[0]}`);
            if(el) el.scrollIntoView({behavior:"smooth",block:"center"});
          };

          // Répartition catégories en stock
          const catStock = categories.map(cat=>({
            name:cat,
            count:active.filter(i=>i.category===cat).length,
            color:catColors[cat]||C.grey
          })).filter(c=>c.count>0);
          const avgDaysActive = activeItems.length
            ? Math.round(activeItems.reduce((a,i)=>a+daysElapsed(i.depositDate,null),0)/activeItems.length)
            : 0;

          return <>
            {/* Graphiques inventaire */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
              {/* Temps moyen en stock */}
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:20}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,letterSpacing:"0.1em",marginBottom:16}}>TEMPS MOYEN EN STOCK (actifs)</div>
                <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:16}}>
                  <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:36,fontWeight:700,color:C.purpleLight}}>{avgDaysActive}</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:14,color:C.textDim}}>jours</span>
                </div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  <button
                    onClick={()=>{
                      setHighlightOld(h=>!h);
                      setHighlightNew(false);
                      setTimeout(()=>scrollTo(oldIds),50);
                    }}
                    style={{
                      background:highlightOld?"rgba(239,68,68,0.12)":"none",
                      border:`1px solid ${highlightOld?"rgba(239,68,68,0.5)":C.border}`,
                      color:highlightOld?C.danger:C.textDim,
                      padding:"6px 14px",borderRadius:3,cursor:"pointer",
                      fontFamily:"'DM Mono',monospace",fontSize:11,
                      display:"flex",alignItems:"center",gap:6}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:highlightOld?C.danger:"rgba(239,68,68,0.3)",display:"inline-block"}}/>
                    + anciens · {maxDays}j ({oldIds.length})
                  </button>
                  <button
                    onClick={()=>{
                      setHighlightNew(h=>!h);
                      setHighlightOld(false);
                      setTimeout(()=>scrollTo(newIds),50);
                    }}
                    style={{
                      background:highlightNew?"rgba(74,222,128,0.1)":"none",
                      border:`1px solid ${highlightNew?"rgba(74,222,128,0.4)":C.border}`,
                      color:highlightNew?C.active:C.textDim,
                      padding:"6px 14px",borderRadius:3,cursor:"pointer",
                      fontFamily:"'DM Mono',monospace",fontSize:11,
                      display:"flex",alignItems:"center",gap:6}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:highlightNew?C.active:"rgba(74,222,128,0.3)",display:"inline-block"}}/>
                    + récents · {minDays}j ({newIds.length})
                  </button>
                </div>
              </div>

              {/* Répartition catégories en stock */}
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:20}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,letterSpacing:"0.1em",marginBottom:12}}>RÉPARTITION STOCK PAR CATÉGORIE</div>
                {catStock.length===0
                  ? <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim}}>Aucun stock actif</div>
                  : <>
                    {/* Barre de progression empilée */}
                    <div style={{display:"flex",height:10,borderRadius:5,overflow:"hidden",marginBottom:14}}>
                      {catStock.map(c=>(
                        <div key={c.name} style={{flex:c.count,background:c.color,transition:"flex 0.3s"}}/>
                      ))}
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {catStock.map(c=>(
                        <div key={c.name} style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:10,height:10,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                          <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:C.greyLight,flex:1}}>{c.name}</span>
                          <span style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:600,color:c.color}}>{c.count}</span>
                          <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim}}>({Math.round(c.count/active.length*100)}%)</span>
                        </div>
                      ))}
                    </div>
                  </>
                }
              </div>
            </div>

            {/* Filtres */}
            <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim}}>FILTRER :</span>
              {["all",...categories].map(c=>(
                <button key={c} onClick={()=>setFilterCat(c)} style={{
                  background:filterCat===c?C.purpleDim:"none",border:`1px solid ${filterCat===c?C.borderStrong:C.border}`,
                  color:filterCat===c?C.purpleLight:C.textDim,padding:"5px 12px",borderRadius:2,cursor:"pointer",
                  fontFamily:"'DM Mono',monospace",fontSize:11}}>
                  {c==="all"?"Tout":c}
                </button>
              ))}
              <div style={{width:1,height:20,background:C.border,margin:"0 4px"}}/>
              {["all","active","sold"].map(s=>(
                <button key={s} onClick={()=>setFilterSt(s)} style={{
                  background:filterSt===s?C.purpleDim:"none",border:`1px solid ${filterSt===s?C.borderStrong:C.border}`,
                  color:filterSt===s?C.purpleLight:C.textDim,padding:"5px 12px",borderRadius:2,cursor:"pointer",
                  fontFamily:"'DM Mono',monospace",fontSize:11}}>
                  {s==="all"?"Tous":s==="active"?"En stock":"Vendus"}
                </button>
              ))}
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,marginLeft:"auto"}}>{filteredItems.length} pièces</span>
            </div>

            <InventoryTable
              items={filteredItems}
              onEdit={item=>setModal(item)}
              onDelete={handleDelete}
              highlightOldIds={highlightOld?oldIds:[]}
              highlightNewIds={highlightNew?newIds:[]}
              catColors={catColors}
              tableMode={tableMode}
              onTableModeChange={setTableMode}
            />
          </>;
        })()}

        {/* ── TEAM VIEW ────────────────────────────────────────────────── */}
        {view==="team" && (()=>{
          // Avatar initiales
          const Avatar = ({name,size=36}) => {
            const initials = (name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
            const hue = [...(name||"")].reduce((a,c)=>a+c.charCodeAt(0),0)%60+240;
            const bg  = "hsl("+hue+",60%,30%)";
            const bd  = "hsl("+hue+",60%,50%)";
            const col = "hsl("+hue+",60%,80%)";
            return (
              <div style={{width:size,height:size,borderRadius:"50%",flexShrink:0,
                background:bg,border:"2px solid "+bd,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,
                fontSize:size*0.35,color:col}}>
                {initials}
              </div>
            );
          };

          // Stats d'un vendeur sur la période courante
          const vendorStats = (vendorId) => {
            const vSold = sold.filter(i=>i.createdBy===vendorId&&i.saleDate&&
              new Date(i.saleDate)>=new Date(new Date().getFullYear(),new Date().getMonth(),1));
            const vDep  = items.filter(i=>i.createdBy===vendorId&&i.depositDate&&
              new Date(i.depositDate)>=new Date(new Date().getFullYear(),new Date().getMonth(),1));
            const ca    = vSold.reduce((a,i)=>a+(i.finalPrice||i.sellPrice),0);
            return { sales:vSold.length, deposits:vDep.length, ca };
          };

          // Streak vendeur
          const vendorStreak = (vendorId) => {
            const now = new Date();
            let count = 0;
            for(let i=1;i<=12;i++){
              const y = now.getMonth()-i<0?now.getFullYear()-1:now.getFullYear();
              const m = ((now.getMonth()-i)+12)%12;
              const s = new Date(y,m,1); s.setHours(0,0,0,0);
              const e = new Date(y,m+1,0); e.setHours(23,59,59,999);
              const mCA = sold.filter(j=>j.createdBy===vendorId&&j.saleDate&&
                new Date(j.saleDate)>=s&&new Date(j.saleDate)<=e)
                .reduce((a,j)=>a+(j.finalPrice||j.sellPrice),0);
              if(mCA>=monthlyGoal) count++;
              else break;
            }
            return count;
          };

          const handleUpdateVendor = async (id, updates) => {
            try {
              const updated = await updateProfile(id, updates);
              setTeam(prev=>prev.map(v=>v.id===id?{...v,...updated}:v));
              setEditingVendor(null);
              showToast("Profil mis à jour");
            } catch(e) { showToast(e.message,"error"); }
          };

          const handleRevoke = async (vendorId, name) => {
            if(!window.confirm(`Révoquer l'accès de ${name||"ce vendeur"} ? Cette action est irréversible.`)) return;
            try {
              const { data:{ session } } = await supabase.auth.getSession();
              await revokeVendor(session, vendorId);
              setTeam(prev=>prev.filter(v=>v.id!==vendorId));
              showToast("Accès révoqué");
            } catch(e) { showToast(e.message,"error"); }
          };

          const handleInvite = async () => {
            if(!inviteEmail.trim()) return;
            setInviting(true);
            try {
              // Si nom renseigné, on le stockera après création du profil via webhook
              // Invite vers l'org managée La Baraka — TODO session 4 : selector dynamique
              const LA_BARAKA_ORG_ID = "dfe3cff6-ac4f-41a4-9601-e3eeca0ced34";
              const targetOrgId = profile.org_id === "662c2570-c5fa-41db-9ff4-5e556024d968"
                ? LA_BARAKA_ORG_ID  // admin Straygems → invite vers La Baraka
                : profile.org_id;   // autre admin → invite vers sa propre org
              await inviteVendor(inviteEmail.trim(), targetOrgId);
              showToast(`Invitation envoyée à ${inviteEmail}`);
              setInviteEmail(""); setInviteName("");
              setTimeout(()=>loadTeam(), 1500);
            } catch(e) { showToast(e.message,"error"); }
            finally { setInviting(false); }
          };

          return (
            <>
              <SectionTitle icon="👥">Équipe — {partnerName}</SectionTitle>

              <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:16,alignItems:"start"}}>

                {/* Liste vendeurs */}
                <div>
                  {teamLoading && <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:C.textDim,padding:20}}>Chargement...</div>}
                  {!teamLoading && team.length===0 && (
                    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:32,textAlign:"center"}}>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:C.textDim,marginBottom:8}}>Aucun vendeur dans l'équipe</div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textMuted}}>Invitez votre premier vendeur →</div>
                    </div>
                  )}
                  {!teamLoading && team.map(vendor=>{
                    const stats  = vendorStats(vendor.id);
                    const streak = vendorStreak(vendor.id);
                    const isEditing = editingVendor===vendor.id;
                    const name = vendor.display_name || vendor.email;
                    const initials = (vendor.display_name||vendor.email||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
                    const hue = [...(name)].reduce((a,c)=>a+c.charCodeAt(0),0)%60+240;
                    return (
                      <div key={vendor.id} style={{background:C.surface,border:`1px solid ${C.border}`,
                        borderRadius:4,padding:16,marginBottom:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:isEditing?14:0}}>
                          {/* Avatar */}
                          <div style={{width:40,height:40,borderRadius:"50%",flexShrink:0,
                            background:"hsl("+hue+",60%,20%)",border:"2px solid hsl("+hue+",60%,40%)",
                            display:"flex",alignItems:"center",justifyContent:"center",
                            fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:14,
                            color:"hsl("+hue+",60%,75%)"}}>{initials}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:600,
                              color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              {vendor.display_name||<span style={{color:C.textDim,fontStyle:"italic"}}>Nom non défini</span>}
                            </div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim}}>{vendor.email}</div>
                          </div>
                          {/* Stats inline */}
                          <div style={{display:"flex",gap:16,alignItems:"center"}}>
                            <div style={{textAlign:"center"}}>
                              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:16,fontWeight:700,color:C.purpleLight}}>{euro(stats.ca)}</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:C.textDim}}>CA ce mois</div>
                            </div>
                            <div style={{textAlign:"center"}}>
                              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:16,fontWeight:700,color:C.active}}>{stats.sales}</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:C.textDim}}>ventes</div>
                            </div>
                            <div style={{textAlign:"center"}}>
                              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:16,fontWeight:700,color:C.accent}}>{stats.deposits}</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:C.textDim}}>dépôts</div>
                            </div>
                            <div style={{textAlign:"center"}}>
                              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:16,fontWeight:700,
                                color:streak>=3?C.active:C.textDim}}>{streak}🔥</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:C.textDim}}>streak</div>
                            </div>
                          </div>
                          {/* Crayon edit */}
                          <button onClick={()=>setEditingVendor(isEditing?null:vendor.id)}
                            style={{background:"none",border:`1px solid ${isEditing?C.borderStrong:C.border}`,
                              color:isEditing?C.purpleLight:C.textDim,padding:"5px 8px",borderRadius:3,
                              cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:12}}>
                            {isEditing?"✕":"✎"}
                          </button>
                        </div>

                        {/* Panneau édition — visible uniquement si crayon actif */}
                        {isEditing && (
                          <div style={{background:"#0A0A0F",border:`1px solid ${C.border}`,borderRadius:6,padding:14}}>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                              <div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.08em",marginBottom:4}}>NOM / SURNOM</div>
                                <input defaultValue={vendor.display_name||""} id={`name-${vendor.id}`}
                                  style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:3,
                                    color:C.text,padding:"8px 10px",fontFamily:"'Space Grotesk',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}}
                                  placeholder="Prénom Nom"/>
                              </div>
                              <div>
                                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.08em",marginBottom:4}}>OBJECTIF INDIVIDUEL (€)</div>
                                <input type="number" defaultValue={vendor.individual_goal||""} id={`goal-${vendor.id}`}
                                  style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:3,
                                    color:C.purpleLight,padding:"8px 10px",fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:600,outline:"none",boxSizing:"border-box"}}
                                  placeholder={String(monthlyGoal)}/>
                              </div>
                            </div>
                            <div style={{display:"flex",gap:8,justifyContent:"space-between"}}>
                              <button onClick={()=>handleRevoke(vendor.id, vendor.display_name||vendor.email)}
                                style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",
                                  color:C.danger,padding:"7px 14px",borderRadius:3,cursor:"pointer",
                                  fontFamily:"'DM Mono',monospace",fontSize:11}}>
                                Révoquer l'accès
                              </button>
                              <button onClick={()=>{
                                const nameVal = document.getElementById(`name-${vendor.id}`)?.value;
                                const goalVal = document.getElementById(`goal-${vendor.id}`)?.value;
                                handleUpdateVendor(vendor.id, {
                                  display_name: nameVal||null,
                                  individual_goal: goalVal?parseFloat(goalVal):null,
                                });
                              }} style={{background:`linear-gradient(135deg,${C.purple},${C.accent})`,
                                border:"none",color:"#fff",padding:"7px 20px",borderRadius:3,cursor:"pointer",
                                fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:600}}>
                                Sauvegarder
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Panneau invitation */}
                <div style={{background:C.surface,border:`1px solid ${C.borderStrong}`,borderRadius:4,padding:20,position:"sticky",top:20}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:16}}>+ INVITER UN VENDEUR</div>
                  <div style={{marginBottom:12}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.08em",marginBottom:6}}>NOM / SURNOM</div>
                    <input value={inviteName} onChange={e=>setInviteName(e.target.value)}
                      placeholder="Prénom Nom"
                      style={{width:"100%",background:"#0A0A0F",border:`1px solid ${C.border}`,borderRadius:3,
                        color:C.text,padding:"10px 12px",fontFamily:"'Space Grotesk',sans-serif",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                  <div style={{marginBottom:16}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.08em",marginBottom:6}}>EMAIL *</div>
                    <input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&handleInvite()}
                      placeholder="vendeur@labaraka.com"
                      style={{width:"100%",background:"#0A0A0F",border:`1px solid ${C.border}`,borderRadius:3,
                        color:C.text,padding:"10px 12px",fontFamily:"'Space Grotesk',sans-serif",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                  <button onClick={handleInvite} disabled={!inviteEmail.trim()||inviting}
                    style={{width:"100%",background:inviteEmail.trim()&&!inviting?`linear-gradient(135deg,${C.purple},${C.accent})`:"#1A1A24",
                      border:"none",color:inviteEmail.trim()&&!inviting?"#fff":C.textDim,padding:"11px",borderRadius:3,
                      cursor:inviteEmail.trim()&&!inviting?"pointer":"not-allowed",
                      fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:600}}>
                    {inviting?"Envoi...":"Envoyer l'invitation"}
                  </button>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textMuted,marginTop:10,textAlign:"center",lineHeight:1.6}}>
                    Le vendeur recevra un email pour créer son compte. Lien valable 48h.
                  </div>

                  {/* Compteur équipe */}
                  <div style={{marginTop:20,paddingTop:16,borderTop:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim}}>VENDEURS ACTIFS</span>
                      <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:700,color:C.purpleLight}}>{team.length}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim}}>ORGANISATION</span>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.accent}}>{partnerName}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          );
        })()}

        {view==="settings" && <>
          <SectionTitle icon="⚙️">Configuration — {partnerName}</SectionTitle>
          {catWarning && (
            <div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.3)",
              borderRadius:4,padding:"14px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:C.amber,flex:1}}>
                ⚠ Certaines pièces utilisent la catégorie <strong>"{catWarning}"</strong>. Elles se retrouveront sans catégorie après suppression. Confirmer ?
              </span>
              <button onClick={()=>{
                setCategories(p=>p.filter(c=>c!==catWarning));
                setCatWarning(null);
              }} style={{background:C.amber,border:"none",color:"#000",padding:"6px 14px",borderRadius:3,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:700}}>Supprimer quand même</button>
              <button onClick={()=>setCatWarning(null)} style={{background:"none",border:`1px solid ${C.border}`,color:C.textDim,padding:"6px 14px",borderRadius:3,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:11}}>Annuler</button>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,maxWidth:640}}>
            <div style={{gridColumn:"1/-1",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:24}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,letterSpacing:"0.1em",marginBottom:12}}>NOM DU PARTENAIRE</div>
              <input value={partnerInput} onChange={e=>setPartnerInput(e.target.value)}
                style={{width:"100%",background:"#0A0A0F",border:`1px solid ${C.border}`,borderRadius:3,color:C.text,padding:"10px 14px",fontFamily:"'Space Grotesk',sans-serif",fontSize:15,outline:"none",boxSizing:"border-box"}}/>
            </div>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:24}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,letterSpacing:"0.1em",marginBottom:12}}>LOYER MENSUEL (€)</div>
              <input type="number" min="0" value={feeInput} onChange={e=>setFeeInput(e.target.value)}
                style={{width:"100%",background:"#0A0A0F",border:`1px solid ${C.border}`,borderRadius:3,color:C.purpleLight,padding:"10px 14px",fontFamily:"'Space Grotesk',sans-serif",fontSize:22,fontWeight:700,outline:"none",boxSizing:"border-box"}}/>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,marginTop:8}}>Actuellement : <span style={{color:C.purpleLight}}>{euro(monthlyFee)}/mois</span></div>
            </div>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:24}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,letterSpacing:"0.1em",marginBottom:12}}>OBJECTIF MENSUEL VENDEURS (€)</div>
              <input type="number" min="1" value={goalInput} onChange={e=>setGoalInput(e.target.value)}
                style={{width:"100%",background:"#0A0A0F",border:`1px solid ${C.border}`,borderRadius:3,color:C.active,padding:"10px 14px",fontFamily:"'Space Grotesk',sans-serif",fontSize:22,fontWeight:700,outline:"none",boxSizing:"border-box"}}/>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,marginTop:8}}>Actuellement : <span style={{color:C.active}}>{euro(monthlyGoal)}/mois</span></div>
            </div>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:24}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,letterSpacing:"0.1em",marginBottom:6}}>TAUX URSSAF (%)</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#7B7490",marginBottom:10}}>Standard 22% · ACRE ~11% · 0% = désactivé</div>
              <input type="number" min="0" max="100" step="0.1" value={urssafInput} onChange={e=>setUrssafInput(e.target.value)}
                style={{width:"100%",background:"#0A0A0F",border:`1px solid ${C.border}`,borderRadius:3,color:C.amber,padding:"10px 14px",fontFamily:"'Space Grotesk',sans-serif",fontSize:22,fontWeight:700,outline:"none",boxSizing:"border-box"}}/>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,marginTop:8}}>
                Actuellement : <span style={{color:C.amber}}>{Math.round(urssafRate*100)}%</span>
                {urssafRate < 0.12 && urssafRate > 0 && <span style={{color:C.active,marginLeft:8}}> · Mode ACRE actif</span>}
                {urssafRate === 0 && <span style={{color:C.danger,marginLeft:8}}> · URSSAF désactivée</span>}
              </div>
            </div>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:24}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,letterSpacing:"0.1em",marginBottom:12}}>EMPLACEMENTS MAX</div>
              <input type="number" min="1" value={maxSlotsInput} onChange={e=>setMaxSlotsInput(e.target.value)}
                style={{width:"100%",background:"#0A0A0F",border:`1px solid ${C.border}`,borderRadius:3,color:C.purpleLight,padding:"10px 14px",fontFamily:"'Space Grotesk',sans-serif",fontSize:22,fontWeight:700,outline:"none",boxSizing:"border-box"}}/>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,marginTop:8}}>
                Occupation : <span style={{color:active.length>maxSlots?C.danger:C.active}}>{active.length}/{maxSlots}</span>
              </div>
            </div>

            {/* Catégories */}
            <div style={{gridColumn:"1/-1",background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:24}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim,letterSpacing:"0.1em",marginBottom:14}}>CATÉGORIES</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
                {categories.map(cat=>(
                  <div key={cat} style={{display:"flex",alignItems:"center",gap:6,
                    background:catColors[cat]?catColors[cat]+"22":C.purple+"22",
                    border:"1px solid "+(catColors[cat]?catColors[cat]+"55":C.purple+"55"),
                    borderRadius:4,padding:"6px 10px"}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:catColors[cat]||C.purple}}/>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:C.text}}>{cat}</span>
                    <button
                      onClick={()=>{
                        const inUse = items.some(i=>i.category===cat);
                        if(inUse) setCatWarning(cat);
                        else setCategories(p=>p.filter(c=>c!==cat));
                      }}
                      style={{background:"none",border:"none",color:"rgba(239,68,68,0.5)",cursor:"pointer",
                        fontSize:13,padding:"0 2px",lineHeight:1,marginLeft:2}}
                      onMouseEnter={e=>e.currentTarget.style.color=C.danger}
                      onMouseLeave={e=>e.currentTarget.style.color="rgba(239,68,68,0.5)"}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8}}>
                <input
                  value={newCatInput} onChange={e=>setNewCatInput(e.target.value)}
                  onKeyDown={e=>{
                    if(e.key==="Enter"&&newCatInput.trim()&&!categories.includes(newCatInput.trim())){
                      const name = newCatInput.trim();
                      setCategories(p=>[...p,name]);
                      const hue = Math.round(Math.random()*60)+240;
                      setCatColors(p=>({...p,[name]:"hsl("+hue+",70%,65%)"}));
                      setNewCatInput("");
                    }
                  }}
                  placeholder="Nouvelle catégorie..."
                  style={{flex:1,background:"#0A0A0F",border:`1px solid ${C.border}`,borderRadius:3,
                    color:C.text,padding:"8px 12px",fontFamily:"'DM Mono',monospace",fontSize:13,outline:"none"}}
                />
                <button onClick={()=>{
                  const name = newCatInput.trim();
                  if(!name||categories.includes(name)) return;
                  setCategories(p=>[...p,name]);
                  const hue = Math.round(Math.random()*60)+240;
                  setCatColors(p=>({...p,[name]:"hsl("+hue+",70%,65%)"}));
                  setNewCatInput("");
                }} style={{background:C.purple,border:"none",color:"#fff",padding:"8px 16px",
                  borderRadius:3,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:13}}>
                  + Ajouter
                </button>
              </div>
            </div>

            <div style={{gridColumn:"1/-1",background:C.purpleDim,border:`1px solid ${C.borderStrong}`,borderRadius:4,padding:20,display:"flex",gap:24,flexWrap:"wrap"}}>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>COÛT / PIÈCE EN STOCK</div>
                <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:20,fontWeight:700,color:C.accent}}>{active.length>0?`${(monthlyFee/active.length).toFixed(2)}€`:"—"}</div>
              </div>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>SEUIL RENTABILITÉ / MOIS</div>
                <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:20,fontWeight:700,color:C.purpleLight}}>{euro(monthlyFee)} de marge brute</div>
              </div>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,letterSpacing:"0.1em",marginBottom:4}}>LOYER ANNUEL PROJETÉ</div>
                <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:20,fontWeight:700,color:C.danger}}>{euro(monthlyFee*12)}</div>
              </div>
            </div>
            <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:14}}>
              <button onClick={()=>saveSettings()} style={{background:`linear-gradient(135deg,${C.purple},${C.accent})`,border:"none",color:"#fff",padding:"10px 28px",borderRadius:3,cursor:"pointer",fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:600}}>Enregistrer</button>
              {settingsSaved && <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:C.active}}>✓ Sauvegardé</span>}
            </div>
          </div>

          {/* LOGS */}
          <SectionTitle icon="📋">Activité — 30 derniers jours</SectionTitle>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,overflow:"hidden"}}>
            {/* Filtres */}
            <div style={{display:"flex",gap:6,padding:"12px 16px",borderBottom:`1px solid ${C.border}`,flexWrap:"wrap"}}>
              {["all","auth.login","auth.logout","item.deposit","item.sold","item.updated"].map(f=>(
                <button key={f} onClick={()=>setLogsFilter(f)} style={{
                  background:logsFilter===f?C.purpleDim:"none",
                  border:`1px solid ${logsFilter===f?C.borderStrong:C.border}`,
                  color:logsFilter===f?C.purpleLight:C.textDim,
                  padding:"4px 10px",borderRadius:2,cursor:"pointer",
                  fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"0.06em"}}>
                  {f==="all"?"Tout":f==="auth.login"?"Connexion":f==="auth.logout"?"Déconnexion":f==="item.deposit"?"Dépôt":f==="item.sold"?"Vente":"Modification"}
                </button>
              ))}
              <button onClick={loadLogs} style={{marginLeft:"auto",background:"none",border:`1px solid ${C.border}`,
                color:C.textDim,padding:"4px 10px",borderRadius:2,cursor:"pointer",
                fontFamily:"'DM Mono',monospace",fontSize:10}}>⟳</button>
            </div>
            {logsLoading && <div style={{padding:20,fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim}}>Chargement...</div>}
            {!logsLoading && (()=>{
              const filtered = logsFilter==="all" ? logs : logs.filter(l=>l.event_type===logsFilter);
              const icons = { "auth.login":"→","auth.logout":"←","item.deposit":"↓","item.sold":"✓","item.updated":"✎" };
              const colors = { "auth.login":C.active,"auth.logout":C.textDim,"item.deposit":C.purpleLight,"item.sold":C.accent,"item.updated":C.amber };
              if(!filtered.length) return (
                <div style={{padding:32,textAlign:"center",fontFamily:"'DM Mono',monospace",fontSize:11,color:C.textDim}}>
                  Aucun événement
                </div>
              );
              return (
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${C.border}`}}>
                      {["Date","Type","Détail"].map(h=>(
                        <th key={h} style={{padding:"8px 14px",textAlign:"left",fontFamily:"'DM Mono',monospace",
                          fontSize:9,color:C.textDim,letterSpacing:"0.1em",fontWeight:500}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((log,idx)=>{
                      const col = colors[log.event_type]||C.textDim;
                      const icon = icons[log.event_type]||"·";
                      const d = new Date(log.created_at);
                      const dateStr = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
                      const detail = log.event_type==="item.deposit"
                        ? `${log.payload?.ref||""} — ${log.payload?.name||""} · ${euro(log.payload?.price||0)}`
                        : log.event_type==="item.sold"
                        ? `${log.payload?.ref||""} — ${log.payload?.name||""} · ${euro(log.payload?.price||0)} (${log.payload?.channel||"—"})`
                        : log.payload?.email||log.payload?.role||"";
                      return (
                        <tr key={log.id} style={{borderBottom:`1px solid rgba(139,92,246,0.04)`,
                          background:idx%2===0?"transparent":"rgba(139,92,246,0.01)"}}>
                          <td style={{padding:"8px 14px",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.textDim,whiteSpace:"nowrap"}}>{dateStr}</td>
                          <td style={{padding:"8px 14px",whiteSpace:"nowrap"}}>
                            <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:col,fontWeight:600}}>
                              {icon} {log.event_type}
                            </span>
                          </td>
                          <td style={{padding:"8px 14px",fontFamily:"'DM Mono',monospace",fontSize:10,color:C.greyLight,
                            maxWidth:300,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{detail}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [session,setSession]   = useState(null);
  const [profile,setProfile]   = useState(null);
  const [checking,setChecking] = useState(true);

  useEffect(()=>{
    // Vérifie la session existante au démarrage
    supabase.auth.getSession().then(async ({ data: { session } })=>{
      if(session) {
        try {
          const p = await getProfile(session.user.id);
          if(p.role === "admin" || p.role === "owner") { setSession(session); setProfile(p); }
          else await signOut();
        } catch(e) { await signOut(); }
      }
      setChecking(false);
    });

    // Écoute les changements de session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session)=>{
      if(event === "SIGNED_OUT") { setSession(null); setProfile(null); }
    });

    return () => subscription.unsubscribe();
  },[]);

  const handleUnlock = useCallback((profile)=>{
    setProfile(profile);
    supabase.auth.getSession().then(({ data: { session } })=>setSession(session));
  },[]);

  const handleSignOut = useCallback(async ()=>{
    writeLog("auth.logout", { role: "admin" });
    await signOut();
    setSession(null);
    setProfile(null);
  },[]);

  if(checking) return (
    <div style={{background:"#0D0D12",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:28,height:28,border:"2px solid rgba(139,92,246,0.2)",borderTop:"2px solid #8B5CF6",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if(!session) return <LoginGate onUnlock={handleUnlock}/>;
  return <DashboardApp key="dashboard-app" profile={profile} onSignOut={handleSignOut}/>;
}
