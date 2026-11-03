import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { mappaCanonica } from "./nomiEsercizi";

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
// Ripartizione del lavoro tra distretti: molti esercizi non lavorano un solo muscolo.
// Dipende dall'esercizio e, per i multiarticolari degli arti inferiori, dalle leve della cliente (femore lungo/corto).
function quote(nome, leve) {
  const n = (nome || "").replace(/^\+\s*/, "");
  if (/bulgar|split squat/i.test(n)) return { Glutei: 0.5, Femorali: 0.5 };
  if (/affond|lunge|step.?up|walking/i.test(n)) return { Glutei: 0.5, Quadricipiti: 0.3, Femorali: 0.2 };
  if (/rdl|stacco rumeno|romanian|good morning/i.test(n)) return { Femorali: 0.6, Glutei: 0.4 };
  if (/squat|leg press|pressa|hack/i.test(n)) {
    if (leve === "lunghe") return { Quadricipiti: 0.4, Glutei: 0.6 };
    if (leve === "corte") return { Quadricipiti: 0.75, Glutei: 0.25 };
    return { Quadricipiti: 0.6, Glutei: 0.4 };
  }
  const g = gruppoDi(n);
  return g ? { [g]: 1 } : {};
}
// Serie effettive di un esercizio: quelle indicate nel programma; se mancano, top set = 1 e back-off = 2;
// altrimenti quelle realmente registrate nel log (valore più frequente); se non c'è nulla, restano "non indicate" (null) e non vengono contate.
function serieEffettive(programma, righe) {
  const perEs = {};
  righe.forEach((r) => { if (!r.data || !(Number(r.kg) > 0 || num(r.ripetizioni))) return; ((perEs[r.exercise_id] = perEs[r.exercise_id] || {})[r.data] = (perEs[r.exercise_id][r.data] || new Set())).add(r.numero_serie || 1); });
  return programma.map((e) => {
    let s = num(e.serie);
    if (e.tecnica === "top_back" && ((e.serie_top || 0) + (e.serie_backoff || 0)) > 0) s = (e.serie_top || 0) + (e.serie_backoff || 0);
    if (!(s > 0)) {
      if (/top\s*set/i.test(e.nome || "")) s = 1;
      else if (/back.?off/i.test(e.nome || "")) s = 2;
      else {
        const conte = Object.entries(perEs[e.id] || {}).sort((a, b) => a[0].localeCompare(b[0])).slice(-4).map(([, set]) => set.size);
        if (conte.length) { const f = {}; conte.forEach((c) => { f[c] = (f[c] || 0) + 1; }); s = Number(Object.entries(f).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]); } else s = null;
      }
    }
    return { ...e, serieEff: s };
  });
}
const arr05 = (x) => Math.round(x * 2) / 2;
const SPINTA = ["Petto", "Spalle", "Tricipiti"], TRAZIONE = ["Dorso", "Bicipiti"];

// Riferimenti settimanali per distretto: serie, frequenza (sedute/sett.), range di ripetizioni.
// Donna: tabella di Morgana. Uomo: valori di riferimento da letteratura (modificabili qui).
const DISTRETTI = {
  F: [
    { d: "Glutei e femorali", g: ["Glutei", "Femorali"], serie: [15, 22], freq: [2, 3], rep: [6, 12] },
    { d: "Quadricipiti", g: ["Quadricipiti"], serie: [12, 15], freq: [2, 2], rep: [8, 15] },
    { d: "Dorso", g: ["Dorso"], serie: [10, 15], freq: [2, 3], rep: [8, 12] },
    { d: "Spalle e braccia", g: ["Spalle", "Bicipiti", "Tricipiti"], serie: [8, 12], freq: [2, 3], rep: [12, 20] },
    { d: "Petto", g: ["Petto"], serie: [6, 10], freq: [1, 2], rep: [8, 12] },
    { d: "Polpacci", g: ["Polpacci"], serie: [6, 10], freq: [2, 3], rep: [10, 20], facolt: true },
    { d: "Addome / core", g: ["Addome"], serie: [6, 10], freq: [2, 3], rep: [10, 20], facolt: true },
  ],
  M: [
    { d: "Petto", g: ["Petto"], serie: [10, 16], freq: [2, 2], rep: [6, 12] },
    { d: "Dorso", g: ["Dorso"], serie: [12, 18], freq: [2, 3], rep: [6, 12] },
    { d: "Spalle e braccia", g: ["Spalle", "Bicipiti", "Tricipiti"], serie: [14, 22], freq: [2, 3], rep: [8, 15] },
    { d: "Quadricipiti", g: ["Quadricipiti"], serie: [10, 16], freq: [2, 2], rep: [6, 12] },
    { d: "Glutei e femorali", g: ["Glutei", "Femorali"], serie: [10, 16], freq: [2, 2], rep: [6, 12] },
    { d: "Polpacci", g: ["Polpacci"], serie: [8, 12], freq: [2, 3], rep: [8, 15], facolt: true },
    { d: "Addome / core", g: ["Addome"], serie: [6, 10], freq: [2, 3], rep: [10, 20], facolt: true },
  ],
};
const repRange = (v) => { const n = (String(v ?? "").match(/\d+([.,]\d+)?/g) || []).map((x) => Number(x.replace(",", "."))).filter((x) => x > 0 && x < 100); return n.length ? [Math.min(...n), Math.max(...n)] : null; };

