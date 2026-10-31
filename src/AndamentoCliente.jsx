import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

/* Solo coach: indice di andamento in % per cliente, ultimi 30 giorni vs i 30 prima. Calcolo con soglie semplici (vedi commenti). */

const pad = (n) => (n < 10 ? "0" + n : "" + n);
const fmt = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const giorniFa = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return fmt(d); };
const gg = (a) => { const p = a.split("-"); return Math.round((new Date(+p[0], +p[1] - 1, +p[2], 12) - new Date()) / 86400000); }; // negativo = passato
const clamp = (x, a = 0, b = 100) => Math.max(a, Math.min(b, x));
const media = (arr) => { const v = arr.filter((x) => x !== null && x !== undefined && !isNaN(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };

async function leggi(q) {
  let tutto = [], da = 0;
  for (let i = 0; i < 20; i++) {
    const { data, error } = await q().range(da, da + 999);
    if (error || !data) break;
    tutto = tutto.concat(data);
    if (data.length < 1000) break;
    da += 1000;
  }
  return tutto;
}

const rangeCorr = [giorniFa(29), giorniFa(0)];
const rangePrec = [giorniFa(59), giorniFa(30)];
const dentro = (d, r) => d >= r[0] && d <= r[1];

function calcola(client, d) {
  const aree = [];
  const prec = {}; // punteggi del periodo precedente
  const kcalOn = client.kcal_attivo !== false;
  const online = client.tipo_servizio === "online" || client.tipo_servizio === "ibrido";

  // ALLENAMENTO: giorni allenati (obiettivo 12 in 30 gg = 3 a settimana) 60% + progressione carichi 40%
  const giorniTr = (r) => new Set(d.tr.filter((x) => dentro(x.data, r)).map((x) => x.data)).size;
  const costanza = (r) => clamp((giorniTr(r) / 12) * 100);
  const mediaKg = (r) => { const m = {}; d.tr.filter((x) => dentro(x.data, r) && Number(x.kg) > 0).forEach((x) => { (m[x.exercise_id] = m[x.exercise_id] || []).push(Number(x.kg)); }); return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.reduce((s, y) => s + y, 0) / v.length])); };
  const kgC = mediaKg(rangeCorr), kgP = mediaKg(rangePrec);
  const comuni = Object.keys(kgC).filter((k) => kgP[k]);
  const prog = comuni.length >= 2 ? clamp(50 + (media(comuni.map((k) => ((kgC[k] - kgP[k]) / kgP[k]) * 100)) / 5) * 50) : null; // +5% medio = 100, 0 = 50, -5% = 0
  const trCorr = giorniTr(rangeCorr), trPrec = giorniTr(rangePrec);
  if (trCorr > 0 || trPrec > 0) {
    const sc = prog === null ? costanza(rangeCorr) : costanza(rangeCorr) * 0.6 + prog * 0.4;
    aree.push({ k: "Aderenza all'allenamento", v: Math.round(sc), p: trPrec > 0 ? Math.round(costanza(rangePrec)) : null, nota: giorniTr(rangeCorr) + " sedute in 30 gg" + (prog !== null ? " · carico di lavoro " + (prog >= 55 ? "in progressione" : prog <= 45 ? "in regressione" : "stabile") : "") });
  } else aree.push({ k: "Aderenza all'allenamento", v: 0, p: null, nota: "nessuna seduta registrata" });

  // CORPO: peso e ombelico (ultimo check vs quello di circa 30 giorni prima), letti in base alla fase
  const ck = [...d.ck].filter((c) => c.data_check).sort((a, b) => b.data_check.localeCompare(a.data_check));
  const confronta = (nuovo, rifMin, rifMax) => {
    if (!nuovo) return null;
    const vecchio = ck.find((c) => c.data_check < nuovo.data_check && gg(nuovo.data_check) - gg(c.data_check) >= rifMin && gg(nuovo.data_check) - gg(c.data_check) <= rifMax);
    if (!vecchio) return null;
    const mesi = (gg(nuovo.data_check) - gg(vecchio.data_check)) / 30;
    const comp = (x, ideale) => clamp(50 + (50 * x) / ideale);
    const parti = [];
    const dp = nuovo.peso_kg && vecchio.peso_kg ? ((Number(nuovo.peso_kg) - Number(vecchio.peso_kg)) / Number(vecchio.peso_kg)) * 100 / mesi : null;
    const dv = nuovo.ombelico_cm && vecchio.ombelico_cm ? (Number(nuovo.ombelico_cm) - Number(vecchio.ombelico_cm)) / mesi : null;
    const fase = d.fase;
    if (fase === "cut") { if (dp !== null) parti.push(comp(-dp, 3)); if (dv !== null) parti.push(comp(-dv, 2)); }
    else if (fase === "leanbulk") { if (dp !== null) parti.push(comp(dp, 1.2)); if (dv !== null) parti.push(comp(-Math.max(0, dv - 0.5), 2) );  }
    else if (fase === "recomp") { if (dp !== null) parti.push(clamp(100 - Math.abs(dp) * 50)); if (dv !== null) parti.push(comp(-dv, 2)); }
    else { if (dv !== null) parti.push(comp(-dv, 2)); }
    if (!parti.length) return null;
    return { v: Math.round(media(parti)), nota: [dp !== null ? (dp > 0 ? "+" : "") + dp.toFixed(1).replace(".", ",") + "% massa corporea" : null, dv !== null ? (dv > 0 ? "+" : "") + dv.toFixed(1).replace(".", ",") + " cm circonferenza addominale" : null].filter(Boolean).join(" · ") };
  };
  if (online) {
    const att = confronta(ck[0], 20, 50);
    const pre = ck[1] ? confronta(ck[1], 20, 50) : null;
    if (att) aree.push({ k: "Composizione corporea", v: att.v, p: pre ? pre.v : null, nota: att.nota + " (30 gg)" });
    else aree.push({ k: "Composizione corporea", v: null, p: null, nota: ck.length < 2 ? "servono almeno 2 rilevazioni (check)" : "nessuna rilevazione recente confrontabile" });
  }

  // ALIMENTAZIONE: giorni di diario compilati (obiettivo 70% dei giorni) 50% + proteine vs piano 50%
  if (kcalOn) {
    const perGiorno = (r) => { const m = {}; d.kc.filter((x) => dentro(x.data, r)).forEach((x) => { m[x.data] = (m[x.data] || 0) + (Number(x.proteine) || 0); }); return m; };
    const sc = (r) => {
      const m = perGiorno(r), n = Object.keys(m).length;
      if (!n) return null;
      const dia = clamp((n / 30 / 0.7) * 100);
      const pr = d.piano && Number(d.piano.proteine_g) ? clamp((media(Object.values(m)) / Number(d.piano.proteine_g)) * 100) : null;
      return { v: pr === null ? dia : dia * 0.5 + pr * 0.5, n, pr: media(Object.values(m)) };
    };
    const a = sc(rangeCorr), b = sc(rangePrec);
    if (a) aree.push({ k: "Aderenza nutrizionale", v: Math.round(a.v), p: b ? Math.round(b.v) : null, nota: "registrazione dieta " + a.n + "/30 gg" + (d.piano && Number(d.piano.proteine_g) ? " · apporto proteico " + Math.round(a.pr) + " g/die (target " + d.piano.proteine_g + ")" : "") });
    else aree.push({ k: "Aderenza nutrizionale", v: 0, p: null, nota: "nessuna registrazione dieta" });
  }

  // PUNTUALITÀ CHECK: ≤30 gg dall'ultimo = 100, 45 gg o più = 0
  if (online) {
    if (ck[0]) {
      const x = -gg(ck[0].data_check);
      aree.push({ k: "Aderenza al monitoraggio", v: Math.round(clamp(100 - ((x - 30) / 15) * 100)), p: null, nota: "ultima rilevazione " + x + " gg fa" });
    } else aree.push({ k: "Aderenza al monitoraggio", v: 0, p: null, nota: "nessuna rilevazione" });
  }

  // CICLO: ultimo inizio segnato entro 35 gg = 100, 70 gg o più = 0
  if (client.sesso !== "M" && d.cicloAttivo !== false) {
    const ult = d.ci.map((x) => x.data_inizio).filter(Boolean).sort().pop();
    if (ult) { const x = -gg(ult); aree.push({ k: "Monitoraggio ciclo", v: Math.round(clamp(100 - ((x - 35) / 35) * 100)), p: null, nota: "ultimo inizio ciclo " + x + " gg fa" }); }
    else aree.push({ k: "Monitoraggio ciclo", v: 0, p: null, nota: "mai registrato" });
  }

  // andamento settimanale (8 settimane): allenamenti (obiettivo 3/sett) e diario (obiettivo 5 gg/sett)
  const settT = [], settK = [];
  for (let w = 7; w >= 0; w--) {
    const r = [giorniFa(w * 7 + 6), giorniFa(w * 7)];
    const t = clamp((new Set(d.tr.filter((x) => dentro(x.data, r)).map((x) => x.data)).size / 3) * 100);
    const k = kcalOn ? clamp((new Set(d.kc.filter((x) => dentro(x.data, r)).map((x) => x.data)).size / 5) * 100) : null;
    settT.push(t); settK.push(k);
  }
  return { aree, settT, settK };
}

