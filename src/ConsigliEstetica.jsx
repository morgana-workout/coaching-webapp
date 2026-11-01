import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

/* Solo coach: indicazioni sul programma (da carichi, ripetizioni e serie) e valutazione estetica guidata delle foto dei check. */

const pad = (n) => (n < 10 ? "0" + n : "" + n);
const fmt = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const giorniFa = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return fmt(d); };
const num = (v) => { const m = /(\d+([.,]\d+)?)/.exec(String(v ?? "")); return m ? Number(m[1].replace(",", ".")) : null; };
const kgFmt = (n) => String(Math.round(n * 100) / 100).replace(".", ",");

// distretto muscolare dedotto dal nome dell'esercizio (ordine importante: i casi specifici prima)
const GRUPPI = [
  ["Femorali", /leg curl|rdl|stacco rumeno|romanian|good morning|nordic|hamstring|femoral/i],
  ["Polpacci", /calf|polpac|soleo|gastrocnem/i],
  ["Glutei", /hip thrust|glute|glutei|kickback|abductor|abduzion|pull.?through|bridge/i],
  ["Quadricipiti", /squat|leg press|leg extension|affond|lunge|hack|pressa|step.?up|split/i],
  ["Tricipiti", /pushdown|tricip|french|skull|dip|kickback.*tricip|estensioni.*tricip/i],
  ["Bicipiti", /curl|bicip|hammer/i],
  ["Spalle", /alzate|shoulder|military|lento avanti|reverse fly|face pull|arnold|deltoid|spalle/i],
  ["Dorso", /lat |lat machine|pulldown|trazion|rematore|row|pullover|pull.?up|chin|dorsal|dorso/i],
  ["Petto", /panca|chest|pett|croci|fly|push.?up|piegament|pec/i],
  ["Addome", /crunch|plank|addom|ab wheel|sit.?up|leg raise|core/i],
];
const gruppoDi = (nome) => { const n = (nome || "").replace(/^\+\s*/, ""); const g = GRUPPI.find(([, re]) => re.test(n)); return g ? g[0] : null; };
const SPINTA = ["Petto", "Spalle", "Tricipiti"], TRAZIONE = ["Dorso", "Bicipiti"];

async function leggi(q) {
  let tutto = [], da = 0;
  for (let i = 0; i < 20; i++) { const { data, error } = await q().range(da, da + 999); if (error || !data) break; tutto = tutto.concat(data); if (data.length < 1000) break; da += 1000; }
  return tutto;
}