function analisiTarget(programma, sesso, leve) {
  const tab = DISTRETTI[sesso === "M" ? "M" : "F"];
  const consigli = [], righe = [];
  const donna = sesso !== "M";
  tab.forEach((D) => {
    const peso = (e) => { const q = quote(e.nome, leve); return D.g.reduce((a, g) => a + (q[g] || 0), 0); };
    const esTutti = programma.filter((e) => peso(e) > 0);
    const es = esTutti.filter((e) => e.serieEff > 0);
    const inc = esTutti.length - es.length; // esercizi del distretto senza serie indicate: non si inventano
    const serie = arr05(es.reduce((a, e) => a + e.serieEff * peso(e), 0));
    const perSeduta = {};
    es.forEach((e) => { perSeduta[e.training_day_id] = (perSeduta[e.training_day_id] || 0) + e.serieEff * peso(e); });
    const freq = Object.values(perSeduta).filter((x) => x > 0).length;
    let lo = 0, hi = 0, pesi = 0;
    es.forEach((e) => { const r = repRange(e.ripetizioni), w = e.serieEff * peso(e); if (r && w) { lo += r[0] * w; hi += r[1] * w; pesi += w; } });
    const rep = pesi ? [Math.round(lo / pesi), Math.round(hi / pesi)] : null;
    const medio = rep ? (rep[0] + rep[1]) / 2 : null;
    let stato = "ok";
    if (inc > 0) stato = "inc";
    else if (serie === 0) stato = D.facolt ? "nd" : "manca";
    else if (serie < D.serie[0]) stato = "basso";
    else if (serie > D.serie[1] + 2) stato = "alto";
    righe.push({ d: D.d, serie, freq, rep, rifSerie: D.serie, rifFreq: D.freq, rifRep: D.rep, stato, inc });
    if (inc > 0) return; // senza le serie indicate non si danno indicazioni di volume su questo distretto
    if (serie === 0) { if (!D.facolt) consigli.push({ t: "up", tit: `${D.d}: nessuno stimolo diretto nel programma`, testo: `Riferimento ${D.serie[0]}–${D.serie[1]} serie/settimana. Se il distretto è un obiettivo, inserire almeno 1–2 esercizi.`, peso: 2 }); return; }
    if (serie < D.serie[0]) consigli.push({ t: "up", tit: `${D.d}: ${serie} serie/settimana (riferimento ${D.serie[0]}–${D.serie[1]})`, testo: `Volume inferiore al range indicato per ${donna ? "la donna" : "l'uomo"}. Se il distretto è prioritario, valutare +${Math.min(6, D.serie[0] - serie)} serie settimanali, distribuite su ${Math.max(D.freq[0], 2)} sedute.`, peso: D.facolt ? 0 : 2 });
    else if (serie > D.serie[1] + 2) consigli.push({ t: "dn", tit: `${D.d}: ${serie} serie/settimana (riferimento ${D.serie[0]}–${D.serie[1]})`, testo: "Volume superiore al range: valutare la riduzione se il recupero è scarso, se i carichi non progrediscono o se compare ritenzione/indolenzimento persistente.", peso: 1 });
    if (freq > 0 && freq < D.freq[0]) consigli.push({ t: "fl", tit: `${D.d}: frequenza ${freq}×/settimana (riferimento ${D.freq[0]}${D.freq[1] > D.freq[0] ? "–" + D.freq[1] : ""}×)`, testo: `Distribuire le ${serie} serie su ${D.freq[0]} sedute migliora la qualità delle serie e il recupero${donna ? "; nella donna la monofrequenza è in genere poco efficiente" : ""}.`, peso: 1 });
    if (medio !== null && (medio < D.rep[0] - 1 || medio > D.rep[1] + 1)) consigli.push({ t: "fl", tit: `${D.d}: ripetizioni medie ${rep[0]}–${rep[1]} (riferimento ${D.rep[0]}–${D.rep[1]})`, testo: medio < D.rep[0] ? "Range di ripetizioni più basso del riferimento: valutare esercizi/serie a più ripetizioni per aumentare il tempo sotto tensione." : "Range di ripetizioni più alto del riferimento: valutare carichi maggiori su 1–2 esercizi principali per la tensione meccanica.", peso: 0 });
    const max = arr05(Math.max(0, ...Object.values(perSeduta)));
    const soglia = donna ? 10 : 12;
    if (max > soglia) consigli.push({ t: "fl", tit: `${D.d}: fino a ${max} serie in una sola seduta (soglia ${soglia})`, testo: donna && D.d === "Glutei e femorali"
      ? "Oltre 10–12 serie per distretto nella stessa seduta il guadagno ipertrofico tende a ridursi (danno muscolare localizzato) e può peggiorare l'infiammazione e la ritenzione agli arti inferiori: frazionare in 3 sedute brevi da 5–6 serie invece di una da 15–18."
      : `Oltre ${soglia} serie per distretto nella stessa seduta il rendimento marginale cala (volume non produttivo): mantenere ${donna ? "5–10" : "6–12"} serie per seduta e ripetere il distretto in un altro giorno.`, peso: 1 });
  });
  return { consigli, righe };
}

async function leggi(q) {
  let tutto = [], da = 0;
  for (let i = 0; i < 20; i++) { const { data, error } = await q().range(da, da + 999); if (error || !data) break; tutto = tutto.concat(data); if (data.length < 1000) break; da += 1000; }
  return tutto;
}

