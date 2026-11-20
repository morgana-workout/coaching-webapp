import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { ChevronLeft } from "lucide-react";

/* Analisi carichi (vista coach): andamento % del miglior set di lavoro, tabella di movimento degli esercizi,
   dettaglio per esercizio con eventi (cambio programma, prescrizione, scarico, altra palestra) e log delle serie.
   Solo dati già presenti: carichi, ripetizioni, programmi archiviati, scarichi, cambi palestra. */

const NAVY = "#0f2a4a";
const AZ = "#4aa8e0";
const COLORI = ["#0f2a4a", "#4aa8e0", "#1d6fb8", "#7cc4ee", "#475569", "#2563eb", "#0ea5a5", "#94a3b8"];
const C_SU = "#2f9e77", C_RIP = "#4aa8e0", C_TEN = "#94a3b8", C_CALO = "#d9534f", C_SPEC = "#e8a33d";
const SOGLIA = 2.5;

const fmt = (n) => String(Math.round(n * 10) / 10).replace(".", ",");
const fmtP = (v) => (v == null ? "—" : `${v > 0 ? "+" : ""}${fmt(v)}%`);
const gg = (d) => d.split("-").reverse().slice(0, 2).join("/");
const ts = (d) => new Date(`${d}T12:00:00`).getTime();
const loc = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const piu = (ds, n) => { const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() + n); return loc(d); };
const lunedi = (ds) => { const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return loc(d); };
const nomeProg = (lab) => (lab ? String(lab).replace(/^scheda/i, "Programma") : "Programma attuale");

function parseRip(s) {
  const m = String(s ?? "").match(/\d+(?:[.,]\d+)?/g);
  if (!m) return null;
  const a = m.map((x) => parseFloat(x.replace(",", ".")));
  return [Math.min(...a), Math.max(...a)];
}

async function leggiTutto(costruisci) {
  const out = [];
  for (let da = 0; ; da += 1000) {
    const { data, error } = await costruisci().range(da, da + 999);
    if (error) throw error;
    out.push(...(data || []));
    if ((data || []).length < 1000) break;
  }
  return out;
}

function passoY(min, max) {
  const span = Math.max(max - min, 1);
  for (const s of [1, 2, 5, 10, 20, 25, 50, 100, 200]) if (span / s <= 5) return s;
  return 500;
}

function Spark({ vals, colore }) {
  if (!vals || vals.length < 2) return <span className="inline-block w-[60px]" />;
  const mn = Math.min(...vals), mx = Math.max(...vals), sp = mx - mn || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * 60},${20 - ((v - mn) / sp) * 18}`).join(" ");
  return (
    <svg width="60" height="22" viewBox="0 0 60 22" className="block">
      <polyline fill="none" stroke={colore} strokeWidth="2" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

function colorePct(p) {
  if (p == null) return "text-slate-400";
  return p > SOGLIA ? "text-emerald-600" : p < -SOGLIA ? "text-rose-600" : "text-slate-500";
}

function GraficoMulti({ serie }) {
  // serie: [{nome, colore, punti:[{d, pct}]}]
  const W = 380, H = 190, L = 34, R = 8, T = 10, B = 22;
  const tutti = serie.flatMap((s) => s.punti);
  if (tutti.length === 0) return <p className="text-xs text-slate-400 py-6 text-center">Scegli almeno un esercizio.</p>;
  let t0 = Math.min(...tutti.map((p) => ts(p.d))), t1 = Math.max(...tutti.map((p) => ts(p.d)));
  if (t1 === t0) { t0 -= 86400000 * 3; t1 += 86400000 * 3; }
  const vals = tutti.map((p) => p.pct);
  const st = passoY(Math.min(0, ...vals), Math.max(0, ...vals));
  const y0 = Math.floor(Math.min(0, ...vals) / st) * st, y1 = Math.max(Math.ceil(Math.max(0, ...vals) / st) * st, y0 + st);
  const X = (d) => L + ((ts(d) - t0) / (t1 - t0)) * (W - L - R);
  const Y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const ticks = []; for (let v = y0; v <= y1 + 0.001; v += st) ticks.push(v);
  const asseX = [t0, (t0 + t1) / 2, t1].map((t) => { const d = new Date(t); return { x: L + ((t - t0) / (t1 - t0)) * (W - L - R), l: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` }; });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? "#9fb3c8" : "#e6ecf3"} strokeDasharray={v === 0 ? "3 3" : undefined} />
          <text x={L - 4} y={Y(v) + 3} fontSize="9" fill="#64748b" textAnchor="end">{v > 0 ? "+" : ""}{v}%</text>
        </g>
      ))}
      {asseX.map((a, i) => <text key={i} x={a.x} y={H - 6} fontSize="9" fill="#64748b" textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}>{a.l}</text>)}
      {serie.map((s) => (
        <g key={s.nome}>
          <polyline fill="none" stroke={s.colore} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" points={s.punti.map((p) => `${X(p.d)},${Y(p.pct)}`).join(" ")} />
          {s.punti.map((p, i) => <circle key={i} cx={X(p.d)} cy={Y(p.pct)} r="2.6" fill={s.colore} />)}
        </g>
      ))}
    </svg>
  );
}