function analizza(esercizi, giorni, righe) {
  const idGiorniAttivi = new Set(giorni.filter((g) => !g.scheda_archiviata).map((g) => g.id));
  const programma = esercizi.filter((e) => idGiorniAttivi.has(e.training_day_id));
  const consigli = [];
  const oggi = fmt(new Date());
  const finestra28 = righe.filter((r) => r.data >= giorniFa(27) && r.data <= oggi);
  const dateAllenate28 = new Set(finestra28.map((r) => r.data));

  // --- per esercizio (ultime 8 settimane): massimale di sessione e ripetizioni a quel carico
  const perEs = {};
  righe.forEach((r) => { const kg = Number(r.kg); if (!r.data || !(kg > 0)) return; (perEs[r.exercise_id] = perEs[r.exercise_id] || {}); const s = (perEs[r.exercise_id][r.data] = perEs[r.exercise_id][r.data] || { kg: 0, reps: 0 }); const rp = num(r.ripetizioni) || 0; if (kg > s.kg) { s.kg = kg; s.reps = rp; } else if (kg === s.kg) s.reps = Math.max(s.reps, rp); });
  const nomeDi = Object.fromEntries(esercizi.map((e) => [e.id, (e.nome || "").replace(/^\+\s*/, "")]));
  const su = [], giu = [], ok = [];
  Object.entries(perEs).forEach(([id, sess]) => {
    const date = Object.keys(sess).sort();
    if (date.length < 3) return;
    const ult = date.slice(-3).map((d) => sess[d]);
    const nome = nomeDi[id]; if (!nome) return;
    const [a, b, c] = ult;
    if (c.kg > a.kg) { ok.push(nome); return; }
    if (c.kg < a.kg && c.kg <= b.kg) { giu.push({ tit: nome, testo: `Carico in diminuzione su 3 sessioni (${kgFmt(a.kg)} → ${kgFmt(c.kg)} kg): valutare recupero (sonno, apporto energetico, stress), un microciclo di scarico (−30/40% del volume per 7 giorni) o una riduzione di 1 serie.`, peso: 3 }); return; }
    if (a.kg === b.kg && b.kg === c.kg) {
      if (c.reps <= a.reps - 2 && a.reps > 0) { giu.push({ tit: nome, testo: `Ripetizioni in calo a carico invariato (${a.reps} → ${c.reps} a ${kgFmt(c.kg)} kg): possibile affaticamento accumulato; valutare −1 serie, più recupero tra le serie o riduzione della prossimità al cedimento.`, peso: 2 }); return; }
      const stessiKg = date.slice().reverse().findIndex((d) => sess[d].kg !== c.kg);
      const n = stessiKg === -1 ? date.length : stessiKg;
      if (n >= 5) su.push({ tit: nome, testo: `Carico fermo a ${kgFmt(c.kg)} kg da ${n} sessioni: lo stimolo non è più progressivo. Valutare cambio di stimolo (variante dell'esercizio, tempo di esecuzione, range di ripetizioni) o di metodo (top set + back-off, rest-pause, serie con pausa).`, peso: 3, cambio: true });
      else su.push({ tit: nome, testo: `Carico fermo a ${kgFmt(c.kg)} kg da ${n} sessioni (ripetizioni stabili): applicare il sovraccarico progressivo, +1–2 ripetizioni oppure +2,5 kg (≈ +2,5–5%).`, peso: 2 });
      return;
    }
    ok.push(nome);
  });
  su.sort((x, y) => y.peso - x.peso).slice(0, 3).forEach((x) => consigli.push({ t: "up", ...x }));
  giu.sort((x, y) => y.peso - x.peso).slice(0, 3).forEach((x) => consigli.push({ t: "dn", ...x }));

  // --- volume previsto per distretto (serie/settimana) dal programma attivo, e frequenza (sedute per distretto)
  const vol = {}, freq = {};
  programma.forEach((e) => { const g = gruppoDi(e.nome); if (!g) return; const s = num(e.serie) || 0; vol[g] = (vol[g] || 0) + s; (freq[g] = freq[g] || new Set()).add(e.training_day_id); });
  const nSeduteProg = idGiorniAttivi.size;
  if (nSeduteProg > 0) {
    const basso = Object.entries(vol).filter(([g, v]) => g !== "Addome" && g !== "Polpacci" && v > 0 && v < 10).sort((x, y) => x[1] - y[1]).slice(0, 3).map(([g]) => g);
    Object.entries(vol).forEach(([g, v]) => {
      if (g === "Addome" || g === "Polpacci") return;
      if (v > 0 && v < 10 && basso.includes(g)) consigli.push({ t: "up", tit: `Volume ${g.toLowerCase()}: ${v} serie/settimana previste`, testo: `Inferiore al range indicativo per l'ipertrofia (10–20 serie/settimana per distretto). Se il distretto è prioritario, valutare +2–4 serie settimanali su 1–2 esercizi.`, peso: 1 });
      else if (v > 22) consigli.push({ t: "dn", tit: `Volume ${g.toLowerCase()}: ${v} serie/settimana previste`, testo: `Superiore al range indicativo (10–20): valutare la riduzione se il recupero è scarso o le prestazioni su questo distretto non progrediscono.`, peso: 1 });
      if (v >= 10 && freq[g] && freq[g].size === 1 && nSeduteProg >= 2) consigli.push({ t: "fl", tit: `Frequenza ${g.toLowerCase()}: 1 seduta/settimana`, testo: `Con ${v} serie in un'unica seduta, distribuire il volume su 2 sedute (frequenza 2×/settimana) migliora in genere la qualità delle serie e il recupero.`, peso: 0 });
    });
    const sp = SPINTA.reduce((s, g) => s + (vol[g] || 0), 0), tr = TRAZIONE.reduce((s, g) => s + (vol[g] || 0), 0);
    if (tr > 0 && sp / tr > 1.4) consigli.push({ t: "fl", tit: `Rapporto spinta/trazione ${Math.round(sp)}:${Math.round(tr)}`, testo: "Prevalenza del volume di spinta (petto, spalle, tricipiti) rispetto alla trazione: valutare più lavoro di dorso e deltoide posteriore per postura e simmetria scapolare.", peso: 0 });
    if (tr > 0 && sp > 0 && tr / sp > 1.8) consigli.push({ t: "fl", tit: `Rapporto spinta/trazione ${Math.round(sp)}:${Math.round(tr)}`, testo: "Volume di spinta contenuto rispetto alla trazione: se l'obiettivo include spalle e petto, valutare di aumentarlo.", peso: 0 });
  }

  // --- aderenza vs programma
  if (nSeduteProg > 0 && dateAllenate28.size > 0) {
    const sett = dateAllenate28.size / 4;
    if (sett < nSeduteProg * 0.75) consigli.push({ t: "chk", tit: `Frequenza settimanale reale ${String(Math.round(sett * 10) / 10).replace(".", ",")} (programma: ${nSeduteProg} sedute)`, testo: "L'esecuzione è inferiore al programma: la limitazione alla progressione è più probabilmente l'aderenza che la programmazione. Valutare se il numero di sedute è sostenibile o va ridotto.", peso: 0 });
  }
  const mantenere = ok.slice(0, 5);
  return { consigli, mantenere, datiPochi: dateAllenate28.size < 4 || (!programma.length && !righe.length) };
}

