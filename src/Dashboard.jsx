import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from "recharts";

// ─────────────────────────────────────────────────────────────────
//  DATA SOURCE — update GIST_URL after running n8n for the first time
//  Format: https://gist.githubusercontent.com/YOUR_USER/GIST_ID/raw/dashboard-data.json
// ─────────────────────────────────────────────────────────────────
const GIST_URL = import.meta.env.VITE_GIST_URL || "";

const GOALS    = { TD: 340, BOA: 340, VET: 100, LAW: 100, "VET-I": 225, "BOA-I": 435 };
const PRODUCTS = ["All", "TD", "BOA", "VET", "LAW", "VET-I", "BOA-I"];
const QUARTERS = ["All", "Q4 2025", "Q1 2026"];
const PC = {
  TD: "#E8651A", BOA: "#2A6FDB", VET: "#16A34A",
  LAW: "#9333EA", "VET-I": "#06B6D4", "BOA-I": "#F59E0B",
};
const AC = "#E8651A";
const QC = {
  "Q4 2025": { s: new Date("2025-10-01"), e: new Date("2025-12-31"), d: 92 },
  "Q1 2026": { s: new Date("2026-01-01"), e: new Date("2026-03-31"), d: 90 },
};

const pct = (a, b) => (b === 0 ? 0 : (a / b) * 100);
const f  = n => n.toFixed(1) + "%";
const fd = ds => new Date(ds).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });

// ── UI primitives ─────────────────────────────────────────────────
function KPI({ label, value, sub, color }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "18px 20px", flex: 1, minWidth: 130 }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, color: "rgba(255,255,255,0.45)", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || "#fff", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 18px 14px" }}>
      <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

const CTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: "#fff" }}>{label}</div>
      {payload.map((pp, i) => (
        <div key={i} style={{ color: pp.color || pp.fill, marginTop: 2 }}>
          {pp.name}: <strong>{typeof pp.value === "number" ? (pp.value % 1 !== 0 ? pp.value.toFixed(1) : pp.value) : pp.value}</strong>
        </div>
      ))}
    </div>
  );
};

function GoalCard({ product, quarter, events }) {
  const goal = GOALS[product], color = PC[product], qc = QC[quarter];
  if (!qc) return null;
  const actual = events.reduce((s, e) => s + e.reg, 0);
  const cnt = events.length, variance = actual - goal, att = p(actual, goal);
  const today = new Date();
  const elapsed = Math.min((today - qc.s) / 864e5, qc.d);
  const frac = elapsed / qc.d;
  const done = today > qc.e;
  let proj, pn;
  if (done) { proj = actual; pn = "Quarter completed"; }
  else { const rpd = frac > 0 ? actual / elapsed : 0; proj = Math.round(rpd * qc.d); pn = `${Math.round(frac * 100)}% through quarter`; }
  const will = proj >= goal;
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${color}33`, borderRadius: 16, padding: "20px 18px", flex: 1, minWidth: 190 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
          <span style={{ fontSize: 17, fontWeight: 700, color }}>{product}</span>
        </div>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{quarter}</span>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Goal Attainment</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: att >= 100 ? "#16A34A" : att >= 70 ? "#EAB308" : "#EF4444" }}>{att.toFixed(1)}%</span>
        </div>
        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, height: 10, overflow: "hidden", position: "relative" }}>
          <div style={{ height: "100%", width: `${Math.min(att, 100)}%`, borderRadius: 8, background: att >= 100 ? "#16A34A" : att >= 70 ? "#EAB308" : "#EF4444", transition: "width 0.8s" }} />
          {!done && <div style={{ position: "absolute", top: 0, height: "100%", width: 2, background: "rgba(255,255,255,0.5)", left: `${Math.min(frac * 100, 100)}%` }} />}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
        <div><div style={{ color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>Actual</div><div style={{ fontSize: 20, fontWeight: 700 }}>{actual}</div></div>
        <div><div style={{ color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>Goal</div><div style={{ fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>{goal}</div></div>
        <div><div style={{ color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>Variance</div><div style={{ fontSize: 15, fontWeight: 700, color: variance >= 0 ? "#16A34A" : "#EF4444" }}>{variance >= 0 ? "+" : ""}{variance}</div></div>
        <div><div style={{ color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>Events</div><div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{cnt}</div></div>
      </div>
      <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: will ? "rgba(22,163,74,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${will ? "rgba(22,163,74,0.2)" : "rgba(239,68,68,0.2)"}` }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Projection</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: will ? "#16A34A" : "#EF4444" }}>{proj}</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: will ? "#16A34A" : "#EF4444" }}>{will ? "ON TRACK" : `SHORT BY ${goal - proj}`}</span>
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{pn}</div>
      </div>
    </div>
  );
}