function Linea({ valori }) {
  const w = 220, h = 46;
  const pts = valori.map((v, i) => (i * w) / (valori.length - 1) + "," + (h - 4 - (v / 100) * (h - 8))).join(" ");
  return <svg width={w} height={h} className="mt-2"><polyline fill="none" stroke="#2F5E8E" strokeWidth="2" points={pts} /></svg>;
}

const AREE = [
  ["allenamento", "Aderenza all'allenamento", true],
  ["alimentazione", "Aderenza nutrizionale", true],
  ["corpo", "Composizione corporea", false],
  ["check", "Aderenza al monitoraggio", false],
  ["ciclo", "Monitoraggio ciclo", false],
];
const VAL_MANUALE = { si: 100, parz: 60, no: 20 };
const ETICHETTA_MANUALE = { si: "Rispettato", parz: "Parzialmente", no: "Non rispettato" };

function Segmento({ opzioni, valore, onScegli }) {
  return (
    <span className="inline-flex border border-sky-200 rounded-lg overflow-hidden mr-2">
      {opzioni.map(([k, l]) => <button key={k} onClick={() => onScegli(k)} className={`px-2.5 py-1 text-xs ${valore === k ? "bg-sky-700 text-white" : "bg-white text-slate-600"}`}>{l}</button>)}
    </span>
  );
}