function GraficoEsercizio({ sess, metrica, programmi, scar, cambi, presc, selIdx, onSel }) {
  const W = 380, H = 200, L = 36, R = 10, T = 14, B = 22;
  const val = (s) => (metrica === "kg" ? s.best.kg : metrica === "rip" ? s.best.rip : s.vol);
  const pts = sess.map((s, i) => ({ s, i, v: val(s) })).filter((p) => p.v != null && p.v > 0);
  if (pts.length === 0) return <p className="text-xs text-slate-400 py-6 text-center">Nessun dato per questa misura (ripetizioni non segnate).</p>;
  const dMin = sess[0].data, dMax = sess[sess.length - 1].data;
  let t0 = ts(dMin), t1 = ts(dMax);
  if (t1 === t0) { t0 -= 86400000 * 3; t1 += 86400000 * 3; }
  // bande di prescrizione (solo per le ripetizioni): una per programma
  const bande = [];
  if (metrica === "rip") {
    programmi.forEach((p, k) => {
      const r = parseRip(presc[p.label]?.rip);
      if (!r) return;
      const ini = p.inizio, fine = programmi[k + 1] ? programmi[k + 1].inizio : "9999-12-31";
      if (fine < dMin || ini > dMax) return;
      bande.push({ a: Math.max(ts(ini), t0), b: Math.min(ts(fine), t1), r });
    });
  }
  const vals = pts.map((p) => p.v).concat(bande.flatMap((b) => b.r));
  const st = passoY(Math.min(...vals), Math.max(...vals));
  const y0 = Math.max(0, Math.floor((Math.min(...vals) - st * 0.3) / st) * st), y1 = Math.max(Math.ceil((Math.max(...vals) + st * 0.3) / st) * st, y0 + st);
  const XT = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
  const X = (d) => XT(ts(d));
  const Y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const ticks = []; for (let v = y0; v <= y1 + 0.001; v += st) ticks.push(v);
  // linea a gradini
  let path = "";
  pts.forEach((p, k) => { const x = X(p.s.data), y = Y(p.v); path += k === 0 ? `M${x},${y}` : `H${x}V${y}`; });
  const colStato = (st2) => (st2 === "su" ? C_SU : st2 === "rip" ? C_RIP : st2 === "calo" ? C_CALO : st2 === "spec" ? C_SPEC : C_TEN);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#e6ecf3" />
          <text x={L - 4} y={Y(v) + 3} fontSize="9" fill="#64748b" textAnchor="end">{fmt(v)}</text>
        </g>
      ))}
      {scar.filter((x) => x.al >= dMin && x.dal <= dMax).map((x) => (
        <rect key={x.id || x.dal} x={XT(Math.max(ts(x.dal), t0))} y={T} width={Math.max(XT(Math.min(ts(x.al), t1)) - XT(Math.max(ts(x.dal), t0)), 3)} height={H - T - B} fill={C_SPEC} opacity="0.16" />
      ))}
      {bande.map((b, i) => (
        <g key={i}>
          <rect x={XT(b.a)} y={Y(b.r[1])} width={Math.max(XT(b.b) - XT(b.a), 2)} height={Math.max(Y(b.r[0]) - Y(b.r[1]), 3)} fill="#d9eefa" opacity="0.9" />
          <text x={XT(b.a) + 3} y={Y(b.r[1]) + 9} fontSize="8" fill={NAVY}>{b.r[0] === b.r[1] ? `${b.r[0]}` : `${b.r[0]}–${b.r[1]}`} rip previste</text>
        </g>
      ))}
      {programmi.slice(1).filter((p) => p.inizio > dMin && p.inizio <= dMax).map((p) => (
        <g key={p.label}>
          <line x1={X(p.inizio)} x2={X(p.inizio)} y1={T} y2={H - B} stroke={NAVY} strokeDasharray="4 3" />
          <text x={X(p.inizio) + 3} y={T + 8} fontSize="8" fill={NAVY}>cambio programma</text>
        </g>
      ))}
      {cambi.filter((x) => x.dal >= dMin && x.dal <= dMax).map((x) => (
        <line key={x.id || x.dal} x1={X(x.dal)} x2={X(x.dal)} y1={T} y2={H - B} stroke={C_SPEC} strokeDasharray="2 3" />
      ))}
      <path d={path} fill="none" stroke={NAVY} strokeWidth="2.2" strokeLinejoin="round" />
      {pts.map((p) => (
        <g key={p.i} onClick={() => onSel(p.i)} style={{ cursor: "pointer" }}>
          <circle cx={X(p.s.data)} cy={Y(p.v)} r="11" fill="transparent" />
          <circle cx={X(p.s.data)} cy={Y(p.v)} r={selIdx === p.i ? 6.5 : 4.5} fill={colStato(p.s.stato)} stroke={selIdx === p.i ? NAVY : "#fff"} strokeWidth={selIdx === p.i ? 2 : 1} />
        </g>
      ))}
      <text x={L} y={H - 6} fontSize="9" fill="#64748b">{gg(dMin)}</text>
      <text x={W - R} y={H - 6} fontSize="9" fill="#64748b" textAnchor="end">{gg(dMax)}</text>
    </svg>
  );
}