export function ConsigliProgramma({ client }) {
  const [r, setR] = useState(null);
  useEffect(() => {
    let vivo = true; setR(null);
    (async () => {
      try {
        const { data: es } = await supabase.from("training_exercises").select("id, nome, serie, training_day_id").eq("client_id", client.id);
        const { data: gg } = await supabase.from("training_days").select("id, scheda_archiviata").eq("client_id", client.id);
        const righe = await leggi(() => supabase.from("training_entries").select("exercise_id, data, kg, ripetizioni").eq("client_id", client.id).gte("data", giorniFa(56)).order("id"));
        if (vivo) setR(analizza(es || [], gg || [], righe));
      } catch (e) { if (vivo) setR({ errore: true }); }
    })();
    return () => { vivo = false; };
  }, [client.id]);
  const stile = { up: ["▲ Aumentare / cambiare", "bg-sky-100 text-sky-700"], dn: ["▼ Ridurre / scaricare", "bg-slate-800 text-white"], fl: ["◆ Struttura", "bg-slate-100 text-slate-600"], chk: ["⚑ Verificare", "bg-slate-100 text-slate-600"] };
  return (
    <div className="bg-white border border-sky-200 rounded-2xl p-4 min-w-0">
      <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">Indicazioni sul programma · ultime 8 settimane</p>
      {!r && <p className="text-xs text-slate-400">Analizzo il programma…</p>}
      {r?.errore && <p className="text-xs text-slate-400">Non riesco a leggere i dati.</p>}
      {r && !r.errore && (
        <>
          {r.datiPochi && <p className="text-[12px] text-slate-500 mb-2">Dati di allenamento ancora pochi: le indicazioni basate sui carichi richiedono almeno 3 sessioni per esercizio.</p>}
          {r.consigli.length === 0 && !r.datiPochi && <p className="text-sm text-slate-500">Nessuna indicazione particolare: progressione e struttura del programma sono nei range attesi.</p>}
          {r.consigli.map((c, i) => (
            <div key={i} className="py-2 border-b border-sky-100 last:border-0">
              <span className={`inline-block text-[10.5px] rounded-full px-2 py-0.5 mr-2 ${stile[c.t][1]}`}>{c.cambio ? "⟳ Cambiare stimolo" : stile[c.t][0]}</span>
              <span className="text-[13px] font-semibold text-slate-800">{c.tit}</span>
              <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">{c.testo}</p>
            </div>
          ))}
          {r.mantenere.length > 0 && <p className="text-[12px] text-slate-600 pt-2"><span className="inline-block text-[10.5px] rounded-full px-2 py-0.5 mr-2 bg-slate-100 text-slate-600">▬ Mantenere</span>{r.mantenere.join(", ")}: progressione regolare.</p>}
          <p className="text-[11px] text-slate-400 mt-2">Regole su carichi, ripetizioni e serie registrati e sul programma attivo: sono spunti, la decisione è tua. Il distretto è dedotto dal nome dell'esercizio.</p>
        </>
      )}
    </div>
  );
}

/* ---------------- Valutazione estetica guidata ---------------- */
export const ASPETTI = [
  ["pelle", "Pelle / ritenzione idrica"],
  ["forma", "Definizione muscolare / forma"],
  ["struttura", "Struttura (spalle, vita, gambe)"],
  ["simmetrie", "Simmetrie"],
  ["postura", "Postura"],
];
export const indiceEstetico = (voti) => {
  const v = ASPETTI.map(([k]) => Number(voti?.[k])).filter((x) => x >= 1 && x <= 5);
  return v.length === ASPETTI.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length / 5) * 100) : null;
};