export default function AndamentoCliente({ client, checkins }) {
  const [raw, setRaw] = useState(null);
  const [imp, setImp] = useState({});
  const [aperte, setAperte] = useState(false);
  useEffect(() => {
    let vivo = true; setRaw(null); setImp({});
    (async () => {
      try {
        const da = giorniFa(60);
        const tr = await leggi(() => supabase.from("training_entries").select("exercise_id, data, kg").eq("client_id", client.id).gte("data", da).order("id"));
        const kc = await leggi(() => supabase.from("kcal_voci").select("data, proteine").eq("client_id", client.id).gte("data", da).order("created_at"));
        const { data: ci } = await supabase.from("ciclo_mestruale").select("data_inizio").eq("client_id", client.id);
        const { data: im } = await supabase.from("ciclo_impostazioni").select("attivo").eq("client_id", client.id).maybeSingle();
        const { data: an } = await supabase.from("analisi_cibo_impostazioni").select("fase").eq("client_id", client.id).maybeSingle();
        const { data: pi } = await supabase.from("nutrition_plans").select("*").eq("client_id", client.id).order("data_aggiornamento", { ascending: false }).limit(1).maybeSingle();
        const { data: ai } = await supabase.from("andamento_impostazioni").select("impostazioni").eq("client_id", client.id).maybeSingle();
        if (vivo) { setRaw(calcola(client, { tr, kc, ci: ci || [], ck: checkins || [], cicloAttivo: im?.attivo, fase: an?.fase, piano: pi })); setImp(ai?.impostazioni || {}); }
      } catch (e) { if (vivo) setRaw({ errore: true }); }
    })();
    return () => { vivo = false; };
  }, [client.id, (checkins || []).length]);
  const salva = async (nuove) => {
    setImp(nuove);
    try { await supabase.from("andamento_impostazioni").upsert({ client_id: client.id, impostazioni: nuove, updated_at: new Date().toISOString() }); } catch (e) { /* ignora */ }
  };
  const imposta = (id, patch) => salva({ ...imp, [id]: { ...(imp[id] || {}), ...patch } });
  if (!raw) return <div className="bg-white border border-sky-200 rounded-2xl p-4 text-xs text-slate-400">Calcolo l'andamento…</div>;
  if (raw.errore) return null;

  // applica le impostazioni scelte per questa cliente
  const aree = AREE.flatMap(([id, label, manualePossibile]) => {
    const m = imp[id]?.mode || "auto";
    if (m === "escludi") return [];
    if (m === "manuale" && manualePossibile) { const v = imp[id]?.val || "parz"; return [{ k: label, v: VAL_MANUALE[v], p: null, nota: "indicato da te: " + ETICHETTA_MANUALE[v].toLowerCase(), manuale: true }]; }
    const r0 = raw.aree.find((x) => x.k === label);
    return r0 ? [r0] : [];
  });
  const conDati = aree.filter((a) => a.v !== null);
  const totN = media(conDati.map((a) => a.v));
  const tot = totN === null ? null : Math.round(totN);
  const confr = conDati.filter((a) => a.p !== null);
  const delta = confr.length ? Math.round(media(confr.map((a) => a.v)) - media(confr.map((a) => a.p))) : null;
  const sett = raw.settT.map((t, i) => {
    const parti = [];
    const mt = imp.allenamento?.mode || "auto", mk = imp.alimentazione?.mode || "auto";
    if (mt === "auto") parti.push(t); else if (mt === "manuale") parti.push(VAL_MANUALE[imp.allenamento?.val || "parz"]);
    if (mk === "auto") parti.push(raw.settK[i]); else if (mk === "manuale") parti.push(VAL_MANUALE[imp.alimentazione?.val || "parz"]);
    return media(parti);
  });
  const settOk = sett.every((v) => v !== null);
  const conDelta = aree.filter((a) => a.v !== null && a.p !== null).map((a) => ({ ...a, d: a.v - a.p }));
  const su = [...conDelta].sort((a, b) => b.d - a.d)[0];
  const giu = [...conDelta].sort((a, b) => a.d - b.d)[0];
  const freccia = (d) => (d > 1 ? "▲ +" + d : d < -1 ? "▼ " + d : "▬ 0");
  return (
    <div className="bg-white border border-sky-200 rounded-2xl p-4 space-y-3">
    <div className="flex flex-col lg:flex-row gap-5">
      <div className="lg:w-64 bg-sky-100 rounded-xl p-4 flex-shrink-0">
        <p className="text-[11px] text-slate-600">Indice di aderenza e progressione · ultimi 30 giorni</p>
        <p className="text-4xl font-bold text-sky-700 leading-tight my-1">{tot === null ? "—" : tot + "%"}</p>
        <p className="text-[13px] font-semibold text-sky-700">{delta === null ? "dati insufficienti per il confronto" : freccia(delta) + " punti vs 30 giorni precedenti"}</p>
        {settOk && sett.length > 1 && <Linea valori={sett} />}
        <p className="text-[11px] text-slate-600">ultime 8 settimane (frequenza allenamenti e registrazione dieta)</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">Per dominio</p>
        {aree.length === 0 && <p className="text-sm text-slate-400">Nessuna area inclusa nel calcolo.</p>}
        {aree.map((a) => {
          const dd = a.v !== null && a.p !== null ? a.v - a.p : null;
          const basso = a.v !== null && (a.v < 40 || (dd !== null && dd < -1));
          return (
            <div key={a.k} className="mb-2.5">
              <div className="grid grid-cols-[170px_1fr_40px_64px] gap-2.5 items-center text-[13px]">
                <span className="text-slate-700">{a.k}</span>
                <div className="h-2 bg-sky-100 rounded"><div className={`h-2 rounded ${basso ? "bg-slate-800" : "bg-sky-600"}`} style={{ width: (a.v ?? 0) + "%" }} /></div>
                <b className="text-slate-800">{a.v === null ? "—" : a.v + "%"}</b>
                <span className={`text-xs ${dd !== null && dd < -1 ? "text-slate-800" : "text-sky-700"}`}>{dd === null ? "" : freccia(dd)}</span>
              </div>
              <p className="text-[11px] text-slate-500 pl-[178px]">{a.nota}</p>
            </div>
          );
        })}
      </div>
      <div className="lg:w-56 flex-shrink-0 space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Variazioni rilevanti</p>
        {su && su.d > 1 && <p className="bg-sky-100 text-sky-700 rounded-xl px-3 py-2 text-[13px]">▲ Maggior miglioramento: {su.k} +{su.d}</p>}
        {giu && giu.d < -1 && <p className="bg-slate-800 text-white rounded-xl px-3 py-2 text-[13px]">▼ Maggior peggioramento: {giu.k} {giu.d}</p>}
        {aree.filter((a) => a.v !== null && a.v < 40).slice(0, 2).map((a) => <p key={a.k} className="bg-slate-100 text-slate-600 rounded-xl px-3 py-2 text-[13px]">Area critica: {a.k} ({a.v}%)</p>)}
        {!conDelta.length && <p className="text-[12px] text-slate-400">Il confronto con i 30 giorni precedenti richiede dati in entrambi i periodi (le aree indicate da te non entrano).</p>}
      </div>
    </div>
    <div className="border-t border-sky-100 pt-2">
      <button onClick={() => setAperte((x) => !x)} className="text-xs text-sky-700 font-medium">⚙ Impostazioni analisi {aperte ? "▴" : "▾"}</button>
      {aperte && (
        <div className="mt-2">
          <p className="text-[11px] text-slate-500 mb-2">Scegli per questa cliente cosa includere. "Manuale" = lo indichi tu, anche se non registra nell'app.</p>
          {AREE.filter(([id, label]) => id === "alimentazione" || id === "allenamento" || raw.aree.some((x) => x.k === label) || imp[id]?.mode === "escludi").map(([id, label, manualePossibile]) => {
            const m = imp[id]?.mode || "auto";
            return (
              <div key={id} className="grid sm:grid-cols-[190px_1fr] gap-2 items-center py-2 border-b border-sky-50 text-[13px]">
                <span className="text-slate-700">{label}</span>
                <div className="flex flex-wrap items-center gap-y-1">
                  <Segmento opzioni={manualePossibile ? [["auto", "Auto"], ["manuale", "Manuale"], ["escludi", "Escludi"]] : [["auto", "Auto"], ["escludi", "Escludi"]]} valore={m} onScegli={(k) => imposta(id, { mode: k })} />
                  {m === "manuale" && <Segmento opzioni={[["si", "Rispettato"], ["parz", "Parzialmente"], ["no", "Non rispettato"]]} valore={imp[id]?.val || "parz"} onScegli={(k) => imposta(id, { val: k })} />}
                  {m === "escludi" && <span className="text-[11px] text-slate-500">esclusa dall'indice</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </div>
  );
}