// ── No gist URL configured screen ────────────────────────────────
function SetupScreen() {
  return (
    <div style={{ minHeight: "100vh", background: "#0B0B14", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif", padding: 32 }}>
      <div style={{ maxWidth: 500, textAlign: "center", color: "#E8E8F0" }}>
        <div style={{ fontSize: 40, marginBottom: 20 }}>🔧</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Almost there — one step left</h2>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.8, marginBottom: 24 }}>
          Set your GitHub Gist URL as an environment variable so the dashboard knows where to fetch data from.
        </p>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "16px 20px", textAlign: "left", fontSize: 12, fontFamily: "monospace", color: "#06B6D4" }}>
          <div style={{ color: "rgba(255,255,255,0.4)", marginBottom: 8, fontFamily: "sans-serif", fontSize: 11 }}>In your Vercel project settings → Environment Variables:</div>
          VITE_GIST_URL = https://gist.githubusercontent.com/YOUR_USER/GIST_ID/raw/dashboard-data.json
        </div>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 16 }}>
          After adding the variable, redeploy the project and the dashboard will load live data.
        </p>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function Dashboard() {
  if (!GIST_URL) return <SetupScreen />;

  const [tab, setTab]         = useState("overview");
  const [sp, setSP]           = useState("All");
  const [sq, setSQ]           = useState("All");
  const [sortCol, setSortCol] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [events, setEvents]   = useState([]);
  const [status, setStatus]   = useState("loading"); // loading | live | error
  const [updatedAt, setUpdatedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]     = useState("");
  const mounted = useRef(true);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      // Cache-bust so we always get the latest Gist content
      const url = `${GIST_URL}?t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} — check GIST_URL is correct`);
      const json = await res.json();
      if (!Array.isArray(json.events)) throw new Error("Unexpected data format from Gist");
      if (mounted.current) {
        setEvents(json.events);
        setStatus("live");
        setUpdatedAt(json.updatedAt ? new Date(json.updatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : new Date().toLocaleTimeString());
        setError("");
      }
    } catch (e) {
      if (mounted.current) {
        setStatus(prev => prev === "live" ? "stale" : "error");
        setError(e.message);
      }
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    fetchData();
    const iv = setInterval(fetchData, 120000); // re-fetch every 2 min
    return () => { mounted.current = false; clearInterval(iv); };
  }, [fetchData]);

  // ── Derived ──
  const filtered = useMemo(() =>
    events.filter(e => (sp === "All" || e.product === sp) && (sq === "All" || e.q === sq)),
    [sp, sq, events]
  );

  const totals = useMemo(() => {
    const t = { reg: 0, icpR: 0, nicpR: 0, att: 0, icpA: 0, nicpA: 0, dR: 0, pR: 0, n: filtered.length };
    filtered.forEach(e => { t.reg += e.reg; t.icpR += e.icpR; t.nicpR += e.nicpR; t.att += e.att; t.icpA += e.icpA; t.nicpA += e.nicpA; t.dR += e.dR; t.pR += e.pR; });
    t.conv = p(t.att, t.reg); t.icpPct = p(t.icpR, t.reg); t.icpConv = p(t.icpA, t.icpR);
    return t;
  }, [filtered]);

  const byProd = useMemo(() => {
    const m = {};
    filtered.forEach(e => {
      if (!m[e.product]) m[e.product] = { product: e.product, reg: 0, icpR: 0, att: 0, icpA: 0, n: 0, dR: 0, pR: 0 };
      const x = m[e.product];
      x.reg += e.reg; x.icpR += e.icpR; x.att += e.att; x.icpA += e.icpA; x.n++; x.dR += e.dR; x.pR += e.pR;
    });
    return Object.values(m).map(x => ({ ...x, conv: p(x.att, x.reg), icpPct: p(x.icpR, x.reg), icpConv: p(x.icpA, x.icpR), avg: x.reg / x.n })).sort((a, b) => b.reg - a.reg);
  }, [filtered]);

  const byQ = useMemo(() => {
    const m = {};
    filtered.forEach(e => {
      if (!m[e.q]) m[e.q] = { quarter: e.q, reg: 0, icpR: 0, att: 0, icpA: 0, n: 0 };
      const x = m[e.q]; x.reg += e.reg; x.icpR += e.icpR; x.att += e.att; x.icpA += e.icpA; x.n++;
    });
    return Object.values(m).map(x => ({ ...x, conv: p(x.att, x.reg), icpPct: p(x.icpR, x.reg) }));
  }, [filtered]);

  const goalCards = useMemo(() => {
    const ps = ["TD", "BOA", "VET", "LAW", "VET-I", "BOA-I"];
    const qs = sq === "All" ? ["Q4 2025", "Q1 2026"] : [sq];
    const out = [];
    qs.forEach(q => ps.forEach(pp => {
      if (sp !== "All" && sp !== pp) return;
      const evts = events.filter(e => e.product === pp && e.q === q);
      if (evts.length > 0) out.push({ product: pp, quarter: q, events: evts });
    }));
    return out;
  }, [sp, sq, events]);

  const goalBarData = useMemo(() => {
    const ps = ["TD", "BOA", "VET", "LAW", "VET-I", "BOA-I"];
    const qs = sq === "All" ? ["Q4 2025", "Q1 2026"] : [sq];
    const out = [];
    qs.forEach(q => ps.forEach(pp => {
      if (sp !== "All" && sp !== pp) return;
      const evts = events.filter(e => e.product === pp && e.q === q);
      const act = evts.reduce((s, e) => s + e.reg, 0);
      if (act > 0 || GOALS[pp]) out.push({ name: `${pp} ${q}`, actual: act, goal: GOALS[pp], product: pp });
    }));
    return out;
  }, [sp, sq, events]);

  const timeline = useMemo(() =>
    [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date)).map(e => ({ date: fd(e.date), reg: e.reg, att: e.att, icpR: e.icpR })),
    [filtered]
  );

  const sortedEvents = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va, vb;
      if (sortCol === "date") { va = new Date(a.date); vb = new Date(b.date); }
      else if (sortCol === "product") { va = a.product; vb = b.product; }
      else if (sortCol === "q") { va = a.q; vb = b.q; }
      else { va = a[sortCol] || 0; vb = b[sortCol] || 0; }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortCol, sortDir]);

  const handleSort = col => { if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("desc"); } };
  const sortIcon = col => sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";
  const icpPie = [{ name: "ICP", value: totals.icpR, fill: "#16A34A" }, { name: "Non-ICP", value: totals.nicpR, fill: "#404060" }];
  const srcPie = [{ name: "Partner", value: totals.pR, fill: "#2A6FDB" }, { name: "Direct", value: totals.dR, fill: AC }];
  const tabBtn = t => ({ padding: "10px 22px", borderRadius: "10px 10px 0 0", border: "none", background: tab === t ? "rgba(255,255,255,0.06)" : "transparent", color: tab === t ? "#fff" : "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: tab === t ? 700 : 500, cursor: "pointer", borderBottom: tab === t ? `2px solid ${AC}` : "2px solid transparent", fontFamily: "inherit" });
  const statusColor = status === "live" ? "#16A34A" : status === "stale" ? "#EAB308" : "#EF4444";

  return (
    <div style={{ minHeight: "100vh", background: "#0B0B14", color: "#E8E8F0", fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif", padding: "28px 24px 60px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        .row-h:hover { background: rgba(255,255,255,0.03) !important; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Registrations Analysis — Marketing</h1>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>TD / BOA / VET / LAW / VET-I / BOA-I</span>
        </div>
        <div style={{ height: 3, width: 48, background: AC, borderRadius: 2, marginTop: 10, marginBottom: 8 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "rgba(255,255,255,0.5)", flexWrap: "wrap" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, display: "inline-block", boxShadow: status === "live" ? `0 0 6px ${statusColor}55` : "none" }} />
          <span style={{ color: statusColor, fontWeight: 600 }}>{status === "live" ? "Live" : status === "stale" ? "Stale" : "Error"}</span>
          {updatedAt && <span>· Data from {updatedAt}</span>}
          <span>· {events.length} events</span>
          {error && <span style={{ color: "#EF4444" }}>· {error}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <button style={tabBtn("overview")} onClick={() => setTab("overview")}>Overview</button>
        <button style={tabBtn("events")}   onClick={() => setTab("events")}>Event List</button>
      </div>
      <div style={{ height: 16 }} />

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap", alignItems: "center" }}>
        {QUARTERS.map(q => <button key={q} onClick={() => setSQ(q)} style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid", borderColor: sq === q ? AC : "rgba(255,255,255,0.1)", background: sq === q ? AC : "transparent", color: sq === q ? "#fff" : "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{q}</button>)}
        <div style={{ width: 1, background: "rgba(255,255,255,0.1)", margin: "0 4px", height: 24 }} />
        {PRODUCTS.map(pp => <button key={pp} onClick={() => setSP(pp)} style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid", borderColor: sp === pp ? (PC[pp] || AC) : "rgba(255,255,255,0.1)", background: sp === pp ? (PC[pp] || AC) : "transparent", color: sp === pp ? "#fff" : "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{pp}</button>)}
        <div style={{ flex: 1 }} />
        <button onClick={() => !refreshing && fetchData()} disabled={refreshing} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 600, cursor: refreshing ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 6, opacity: refreshing ? 0.5 : 1, fontFamily: "inherit" }}>
          <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "transparent", animation: refreshing ? "spin 1s linear infinite" : "none" }} />
          {refreshing ? "Syncing…" : "Refresh"}
        </button>
      </div>

      {/* Loading skeleton */}
      {status === "loading" && events.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[...Array(4)].map((_, i) => <div key={i} style={{ height: 80, borderRadius: 14, background: "rgba(255,255,255,0.04)" }} />)}
        </div>
      )}

      {/* Error with no data */}
      {status === "error" && events.length === 0 && (
        <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 16, padding: "40px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#EF4444", marginBottom: 8 }}>Could not load data</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", maxWidth: 400, margin: "0 auto", lineHeight: 1.8 }}>
            {error}<br /><br />Check that <code style={{ background: "rgba(255,255,255,0.07)", padding: "1px 6px", borderRadius: 4 }}>VITE_GIST_URL</code> is set correctly in your Vercel environment variables.
          </div>
          <button onClick={fetchData} style={{ marginTop: 20, padding: "9px 24px", borderRadius: 10, border: `1px solid ${AC}`, background: "transparent", color: AC, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Retry</button>
        </div>
      )}

      {/* ═══ OVERVIEW ═══ */}
      {tab === "overview" && events.length > 0 && (<>
        <div style={{ display: "flex", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
          <KPI label="Total Events"     value={totals.n} />
          <KPI label="Total Registrants" value={totals.reg.toLocaleString()} />
          <KPI label="Total Attendees"  value={totals.att.toLocaleString()} />
          <KPI label="ICP Registrants"  value={totals.icpR.toLocaleString()} sub={f(totals.icpPct) + " of total"} color="#16A34A" />
          <KPI label="Reg → Attendee"   value={f(totals.conv)} color={AC} />
          <KPI label="ICP Conversion"   value={f(totals.icpConv)} sub="ICP Reg → ICP Att" color="#2A6FDB" />
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "24px 22px", marginBottom: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "rgba(255,255,255,0.6)", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: AC, display: "inline-block" }} />Goal Tracking & Projections
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
            {goalCards.map(c => <GoalCard key={`${c.product}-${c.quarter}`} product={c.product} quarter={c.quarter} events={c.events} />)}
          </div>
          <Card title="Goal vs Actual Registrations">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={goalBarData} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} axisLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} />
                <Tooltip content={<CTip />} />
                <Legend formatter={v => <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{v}</span>} />
                <Bar dataKey="goal" name="Goal" fill="rgba(255,255,255,0.12)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Actual" radius={[4, 4, 0, 0]}>
                  {goalBarData.map((en, i) => <Cell key={i} fill={en.actual >= en.goal ? "#16A34A" : PC[en.product]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 16 }}>
          <Card title="Registrations by Product">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byProd} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="product" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} />
                <Tooltip content={<CTip />} />
                <Bar dataKey="reg" name="Total" fill="#404060" radius={[4, 4, 0, 0]} />
                <Bar dataKey="icpR" name="ICP" fill="#16A34A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card title="ICP vs Non-ICP">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={icpPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={0}>
                  {icpPie.map((en, i) => <Cell key={i} fill={en.fill} />)}
                </Pie>
                <Tooltip content={<CTip />} />
                <Legend formatter={v => <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ textAlign: "center", marginTop: -18, fontSize: 20, fontWeight: 700, color: "#16A34A" }}>{f(totals.icpPct)}</div>
          </Card>
          <Card title="Registration Source">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={srcPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={0}>
                  {srcPie.map((en, i) => <Cell key={i} fill={en.fill} />)}
                </Pie>
                <Tooltip content={<CTip />} />
                <Legend formatter={v => <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ textAlign: "center", marginTop: -18, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
              Partner: <strong style={{ color: "#2A6FDB" }}>{totals.pR}</strong> | Direct: <strong style={{ color: AC }}>{totals.dR}</strong>
            </div>
          </Card>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
          <Card title="Event Timeline">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={timeline} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }} interval={Math.max(0, Math.floor(timeline.length / 10))} axisLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} />
                <Tooltip content={<CTip />} />
                <Line type="monotone" dataKey="reg" stroke={AC} strokeWidth={2} dot={{ r: 3, fill: AC }} name="Registrants" />
                <Line type="monotone" dataKey="att" stroke="#2A6FDB" strokeWidth={2} dot={{ r: 3, fill: "#2A6FDB" }} name="Attendees" />
                <Line type="monotone" dataKey="icpR" stroke="#16A34A" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 2, fill: "#16A34A" }} name="ICP Reg" />
                <Legend formatter={v => <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{v}</span>} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Conversion by Product">
            <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 6 }}>
              {byProd.map(pp => (
                <div key={pp.product}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: PC[pp.product] }}>{pp.product}</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{pp.n} events</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, fontSize: 10 }}>
                    {[{ label: "Reg→Att", val: pp.conv, color: PC[pp.product] }, { label: "ICP %", val: pp.icpPct, color: "#16A34A" }].map(({ label, val, color }) => (
                      <div key={label} style={{ flex: 1 }}>
                        <div style={{ color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>{label}</div>
                        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 6, height: 22, overflow: "hidden", position: "relative" }}>
                          <div style={{ height: "100%", width: `${Math.min(val, 100)}%`, background: color, borderRadius: 6, opacity: 0.7 }} />
                          <span style={{ position: "absolute", right: 6, top: 4, fontSize: 10, fontWeight: 600 }}>{f(val)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card title="Quarter-over-Quarter">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byQ} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="quarter" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} />
              <Tooltip content={<CTip />} />
              <Legend formatter={v => <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{v}</span>} />
              <Bar dataKey="reg"  name="Registrants" fill={AC}        radius={[4, 4, 0, 0]} />
              <Bar dataKey="icpR" name="ICP Reg"     fill="#16A34A"   radius={[4, 4, 0, 0]} />
              <Bar dataKey="att"  name="Attendees"   fill="#2A6FDB"   radius={[4, 4, 0, 0]} />
              <Bar dataKey="n"    name="Events"      fill="#9333EA"   radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </>)}

      {/* ═══ EVENT LIST ═══ */}
      {tab === "events" && events.length > 0 && (<>
        <div style={{ display: "flex", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
          <KPI label="Showing"      value={`${sortedEvents.length} events`} />
          <KPI label="Registrants"  value={totals.reg.toLocaleString()} />
          <KPI label="Attendees"    value={totals.att.toLocaleString()} />
          <KPI label="Avg Reg/Event" value={totals.n > 0 ? (totals.reg / totals.n).toFixed(1) : "0"} />
          <KPI label="Avg Conv Rate" value={f(totals.conv)} color={AC} />
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "6px 0", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                {[{ k: "date", l: "Date" }, { k: "product", l: "Product" }, { k: "q", l: "Quarter" }, { k: "reg", l: "Registrants" }, { k: "icpR", l: "ICP Reg" }, { k: "nicpR", l: "Non-ICP" }, { k: "att", l: "Attendees" }, { k: "icpA", l: "ICP Att" }, { k: "nicpA", l: "Non-ICP Att" }, { k: "att", l: "Conv %" }, { k: "dR", l: "Direct" }, { k: "pR", l: "Partner" }].map((c, i) => (
                  <th key={i} onClick={() => handleSort(c.k)} style={{ padding: "10px", textAlign: "left", color: "rgba(255,255,255,0.5)", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>{c.l}{sortIcon(c.k)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedEvents.map((e, i) => {
                const cv = e.reg > 0 ? p(e.att, e.reg) : 0;
                return (
                  <tr key={i} className="row-h" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "10px", whiteSpace: "nowrap" }}>{fd(e.date)}</td>
                    <td style={{ padding: "10px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 3, background: PC[e.product], display: "inline-block" }} /><span style={{ fontWeight: 600, color: PC[e.product] }}>{e.product}</span></span></td>
                    <td style={{ padding: "10px", color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{e.q}</td>
                    <td style={{ padding: "10px", fontWeight: 600 }}>{e.reg}</td>
                    <td style={{ padding: "10px", color: "#16A34A" }}>{e.icpR}</td>
                    <td style={{ padding: "10px", color: "rgba(255,255,255,0.4)" }}>{e.nicpR}</td>
                    <td style={{ padding: "10px", fontWeight: 600 }}>{e.att}</td>
                    <td style={{ padding: "10px", color: "#2A6FDB" }}>{e.icpA}</td>
                    <td style={{ padding: "10px", color: "rgba(255,255,255,0.4)" }}>{e.nicpA}</td>
                    <td style={{ padding: "10px" }}><span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: cv >= 60 ? "rgba(22,163,74,0.12)" : cv >= 40 ? "rgba(234,179,8,0.12)" : "rgba(239,68,68,0.12)", color: cv >= 60 ? "#16A34A" : cv >= 40 ? "#EAB308" : "#EF4444" }}>{f(cv)}</span></td>
                    <td style={{ padding: "10px" }}>{e.dR}</td>
                    <td style={{ padding: "10px" }}>{e.pR}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 18 }}>
          <Card title="Product Summary">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    {["Product", "Events", "Registrants", "Goal", "Variance", "ICP Reg", "ICP %", "Attendees", "Conv Rate", "Avg/Event", "Direct", "Partner"].map(h => (
                      <th key={h} style={{ padding: "8px", textAlign: "left", color: "rgba(255,255,255,0.4)", fontWeight: 600, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byProd.map(pp => {
                    const goal = GOALS[pp.product] || 0, v = pp.reg - goal;
                    return (
                      <tr key={pp.product} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "10px 8px", fontWeight: 700, color: PC[pp.product] }}>{pp.product}</td>
                        <td style={{ padding: "10px 8px" }}>{pp.n}</td>
                        <td style={{ padding: "10px 8px", fontWeight: 600 }}>{pp.reg}</td>
                        <td style={{ padding: "10px 8px", color: "rgba(255,255,255,0.35)" }}>{goal}</td>
                        <td style={{ padding: "10px 8px", fontWeight: 700, color: v >= 0 ? "#16A34A" : "#EF4444" }}>{v >= 0 ? "+" : ""}{v}</td>
                        <td style={{ padding: "10px 8px", color: "#16A34A" }}>{pp.icpR}</td>
                        <td style={{ padding: "10px 8px", color: "#16A34A" }}>{f(pp.icpPct)}</td>
                        <td style={{ padding: "10px 8px", fontWeight: 600 }}>{pp.att}</td>
                        <td style={{ padding: "10px 8px", color: AC, fontWeight: 600 }}>{f(pp.conv)}</td>
                        <td style={{ padding: "10px 8px" }}>{pp.avg.toFixed(1)}</td>
                        <td style={{ padding: "10px 8px" }}>{pp.dR}</td>
                        <td style={{ padding: "10px 8px" }}>{pp.pR}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </>)}

      <div style={{ textAlign: "center", marginTop: 28, fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
        Live via n8n → GitHub Gist · Auto-refreshes every 2 min · Goals: TD 340, BOA 340, VET 100, LAW 100, VET-I 225, BOA-I 435/quarter
      </div>
    </div>
  );
}
