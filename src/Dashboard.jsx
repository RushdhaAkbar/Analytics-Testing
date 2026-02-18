import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

// ─────────────────────────────────────────────────────────────────
//  DATA SOURCE — set VITE_GIST_URL in Netlify environment variables
//  Format: https://gist.githubusercontent.com/YOUR_USER/GIST_ID/raw/dashboard-data.json
// ─────────────────────────────────────────────────────────────────
function normalizeGistUrl(url) {
  if (!url) return "";
  if (url.includes("gist.github.com")) {
    const match = url.match(/gist\.github\.com\/([^/]+)\/([a-zA-Z0-9]+)/);
    if (match) return `https://gist.githubusercontent.com/${match[1]}/${match[2]}/raw`;
  }
  return url;
}
const GIST_URL = normalizeGistUrl(import.meta.env.VITE_GIST_URL || "");

const GOALS={TD:262,BOA:262,VET:77,LAW:77,"VET-I":174,"BOA-I":336,"IU-I":203,"RIDA-I":203,DMS:203,"TD-I":203};
const ICP_GOALS={TD:183,BOA:183,VET:54,LAW:54,"VET-I":122,"BOA-I":235,"IU-I":142,"RIDA-I":142,DMS:142,"TD-I":142};
const ATT_PCT=0.60;
const TOTAL_REG_GOAL=2000;
const PRODUCTS=["All","TD","BOA","VET","LAW","VET-I","BOA-I","DMS","IU-I","RIDA-I","TD-I"];
const PC={TD:"#E8651A",BOA:"#2A6FDB",VET:"#16A34A",LAW:"#9333EA","VET-I":"#06B6D4","BOA-I":"#F59E0B",DMS:"#EC4899","IU-I":"#8B5CF6","RIDA-I":"#14B8A6","TD-I":"#F97316"};
const AC="#E8651A";

// Build quarter date-range from any label like "Q1 2026" — no hardcoding
function makeQC(label) {
  const m = label.match(/^Q(\d)\s+(\d{4})$/);
  if (!m) return null;
  const q=parseInt(m[1]), y=parseInt(m[2]);
  const s0=[[0,1],[3,1],[6,1],[9,1]], e0=[[2,31],[5,30],[8,30],[11,31]], days=[90,91,92,92];
  return { s:new Date(y,s0[q-1][0],s0[q-1][1]), e:new Date(y,e0[q-1][0],e0[q-1][1]), d:days[q-1] };
}

// Sort quarter labels chronologically
function sortQs(qs) {
  return [...qs].sort((a,b) => {
    const ma=a.match(/Q(\d)\s+(\d{4})/), mb=b.match(/Q(\d)\s+(\d{4})/);
    if (!ma||!mb) return 0;
    return parseInt(ma[2])-parseInt(mb[2]) || parseInt(ma[1])-parseInt(mb[1]);
  });
}

const p=(a,b)=>b===0?0:(a/b)*100;
const f=n=>n.toFixed(1)+"%";
const fd=ds=>new Date(ds).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"2-digit"});

/* ── UI Components ── */
function KPI({label,value,sub,color}){return(<div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"18px 20px",flex:1,minWidth:130}}><div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:1.2,color:"rgba(255,255,255,0.45)",marginBottom:5}}>{label}</div><div style={{fontSize:28,fontWeight:700,color:color||"#fff",lineHeight:1.1}}>{value}</div>{sub&&<div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:4}}>{sub}</div>}</div>);}
function Card({title,children}){return(<div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"20px 18px 14px"}}><div style={{fontSize:12,fontWeight:600,textTransform:"uppercase",letterSpacing:1,color:"rgba(255,255,255,0.5)",marginBottom:14}}>{title}</div>{children}</div>);}
const CTip=({active,payload,label})=>{if(!active||!payload?.length)return null;return(<div style={{background:"#1a1a2e",border:"1px solid rgba(255,255,255,0.15)",borderRadius:10,padding:"10px 14px",fontSize:12}}><div style={{fontWeight:600,marginBottom:4,color:"#fff"}}>{label}</div>{payload.map((pp,i)=>(<div key={i} style={{color:pp.color||pp.fill,marginTop:2}}>{pp.name}: <strong>{typeof pp.value==="number"?(pp.value%1!==0?pp.value.toFixed(1):pp.value):pp.value}</strong></div>))}</div>);};