export function ValutazioneEstetica({ client, checkins }) {
  const ordinati = [...(checkins || [])].filter((c) => c.data_check).sort((a, b) => a.data_check.localeCompare(b.data_check));
  const [val, setVal] = useState({}); // checkin_id -> voti
  const [idA, setIdA] = useState(""); const [idB, setIdB] = useState("");
  useEffect(() => {
    let vivo = true;
    supabase.from("valutazione_estetica").select("checkin_id, voti").eq("client_id", client.id).then(({ data }) => { if (vivo) { const m = {}; (data || []).forEach((x) => { m[x.checkin_id] = x.voti || {}; }); setVal(m); } });
    return () => { vivo = false; };
  }, [client.id]);
  useEffect(() => { setIdA(ordinati[0]?.id || ""); setIdB(ordinati.length > 1 ? ordinati[ordinati.length - 1].id : ""); }, [client.id, ordinati.length]);
  const salva = async (c, k, v) => {
    const voti = { ...(val[c.id] || {}), [k]: v };
    setVal((p) => ({ ...p, [c.id]: voti }));
    try { await supabase.from("valutazione_estetica").upsert({ client_id: client.id, checkin_id: c.id, data_check: c.data_check, voti, updated_at: new Date().toISOString() }, { onConflict: "client_id,checkin_id" }); window.dispatchEvent(new Event("estetica-aggiornata")); } catch (e) { /* ignora */ }
  };
  const A = ordinati.find((c) => c.id === idA), B = ordinati.find((c) => c.id === idB);
  const dm = (c) => c.data_check.split("-").reverse().join("/");
  const Voti = ({ c, k }) => (
    <span className="inline-flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => salva(c, k, n)} className={`w-6 h-6 rounded-md text-[11px] border ${val[c.id]?.[k] === n ? "bg-sky-700 text-white border-sky-700" : "bg-white text-slate-600 border-sky-200"}`}>{n}</button>)}</span>
  );
  const iA = A ? indiceEstetico(val[A.id]) : null, iB = B ? indiceEstetico(val[B.id]) : null;
  const Sel = ({ valore, onChange }) => <select value={valore} onChange={(e) => onChange(e.target.value)} className="border border-sky-200 rounded-lg px-2 py-1 text-[12px] bg-white">{ordinati.map((c) => <option key={c.id} value={c.id}>{dm(c)}</option>)}</select>;
  return (
    <div className="bg-white border border-sky-200 rounded-2xl p-4 min-w-0">
      <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">Valutazione estetica · confronto tra due check</p>
      {ordinati.length < 1 ? <p className="text-sm text-slate-400">Nessun check con foto da valutare.</p> : (
        <>
          <p className="text-[12px] text-slate-500 mb-2">Guarda le foto e assegna un voto da 1 (scarso) a 5 (ottimo) a ogni aspetto. Il confronto si aggiorna da solo.</p>
          <div className="flex flex-wrap items-center gap-2 mb-2 text-[12px] text-slate-600">
            <span>Confronta</span><Sel valore={idA} onChange={setIdA} />
            {ordinati.length > 1 && <><span>con</span><Sel valore={idB} onChange={setIdB} /></>}
          </div>
          {ASPETTI.map(([k, label]) => {
            const a = Number(val[A?.id]?.[k]) || null, b = Number(val[B?.id]?.[k]) || null;
            const doppio = B && A && B.id !== A.id;
            const d = a && b && doppio ? b - a : null;
            return (
              <div key={k} className="py-2 border-b border-sky-100 last:border-0">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-slate-700">{label}</span>
                  <span className={`text-xs font-semibold ${d > 0 ? "text-sky-700" : d < 0 ? "text-slate-800" : "text-slate-400"}`}>{d === null ? "" : d > 0 ? "▲ +" + d : d < 0 ? "▼ " + d : "▬ 0"}</span>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1">
                  {A && <span className="inline-flex items-center gap-2"><span className="text-[11px] text-slate-500 w-12">{dm(A).slice(0, 5)}</span><Voti c={A} k={k} /></span>}
                  {doppio && <span className="inline-flex items-center gap-2"><span className="text-[11px] text-slate-500 w-12">{dm(B).slice(0, 5)}</span><Voti c={B} k={k} /></span>}
                </div>
              </div>
            );
          })}
          {(iA !== null || iB !== null) && (
            <div className="mt-3 bg-sky-100 rounded-xl px-3 py-2 text-[13px] text-sky-700 font-semibold">
              Indice estetico {iA !== null ? iA + "%" : "—"}{B && B.id !== A?.id ? " → " + (iB !== null ? iB + "%" : "—") : ""}
              {iA !== null && iB !== null && B.id !== A.id ? "  (" + (iB - iA >= 0 ? "▲ +" : "▼ ") + (iB - iA) + ")" : ""}
              <p className="text-[11px] font-normal text-slate-600 mt-0.5">Entra nel dominio "Composizione corporea" del quadro andamento: peso stabile con foto migliori non risulta più come stallo.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