function Dettaglio({ ex, sess, programmi, scar, cambi, onChiudi }) {
  const [metrica, setMetrica] = useState("kg");
  const [selIdx, setSelIdx] = useState(sess.length - 1);
  const s = sess[selIdx];
  // eventi dell'esercizio nel periodo
  const dMin = sess[0]?.data || "", dMax = sess[sess.length - 1]?.data || "";
  const ev = [];
  programmi.forEach((p, k) => {
    if (k === 0 || p.inizio < dMin || p.inizio > dMax) return;
    const prec = [...programmi.slice(0, k)].reverse().find((q) => ex.presc[q.label]);
    const a = prec ? ex.presc[prec.label] : null, b = ex.presc[p.label];
    const txt = (x) => `${x.serie || "?"}×${x.rip || "?"}`;
    const partiEv = [];
    if (a && b && (a.serie !== b.serie || a.rip !== b.rip)) partiEv.push({ t: "Prescrizione", d: `${txt(a)} → ${txt(b)}` });
    if (a && b && (a.tec || "") !== (b.tec || "")) partiEv.push({ t: "Tecnica", d: `${a.tec || "nessuna"} → ${b.tec || "nessuna"}` });
    if (partiEv.length === 0) ev.push({ data: p.inizio, t: "Cambio programma", d: `${nomeProg(p.label)}${b ? `: ${txt(b)}` : ""}` });
    else { ev.push({ data: p.inizio, t: "Cambio programma", d: nomeProg(p.label) }); partiEv.forEach((x) => ev.push({ data: p.inizio, ...x })); }
  });
  scar.filter((x) => x.al >= dMin && x.dal <= dMax).forEach((x) => ev.push({ data: x.dal, t: "Scarico", d: `${gg(x.dal)} → ${gg(x.al)}${x.nota ? ` · ${x.nota}` : ""}` }));
  cambi.filter((x) => x.dal >= dMin && x.dal <= dMax).forEach((x) => ev.push({ data: x.dal, t: "Altra palestra", d: `${x.tipo || ""}${x.nota ? ` · ${x.nota}` : ""}` }));
  ev.sort((a, b) => a.data.localeCompare(b.data));
  const labStato = { inizio: "Prima seduta", su: "Carico in aumento", rip: "Più ripetizioni a pari carico", ten: "Invariato", calo: "In calo", spec: "Scarico / altra palestra" };
  return (
    <Card2>
      <button onClick={onChiudi} className="flex items-center gap-1 text-xs text-slate-500 mb-2"><ChevronLeft size={14} /> Tutti gli esercizi</button>
      <p className="font-semibold text-slate-800">{ex.nome}</p>
      <p className="text-xs text-slate-500 mb-2">{sess.length} sedute · massimo {fmt(Math.max(...sess.map((x) => x.best.kg)))} kg</p>
      <div className="flex gap-1.5 mb-1">
        {[["kg", "Carico"], ["rip", "Ripetizioni"], ["vol", "Volume"]].map(([k, l]) => (
          <button key={k} onClick={() => setMetrica(k)} className={`px-3 py-1 rounded-full text-xs ${metrica === k ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>{l}</button>
        ))}
      </div>
      <GraficoEsercizio sess={sess} metrica={metrica} programmi={programmi} scar={scar} cambi={cambi} presc={ex.presc} selIdx={selIdx} onSel={setSelIdx} />
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 mb-2">
        <span><i className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: C_SU }} />Carico ↑</span>
        <span><i className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: C_RIP }} />Rip ↑</span>
        <span><i className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: C_TEN }} />Invariato</span>
        <span><i className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: C_CALO }} />Calo</span>
        <span><i className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: C_SPEC }} />Scarico / altra palestra</span>
      </div>
      {s && (
        <div className="rounded-xl p-3 text-xs text-white" style={{ background: NAVY }}>
          <p className="font-semibold">{gg(s.data)} · {ex.nome}</p>
          <p className="mt-1 opacity-90">{s.sets.map((q, i) => `Serie ${i + 1}: ${fmt(q.kg)} kg${q.rip > 0 ? ` × ${fmt(q.rip)}` : ""}`).join(" · ")}</p>
          <p className="mt-1 opacity-75">{labStato[s.stato]}{ex.presc[s.label] ? ` · previsto ${ex.presc[s.label].serie || "?"}×${ex.presc[s.label].rip || "?"}` : ""} · {nomeProg(s.label)}</p>
          {s.note && <p className="mt-1 opacity-75">Nota: {s.note}</p>}
          {s.motivi.length > 0 && <p className="mt-1 opacity-75">Motivo del calo: {s.motivi.join(", ")}</p>}
        </div>
      )}
      <div className="mt-3">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">Eventi</p>
        {ev.length === 0 ? <p className="text-xs text-slate-400">Nessun evento nel periodo.</p> : ev.map((e, i) => (
          <p key={i} className="text-xs text-slate-600 py-0.5"><span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-slate-700 mr-1.5">{e.t}</span><span className="text-slate-400">{gg(e.data)}</span> · {e.d}</p>
        ))}
        <p className="text-[10px] text-slate-400 mt-1">Le variazioni di prescrizione e tecnica sono confrontate tra un programma e il successivo.</p>
      </div>
    </Card2>
  );
}

function Card2({ children, className = "" }) {
  return <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-3 ${className}`}>{children}</div>;
}

export default function AnalisiCarichi({ clientId, renderGestione }) {
  const [dati, setDati] = useState(null);
  const [ricarica, setRicarica] = useState(0);
  const [sett, setSett] = useState(8);
  const [scope, setScope] = useState("attuale");
  const [filtro, setFiltro] = useState("tutti");
  const [scelti, setScelti] = useState(null);
  const [apertoNome, setApertoNome] = useState(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data: giorni } = await supabase.from("training_days").select("id, nome, scheda_archiviata").eq("client_id", clientId);
        const righe = await leggiTutto(() => supabase.from("training_entries").select("data, kg, ripetizioni, motivo_calo, note, training_exercises(nome, serie, ripetizioni, tecnica, training_day_id)").eq("client_id", clientId).order("data").order("id"));
        let scar = [], cambi = [];
        try { const { data } = await supabase.from("scarichi").select("id, dal, al, nota").eq("client_id", clientId).order("dal"); scar = data || []; } catch (e) { /* ignora */ }
        try { const { data } = await supabase.from("cambi_palestra").select("id, dal, tipo, nota").eq("client_id", clientId).order("dal"); cambi = data || []; } catch (e) { /* ignora */ }
        if (!vivo) return;
        const info = {}; (giorni || []).forEach((g) => { info[g.id] = g; });
        const dateAltra = new Set(cambi.map((x) => x.dal));
        const inScar = (d) => scar.some((x) => d >= x.dal && d <= x.al);
        const es = {}; const inizioProg = {};
        righe.forEach((r) => {
          const e = r.training_exercises; const kg = Number(r.kg);
          if (!e?.nome || !r.data || !(kg > 0)) return;
          const lab = info[e.training_day_id]?.scheda_archiviata || "";
          if (!inizioProg[lab] || r.data < inizioProg[lab]) inizioProg[lab] = r.data;
          const o = (es[e.nome] = es[e.nome] || { nome: e.nome, presc: {}, per: {} });
          o.presc[lab] = { serie: e.serie, rip: e.ripetizioni, tec: e.tecnica || "" };
          const key = `${r.data}|${lab}`;
          const p = (o.per[key] = o.per[key] || { data: r.data, label: lab, sets: [], note: "", mot: new Set() });
          const rip = parseFloat(String(r.ripetizioni ?? "").replace(",", "."));
          p.sets.push({ kg, rip: rip > 0 ? rip : 0 });
          if (r.note) p.note = p.note || r.note;
          if (r.motivo_calo) String(r.motivo_calo).split(",").filter(Boolean).forEach((x) => p.mot.add(x));
        });
        const lista = Object.values(es).map((o) => {
          const sess = Object.values(o.per).sort((a, b) => a.data.localeCompare(b.data)).map((p) => {
            const ord = [...p.sets].sort((a, b) => b.kg - a.kg || b.rip - a.rip);
            const vol = p.sets.reduce((a, x) => a + (x.rip > 0 ? x.kg * x.rip : 0), 0);
            return { data: p.data, label: p.label, sets: p.sets, best: ord[0], vol: vol > 0 ? Math.round(vol) : null, note: p.note, motivi: [...p.mot].filter((x) => x !== "scarico"), flag: dateAltra.has(p.data) || inScar(p.data) };
          });
          let prev = null;
          sess.forEach((s) => {
            if (s.flag) { s.stato = "spec"; return; }
            if (!prev) s.stato = "inizio";
            else if (s.best.kg > prev.best.kg) s.stato = "su";
            else if (s.best.kg < prev.best.kg) s.stato = "calo";
            else if (s.best.rip > prev.best.rip) s.stato = "rip";
            else if (s.best.rip < prev.best.rip) s.stato = "calo";
            else s.stato = "ten";
            prev = s;
          });
          return { nome: o.nome, presc: o.presc, sess };
        });
        const programmi = Object.entries(inizioProg).map(([label, inizio]) => ({ label, inizio })).sort((a, b) => a.inizio.localeCompare(b.inizio));
        setDati({ lista, programmi, scar, cambi });
      } catch (e) { if (vivo) setDati({ lista: [], programmi: [], scar: [], cambi: [] }); }
    })();
    return () => { vivo = false; };
  }, [clientId, ricarica]);

  const gestione = renderGestione ? renderGestione({ scarichi: dati?.scar || [], cambi: dati?.cambi || [], ricarica: () => setRicarica((n) => n + 1) }) : null;
  if (!dati) return <p className="text-xs text-slate-400 text-center py-4">Carico l'analisi dei carichi…</p>;
  if (dati.lista.length === 0) return <div className="space-y-2"><Card2><p className="text-sm text-slate-500 text-center py-3">Ancora nessun carico registrato 🫶🏻</p></Card2>{gestione}</div>;

  const oggi = loc(new Date());
  const da = sett ? piu(oggi, -7 * sett) : "0000-00-00";
  // per ogni esercizio: sedute nel perimetro (programma attuale / storico) e nel periodo
  const righeEs = dati.lista.map((e) => {
    const inScope = e.sess.filter((s) => (scope === "attuale" ? s.label === "" : true) && s.data >= da);
    const valide = inScope.filter((s) => !s.flag);
    if (inScope.length === 0) return null;
    const base = valide[0]?.best.kg, ult = valide[valide.length - 1]?.best.kg;
    const pct = valide.length >= 2 && base > 0 ? (ult / base - 1) * 100 : null;
    const l3 = valide.slice(-3);
    const fermo = l3.length === 3 && l3.every((x) => x.best.kg === l3[0].best.kg) && l3[2].best.rip <= l3[0].best.rip;
    return { ex: e, inScope, valide, base, ult, pct, fermo, punti: valide.map((s) => ({ d: s.data, pct: base > 0 ? (s.best.kg / base - 1) * 100 : 0 })) };
  }).filter(Boolean);
  const ordinate = [...righeEs].sort((a, b) => (b.pct ?? -999) - (a.pct ?? -999));
  const su = righeEs.filter((x) => x.pct != null && x.pct > SOGLIA).length;
  const giu = righeEs.filter((x) => x.pct != null && x.pct < -SOGLIA).length;
  const stabili = righeEs.filter((x) => x.pct != null && Math.abs(x.pct) <= SOGLIA).length;
  const fermi = righeEs.filter((x) => x.fermo).length;
  const conPct = righeEs.filter((x) => x.pct != null);
  const media = conPct.length ? conPct.reduce((a, x) => a + x.pct, 0) / conPct.length : null;
  const dateAll = new Set(); righeEs.forEach((x) => x.inScope.forEach((s) => dateAll.add(s.data)));
  const primaData = [...dateAll].sort()[0];
  const lunSett = new Set([...dateAll].map(lunedi));
  const nSett = primaData ? Math.max(1, Math.round((ts(lunedi(oggi)) - ts(lunedi(sett ? (primaData < da ? da : primaData) : primaData))) / (7 * 86400000)) + 1) : 0;
  const filtrata = ordinate.filter((x) => filtro === "tutti" || (filtro === "su" && x.pct != null && x.pct > SOGLIA) || (filtro === "giu" && x.pct != null && x.pct < -SOGLIA) || (filtro === "stabili" && x.pct != null && Math.abs(x.pct) <= SOGLIA) || (filtro === "fermi" && x.fermo));
  const conGrafico = filtrata.filter((x) => x.punti.length >= 2);
  const effettivi = (scelti ? conGrafico.filter((x) => scelti.includes(x.ex.nome)) : [...conGrafico].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 5));
  const colDi = (nome) => COLORI[Math.max(0, conGrafico.findIndex((x) => x.ex.nome === nome)) % COLORI.length];
  const toggle = (nome) => setScelti((cur) => { const base = cur || effettivi.map((x) => x.ex.nome); return base.includes(nome) ? base.filter((n) => n !== nome) : [...base, nome]; });
  const aperto = apertoNome ? righeEs.find((x) => x.ex.nome === apertoNome) : null;

  // eventi del periodo
  const evGen = [];
  dati.programmi.forEach((p, k) => { if (k > 0 && p.inizio >= da) evGen.push({ data: p.inizio, t: "Cambio programma" }); });
  dati.scar.filter((x) => x.al >= da).forEach((x) => evGen.push({ data: x.dal, t: "Scarico" }));
  dati.cambi.filter((x) => x.dal >= da).forEach((x) => evGen.push({ data: x.dal, t: "Altra palestra" }));
  evGen.sort((a, b) => a.data.localeCompare(b.data));

  const chip = (on, onClick, testo, key) => (
    <button key={key} onClick={onClick} className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border ${on ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200"}`}>{testo}</button>
  );

  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Analisi dei carichi</p>
        <p className="text-slate-400 text-xs mt-0.5">Miglior set di lavoro di ogni seduta (carico più alto, a parità più ripetizioni).</p>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {[[4, "4 sett."], [8, "8 sett."], [12, "12 sett."], [0, "Tutto"]].map(([n, l]) => chip(sett === n, () => setSett(n), l, n))}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {chip(scope === "attuale", () => { setScope("attuale"); setScelti(null); }, "Programma attuale", "a")}
        {chip(scope === "storico", () => { setScope("storico"); setScelti(null); }, "Tutto lo storico", "s")}
      </div>

      {righeEs.length === 0 ? (
        <Card2><p className="text-sm text-slate-500 text-center py-3">Nessuna seduta in questo periodo. Prova ad allargare il periodo o a scegliere “Tutto lo storico”.</p></Card2>
      ) : aperto ? (
        <Dettaglio key={aperto.ex.nome} ex={aperto.ex} sess={aperto.inScope} programmi={dati.programmi} scar={dati.scar} cambi={dati.cambi} onChiudi={() => setApertoNome(null)} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Card2><p className="text-2xl font-semibold text-slate-800">{dateAll.size}</p><p className="text-[11px] text-slate-500">Allenamenti registrati · {lunSett.size}/{nSett} settimane attive</p></Card2>
            <Card2><p className={`text-2xl font-semibold ${colorePct(media)}`}>{fmtP(media == null ? null : Math.round(media * 10) / 10)}</p><p className="text-[11px] text-slate-500">Variazione media del carico</p></Card2>
            <Card2><p className="text-2xl font-semibold text-emerald-600">{su}</p><p className="text-[11px] text-slate-500">Esercizi in progresso (&gt; +{fmt(SOGLIA)}%)</p></Card2>
            <Card2><p className="text-2xl font-semibold text-slate-800">{fermi}<span className="text-sm text-rose-600 font-medium"> · {giu} in calo</span></p><p className="text-[11px] text-slate-500">Fermi da 3+ sedute · {stabili} stabili</p></Card2>
          </div>

          <Card2>
            <p className="font-semibold text-slate-800 text-sm">Variazione % del carico</p>
            <div className="flex gap-1.5 overflow-x-auto py-1.5">
              {[["tutti", "Tutti"], ["su", "↑ Progrediti"], ["giu", "↓ In calo"], ["stabili", `≈ Stabili (±${fmt(SOGLIA)}%)`], ["fermi", "Fermi"]].map(([k, l]) => chip(filtro === k, () => { setFiltro(k); setScelti(null); }, l, k))}
            </div>
            <GraficoMulti serie={effettivi.map((x) => ({ nome: x.ex.nome, colore: colDi(x.ex.nome), punti: x.punti }))} />
            <div className="flex gap-1.5 overflow-x-auto pt-1.5">
              {conGrafico.map((x) => {
                const on = effettivi.some((y) => y.ex.nome === x.ex.nome);
                return (
                  <button key={x.ex.nome} onClick={() => toggle(x.ex.nome)} className={`px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap border ${on ? "bg-slate-50 text-slate-800 border-slate-400" : "bg-white text-slate-400 border-slate-200"}`}>
                    <i className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: on ? colDi(x.ex.nome) : "#cbd5e1" }} />{x.ex.nome}
                  </button>
                );
              })}
            </div>
            {conGrafico.length === 0 && <p className="text-xs text-slate-400 mt-1">Servono almeno 2 sedute valide per tracciare una linea.</p>}
            {evGen.length > 0 && (
              <p className="text-[11px] text-slate-500 mt-2">{evGen.map((e, i) => <span key={i} className="inline-block mr-2"><span className="px-2 py-0.5 rounded-full bg-sky-100 text-slate-700 mr-1">{e.t}</span>{gg(e.data)}</span>)}</p>
            )}
          </Card2>

          <Card2 className="!p-0">
            <p className="font-semibold text-slate-800 text-sm px-3 pt-3">Movimento degli esercizi</p>
            <p className="text-[11px] text-slate-400 px-3 pb-1">Tocca una riga per il dettaglio. Scarichi e sedute in altra palestra non entrano nel confronto.</p>
            {filtrata.length === 0 && <p className="text-xs text-slate-400 px-3 pb-3">Nessun esercizio con questo filtro.</p>}
            <div className="divide-y divide-slate-100">
              {filtrata.map((x) => (
                <button key={x.ex.nome} onClick={() => setApertoNome(x.ex.nome)} className="w-full text-left px-3 py-2 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{x.ex.nome}{x.fermo ? " · fermo" : ""}</p>
                    <p className="text-[11px] text-slate-400">{x.valide.length < 2 ? `${x.inScope.length} ${x.inScope.length === 1 ? "seduta" : "sedute"}` : `${fmt(x.base)} → ${fmt(x.ult)} kg · ${x.valide.length} sedute`}</p>
                  </div>
                  <Spark vals={x.valide.map((s) => s.best.kg)} colore={x.pct == null ? "#94a3b8" : x.pct > SOGLIA ? C_SU : x.pct < -SOGLIA ? C_CALO : "#64748b"} />
                  <span className={`w-14 text-right text-xs font-semibold ${colorePct(x.pct)}`}>{x.pct == null ? "—" : fmtP(Math.round(x.pct * 10) / 10)}</span>
                </button>
              ))}
            </div>
          </Card2>

          {(fermi > 0 || giu > 0) && (
            <Card2 className="bg-sky-50 border-sky-100">
              <p className="text-xs uppercase tracking-wide text-sky-700 font-medium mb-1">Per la programmazione</p>
              {fermi > 0 && <p className="text-xs text-slate-700 py-0.5">• {fermi} {fermi === 1 ? "esercizio fermo" : "esercizi fermi"} da almeno 3 sedute: valuta una variazione di serie, ripetizioni o tecnica ({righeEs.filter((x) => x.fermo).map((x) => x.ex.nome).join(", ")}).</p>}
              {giu > 0 && <p className="text-xs text-slate-700 py-0.5">• {giu} {giu === 1 ? "esercizio in calo" : "esercizi in calo"}: verifica recupero, sonno e carico complessivo ({righeEs.filter((x) => x.pct != null && x.pct < -SOGLIA).map((x) => x.ex.nome).join(", ")}).</p>}
            </Card2>
          )}
        </>
      )}
      {gestione}
    </div>
  );
}