function analizza(esercizi, giorni, righe, sesso, leve) {
  let tabella = [];
  const idGiorniAttivi = new Set(giorni.filter((g) => !g.scheda_archiviata).map((g) => g.id));
  const programma = serieEffettive(esercizi.filter((e) => idGiorniAttivi.has(e.training_day_id)), righe);
  const consigli = [];
  const oggi = fmt(new Date());
  const finestra28 = righe.filter((r) => r.data >= giorniFa(27) && r.data <= oggi);
  const dateAllenate28 = new Set(finestra28.map((r) => r.data));

  // --- per esercizio (ultime 8 settimane): massimale di sessione e ripetizioni a quel carico
  const canon = mappaCanonica(esercizi, new Set(programma.map((e) => e.id))); // esercizi con nomi simili = un'unica progressione
  const perEs = {};
  righe.forEach((r) => { const kg = Number(r.kg); if (!r.data || !(kg > 0)) return; const cid = canon.map[r.exercise_id] || r.exercise_id; (perEs[cid] = perEs[cid] || {}); const s = (perEs[cid][r.data] = perEs[cid][r.data] || { kg: 0, reps: 0 }); const rp = num(r.ripetizioni) || 0; if (kg > s.kg) { s.kg = kg; s.reps = rp; } else if (kg === s.kg) s.reps = Math.max(s.reps, rp); });
  const nomeDi = canon.nomi;
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
  programma.forEach((e) => { const q = quote(e.nome, leve); const s = e.serieEff || 0; Object.entries(q).forEach(([g, w]) => { vol[g] = (vol[g] || 0) + s * w; (freq[g] = freq[g] || new Set()).add(e.training_day_id); }); });
  const nSeduteProg = idGiorniAttivi.size;
  if (nSeduteProg > 0) {
    const T = analisiTarget(programma, sesso, leve);
    T.consigli.sort((x, y) => y.peso - x.peso).forEach((x) => consigli.push(x));
    tabella = T.righe;
    const sp = SPINTA.reduce((s, g) => s + (vol[g] || 0), 0), tr = TRAZIONE.reduce((s, g) => s + (vol[g] || 0), 0);
    if (tr > 0 && sp / tr > 1.4) consigli.push({ t: "fl", tit: `Rapporto spinta/trazione ${Math.round(sp)}:${Math.round(tr)}`, testo: "Prevalenza del volume di spinta (petto, spalle, tricipiti) rispetto alla trazione: valutare più lavoro di dorso e deltoide posteriore per postura e simmetria scapolare.", peso: 0 });
    if (tr > 0 && sp > 0 && tr / sp > 1.8) consigli.push({ t: "fl", tit: `Rapporto spinta/trazione ${Math.round(sp)}:${Math.round(tr)}`, testo: "Volume di spinta contenuto rispetto alla trazione: se l'obiettivo include spalle e petto, valutare di aumentarlo.", peso: 0 });
  }

  // --- aderenza vs programma
  if (nSeduteProg > 0 && dateAllenate28.size > 0) {
    // il conteggio parte dal primo allenamento registrato nel log (chi ha iniziato da poco non viene penalizzata)
    const primo = righe.filter((r) => r.data).map((r) => r.data).sort()[0];
    const inizio = primo && primo > giorniFa(27) ? primo : giorniFa(27);
    const giorniOsservati = Math.max(1, Math.round((new Date(oggi) - new Date(inizio)) / 86400000) + 1);
    const sett = dateAllenate28.size / (giorniOsservati / 7);
    if (giorniOsservati >= 14 && sett < nSeduteProg * 0.75) consigli.push({ t: "chk", tit: `Frequenza settimanale reale ${String(Math.round(sett * 10) / 10).replace(".", ",")} (programma: ${nSeduteProg} sedute)`, testo: "Dal primo allenamento registrato, l'esecuzione è inferiore al programma: la limitazione alla progressione è più probabilmente l'aderenza che la programmazione. Valutare se il numero di sedute è sostenibile o va ridotto.", peso: 0 });
  }
  const mantenere = ok.slice(0, 5);
  const nonIndicate = programma.filter((e) => !(e.serieEff > 0)).map((e) => e.nome);
  return { consigli, mantenere, tabella, sesso, programma, nonIndicate, giorni: giorni.filter((g) => !g.scheda_archiviata), datiPochi: dateAllenate28.size < 4 || (!programma.length && !righe.length) };
}