function GoalCard({product,quarter,events}){
  const goal=GOALS[product],icpGoal=ICP_GOALS[product]||0,color=PC[product],qc=makeQC(quarter);if(!qc)return null;
  const actual=events.reduce((s,e)=>s+e.reg,0),icpActual=events.reduce((s,e)=>s+e.icpR,0),attTotal=events.reduce((s,e)=>s+e.att,0),cnt=events.length;
  const variance=actual-goal,icpVariance=icpActual-icpGoal;
  const regPct=p(actual,goal),icpPct2=p(icpActual,icpGoal);
  const attGoal=Math.round(actual*ATT_PCT),attVar=attTotal-attGoal,attPct2=attGoal>0?p(attTotal,attGoal):0;
  const today=new Date(),elapsed=Math.min((today-qc.s)/864e5,qc.d),frac=elapsed/qc.d,done=today>qc.e;
  let proj,icpProj,pn;if(done){proj=actual;icpProj=icpActual;pn="Quarter completed";}else{const rpd=frac>0?actual/elapsed:0;proj=Math.round(rpd*qc.d);const irpd=frac>0?icpActual/elapsed:0;icpProj=Math.round(irpd*qc.d);pn=`${Math.round(frac*100)}% through quarter`;}
  const will=proj>=goal,icpWill=icpProj>=icpGoal;
  return(<div style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${color}33`,borderRadius:16,padding:"20px 18px",flex:1,minWidth:220}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:3,background:color}}/><span style={{fontSize:17,fontWeight:700,color}}>{product}</span></div><span style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>{quarter}</span></div>
    <div style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>Reg Goal</span><span style={{fontSize:13,fontWeight:700,color:regPct>=100?"#16A34A":regPct>=70?"#EAB308":"#EF4444"}}>{regPct.toFixed(1)}%</span></div>
    <div style={{background:"rgba(255,255,255,0.06)",borderRadius:8,height:10,overflow:"hidden",position:"relative"}}><div style={{height:"100%",width:`${Math.min(regPct,100)}%`,borderRadius:8,background:regPct>=100?"#16A34A":regPct>=70?"#EAB308":"#EF4444",transition:"width 0.8s"}}/>{!done&&<div style={{position:"absolute",top:0,height:"100%",width:2,background:"rgba(255,255,255,0.5)",left:`${Math.min(frac*100,100)}%`}}/>}</div></div>
    <div style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>ICP Goal <span style={{fontSize:9,color:"rgba(255,255,255,0.3)"}}>(70%)</span></span><span style={{fontSize:13,fontWeight:700,color:icpPct2>=100?"#16A34A":icpPct2>=70?"#EAB308":"#EF4444"}}>{icpPct2.toFixed(1)}%</span></div>
    <div style={{background:"rgba(255,255,255,0.06)",borderRadius:8,height:8,overflow:"hidden",position:"relative"}}><div style={{height:"100%",width:`${Math.min(icpPct2,100)}%`,borderRadius:8,background:icpPct2>=100?"#16A34A":icpPct2>=70?"#EAB308":"#EF4444",transition:"width 0.8s"}}/>{!done&&<div style={{position:"absolute",top:0,height:"100%",width:2,background:"rgba(255,255,255,0.5)",left:`${Math.min(frac*100,100)}%`}}/>}</div></div>
    <div style={{marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>Att Goal <span style={{fontSize:9,color:"rgba(255,255,255,0.3)"}}>(60% of reg)</span></span><span style={{fontSize:13,fontWeight:700,color:attPct2>=100?"#16A34A":attPct2>=70?"#EAB308":"#EF4444"}}>{attPct2.toFixed(1)}%</span></div>
    <div style={{background:"rgba(255,255,255,0.06)",borderRadius:8,height:8,overflow:"hidden",position:"relative"}}><div style={{height:"100%",width:`${Math.min(attPct2,100)}%`,borderRadius:8,background:attPct2>=100?"#16A34A":attPct2>=70?"#EAB308":"#EF4444",transition:"width 0.8s"}}/></div></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,fontSize:11}}>
      <div><div style={{color:"rgba(255,255,255,0.4)",marginBottom:2}}>Reg</div><div style={{fontSize:16,fontWeight:700}}>{actual}<span style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>/{goal}</span></div></div>
      <div><div style={{color:"rgba(255,255,255,0.4)",marginBottom:2}}>ICP</div><div style={{fontSize:16,fontWeight:700,color:"#16A34A"}}>{icpActual}<span style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>/{icpGoal}</span></div></div>
      <div><div style={{color:"rgba(255,255,255,0.4)",marginBottom:2}}>Att</div><div style={{fontSize:16,fontWeight:700,color:"#2A6FDB"}}>{attTotal}<span style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>/{attGoal}</span></div></div>
      <div><div style={{color:"rgba(255,255,255,0.4)",marginBottom:2}}>Reg Var</div><div style={{fontSize:13,fontWeight:700,color:variance>=0?"#16A34A":"#EF4444"}}>{variance>=0?"+":""}{variance}</div></div>
      <div><div style={{color:"rgba(255,255,255,0.4)",marginBottom:2}}>ICP Var</div><div style={{fontSize:13,fontWeight:700,color:icpVariance>=0?"#16A34A":"#EF4444"}}>{icpVariance>=0?"+":""}{icpVariance}</div></div>
      <div><div style={{color:"rgba(255,255,255,0.4)",marginBottom:2}}>Att Var</div><div style={{fontSize:13,fontWeight:700,color:attVar>=0?"#16A34A":"#EF4444"}}>{attVar>=0?"+":""}{attVar}</div></div>
    </div>
    <div style={{marginTop:12,padding:"10px 12px",borderRadius:10,background:(will&&icpWill)?"rgba(22,163,74,0.08)":"rgba(239,68,68,0.08)",border:`1px solid ${(will&&icpWill)?"rgba(22,163,74,0.2)":"rgba(239,68,68,0.2)"}`}}><div style={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>Projection</div><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}><span style={{fontSize:14,fontWeight:700,color:will?"#16A34A":"#EF4444"}}>{proj} reg</span><span style={{fontSize:14,fontWeight:700,color:icpWill?"#16A34A":"#EF4444"}}>{icpProj} ICP</span></div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:1}}>{pn} · {cnt} events</div></div>
  </div>);
}

/* ═══ MAIN ═══ */
export default function Dashboard(){
  const [tab,setTab]=useState("overview");
  const [sp,setSP]=useState("All");
  const [sq,setSQ]=useState("All");
  const [sortCol,setSortCol]=useState("date");
  const [sortDir,setSortDir]=useState("desc");
  const [events,setEvents]=useState([]);
  const [src,setSrc]=useState("loading");
  const [lastRefresh,setLastRefresh]=useState(null);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState("");
  const mounted=useRef(true);

  // Quarters derived entirely from event data — no hardcoding
  const allQs=useMemo(()=>sortQs([...new Set(events.map(e=>e.q).filter(Boolean))]),[events]);
  const QUARTERS=useMemo(()=>["All",...allQs],[allQs]);

  const fetchData=useCallback(async()=>{
    if(!mounted.current||!GIST_URL)return;
    setRefreshing(true);
    try{
      const url=`${GIST_URL}${GIST_URL.includes("?")?"&":"?"}t=${Date.now()}`;
      const res=await fetch(url,{method:"GET",headers:{Accept:"application/json"},cache:"no-store"});
      if(!res.ok)throw new Error(`HTTP ${res.status}`);
      const json=await res.json();
      if(!Array.isArray(json.events))throw new Error("Invalid format — expected { events: [] }");
      if(mounted.current){
        setEvents(json.events);
        setSrc("live");
        setLastRefresh(json.updatedAt?new Date(json.updatedAt).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}):new Date().toLocaleTimeString());
        setError("");
      }
    }catch(e){
      console.warn("Gist fetch failed:",e?.message||e);
      if(mounted.current){setSrc(prev=>prev==="live"?"stale":"error");setError(e?.message||"");}
    }finally{
      if(mounted.current)setRefreshing(false);
    }
  },[]);

  useEffect(()=>{mounted.current=true;fetchData();const iv=setInterval(fetchData,120000);return()=>{mounted.current=false;clearInterval(iv);};},[fetchData]);

  const filtered=useMemo(()=>events.filter(e=>(sp==="All"||e.product===sp)&&(sq==="All"||e.q===sq)),[sp,sq,events]);

  const totals=useMemo(()=>{const t={reg:0,icpR:0,nicpR:0,att:0,icpA:0,nicpA:0,dR:0,pR:0,n:filtered.length};filtered.forEach(e=>{t.reg+=e.reg;t.icpR+=e.icpR;t.nicpR+=e.nicpR;t.att+=e.att;t.icpA+=e.icpA;t.nicpA+=e.nicpA;t.dR+=e.dR;t.pR+=e.pR;});t.conv=p(t.att,t.reg);t.icpPct=p(t.icpR,t.reg);t.icpConv=p(t.icpA,t.icpR);return t;},[filtered]);

  const byProd=useMemo(()=>{const m={};filtered.forEach(e=>{if(!m[e.product])m[e.product]={product:e.product,reg:0,icpR:0,att:0,icpA:0,n:0,dR:0,pR:0};const x=m[e.product];x.reg+=e.reg;x.icpR+=e.icpR;x.att+=e.att;x.icpA+=e.icpA;x.n++;x.dR+=e.dR;x.pR+=e.pR;});return Object.values(m).map(x=>({...x,conv:p(x.att,x.reg),icpPct:p(x.icpR,x.reg),icpConv:p(x.icpA,x.icpR),avg:x.reg/x.n})).sort((a,b)=>b.reg-a.reg);},[filtered]);

  const byQ=useMemo(()=>{const m={};filtered.forEach(e=>{if(!m[e.q])m[e.q]={quarter:e.q,reg:0,icpR:0,att:0,icpA:0,n:0};const x=m[e.q];x.reg+=e.reg;x.icpR+=e.icpR;x.att+=e.att;x.icpA+=e.icpA;x.n++;});return Object.values(m).map(x=>({...x,conv:p(x.att,x.reg),icpPct:p(x.icpR,x.reg)}));},[filtered]);

  const goalCards=useMemo(()=>{const ps=["TD","BOA","VET","LAW","VET-I","BOA-I","DMS","IU-I","RIDA-I","TD-I"],qs=sq==="All"?allQs:[sq],out=[];qs.forEach(q=>ps.forEach(pp=>{if(sp!=="All"&&sp!==pp)return;const evts=events.filter(e=>e.product===pp&&e.q===q);if(evts.length>0)out.push({product:pp,quarter:q,events:evts});}));return out;},[sp,sq,events,allQs]);

  const goalBarData=useMemo(()=>{const ps=["TD","BOA","VET","LAW","VET-I","BOA-I","DMS","IU-I","RIDA-I","TD-I"],qs=sq==="All"?allQs:[sq],out=[];qs.forEach(q=>ps.forEach(pp=>{if(sp!=="All"&&sp!==pp)return;const evts=events.filter(e=>e.product===pp&&e.q===q);const act=evts.reduce((s,e)=>s+e.reg,0);const icpAct=evts.reduce((s,e)=>s+e.icpR,0);if(act>0||GOALS[pp])out.push({name:`${pp} ${q}`,actual:act,goal:GOALS[pp],icpActual:icpAct,icpGoal:ICP_GOALS[pp]||0,product:pp});}));return out;},[sp,sq,events,allQs]);

  const timeline=useMemo(()=>[...filtered].sort((a,b)=>new Date(a.date)-new Date(b.date)).map(e=>({date:fd(e.date),reg:e.reg,att:e.att,icpR:e.icpR})),[filtered]);

  const sortedEvents=useMemo(()=>{const arr=[...filtered];arr.sort((a,b)=>{let va,vb;if(sortCol==="date"){va=new Date(a.date);vb=new Date(b.date);}else if(sortCol==="product"){va=a.product;vb=b.product;}else if(sortCol==="q"){va=a.q;vb=b.q;}else{va=a[sortCol]||0;vb=b[sortCol]||0;}if(va<vb)return sortDir==="asc"?-1:1;if(va>vb)return sortDir==="asc"?1:-1;return 0;});return arr;},[filtered,sortCol,sortDir]);

  const handleSort=col=>{if(sortCol===col)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortCol(col);setSortDir("desc");}};
  const sortIcon=col=>sortCol===col?(sortDir==="asc"?" ↑":" ↓"):"";

  const perfRanking=useMemo(()=>{
    const allProds=["TD","BOA","VET","LAW","VET-I","BOA-I","DMS","IU-I","RIDA-I","TD-I"];
    const qs=sq==="All"?allQs:[sq];
    const prodMap={};
    allProds.forEach(prod=>{
      if(sp!=="All"&&sp!==prod)return;
      const goal=GOALS[prod]||0;
      const evts=events.filter(e=>e.product===prod&&(sq==="All"||e.q===sq));
      if(evts.length===0)return;
      const reg=evts.reduce((s,e)=>s+e.reg,0),att=evts.reduce((s,e)=>s+e.att,0),icpR=evts.reduce((s,e)=>s+e.icpR,0),icpA=evts.reduce((s,e)=>s+e.icpA,0),dR=evts.reduce((s,e)=>s+e.dR,0),pR=evts.reduce((s,e)=>s+e.pR,0);
      const conv=reg>0?(att/reg)*100:0,icpPct=reg>0?(icpR/reg)*100:0,icpConv=icpR>0?(icpA/icpR)*100:0,avg=reg/evts.length;
      let totalGoal=0,totalActual=0,totalIcpGoal=0,totalIcpActual=0;
      qs.forEach(q=>{const qEvts=events.filter(e=>e.product===prod&&e.q===q);totalActual+=qEvts.reduce((s,e)=>s+e.reg,0);totalIcpActual+=qEvts.reduce((s,e)=>s+e.icpR,0);totalGoal+=goal;totalIcpGoal+=(ICP_GOALS[prod]||0);});
      const attainment=totalGoal>0?(totalActual/totalGoal)*100:0;
      const icpAttainment=totalIcpGoal>0?(totalIcpActual/totalIcpGoal)*100:0;
      const score=(attainment*0.30)+(icpAttainment*0.15)+(conv*0.20)+(icpPct*0.15)+(icpConv*0.10)+Math.min((avg/50)*10,10)*1.0;
      prodMap[prod]={product:prod,color:PC[prod],reg,att,icpR,icpA,dR,pR,conv,icpPct,icpConv,avg,n:evts.length,goal:totalGoal,icpGoal:totalIcpGoal,attainment,icpAttainment,score};
    });
    return Object.values(prodMap).sort((a,b)=>b.score-a.score);
  },[events,sp,sq,allQs]);

  const icpPie=[{name:"ICP",value:totals.icpR,fill:"#16A34A"},{name:"Non-ICP",value:totals.nicpR,fill:"#404060"}];
  const srcPie=[{name:"Partner",value:totals.pR,fill:"#2A6FDB"},{name:"Direct",value:totals.dR,fill:AC}];

  const insights=useMemo(()=>{
    const allProds=["TD","BOA","VET","LAW","VET-I","BOA-I","DMS","IU-I","RIDA-I","TD-I"];
    const qs=sq==="All"?allQs:[sq];
    const concerns=[],positives=[];
    qs.forEach(q=>{
      const qc=makeQC(q);if(!qc)return;
      const today=new Date(),elapsed=Math.min((today-qc.s)/864e5,qc.d),frac=elapsed/qc.d,done=today>qc.e;
      allProds.forEach(prod=>{
        if(sp!=="All"&&sp!==prod)return;
        const goal=GOALS[prod];if(!goal)return;
        const evts=events.filter(e=>e.product===prod&&e.q===q);if(evts.length===0)return;
        const actual=evts.reduce((s,e)=>s+e.reg,0),att=evts.reduce((s,e)=>s+e.att,0),icpR=evts.reduce((s,e)=>s+e.icpR,0);
        const conv=actual>0?(att/actual)*100:0,icpPct=actual>0?(icpR/actual)*100:0,attainment=(actual/goal)*100;
        const color=PC[prod];
        let proj;if(done){proj=actual;}else{const rpd=frac>0?actual/elapsed:0;proj=Math.round(rpd*qc.d);}
        const projShort=goal-proj;
        const icpGoal=ICP_GOALS[prod]||0,icpAttainment=icpGoal>0?(icpR/icpGoal)*100:0;
        if(!done&&attainment<frac*100*0.7&&projShort>0)concerns.push({prod,q,severity:"critical",color,icon:"🔴",title:`${prod} critically behind in ${q}`,detail:`At ${attainment.toFixed(0)}% of goal (${actual}/${goal}) with ${(frac*100).toFixed(0)}% of quarter elapsed. Projected to finish at ${proj}, short by ${projShort}.`,rec:`Increase event frequency or boost per-event registrations. Current avg is ${(actual/evts.length).toFixed(0)}/event — needs ~${Math.ceil((goal-actual)/Math.max(1,Math.ceil(qc.d*(1-frac)/14)))}/event to recover.`});
        else if(!done&&attainment<frac*100*0.9&&projShort>0)concerns.push({prod,q,severity:"warning",color,icon:"🟡",title:`${prod} trending below target in ${q}`,detail:`At ${attainment.toFixed(0)}% of goal (${actual}/${goal}). Projected ${proj} vs goal of ${goal}.`,rec:`Consider adding ${Math.ceil(projShort/Math.max(1,(actual/evts.length)))} more events or increasing promotion to close the ${projShort}-registration gap.`});
        if(conv<25&&actual>10)concerns.push({prod,q,severity:"warning",color,icon:"🟡",title:`${prod} has low conversion (${conv.toFixed(1)}%) in ${q}`,detail:`Only ${att} of ${actual} registrants attended (${conv.toFixed(1)}%). This is well below a healthy 40%+ benchmark.`,rec:`Review event timing, reminder cadence, and content relevance. Consider pre-event engagement or shorter lead times.`});
        const attGoal60=Math.round(actual*ATT_PCT);
        if(actual>10&&att<attGoal60){const attGap=attGoal60-att,attAchieved=attGoal60>0?((att/attGoal60)*100).toFixed(0):0;concerns.push({prod,q,severity:att<attGoal60*0.5?"critical":"warning",color,icon:att<attGoal60*0.5?"🔴":"🟡",title:`${prod} attendees below 60% target in ${q}`,detail:`${att} attendees vs target of ${attGoal60} (60% of ${actual} registrations). Achieving only ${attAchieved}% of attendee goal, short by ${attGap}.`,rec:`Conversion rate is ${conv.toFixed(1)}%. Improve attendance with stronger reminders, calendar holds, and pre-event engagement.`});}
        if(icpGoal>0&&!done&&icpAttainment<frac*100*0.7&&icpR<icpGoal)concerns.push({prod,q,severity:"critical",color,icon:"🔴",title:`${prod} ICP registrations critically behind in ${q}`,detail:`ICP at ${icpAttainment.toFixed(0)}% of goal (${icpR}/${icpGoal}) with ${(frac*100).toFixed(0)}% of quarter elapsed. Need ${icpGoal-icpR} more ICP registrations.`,rec:`Focus on ICP-targeted channels. Current ICP ratio is ${icpPct.toFixed(0)}% — needs to reach 70%+ of registrations.`});
        else if(icpGoal>0&&!done&&icpAttainment<frac*100*0.9&&icpR<icpGoal)concerns.push({prod,q,severity:"warning",color,icon:"🟡",title:`${prod} ICP registrations trending below target in ${q}`,detail:`ICP at ${icpAttainment.toFixed(0)}% of goal (${icpR}/${icpGoal}). Gap of ${icpGoal-icpR} ICP registrations.`,rec:`Increase ICP-focused targeting. Current ICP ratio is ${icpPct.toFixed(0)}% vs 70% target.`});
        if(icpPct<30&&actual>10)concerns.push({prod,q,severity:"info",color,icon:"🔵",title:`${prod} has low ICP ratio (${icpPct.toFixed(0)}%) in ${q}`,detail:`Only ${icpR} of ${actual} registrants are ICP (${icpPct.toFixed(1)}%) vs 70% target.`,rec:`Refine audience targeting and partner channels.`});
        if(done&&actual<goal)concerns.push({prod,q,severity:"critical",color,icon:"🔴",title:`${prod} missed reg goal in ${q}`,detail:`Finished at ${actual} registrations vs goal of ${goal} (${attainment.toFixed(0)}% attainment). Short by ${goal-actual}.`,rec:`Analyze what worked vs didn't. Top-performing events averaged ${Math.max(...evts.map(e=>e.reg))} registrations — replicate those formats.`});
        if(done&&icpGoal>0&&icpR<icpGoal)concerns.push({prod,q,severity:"critical",color,icon:"🔴",title:`${prod} missed ICP goal in ${q}`,detail:`Finished at ${icpR} ICP registrations vs goal of ${icpGoal} (${icpAttainment.toFixed(0)}% attainment). Short by ${icpGoal-icpR}.`,rec:`ICP ratio was ${icpPct.toFixed(0)}% vs 70% target. Review audience quality and channel mix for next quarter.`});
        if(attainment>=frac*100&&!done)positives.push({prod,q,color,icon:"✅",title:`${prod} reg on track in ${q}`,detail:`At ${attainment.toFixed(0)}% of goal with ${(frac*100).toFixed(0)}% of quarter elapsed. Projected to reach ${proj}.`});
        if(done&&actual>=goal)positives.push({prod,q,color,icon:"🎯",title:`${prod} hit reg goal in ${q}`,detail:`Achieved ${actual} registrations vs goal of ${goal} (${attainment.toFixed(0)}% attainment).`});
        if(icpGoal>0&&icpAttainment>=frac*100&&!done)positives.push({prod,q,color,icon:"💚",title:`${prod} ICP on track in ${q}`,detail:`ICP at ${icpAttainment.toFixed(0)}% of goal (${icpR}/${icpGoal}) with ${(frac*100).toFixed(0)}% of quarter elapsed.`});
        if(done&&icpGoal>0&&icpR>=icpGoal)positives.push({prod,q,color,icon:"🎯",title:`${prod} hit ICP goal in ${q}`,detail:`Achieved ${icpR} ICP registrations vs goal of ${icpGoal} (${icpAttainment.toFixed(0)}% attainment).`});
        if(conv>=60&&actual>10)positives.push({prod,q,color,icon:"⚡",title:`${prod} has excellent conversion (${conv.toFixed(0)}%) in ${q}`,detail:`${att} of ${actual} registrants attended — strong audience engagement.`});
        const attGoalPos=Math.round(actual*ATT_PCT);if(actual>10&&att>=attGoalPos&&attGoalPos>0)positives.push({prod,q,color,icon:"👥",title:`${prod} met 60% attendee target in ${q}`,detail:`${att} attendees from ${actual} registrations (${conv.toFixed(0)}% conv) vs target of ${attGoalPos}.`});
      });
    });
    concerns.sort((a,b)=>{if(a.q!==b.q)return a.q>b.q?-1:1;if(a.severity==="critical"&&b.severity!=="critical")return -1;if(b.severity==="critical"&&a.severity!=="critical")return 1;return 0;});
    positives.sort((a,b)=>a.q!==b.q?(a.q>b.q?-1:1):0);
    return{concerns,positives};
  },[events,sp,sq,allQs]);

  const tabBtn=t=>({padding:"10px 22px",borderRadius:"10px 10px 0 0",border:"none",background:tab===t?"rgba(255,255,255,0.06)":"transparent",color:tab===t?"#fff":"rgba(255,255,255,0.4)",fontSize:13,fontWeight:tab===t?700:500,cursor:"pointer",borderBottom:tab===t?`2px solid ${AC}`:"2px solid transparent",fontFamily:"inherit"});
  const statusColor=src==="live"?"#16A34A":src==="stale"?"#EAB308":src==="error"?"#EF4444":"rgba(255,255,255,0.3)";
  const statusLabel=src==="live"?"Live":src==="stale"?"Stale (last fetch failed)":src==="error"?"Fetch failed":"Loading…";

  // Empty state — waiting for Gist
  if(src!=="live"&&src!=="stale"&&events.length===0){
    return(
      <div style={{minHeight:"100vh",background:"#0B0B14",color:"#E8E8F0",fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
        {!GIST_URL
          ? <><div style={{fontSize:20,fontWeight:700,color:"#EAB308"}}>VITE_GIST_URL not set</div><div style={{fontSize:13,color:"rgba(255,255,255,0.4)"}}>Add VITE_GIST_URL to your Netlify environment variables and redeploy.</div></>
          : <><div style={{width:36,height:36,borderRadius:"50%",border:"3px solid rgba(255,255,255,0.1)",borderTopColor:AC,animation:"spin 1s linear infinite"}}/><div style={{fontSize:14,color:"rgba(255,255,255,0.5)"}}>Loading data from Gist…</div>{error&&<div style={{fontSize:12,color:"#EF4444"}}>{error}</div>}</>
        }
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return(
    <div style={{minHeight:"100vh",background:"#0B0B14",color:"#E8E8F0",fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif",padding:"28px 24px 60px"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>

      <div style={{marginBottom:14}}>
        <div style={{display:"flex",alignItems:"baseline",gap:12,flexWrap:"wrap"}}>
          <h1 style={{fontSize:26,fontWeight:700,margin:0,letterSpacing:-0.5}}>Registrations Analysis - Marketing</h1>
          <span style={{fontSize:12,color:"rgba(255,255,255,0.35)",fontWeight:500}}>TD / BOA / VET / LAW / VET-I / BOA-I / DMS / IU-I / RIDA-I / TD-I</span>
        </div>
        <div style={{height:3,width:48,background:AC,borderRadius:2,marginTop:10,marginBottom:8}}/>
        <div style={{display:"flex",alignItems:"center",gap:8,fontSize:11,color:"rgba(255,255,255,0.5)"}}>
          <span style={{width:8,height:8,borderRadius:"50%",background:statusColor,display:"inline-block",boxShadow:src==="live"?"0 0 6px #16A34A55":"none"}}/>
          <span style={{color:statusColor,fontWeight:600}}>{statusLabel}</span>
          {lastRefresh&&<span>· Updated {lastRefresh}</span>}
          <span>· {events.length} events · 4 data sources</span>
          {error&&src!=="live"&&<span style={{color:"#EF4444"}}>· {error}</span>}
        </div>
      </div>

      <div style={{display:"flex",gap:2,borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
        <button style={tabBtn("overview")} onClick={()=>setTab("overview")}>Overview</button>
        <button style={tabBtn("performance")} onClick={()=>setTab("performance")}>Performance</button>
        <button style={tabBtn("insights")} onClick={()=>setTab("insights")}>Insights</button>
        <button style={tabBtn("events")} onClick={()=>setTab("events")}>Event List</button>
      </div>
      <div style={{height:16}}/>

      {/* Filters */}
      <div style={{display:"flex",gap:10,marginBottom:22,flexWrap:"wrap",alignItems:"center"}}>
        {QUARTERS.map(q=>(<button key={q} onClick={()=>setSQ(q)} style={{padding:"7px 16px",borderRadius:8,border:"1px solid",borderColor:sq===q?AC:"rgba(255,255,255,0.1)",background:sq===q?AC:"transparent",color:sq===q?"#fff":"rgba(255,255,255,0.55)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{q}</button>))}
        <div style={{width:1,background:"rgba(255,255,255,0.1)",margin:"0 4px",height:24}}/>
        {PRODUCTS.map(pp=>(<button key={pp} onClick={()=>setSP(pp)} style={{padding:"7px 16px",borderRadius:8,border:"1px solid",borderColor:sp===pp?(PC[pp]||AC):"rgba(255,255,255,0.1)",background:sp===pp?(PC[pp]||AC):"transparent",color:sp===pp?"#fff":"rgba(255,255,255,0.55)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{pp}</button>))}
        <div style={{flex:1}}/>
        <button type="button" onClick={()=>{if(!refreshing)fetchData();}} disabled={refreshing||!GIST_URL} style={{padding:"7px 14px",borderRadius:8,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.6)",fontSize:11,fontWeight:600,cursor:(refreshing||!GIST_URL)?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:6,opacity:(refreshing||!GIST_URL)?0.4:1,fontFamily:"inherit",transition:"opacity 0.2s"}}>
          <span style={{display:"inline-block",width:14,height:14,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.4)",borderTopColor:"transparent",animation:refreshing?"spin 1s linear infinite":"none"}}/>
          {refreshing?"Syncing…":"Refresh"}
        </button>
      </div>

      {/* ═══ OVERVIEW ═══ */}
      {tab==="overview"&&(<>
        <div style={{display:"flex",gap:12,marginBottom:22,flexWrap:"wrap"}}>
          <KPI label="Total Events" value={totals.n}/>
          <KPI label="Total Registrants" value={totals.reg.toLocaleString()} sub={`Goal: ${TOTAL_REG_GOAL}`} color={totals.reg>=TOTAL_REG_GOAL?"#16A34A":AC}/>
          <KPI label="Total Attendees" value={totals.att.toLocaleString()} sub={`Goal: ${Math.round(totals.reg*ATT_PCT)}`}/>
          <KPI label="ICP Registrants" value={totals.icpR.toLocaleString()} sub={f(totals.icpPct)+" of total"} color="#16A34A"/>
          <KPI label="Reg → Attendee" value={f(totals.conv)} color={AC}/>
          <KPI label="ICP Conversion" value={f(totals.icpConv)} sub="ICP Reg → ICP Att" color="#2A6FDB"/>
        </div>

        {(()=>{const tIcpGoal=Math.round(TOTAL_REG_GOAL*0.7),tAttGoal=Math.round(totals.reg*ATT_PCT);const rPct=(totals.reg/TOTAL_REG_GOAL)*100,iPct=tIcpGoal>0?(totals.icpR/tIcpGoal)*100:0,aPct=tAttGoal>0?(totals.att/tAttGoal)*100:0;return(
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"18px 20px",marginBottom:22}}>
          <div style={{fontSize:14,fontWeight:700,color:"rgba(255,255,255,0.6)",marginBottom:14}}>Combined Goals — All Products</div>
          <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:200}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>Total Registrations</span><span style={{fontSize:14,fontWeight:800,color:rPct>=100?"#16A34A":"#EF4444"}}>{totals.reg.toLocaleString()} <span style={{fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.3)"}}>/ {TOTAL_REG_GOAL.toLocaleString()}</span></span></div>
              <div style={{background:"rgba(255,255,255,0.06)",borderRadius:10,height:12,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(rPct,100)}%`,borderRadius:10,background:rPct>=100?"#16A34A":rPct>=70?"#EAB308":"#EF4444",transition:"width 0.8s"}}/></div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:10,color:"rgba(255,255,255,0.35)"}}><span>{rPct.toFixed(1)}%</span><span>{totals.reg>=TOTAL_REG_GOAL?`+${(totals.reg-TOTAL_REG_GOAL).toLocaleString()}`:`-${(TOTAL_REG_GOAL-totals.reg).toLocaleString()}`}</span></div>
            </div>
            <div style={{flex:1,minWidth:200}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>ICP Registrations <span style={{fontSize:9,color:"rgba(255,255,255,0.3)"}}>(70%)</span></span><span style={{fontSize:14,fontWeight:800,color:iPct>=100?"#16A34A":"#EF4444"}}>{totals.icpR.toLocaleString()} <span style={{fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.3)"}}>/ {tIcpGoal.toLocaleString()}</span></span></div>
              <div style={{background:"rgba(255,255,255,0.06)",borderRadius:10,height:12,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(iPct,100)}%`,borderRadius:10,background:iPct>=100?"#16A34A":iPct>=70?"#EAB308":"#EF4444",transition:"width 0.8s"}}/></div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:10,color:"rgba(255,255,255,0.35)"}}><span>{iPct.toFixed(1)}%</span><span>{totals.icpR>=tIcpGoal?`+${(totals.icpR-tIcpGoal).toLocaleString()}`:`-${(tIcpGoal-totals.icpR).toLocaleString()}`}</span></div>
            </div>
            <div style={{flex:1,minWidth:200}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>Attendees <span style={{fontSize:9,color:"rgba(255,255,255,0.3)"}}>(60% of actual reg)</span></span><span style={{fontSize:14,fontWeight:800,color:aPct>=100?"#16A34A":"#EF4444"}}>{totals.att.toLocaleString()} <span style={{fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.3)"}}>/ {tAttGoal.toLocaleString()}</span></span></div>
              <div style={{background:"rgba(255,255,255,0.06)",borderRadius:10,height:12,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(aPct,100)}%`,borderRadius:10,background:aPct>=100?"#16A34A":aPct>=70?"#EAB308":"#EF4444",transition:"width 0.8s"}}/></div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:10,color:"rgba(255,255,255,0.35)"}}><span>{aPct.toFixed(1)}%</span><span>{totals.att>=tAttGoal?`+${(totals.att-tAttGoal).toLocaleString()}`:`-${(tAttGoal-totals.att).toLocaleString()}`}</span></div>
            </div>
          </div>
        </div>);})()} 

        <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:20,padding:"24px 22px",marginBottom:22}}>
          <div style={{fontSize:14,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,color:"rgba(255,255,255,0.6)",marginBottom:18,display:"flex",alignItems:"center",gap:8}}><span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:AC}}/>Goal Tracking & Projections</div>
          <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:22}}>{goalCards.map(c=>(<GoalCard key={`${c.product}-${c.quarter}`} product={c.product} quarter={c.quarter} events={c.events}/>))}</div>
          <Card title="Goal vs Actual Registrations">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={goalBarData} margin={{left:-10}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/><XAxis dataKey="name" tick={{fill:"rgba(255,255,255,0.5)",fontSize:10}} axisLine={false} interval={0} angle={-20} textAnchor="end" height={50}/><YAxis tick={{fill:"rgba(255,255,255,0.4)",fontSize:10}} axisLine={false}/><Tooltip content={<CTip/>}/><Legend formatter={v=><span style={{color:"rgba(255,255,255,0.6)",fontSize:11}}>{v}</span>}/><Bar dataKey="goal" name="Reg Goal" fill="rgba(255,255,255,0.12)" radius={[4,4,0,0]}/><Bar dataKey="actual" name="Reg Actual" radius={[4,4,0,0]}>{goalBarData.map((en,i)=>(<Cell key={i} fill={en.actual>=en.goal?"#16A34A":PC[en.product]}/>))}</Bar><Bar dataKey="icpGoal" name="ICP Goal" fill="rgba(22,163,74,0.15)" radius={[4,4,0,0]}/><Bar dataKey="icpActual" name="ICP Actual" radius={[4,4,0,0]}>{goalBarData.map((en,i)=>(<Cell key={i} fill={en.icpActual>=en.icpGoal?"#16A34A":"#065F46"}/>))}</Bar></BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:16}}>
          <Card title="Registrations by Product"><ResponsiveContainer width="100%" height={220}><BarChart data={byProd} margin={{left:-10}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/><XAxis dataKey="product" tick={{fill:"rgba(255,255,255,0.5)",fontSize:11}} axisLine={false}/><YAxis tick={{fill:"rgba(255,255,255,0.4)",fontSize:10}} axisLine={false}/><Tooltip content={<CTip/>}/><Bar dataKey="reg" name="Total" fill="#404060" radius={[4,4,0,0]}/><Bar dataKey="icpR" name="ICP" fill="#16A34A" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></Card>
          <Card title="ICP vs Non-ICP"><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={icpPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={0}>{icpPie.map((en,i)=><Cell key={i} fill={en.fill}/>)}</Pie><Tooltip content={<CTip/>}/><Legend formatter={v=><span style={{color:"rgba(255,255,255,0.6)",fontSize:11}}>{v}</span>}/></PieChart></ResponsiveContainer><div style={{textAlign:"center",marginTop:-18,fontSize:20,fontWeight:700,color:"#16A34A"}}>{f(totals.icpPct)}</div></Card>
          <Card title="Registration Source"><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={srcPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={0}>{srcPie.map((en,i)=><Cell key={i} fill={en.fill}/>)}</Pie><Tooltip content={<CTip/>}/><Legend formatter={v=><span style={{color:"rgba(255,255,255,0.6)",fontSize:11}}>{v}</span>}/></PieChart></ResponsiveContainer><div style={{textAlign:"center",marginTop:-18,fontSize:12,color:"rgba(255,255,255,0.5)"}}>Partner: <strong style={{color:"#2A6FDB"}}>{totals.pR}</strong> | Direct: <strong style={{color:AC}}>{totals.dR}</strong></div></Card>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
          <Card title="Event Timeline"><ResponsiveContainer width="100%" height={240}><LineChart data={timeline} margin={{left:-10}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/><XAxis dataKey="date" tick={{fill:"rgba(255,255,255,0.4)",fontSize:9}} interval={Math.max(0,Math.floor(timeline.length/10))} axisLine={false}/><YAxis tick={{fill:"rgba(255,255,255,0.4)",fontSize:10}} axisLine={false}/><Tooltip content={<CTip/>}/><Line type="monotone" dataKey="reg" stroke={AC} strokeWidth={2} dot={{r:3,fill:AC}} name="Registrants"/><Line type="monotone" dataKey="att" stroke="#2A6FDB" strokeWidth={2} dot={{r:3,fill:"#2A6FDB"}} name="Attendees"/><Line type="monotone" dataKey="icpR" stroke="#16A34A" strokeWidth={1.5} strokeDasharray="5 3" dot={{r:2,fill:"#16A34A"}} name="ICP Reg"/><Legend formatter={v=><span style={{color:"rgba(255,255,255,0.6)",fontSize:11}}>{v}</span>}/></LineChart></ResponsiveContainer></Card>
          <Card title="Conversion by Product"><div style={{display:"flex",flexDirection:"column",gap:14,paddingTop:6}}>{byProd.map(pp=>(<div key={pp.product}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,fontWeight:600,color:PC[pp.product]}}>{pp.product}</span><span style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>{pp.n} events</span></div><div style={{display:"flex",gap:6,fontSize:10}}><div style={{flex:1}}><div style={{color:"rgba(255,255,255,0.4)",marginBottom:2}}>Reg→Att</div><div style={{background:"rgba(255,255,255,0.06)",borderRadius:6,height:22,overflow:"hidden",position:"relative"}}><div style={{height:"100%",width:`${Math.min(pp.conv,100)}%`,background:PC[pp.product],borderRadius:6,opacity:0.7}}/><span style={{position:"absolute",right:6,top:4,fontSize:10,fontWeight:600}}>{f(pp.conv)}</span></div></div><div style={{flex:1}}><div style={{color:"rgba(255,255,255,0.4)",marginBottom:2}}>ICP %</div><div style={{background:"rgba(255,255,255,0.06)",borderRadius:6,height:22,overflow:"hidden",position:"relative"}}><div style={{height:"100%",width:`${Math.min(pp.icpPct,100)}%`,background:"#16A34A",borderRadius:6,opacity:0.7}}/><span style={{position:"absolute",right:6,top:4,fontSize:10,fontWeight:600}}>{f(pp.icpPct)}</span></div></div></div></div>))}</div></Card>
        </div>

        <Card title="Quarter-over-Quarter"><ResponsiveContainer width="100%" height={220}><BarChart data={byQ} margin={{left:-10}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/><XAxis dataKey="quarter" tick={{fill:"rgba(255,255,255,0.5)",fontSize:11}} axisLine={false}/><YAxis tick={{fill:"rgba(255,255,255,0.4)",fontSize:10}} axisLine={false}/><Tooltip content={<CTip/>}/><Legend formatter={v=><span style={{color:"rgba(255,255,255,0.6)",fontSize:11}}>{v}</span>}/><Bar dataKey="reg" name="Registrants" fill={AC} radius={[4,4,0,0]}/><Bar dataKey="icpR" name="ICP Reg" fill="#16A34A" radius={[4,4,0,0]}/><Bar dataKey="att" name="Attendees" fill="#2A6FDB" radius={[4,4,0,0]}/><Bar dataKey="n" name="Events" fill="#9333EA" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></Card>
      </>)}

      {/* ═══ PERFORMANCE ═══ */}
      {tab==="performance"&&(<>
        <div style={{display:"flex",gap:12,marginBottom:22,flexWrap:"wrap"}}>
          <KPI label="Products Ranked" value={perfRanking.length}/>
          <KPI label="Top Performer" value={perfRanking.length>0?perfRanking[0].product:"—"} color={perfRanking.length>0?perfRanking[0].color:"#fff"}/>
          <KPI label="Top Score" value={perfRanking.length>0?perfRanking[0].score.toFixed(1):"—"} color="#16A34A"/>
          <KPI label="Lowest Performer" value={perfRanking.length>0?perfRanking[perfRanking.length-1].product:"—"} color={perfRanking.length>0?perfRanking[perfRanking.length-1].color:"#fff"}/>
          <KPI label="Avg Score" value={perfRanking.length>0?(perfRanking.reduce((s,r)=>s+r.score,0)/perfRanking.length).toFixed(1):"—"}/>
        </div>
        {perfRanking.length>=3&&(
        <div style={{display:"flex",justifyContent:"center",alignItems:"flex-end",gap:16,marginBottom:28,padding:"20px 0"}}>
          {[perfRanking[1],perfRanking[0],perfRanking[2]].map((r,i)=>{
            const heights=[140,180,110],medals=["🥈","🥇","🥉"],positions=["2nd","1st","3rd"];
            return(<div key={r.product} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
              <span style={{fontSize:24}}>{medals[i]}</span>
              <span style={{fontSize:15,fontWeight:700,color:r.color}}>{r.product}</span>
              <div style={{width:90,height:heights[i],background:`linear-gradient(180deg, ${r.color}44, ${r.color}11)`,border:`1px solid ${r.color}33`,borderRadius:"12px 12px 0 0",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:4}}>
                <span style={{fontSize:22,fontWeight:700,color:r.color}}>{r.score.toFixed(1)}</span>
                <span style={{fontSize:9,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:1}}>{positions[i]}</span>
              </div>
            </div>);
          })}
        </div>
        )}
        <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:20,padding:"24px 22px",marginBottom:22}}>
          <div style={{fontSize:14,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,color:"rgba(255,255,255,0.6)",marginBottom:18,display:"flex",alignItems:"center",gap:8}}>
            <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:AC}}/>
            Product Performance Ranking
            <span style={{fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.3)",marginLeft:8,textTransform:"none",letterSpacing:0}}>Composite score: Reg Goal (30%) + ICP Goal (15%) + Conversion (20%) + ICP Ratio (15%) + ICP Conv (10%) + Avg/Event (10%)</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {perfRanking.map((r,i)=>{
              const maxScore=perfRanking.length>0?perfRanking[0].score:1,barW=maxScore>0?(r.score/maxScore)*100:0,medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":"";
              return(
              <div key={r.product} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${r.color}22`,borderRadius:14,padding:"16px 20px"}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                  <span style={{fontSize:18,fontWeight:800,color:"rgba(255,255,255,0.2)",width:28,textAlign:"right"}}>#{i+1}</span>
                  {medal&&<span style={{fontSize:18}}>{medal}</span>}
                  <div style={{width:12,height:12,borderRadius:4,background:r.color}}/>
                  <span style={{fontSize:16,fontWeight:700,color:r.color}}>{r.product}</span>
                  <div style={{flex:1}}/>
                  <span style={{fontSize:22,fontWeight:800,color:r.color}}>{r.score.toFixed(1)}</span>
                  <span style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontWeight:600}}>PTS</span>
                </div>
                <div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,height:8,overflow:"hidden",marginBottom:14}}>
                  <div style={{height:"100%",width:`${barW}%`,background:`linear-gradient(90deg, ${r.color}, ${r.color}88)`,borderRadius:8,transition:"width 0.8s"}}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8,fontSize:10}}>
                  <div><div style={{color:"rgba(255,255,255,0.35)",marginBottom:3}}>Reg Goal</div><div style={{fontSize:14,fontWeight:700,color:r.attainment>=100?"#16A34A":r.attainment>=70?"#EAB308":"#EF4444"}}>{r.attainment.toFixed(0)}%</div><div style={{color:"rgba(255,255,255,0.25)",fontSize:9}}>{r.reg}/{r.goal}</div></div>
                  <div><div style={{color:"rgba(255,255,255,0.35)",marginBottom:3}}>ICP Goal</div><div style={{fontSize:14,fontWeight:700,color:r.icpAttainment>=100?"#16A34A":r.icpAttainment>=70?"#EAB308":"#EF4444"}}>{r.icpAttainment.toFixed(0)}%</div><div style={{color:"rgba(255,255,255,0.25)",fontSize:9}}>{r.icpR}/{r.icpGoal}</div></div>
                  <div><div style={{color:"rgba(255,255,255,0.35)",marginBottom:3}}>Conversion</div><div style={{fontSize:14,fontWeight:700,color:r.conv>=50?"#16A34A":r.conv>=30?"#EAB308":"#EF4444"}}>{r.conv.toFixed(1)}%</div><div style={{color:"rgba(255,255,255,0.25)",fontSize:9}}>{r.att} att</div></div>
                  <div><div style={{color:"rgba(255,255,255,0.35)",marginBottom:3}}>ICP Ratio</div><div style={{fontSize:14,fontWeight:700,color:r.icpPct>=60?"#16A34A":r.icpPct>=40?"#EAB308":"#EF4444"}}>{r.icpPct.toFixed(0)}%</div><div style={{color:"rgba(255,255,255,0.25)",fontSize:9}}>{r.icpR} ICP</div></div>
                  <div><div style={{color:"rgba(255,255,255,0.35)",marginBottom:3}}>ICP Conv</div><div style={{fontSize:14,fontWeight:700,color:r.icpConv>=50?"#16A34A":r.icpConv>=30?"#EAB308":"#EF4444"}}>{r.icpConv.toFixed(1)}%</div><div style={{color:"rgba(255,255,255,0.25)",fontSize:9}}>{r.icpA} att</div></div>
                  <div><div style={{color:"rgba(255,255,255,0.35)",marginBottom:3}}>Avg/Event</div><div style={{fontSize:14,fontWeight:700}}>{r.avg.toFixed(1)}</div><div style={{color:"rgba(255,255,255,0.25)",fontSize:9}}>{r.n} events</div></div>
                  <div><div style={{color:"rgba(255,255,255,0.35)",marginBottom:3}}>Source Mix</div><div style={{fontSize:14,fontWeight:700,color:"#2A6FDB"}}>{r.reg>0?((r.pR/r.reg)*100).toFixed(0):0}%</div><div style={{color:"rgba(255,255,255,0.25)",fontSize:9}}>partner</div></div>
                </div>
              </div>);
            })}
          </div>
        </div>
        <Card title="Performance Score Comparison">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={perfRanking} layout="vertical" margin={{left:50,right:20}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/>
              <XAxis type="number" tick={{fill:"rgba(255,255,255,0.4)",fontSize:10}} axisLine={false}/>
              <YAxis type="category" dataKey="product" tick={{fill:"rgba(255,255,255,0.5)",fontSize:11,fontWeight:600}} axisLine={false} width={50}/>
              <Tooltip content={<CTip/>}/>
              <Bar dataKey="score" name="Score" radius={[0,6,6,0]}>{perfRanking.map((r,i)=>(<Cell key={i} fill={r.color}/>))}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </>)}

      {/* ═══ INSIGHTS ═══ */}
      {tab==="insights"&&(<>
        <div style={{display:"flex",gap:12,marginBottom:22,flexWrap:"wrap"}}>
          <KPI label="Issues Found" value={insights.concerns.length} color={insights.concerns.length>0?"#EF4444":"#16A34A"}/>
          <KPI label="Critical" value={insights.concerns.filter(c=>c.severity==="critical").length} color="#EF4444"/>
          <KPI label="Warnings" value={insights.concerns.filter(c=>c.severity==="warning").length} color="#EAB308"/>
          <KPI label="Info" value={insights.concerns.filter(c=>c.severity==="info").length} color="#3B82F6"/>
          <KPI label="Performing Well" value={insights.positives.length} color="#16A34A"/>
        </div>
        {insights.concerns.length>0&&(
        <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:20,padding:"24px 22px",marginBottom:22}}>
          <div style={{fontSize:14,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,color:"rgba(255,255,255,0.6)",marginBottom:18,display:"flex",alignItems:"center",gap:8}}>
            <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:"#EF4444"}}/>Needs Attention
            <span style={{fontSize:11,fontWeight:600,color:"#EF4444",background:"rgba(239,68,68,0.1)",padding:"2px 10px",borderRadius:20,marginLeft:6}}>{insights.concerns.length} issue{insights.concerns.length!==1?"s":""}</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {insights.concerns.map((c,i)=>(
              <div key={i} style={{background:c.severity==="critical"?"rgba(239,68,68,0.06)":c.severity==="warning"?"rgba(234,179,8,0.06)":"rgba(59,130,246,0.06)",border:`1px solid ${c.severity==="critical"?"rgba(239,68,68,0.15)":c.severity==="warning"?"rgba(234,179,8,0.15)":"rgba(59,130,246,0.15)"}`,borderRadius:14,padding:"16px 18px"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <span style={{fontSize:16}}>{c.icon}</span>
                  <span style={{fontSize:13,fontWeight:700,color:c.color}}>{c.title}</span>
                  <span style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginLeft:"auto"}}>{c.q}</span>
                </div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",lineHeight:1.6,marginBottom:10,paddingLeft:26}}>{c.detail}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",paddingLeft:26,borderLeft:`2px solid ${c.color}33`,marginLeft:26,paddingTop:2,paddingBottom:2}}>
                  <span style={{fontWeight:700,color:c.color,fontSize:10,textTransform:"uppercase",letterSpacing:0.5}}>Recommendation: </span>{c.rec}
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
        {insights.positives.length>0&&(
        <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:20,padding:"24px 22px",marginBottom:22}}>
          <div style={{fontSize:14,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,color:"rgba(255,255,255,0.6)",marginBottom:18,display:"flex",alignItems:"center",gap:8}}>
            <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:"#16A34A"}}/>Performing Well
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:10}}>
            {insights.positives.map((p2,i)=>(
              <div key={i} style={{background:"rgba(22,163,74,0.05)",border:"1px solid rgba(22,163,74,0.12)",borderRadius:12,padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <span style={{fontSize:14}}>{p2.icon}</span>
                  <span style={{fontSize:12,fontWeight:700,color:p2.color}}>{p2.title}</span>
                </div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.5,paddingLeft:22}}>{p2.detail}</div>
              </div>
            ))}
          </div>
        </div>
        )}
        {insights.concerns.length===0&&insights.positives.length===0&&(
          <div style={{textAlign:"center",padding:"60px 20px",color:"rgba(255,255,255,0.3)",fontSize:14}}>No insights available for the current filter selection.</div>
        )}
      </>)}

      {/* ═══ EVENT LIST ═══ */}
      {tab==="events"&&(<>
        <div style={{display:"flex",gap:12,marginBottom:22,flexWrap:"wrap"}}><KPI label="Showing" value={`${sortedEvents.length} events`}/><KPI label="Registrants" value={totals.reg.toLocaleString()}/><KPI label="Attendees" value={totals.att.toLocaleString()}/><KPI label="Avg Reg / Event" value={(totals.n>0?(totals.reg/totals.n).toFixed(1):"0")}/><KPI label="Avg Conv Rate" value={f(totals.conv)} color={AC}/></div>
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"6px 0",overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
              {[{k:"date",l:"Date"},{k:"product",l:"Product"},{k:"q",l:"Quarter"},{k:"reg",l:"Registrants"},{k:"icpR",l:"ICP Reg"},{k:"nicpR",l:"Non-ICP"},{k:"att",l:"Attendees"},{k:"icpA",l:"ICP Att"},{k:"nicpA",l:"Non-ICP Att"},{k:"conv",l:"Conv %"},{k:"dR",l:"Direct"},{k:"pR",l:"Partner"}].map(c=>(
                <th key={c.k} onClick={()=>handleSort(c.k==="conv"?"att":c.k)} style={{padding:"10px 10px",textAlign:"left",color:"rgba(255,255,255,0.5)",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:0.8,cursor:"pointer",userSelect:"none",whiteSpace:"nowrap"}}>{c.l}{sortIcon(c.k==="conv"?"att":c.k)}</th>))}
            </tr></thead>
            <tbody>{sortedEvents.map((e,i)=>{const cv=e.reg>0?p(e.att,e.reg):0;return(
              <tr key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}} onMouseEnter={ev=>ev.currentTarget.style.background="rgba(255,255,255,0.03)"} onMouseLeave={ev=>ev.currentTarget.style.background="transparent"}>
                <td style={{padding:"10px 10px",whiteSpace:"nowrap"}}>{fd(e.date)}</td>
                <td style={{padding:"10px 10px"}}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><span style={{width:8,height:8,borderRadius:3,background:PC[e.product],display:"inline-block"}}/><span style={{fontWeight:600,color:PC[e.product]}}>{e.product}</span></span></td>
                <td style={{padding:"10px 10px",color:"rgba(255,255,255,0.5)",fontSize:11}}>{e.q}</td>
                <td style={{padding:"10px 10px",fontWeight:600}}>{e.reg}</td>
                <td style={{padding:"10px 10px",color:"#16A34A"}}>{e.icpR}</td>
                <td style={{padding:"10px 10px",color:"rgba(255,255,255,0.4)"}}>{e.nicpR}</td>
                <td style={{padding:"10px 10px",fontWeight:600}}>{e.att}</td>
                <td style={{padding:"10px 10px",color:"#2A6FDB"}}>{e.icpA}</td>
                <td style={{padding:"10px 10px",color:"rgba(255,255,255,0.4)"}}>{e.nicpA}</td>
                <td style={{padding:"10px 10px"}}><span style={{padding:"3px 8px",borderRadius:6,fontSize:11,fontWeight:600,background:cv>=60?"rgba(22,163,74,0.12)":cv>=40?"rgba(234,179,8,0.12)":"rgba(239,68,68,0.12)",color:cv>=60?"#16A34A":cv>=40?"#EAB308":"#EF4444"}}>{f(cv)}</span></td>
                <td style={{padding:"10px 10px"}}>{e.dR}</td><td style={{padding:"10px 10px"}}>{e.pR}</td>
              </tr>);})}</tbody>
          </table>
        </div>
        <div style={{marginTop:18}}><Card title="Product Summary"><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.1)"}}>{["Product","Events","Reg","Goal","Var","ICP","ICP Goal","ICP Var","Att","Att Goal","Att Var","Conv %","Avg/Evt","Direct","Partner"].map(h=>(<th key={h} style={{padding:"8px",textAlign:"left",color:"rgba(255,255,255,0.4)",fontWeight:600,fontSize:9,textTransform:"uppercase",letterSpacing:0.8}}>{h}</th>))}</tr></thead>
          <tbody>{byProd.map(pp=>{const goal=GOALS[pp.product]||0,v=pp.reg-goal,icpG=ICP_GOALS[pp.product]||0,icpV=pp.icpR-icpG,aG=Math.round(pp.reg*ATT_PCT),aV=pp.att-aG;return(<tr key={pp.product} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <td style={{padding:"10px 8px",fontWeight:700,color:PC[pp.product]}}>{pp.product}</td><td style={{padding:"10px 8px"}}>{pp.n}</td><td style={{padding:"10px 8px",fontWeight:600}}>{pp.reg}</td><td style={{padding:"10px 8px",color:"rgba(255,255,255,0.35)"}}>{goal}</td><td style={{padding:"10px 8px",fontWeight:700,color:v>=0?"#16A34A":"#EF4444"}}>{v>=0?"+":""}{v}</td><td style={{padding:"10px 8px",color:"#16A34A"}}>{pp.icpR}</td><td style={{padding:"10px 8px",color:"rgba(255,255,255,0.35)"}}>{icpG}</td><td style={{padding:"10px 8px",fontWeight:700,color:icpV>=0?"#16A34A":"#EF4444"}}>{icpV>=0?"+":""}{icpV}</td><td style={{padding:"10px 8px",fontWeight:600}}>{pp.att}</td><td style={{padding:"10px 8px",color:"rgba(255,255,255,0.35)"}}>{aG}</td><td style={{padding:"10px 8px",fontWeight:700,color:aV>=0?"#16A34A":"#EF4444"}}>{aV>=0?"+":""}{aV}</td><td style={{padding:"10px 8px",color:AC,fontWeight:600}}>{f(pp.conv)}</td><td style={{padding:"10px 8px"}}>{pp.avg.toFixed(1)}</td><td style={{padding:"10px 8px"}}>{pp.dR}</td><td style={{padding:"10px 8px"}}>{pp.pR}</td>
          </tr>);})}</tbody></table></div></Card></div>
      </>)}

      <div style={{textAlign:"center",marginTop:28,fontSize:10,color:"rgba(255,255,255,0.2)"}}>
        Live via n8n → GitHub Gist · Auto-refreshes every 2 min · Total Goal: {TOTAL_REG_GOAL.toLocaleString()}/qtr · ICP = 70% · Att = 60% of Actual
      </div>
    </div>
  );
}