export function ConsigliProgramma({ client }) {
  const [r, setR] = useState(null);
  const [leve, setLeve] = useState(client.leve || "");
  const [ric, setRic] = useState(0);
  const salvaLeve = async (v) => { setLeve(v); try { await supabase.from("clients").update({ leve: v || null }).eq("id", client.id); } catch (e) {} };
  useEffect(() => {
    let vivo = true; setR(null);
    (async () => {
      try {
        const { data: es } = await supabase.from("training_exercises").select("id, nome, serie, ripetizioni, training_day_id, ordine, tecnica, serie_top, serie_backoff").eq("client_id", client.id);
        const { data: gg } = await supabase.from("training_days").select("id, nome, scheda_archiviata").eq("client_id", client.id);
        const righe = await leggi(() => supabase.from("training_entries").select("exercise_id, data, kg, ripetizioni, numero_serie").eq("client_id", client.id).gte("data", giorniFa(56)).order("id"));
        if (vivo) setR(analizza(es || [], gg || [], righe, client.sesso, leve));
      } catch (e) { if (vivo) setR({ errore: true }); }
    })();
    return () => { vivo = false; };
  }, [client.id, client.sesso, leve, ric]);
  const stile = { up: ["▲ Aumentare / cambiare", "bg-sky-100 text-sky-700"], dn: ["▼ Ridurre / scaricare", "bg-slate-800 text-white"], fl: ["◆ Struttura", "bg-slate-100 text-slate-600"], chk: ["⚑ Verificare", "bg-slate-100 text-slate-600"] };
  return (
    <div className="bg-white border border-sky-200 rounded-2xl p-4 min-w-0">
      <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">Indicazioni sul programma · ultime 8 settimane</p>
      <div className="flex items-center gap-2 mb-2 text-[12px] text-slate-600">
        <span>Leve (femore):</span>
        {[["", "non indicate"], ["corte", "corte"], ["lunghe", "lunghe"]].map(([v, l]) => (
          <button key={v} onClick={() => salvaLeve(v)} className={`px-2.5 py-1 rounded-full text-[11.5px] ${leve === v ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>{l}</button>
        ))}
      </div>
      {!r && <p className="text-xs text-slate-400">Analizzo il programma…</p>}
      {r?.errore && <p className="text-xs text-slate-400">Non riesco a leggere i dati.</p>}
      {r && !r.errore && (
        <>
          {r.nonIndicate?.length > 0 && <p className="text-[12px] text-slate-500 mb-2">Serie non indicate per {r.nonIndicate.length} esercizi ({r.nonIndicate.slice(0, 4).join(", ")}{r.nonIndicate.length > 4 ? "…" : ""}): non li conto e non do indicazioni di volume sui distretti che li comprendono. Le serie mancanti vengono dedotte solo da top set (1) e back-off (2) o dal log.</p>}
          {r.datiPochi && <p className="text-[12px] text-slate-500 mb-2">Dati di allenamento ancora pochi: le indicazioni basate sui carichi richiedono almeno 3 sessioni per esercizio.</p>}
          {r.consigli.length === 0 && !r.datiPochi && <p className="text-sm text-slate-500">Nessuna indicazione particolare: progressione e struttura del programma sono nei range attesi.</p>}
          {r.consigli.map((c, i) => (
            <div key={i} className="py-2 border-b border-sky-100 last:border-0">
              <span className={`inline-block text-[10.5px] rounded-full px-2 py-0.5 mr-2 ${stile[c.t][1]}`}>{c.cambio ? "⟳ Cambiare stimolo" : stile[c.t][0]}</span>
              <span className="text-[13px] font-semibold text-slate-800">{c.tit}</span>
              <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">{c.testo}</p>
            </div>
          ))}
          {r.tabella?.length > 0 && r.tabella.some((x) => x.serie > 0) && (
            <div className="mt-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-1">Programma vs riferimento · {r.sesso === "M" ? "uomo" : "donna"}</p>
              <div className="text-[11.5px] text-slate-700">
                <div className="grid grid-cols-[1.5fr_1fr_.8fr_1fr] gap-x-2 text-[10.5px] text-slate-400 pb-1"><span>Distretto</span><span>Serie/sett.</span><span>Freq.</span><span>Ripetizioni</span></div>
                {r.tabella.map((x) => (
                  <div key={x.d} className="grid grid-cols-[1.5fr_1fr_.8fr_1fr] gap-x-2 py-1 border-t border-sky-100">
                    <span>{x.d}</span>
                    <span className={x.stato === "basso" || x.stato === "manca" ? "text-slate-900 font-semibold" : x.stato === "alto" ? "text-slate-900 font-semibold" : ""}>{String(x.serie).replace(".", ",")}{x.inc ? <span className="text-slate-400"> +{x.inc} n.i.</span> : null} <span className="text-slate-400">/ {x.rifSerie[0]}–{x.rifSerie[1]}</span> {x.stato === "basso" || x.stato === "manca" ? "▼" : x.stato === "alto" ? "▲" : x.stato === "ok" ? "✓" : ""}</span>
                    <span>{x.freq}× <span className="text-slate-400">/ {x.rifFreq[0]}{x.rifFreq[1] > x.rifFreq[0] ? "–" + x.rifFreq[1] : ""}</span></span>
                    <span>{x.rep ? x.rep[0] + "–" + x.rep[1] : "—"} <span className="text-slate-400">/ {x.rifRep[0]}–{x.rifRep[1]}</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Simulatore r={r} sesso={client.sesso} leve={leve} onApplicato={() => setRic((x) => x + 1)} />
          {r.mantenere.length > 0 && <p className="text-[12px] text-slate-600 pt-2"><span className="inline-block text-[10.5px] rounded-full px-2 py-0.5 mr-2 bg-slate-100 text-slate-600">▬ Mantenere</span>{r.mantenere.join(", ")}: progressione regolare.</p>}
          <p className="text-[11px] text-slate-400 mt-2">Regole su carichi, ripetizioni e serie registrati e sul programma attivo: sono spunti, la decisione è tua. Il lavoro è ripartito tra i distretti in base all'esercizio (es. squat bulgaro: glutei e femorali; squat e pressa: quadricipiti e glutei in proporzione alle leve indicate).</p>
        </>
      )}
    </div>
  );
}

const TECNICHE_SIM = [["", "Nessuna tecnica"], ["top_back", "Top set + back-off"], ["drop", "Drop set"], ["rest_pause", "Rest-pause"], ["myo", "Myo-reps"], ["super", "Superserie"], ["cluster", "Cluster"], ["pausa", "Serie con pausa"]];
const nomeTecnica = (t) => (TECNICHE_SIM.find(([k]) => k === t) || [])[1] || "";
const COMPOSTI = /squat|leg press|pressa|hack|hip thrust|rdl|romanian|stacco|deadlift|good morning|bulgar|affond|lunge|step.?up|panca|chest press|military|lento avanti|lat |lat machine|pulldown|trazion|rematore|row|pull.?up|chin|dip/i;
const baseNome = (n) => String(n || "").replace(/\s*(top\s*set|back.?off)\s*/gi, " ").replace(/\s+/g, " ").trim().toLowerCase();

// Propone automaticamente: serie per distretto, ordine degli esercizi (multiarticolari prima) e tecnica (top set + back-off) per gli esercizi in stallo.
// Agisce solo su esercizi con serie indicate; non inventa esercizi nuovi.
function proponiModifiche(r, sesso, leve) {
  const tab = DISTRETTI[sesso === "M" ? "M" : "F"];
  const mod = {}; // id -> serie proposte
  const note = [];
  const corrente = () => r.programma.map((e) => (mod[e.id] != null ? { ...e, serieEff: mod[e.id] } : e));
  const pesoDi = (e, D) => { const q = quote(e.nome, leve); return D.g.reduce((a, g) => a + (q[g] || 0), 0); };
  for (let giro = 0; giro < 40; giro++) {
    const prog = corrente();
    const T = analisiTarget(prog, sesso, leve);
    let fatto = false;
    for (const riga of T.righe) {
      if (riga.inc > 0) continue;
      const D = tab.find((x) => x.d === riga.d);
      const cand = prog.filter((e) => e.serieEff > 0 && pesoDi(e, D) > 0);
      if (riga.stato === "basso" && cand.length) {
        const c = cand.filter((e) => e.serieEff < 5).sort((a, b) => pesoDi(b, D) - pesoDi(a, D) || a.serieEff - b.serieEff)[0];
        if (c) { mod[c.id] = c.serieEff + 1; fatto = true; break; }
      } else if (riga.stato === "alto" && cand.length) {
        const c = cand.filter((e) => e.serieEff > 2 && !(mod[e.id] > (r.programma.find((x) => x.id === e.id)?.serieEff || 0))).sort((a, b) => b.serieEff - a.serieEff)[0];
        if (c) { mod[c.id] = c.serieEff - 1; fatto = true; break; }
      }
    }
    if (!fatto) break;
  }
  const T0 = analisiTarget(corrente(), sesso, leve);
  T0.righe.forEach((x) => { if (x.stato === "manca") note.push(`${x.d}: nessun esercizio nel programma, valuta di inserirne 1–2 (non lo aggiungo io).`); else if (x.stato === "basso") note.push(`${x.d}: ancora sotto il riferimento con le serie degli esercizi attuali, serve un esercizio in più.`); });

  // ordine: multiarticolari prima degli isolamenti, a parità resta l'ordine attuale (top set e back-off restano vicini)
  const ord = {};
  r.giorni.forEach((g) => {
    const es = r.programma.filter((e) => e.training_day_id === g.id).sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0));
    const nuovo = es.map((e, i) => ({ e, i, t: COMPOSTI.test(e.nome) ? 0 : 1 })).sort((a, b) => a.t - b.t || a.i - b.i).map((x) => x.e.id);
    if (nuovo.join() !== es.map((e) => e.id).join()) { ord[g.id] = nuovo; note.push(`${g.nome}: porto gli esercizi multiarticolari prima degli isolamenti (più freschi sui carichi alti).`); }
  });

  // tecnica: esercizi con carico fermo da molte sessioni → top set + back-off
  const tec = {};
  r.consigli.filter((c) => c.cambio).forEach((c) => {
    const k = baseNome(c.tit);
    const e = r.programma.find((x) => baseNome(x.nome) === k && !x.tecnica && !/top\s*set|back.?off/i.test(x.nome));
    const tot = e ? (mod[e.id] ?? e.serieEff) : 0;
    if (e && tot >= 3) { tec[e.id] = { t: "top_back", top: "1", back: String(tot - 1) }; note.push(`${e.nome}: carico fermo da più sessioni → 1 top set + ${tot - 1} back-off per cambiare stimolo.`); }
  });
  return { mod, note, ord, tec };
}

// Bozza provvisoria: si modificano serie, ordine e tecniche (o si aggiungono/tolgono esercizi) e si vede come cambia la valutazione.
// Le modifiche si possono poi applicare al programma vero con conferma.
function Simulatore({ r, sesso, leve, onApplicato }) {
  const [aperto, setAperto] = useState(false);
  const [mod, setMod] = useState({}); // id -> serie (stringa) | "x" per togliere
  const [tec, setTec] = useState({}); // id -> { t, top, back }
  const [ord, setOrd] = useState({}); // giorno -> [ids]
  const [nuovi, setNuovi] = useState([]); // solo simulazione: { nome, serie, rip, training_day_id }
  const [nn, setNn] = useState({ nome: "", serie: "3", rip: "8-12", training_day_id: r.giorni[0]?.id || "" });
  const [esito, setEsito] = useState("");
  const [applicando, setApplicando] = useState(false);
  const [notePrp, setNotePrp] = useState([]);
  const nomeGiorno = (id) => r.giorni.find((g) => g.id === id)?.nome || "";
  const ordineOriginale = (gid) => r.programma.filter((e) => e.training_day_id === gid).sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0)).map((e) => e.id);
  const ordineDi = (gid) => ord[gid] || ordineOriginale(gid);

  const tecDi = (e) => tec[e.id] || { t: e.tecnica || "", top: e.serie_top != null ? String(e.serie_top) : "", back: e.serie_backoff != null ? String(e.serie_backoff) : "" };
  const serieDi = (e) => {
    const T = tecDi(e);
    if (T.t === "top_back" && (Number(T.top) || 0) + (Number(T.back) || 0) > 0) return (Number(T.top) || 0) + (Number(T.back) || 0);
    return mod[e.id] != null && mod[e.id] !== "" && mod[e.id] !== "x" ? Number(mod[e.id]) : (e.serieEff > 0 ? e.serieEff : 0);
  };
  const cambiato = (e) => {
    const T = tecDi(e);
    const posNuova = ordineDi(e.training_day_id).indexOf(e.id), posOra = ordineOriginale(e.training_day_id).indexOf(e.id);
    return serieDi(e) !== (e.serieEff || 0) || (T.t || "") !== (e.tecnica || "") || (T.t === "top_back" && (Number(T.top) || 0) !== (e.serie_top || 0)) || (T.t === "top_back" && (Number(T.back) || 0) !== (e.serie_backoff || 0)) || posNuova !== posOra;
  };
  const cambi = r.programma.filter((e) => mod[e.id] !== "x" && cambiato(e));
  const bozza = [
    ...r.programma.filter((e) => mod[e.id] !== "x").map((e) => ({ ...e, serieEff: serieDi(e) })),
    ...nuovi.map((e, i) => ({ id: "n" + i, nome: e.nome, serieEff: Number(e.serie) || 0, ripetizioni: e.rip, training_day_id: e.training_day_id })),
  ];
  const B = aperto ? analisiTarget(bozza, sesso, leve) : null;
  const sc = (x) => String(x).replace(".", ",");

  const proponi = () => {
    const p = proponiModifiche(r, sesso, leve);
    const m = {}; Object.entries(p.mod).forEach(([id, v]) => { m[id] = String(v); });
    setMod(m); setTec(p.tec); setOrd(p.ord); setNotePrp(p.note);
    setEsito(Object.keys(m).length + Object.keys(p.tec).length + Object.keys(p.ord).length ? "" : "Con i dati indicati non trovo modifiche utili da proporre.");
  };
  const sposta = (gid, id, d) => {
    const lista = [...ordineDi(gid)]; const i = lista.indexOf(id), j = i + d;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    setOrd({ ...ord, [gid]: lista });
  };
  const applica = async () => {
    if (!cambi.length) return;
    const righe = cambi.map((e) => {
      const T = tecDi(e);
      return `${e.nome}: ${e.serieEff || "—"} → ${serieDi(e)} serie${T.t ? ` · ${nomeTecnica(T.t)}${T.t === "top_back" ? ` (${T.top || 0} top + ${T.back || 0} back-off)` : ""}` : ""}`;
    });
    if (!confirm(`Applico ${cambi.length} modifiche al programma vero (serie, tecniche, ordine)?\n\n` + righe.join("\n"))) return;
    setApplicando(true);
    for (const e of cambi) {
      const T = tecDi(e);
      const campi = { serie: serieDi(e) || null, tecnica: T.t || null, serie_top: T.t === "top_back" ? Number(T.top) || 0 : null, serie_backoff: T.t === "top_back" ? Number(T.back) || 0 : null };
      await supabase.from("training_exercises").update(campi).eq("id", e.id);
    }
    for (const g of r.giorni) {
      if (!ord[g.id]) continue;
      for (let i = 0; i < ord[g.id].length; i++) await supabase.from("training_exercises").update({ ordine: i + 1 }).eq("id", ord[g.id][i]);
    }
    setApplicando(false); setMod({}); setTec({}); setOrd({}); setNotePrp([]);
    setEsito(`Fatto: ${cambi.length} esercizi aggiornati nel programma ✓`);
    onApplicato && onApplicato();
  };

  return (
    <div className="mt-3 border-t border-sky-100 pt-3">
      <button onClick={() => setAperto(!aperto)} className="text-[12.5px] font-semibold text-sky-700">🧪 {aperto ? "Chiudi la bozza" : "Prova una modifica al programma (bozza provvisoria)"}</button>
      {aperto && (
        <div className="mt-2 space-y-3">
          <p className="text-[11.5px] text-slate-500">Cambia le serie, l'ordine, le tecniche (es. top set + back-off), togli un esercizio o aggiungine uno per provare: sotto vedi come cambia il confronto con i riferimenti. Il programma vero cambia solo se premi "Applica".</p>
          <div className="flex gap-2 flex-wrap">
            <button onClick={proponi} className="bg-sky-100 text-sky-700 rounded-lg px-3 py-1.5 text-[12px] font-semibold">✨ Proponi tu le modifiche</button>
            {cambi.length > 0 && <button onClick={applica} disabled={applicando} className="bg-slate-800 text-white rounded-lg px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50">{applicando ? "Applico..." : `Applica ${cambi.length} modifiche al programma`}</button>}
          </div>
          {esito && <p className="text-[12px] text-sky-700">{esito}</p>}
          {(cambi.length > 0 || notePrp.length > 0) && (
            <div className="bg-sky-50 rounded-lg px-3 py-2 text-[12px] text-slate-700 space-y-0.5">
              <p className="font-semibold text-slate-800">Modifiche proposte</p>
              {cambi.map((e) => { const T = tecDi(e); return <p key={e.id}>{e.nome}: {e.serieEff || "—"} → <b>{serieDi(e)}</b> serie{T.t ? ` · ${nomeTecnica(T.t)}` : ""}{ordineDi(e.training_day_id).indexOf(e.id) !== ordineOriginale(e.training_day_id).indexOf(e.id) ? " · cambia posizione" : ""}</p>; })}
              {notePrp.map((n, i) => <p key={i} className="text-slate-500">• {n}</p>)}
            </div>
          )}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {r.giorni.map((g) => (
              <div key={g.id}>
                <p className="text-[11px] uppercase tracking-wide text-slate-400 font-medium mb-1">{g.nome}</p>
                <div className="space-y-1.5">
                  {ordineDi(g.id).map((id, pos, lista) => {
                    const e = r.programma.find((x) => x.id === id); if (!e) return null;
                    const T = tecDi(e); const tb = T.t === "top_back";
                    return (
                      <div key={id} className={`border border-sky-100 rounded-lg px-2 py-1.5 ${mod[id] === "x" ? "opacity-40" : ""}`}>
                        <div className="flex items-center gap-1.5 text-[12px]">
                          <span className="flex flex-col leading-none text-slate-400">
                            <button disabled={pos === 0} onClick={() => sposta(g.id, id, -1)} className="disabled:opacity-20">▲</button>
                            <button disabled={pos === lista.length - 1} onClick={() => sposta(g.id, id, 1)} className="disabled:opacity-20">▼</button>
                          </span>
                          <span className="flex-1 min-w-0 truncate">{e.nome}</span>
                          {!tb && <input inputMode="numeric" value={mod[id] === "x" ? "" : (mod[id] ?? (e.serieEff > 0 ? e.serieEff : ""))} placeholder="serie" onChange={(ev) => setMod({ ...mod, [id]: ev.target.value.replace(/\D/g, "") })} className="w-12 border border-slate-200 rounded px-1 py-1 text-center" />}
                          <button onClick={() => setMod({ ...mod, [id]: mod[id] === "x" ? "" : "x" })} className="text-slate-400 px-1" title="Togli/rimetti">{mod[id] === "x" ? "↺" : "✕"}</button>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[11.5px] text-slate-500 flex-wrap">
                          <select value={T.t} onChange={(ev) => setTec({ ...tec, [id]: { ...T, t: ev.target.value, top: ev.target.value === "top_back" && !T.top ? "1" : T.top, back: ev.target.value === "top_back" && !T.back ? String(Math.max(1, (serieDi(e) || 3) - 1)) : T.back } })} className="border border-slate-200 rounded px-1 py-0.5 bg-white">
                            {TECNICHE_SIM.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </select>
                          {tb && (<>
                            <input inputMode="numeric" value={T.top} onChange={(ev) => setTec({ ...tec, [id]: { ...T, top: ev.target.value.replace(/\D/g, "") } })} className="w-9 border border-slate-200 rounded px-1 py-0.5 text-center" /><span>top +</span>
                            <input inputMode="numeric" value={T.back} onChange={(ev) => setTec({ ...tec, [id]: { ...T, back: ev.target.value.replace(/\D/g, "") } })} className="w-9 border border-slate-200 rounded px-1 py-0.5 text-center" /><span>back-off</span>
                          </>)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {nuovi.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px] text-sky-700">
                <span className="flex-1 min-w-0 truncate">+ {e.nome} <span className="text-slate-400">· {nomeGiorno(e.training_day_id)} · {e.serie} serie · solo simulazione</span></span>
                <button onClick={() => setNuovi(nuovi.filter((_, j) => j !== i))} className="text-slate-400 px-1">✕</button>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 items-center flex-wrap">
            <input value={nn.nome} onChange={(ev) => setNn({ ...nn, nome: ev.target.value })} placeholder="Nuovo esercizio (es. Hip thrust)" className="flex-1 min-w-[140px] border border-slate-200 rounded px-2 py-1 text-[12px]" />
            <select value={nn.training_day_id} onChange={(ev) => setNn({ ...nn, training_day_id: ev.target.value })} className="border border-slate-200 rounded px-1 py-1 text-[12px]">{r.giorni.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</select>
            <input value={nn.serie} onChange={(ev) => setNn({ ...nn, serie: ev.target.value.replace(/\D/g, "") })} className="w-12 border border-slate-200 rounded px-1 py-1 text-center text-[12px]" />
            <input value={nn.rip} onChange={(ev) => setNn({ ...nn, rip: ev.target.value })} className="w-16 border border-slate-200 rounded px-1 py-1 text-center text-[12px]" />
            <button onClick={() => { if (nn.nome.trim()) { setNuovi([...nuovi, nn]); setNn({ ...nn, nome: "" }); } }} className="bg-slate-800 text-white rounded px-2.5 py-1 text-[12px]">Aggiungi</button>
          </div>
          {B && (
            <div className="text-[11.5px] text-slate-700">
              <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-1">Ora → bozza</p>
              <div className="grid grid-cols-[1.4fr_.8fr_.8fr_1fr] gap-x-2 text-[10.5px] text-slate-400 pb-1"><span>Distretto</span><span>Serie ora</span><span>Serie bozza</span><span>Riferimento</span></div>
              {B.righe.map((x, i) => {
                const ora = r.tabella[i];
                return (
                  <div key={x.d} className="grid grid-cols-[1.4fr_.8fr_.8fr_1fr] gap-x-2 py-1 border-t border-sky-100">
                    <span>{x.d}</span>
                    <span>{sc(ora?.serie ?? 0)}</span>
                    <span className={x.serie !== ora?.serie ? "font-semibold text-sky-700" : ""}>{sc(x.serie)} {x.stato === "ok" ? "✓" : x.stato === "basso" || x.stato === "manca" ? "▼" : x.stato === "alto" ? "▲" : ""}</span>
                    <span className="text-slate-400">{x.rifSerie[0]}–{x.rifSerie[1]}</span>
                  </div>
                );
              })}
              <p className="mt-2 font-semibold">Indicazioni sulla bozza: {B.consigli.length === 0 ? "nessuna, volume e frequenza nei range ✓" : `${B.consigli.length} (prima: ${r.consigli.filter((c) => c.t !== "chk").length})`}</p>
              {B.consigli.sort((a, b) => b.peso - a.peso).slice(0, 5).map((c, i) => <p key={i} className="text-slate-500 mt-0.5">• {c.tit}</p>)}
            </div>
          )}
        </div>
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

// Legge il blocco [APP-ANALISI] prodotto dalla chat della cliente (righe "chiave: valore")
const CHIAVI_TESTO = { sintesi: "sintesi", punti_forti: "forti", da_migliorare: "migliorare", suggerimenti: "suggerimenti", suggerimenti_coach: "suggerimenti", qualita_dati: "qualita", osservazioni_coach: "osservazioni" };
export function leggiBloccoAnalisi(testo) {
  let t = String(testo || "").replace(/```[a-z]*/gi, "");
  const m = /\[APP-ANALISI\]([\s\S]*?)(\[\/APP-ANALISI\]|$)/i.exec(t);
  if (m) t = m[1];
  const out = { voti: {}, testi: {}, data: null };
  let ultima = null;
  t.split(/\r?\n/).forEach((riga) => {
    const r = riga.replace(/\*\*/g, "").replace(/^\s*[-•*]\s+/, "").trim();
    const mm = /^([a-z_àèéìòù ]+?)\s*[:=]\s*(.*)$/i.exec(r);
    const k = mm ? mm[1].trim().toLowerCase().replace(/\s+/g, "_") : null;
    if (k && (k === "data_check" || k === "data" || ASPETTI.some(([a]) => a === k) || CHIAVI_TESTO[k])) {
      ultima = k;
      const v = mm[2].trim();
      if (k === "data_check" || k === "data") {
        const d1 = /(\d{4})-(\d{2})-(\d{2})/.exec(v), d2 = /(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(v);
        out.data = d1 ? d1[0] : d2 ? d2[3] + "-" + pad(+d2[2]) + "-" + pad(+d2[1]) : null;
      } else if (ASPETTI.some(([a]) => a === k)) {
        const n = Math.round(parseFloat(String(v).replace(",", ".")));
        if (n >= 1 && n <= 5) out.voti[k] = n;
      } else out.testi[CHIAVI_TESTO[k]] = v;
    } else if (ultima && CHIAVI_TESTO[ultima] && r) {
      const kk = CHIAVI_TESTO[ultima];
      out.testi[kk] = (out.testi[kk] ? out.testi[kk] + "\n" : "") + r;
    }
  });
  return out;
}

export function ValutazioneEstetica({ client, checkins }) {
  const ordinati = [...(checkins || [])].filter((c) => c.data_check).sort((a, b) => a.data_check.localeCompare(b.data_check));
  const [val, setVal] = useState({}); // checkin_id -> voti
  const [analisi, setAnalisi] = useState({}); // checkin_id -> testo analisi importata dalla chat
  const [apriImporta, setApriImporta] = useState(false);
  const [testoImporta, setTestoImporta] = useState("");
  const [esitoImporta, setEsitoImporta] = useState("");
  const [idA, setIdA] = useState(""); const [idB, setIdB] = useState("");
  useEffect(() => {
    let vivo = true;
    supabase.from("valutazione_estetica").select("checkin_id, voti, analisi").eq("client_id", client.id).then(({ data }) => { if (vivo) { const m = {}, an = {}; (data || []).forEach((x) => { m[x.checkin_id] = x.voti || {}; if (x.analisi) an[x.checkin_id] = x.analisi; }); setVal(m); setAnalisi(an); } });
    return () => { vivo = false; };
  }, [client.id]);
  useEffect(() => { setIdA(ordinati[0]?.id || ""); setIdB(ordinati.length > 1 ? ordinati[ordinati.length - 1].id : ""); }, [client.id, ordinati.length]);
  const salva = async (c, k, v) => {
    const voti = { ...(val[c.id] || {}), [k]: v };
    setVal((p) => ({ ...p, [c.id]: voti }));
    try { await supabase.from("valutazione_estetica").upsert({ client_id: client.id, checkin_id: c.id, data_check: c.data_check, voti, updated_at: new Date().toISOString() }, { onConflict: "client_id,checkin_id" }); window.dispatchEvent(new Event("estetica-aggiornata")); } catch (e) { /* ignora */ }
  };
  const importa = async () => {
    const r = leggiBloccoAnalisi(testoImporta);
    if (!Object.keys(r.voti).length && !Object.keys(r.testi).length) { setEsitoImporta("Non trovo nessun dato: incolla tutto il blocco [APP-ANALISI] che ti ha scritto la chat."); return; }
    if (!ordinati.length) { setEsitoImporta("Questa cliente non ha ancora check."); return; }
    let c = ordinati[ordinati.length - 1];
    if (r.data) {
      const t0 = new Date(r.data).getTime();
      c = ordinati.reduce((best, x) => (Math.abs(new Date(x.data_check).getTime() - t0) < Math.abs(new Date(best.data_check).getTime() - t0) ? x : best), ordinati[0]);
    }
    const voti = { ...(val[c.id] || {}), ...r.voti };
    const an = { ...(analisi[c.id] || {}), ...r.testi, importata_il: new Date().toISOString() };
    try {
      const { error } = await supabase.from("valutazione_estetica").upsert({ client_id: client.id, checkin_id: c.id, data_check: c.data_check, voti, analisi: an, updated_at: new Date().toISOString() }, { onConflict: "client_id,checkin_id" });
      if (error) throw error;
    } catch (e) { setEsitoImporta("Non sono riuscita a salvare. Riprova."); return; }
    setVal((p) => ({ ...p, [c.id]: voti })); setAnalisi((p) => ({ ...p, [c.id]: an }));
    setIdB(c.id);
    window.dispatchEvent(new Event("estetica-aggiornata"));
    setEsitoImporta(`Fatto ✨ Analisi salvata nel check del ${c.data_check.split("-").reverse().join("/")}.`);
    setTestoImporta("");
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
          {[B, A].filter((c, i, arr) => c && analisi[c.id] && arr.findIndex((y) => y?.id === c.id) === i).map((c) => {
            const a = analisi[c.id];
            const blocchi = [["sintesi", "Lettura del check"], ["forti", "Punti di forza"], ["migliorare", "Da migliorare"], ["osservazioni", "Osservazioni coach considerate"], ["suggerimenti", "Suggerimenti per te"], ["qualita", "Affidabilità dei dati"]];
            return (
              <div key={c.id} className="mt-3 bg-sky-50 border border-sky-200 rounded-xl p-3 text-[12.5px] text-slate-700 space-y-1.5">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">Analisi AI · check del {dm(c)}</p>
                {blocchi.filter(([k]) => a[k]).map(([k, l]) => <p key={k} className="whitespace-pre-line"><b className="text-slate-900">{l}: </b>{a[k]}</p>)}
              </div>
            );
          })}
        </>
      )}
      {ordinati.length > 0 && (
        <div className="mt-3">
          <button onClick={() => { setApriImporta((v) => !v); setEsitoImporta(""); }} className="text-sky-700 text-[12px] font-medium border border-sky-200 rounded-lg px-3 py-1.5">{apriImporta ? "Chiudi" : "Importa analisi dalla chat"}</button>
          {apriImporta && (
            <div className="mt-2 space-y-2">
              <p className="text-[11px] text-slate-500">Copia il blocco [APP-ANALISI] che trovi in fondo alla risposta della chat e incollalo qui. Voti e analisi vanno da soli nel check giusto.</p>
              <textarea value={testoImporta} onChange={(e) => setTestoImporta(e.target.value)} rows={6} placeholder="[APP-ANALISI] ... [/APP-ANALISI]" className="w-full border border-sky-200 rounded-lg px-3 py-2 text-[12px]" />
              <button onClick={importa} disabled={!testoImporta.trim()} className="bg-sky-700 text-white text-[12px] font-medium rounded-lg px-4 py-2 disabled:opacity-40">Importa</button>
              {esitoImporta && <p className="text-[12px] text-slate-700">{esitoImporta}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
