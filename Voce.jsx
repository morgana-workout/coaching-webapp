import React, { useState, useRef, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { X, Mic, ChevronDown, ChevronUp } from "lucide-react";

/* Inserimento del pasto a voce o a testo.
   Niente servizi a pagamento: il riconoscimento vocale è quello del telefono (Web Speech API);
   l'interpretazione è fatta qui, confrontando le parole con la libreria alimenti. L'app NON indovina
   i piatti composti: cerca solo alimenti singoli della libreria; quello che non trova viene salvato
   "da completare" (la quantità resta, i valori si aggiungono dopo). */

const MEALS = [["colazione", "Colazione"], ["pranzo", "Pranzo"], ["spuntini", "Spuntini"], ["cena", "Cena"]];

function round1(n) { return Math.round(n * 10) / 10; }
function round2(n) { return Math.round(n * 100) / 100; }
function num(n) { return Number(n ?? 0).toLocaleString("it-IT", { maximumFractionDigits: 2 }); }
function foodKcal(f, amt) { return round1((f.kcal * amt) / f.per); }
function hasMacro(f) { return f && f.proteine != null && f.carboidrati != null && f.grassi != null; }
function perLabel(f) { return f.unit === "pz" ? "1 " + (f.uname || "pezzo") : num(f.per) + " " + f.unit; }

/* ------------------------------------------------------------------ */
/* Interprete del testo                                                */
/* ------------------------------------------------------------------ */
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/(\d),(\d)/g, "$1.$2").replace(/[',;:!?()"]/g, " ").replace(/[^a-z0-9.\s%]/g, " ")
  .replace(/(\d)([a-z])/g, "$1 $2").replace(/\s+/g, " ").trim();

const PAROLE_NUM = { un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, mezzo: 0.5, mezza: 0.5, venti: 20, trenta: 30, quaranta: 40, cinquanta: 50, sessanta: 60, settanta: 70, ottanta: 80, novanta: 90, cento: 100, duecento: 200, trecento: 300, quattrocento: 400, cinquecento: 500 };
// unità riconosciute → { tipo, f: fattore verso g/ml, stima }
const UNITA = {
  g: { t: "g", f: 1 }, gr: { t: "g", f: 1 }, grammo: { t: "g", f: 1 }, grammi: { t: "g", f: 1 },
  kg: { t: "g", f: 1000 }, chilo: { t: "g", f: 1000 }, chili: { t: "g", f: 1000 }, kili: { t: "g", f: 1000 },
  etto: { t: "g", f: 100 }, etti: { t: "g", f: 100 },
  ml: { t: "ml", f: 1 }, millilitri: { t: "ml", f: 1 }, l: { t: "ml", f: 1000 }, litro: { t: "ml", f: 1000 }, litri: { t: "ml", f: 1000 },
  cucchiaio: { t: "g", f: 10, stima: true }, cucchiai: { t: "g", f: 10, stima: true },
  cucchiaino: { t: "g", f: 5, stima: true }, cucchiaini: { t: "g", f: 5, stima: true },
  bicchiere: { t: "ml", f: 200, stima: true }, bicchieri: { t: "ml", f: 200, stima: true },
  fetta: { t: "pz", f: 1 }, fette: { t: "pz", f: 1 }, pezzo: { t: "pz", f: 1 }, pezzi: { t: "pz", f: 1 }, pz: { t: "pz", f: 1 },
  vasetto: { t: "pz", f: 1 }, vasetti: { t: "pz", f: 1 }, barretta: { t: "pz", f: 1 }, barrette: { t: "pz", f: 1 },
};
const STOP = new Set(["di", "del", "dello", "della", "dei", "degli", "delle", "d", "dell", "l", "il", "lo", "la", "le", "i", "gli", "un", "una", "uno", "al", "alla", "allo", "ai", "con", "e", "poi", "piu", "anche", "ho", "mangiato", "bevuto", "preso", "oggi", "a", "in", "su", "per", "circa", "ancora", "ed"]);
const CONNETTORI = new Set(["e", "ed", "poi", "piu", "con", "anche", "inoltre"]);
const stem = (t) => (t.length > 4 ? t.replace(/[aeio]$/, "") : t);
const isNum = (t) => /^\d+(\.\d+)?$/.test(t);

function tokensDi(testo) { return norm(testo).split(" ").filter(Boolean); }
function paroleCibo(tokens) { return tokens.filter((t) => !STOP.has(t) && !isNum(t)); }

export function dividiTesto(testoGrezzo) {
  let pasto = null;
  let t = norm(testoGrezzo);
  const m = t.match(/\b(colazione|pranzo|cena|spuntino|spuntini|merenda)\b/);
  if (m) { pasto = m[1] === "spuntino" || m[1] === "merenda" ? "spuntini" : m[1]; t = t.replace(m[0], " ").replace(/\s+/g, " ").trim(); }
  const tk = t.split(" ").filter(Boolean);
  const INIZIO = new Set(["a", "ho", "mangiato", "bevuto", "preso", "oggi", "ed", "e", "poi", "ancora", "anche"]);
  const primo = tk.find((x) => !INIZIO.has(x));
  const prima = primo != null && (isNum(primo) || PAROLE_NUM[primo] != null);
  const segs = [];
  let cur = null;
  const chiudi = () => { if (cur) segs.push(cur); cur = null; };
  const valoreNum = (x) => (isNum(x) ? Number(x) : PAROLE_NUM[x]);
  let acc = []; // modalità "cibo poi quantità"
  for (let i = 0; i < tk.length; i++) {
    const x = tk[i];
    if (isNum(x) || PAROLE_NUM[x] != null) {
      let u = null;
      if (i + 1 < tk.length && UNITA[tk[i + 1]]) { u = tk[i + 1]; }
      // "un/una" davanti a una parola qualunque = 1 pezzo; "mezzo" = 0.5
      if (prima || cur) { chiudi(); cur = { qty: valoreNum(x), unita: u, parole: [] }; if (u) i++; }
      else if (!acc.filter((w) => !STOP.has(w)).length) { cur = { qty: valoreNum(x), unita: u, parole: [] }; acc = []; if (u) i++; } // numero senza cibo prima: il cibo viene dopo
      else { segs.push({ qty: valoreNum(x), unita: u, parole: acc }); acc = []; if (u) i++; }
    } else if (prima || cur) { if (cur) cur.parole.push(x); }
    else acc.push(x);
  }
  chiudi();
  if (!prima && !cur && acc.length) segs.push({ qty: null, unita: null, parole: acc });
  // ripulisce i connettori finali (es. "pasta e")
  segs.forEach((sg) => { while (sg.parole.length && CONNETTORI.has(sg.parole[sg.parole.length - 1])) sg.parole.pop(); });
  const out = segs.map((s) => ({ ...s, cibo: paroleCibo(s.parole) })).filter((s) => s.cibo.length);
  return { pasto, segmenti: out };
}

function tokensAlimento(f) {
  const nome = paroleCibo(tokensDi(f.nome));
  const marca = paroleCibo(tokensDi(f.marca || ""));
  return { nome, marca };
}

export function trovaCandidati(cibo, foods) {
  const fr = cibo.map(stem);
  const out = [];
  foods.forEach((f) => {
    const { nome, marca } = tokensAlimento(f);
    const tutti = [...nome, ...marca].map(stem);
    if (!tutti.length) return;
    let ok = 0;
    fr.forEach((p) => { if (tutti.some((q) => q === p || (p.length >= 4 && q.startsWith(p)) || (q.length >= 4 && p.startsWith(q)))) ok++; });
    if (ok !== fr.length) return;
    let score = 1 + ok / tutti.length;
    const marcaDetta = marca.length && marca.map(stem).some((q) => fr.includes(q));
    if (f.marca && !marcaDetta) score -= 0.15;
    if (!f.marca) score += 0.05;
    const dettoCotto = fr.some((p) => p.startsWith("cott"));
    if (!dettoCotto && /\bcott/i.test(f.nome)) score -= 0.2; // di norma si pesa crudo
    if (!dettoCotto && /\bcrud/i.test(f.nome)) score += 0.2;
    if (f.proteine == null) score -= 0.1; // meglio gli alimenti con i valori completi
    out.push({ f, score });
  });
  return out.sort((a, b) => b.score - a.score || a.f.nome.localeCompare(b.f.nome, "it")).slice(0, 8).map((x) => x.f);
}

function pesoPezzo(f) {
  const m = (f.uname || "").match(/\((\d+(?:[.,]\d+)?)\s*(?:g|ml)\)/);
  return m ? Number(m[1].replace(",", ".")) : null;
}

/* quantità finale nell'unità dell'alimento scelto */
function quantitaPer(f, seg) {
  if (!f) return { q: seg.qty, nota: null };
  const u = seg.unita ? UNITA[seg.unita] : null;
  const n = seg.qty;
  if (n == null) return { q: null, nota: "Indica la quantità." };
  if (f.unit === "pz") {
    if (!u || u.t === "pz") return { q: n, nota: null };
    const pp = pesoPezzo(f);
    if (pp) return { q: Math.round((n * u.f / pp) * 2) / 2 || 1, nota: u.stima ? "Quantità stimata: controllala." : null };
    return { q: null, nota: "Quanti pezzi? Indicalo tu." };
  }
  // alimento in g / ml
  if (u && (u.t === "g" || u.t === "ml")) return { q: round1(n * u.f), nota: u.stima ? "Quantità stimata: controllala." : null };
  if (!u && n >= 20) return { q: n, nota: null }; // «100 di pollo»: sono grammi
  if (!u || u.t === "pz") {
    if (f.quantita_abituale) return { q: round1(n * Number(f.quantita_abituale)), nota: "Ho usato la tua quantità abituale: controllala." };
    return { q: null, nota: "Quanti grammi? Indicalo tu." };
  }
  return { q: null, nota: "Indica la quantità." };
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
let _rid = 0;

function righeDa(testo, foods) {
  const { pasto, segmenti } = dividiTesto(testo);
  const righe = segmenti.map((s) => {
    const cand = trovaCandidati(s.cibo, foods);
    const f = cand[0] || null;
    const { q, nota } = quantitaPer(f, s);
    const cottoCrudo = cand.length > 1 && cand.some((c) => /\bcrud/i.test(c.nome)) && cand.some((c) => /\bcott/i.test(c.nome));
    const pw = [...s.parole]; while (pw.length && (STOP.has(pw[0]) || isNum(pw[0]))) pw.shift(); while (pw.length && STOP.has(pw[pw.length - 1])) pw.pop();
    return { id: ++_rid, seg: s, frase: (pw.length ? pw : s.cibo).join(" "), cand, sel: f ? f.id : null, qty: q == null ? "" : String(q), nota, cottoCrudo };
  });
  return { pasto, righe };
}

/* ------------------------------------------------------------------ */
/* Finestra "A voce o a testo"                                         */
/* ------------------------------------------------------------------ */
export function VoceAggiungi({ clientId, isAdmin, date, meal, foods, onChiudi, onFatto }) {
  const [testo, setTesto] = useState("");
  const [ascolto, setAscolto] = useState(false);
  const [errMic, setErrMic] = useState("");
  const [righe, setRighe] = useState(null);
  const [pasto, setPasto] = useState(meal);
  const [aperti, setAperti] = useState({});
  const [salvando, setSalvando] = useState(false);
  const recRef = useRef(null);
  const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

  useEffect(() => () => { try { recRef.current && recRef.current.stop(); } catch (e) { /* niente */ } }, []);

  const ferma = () => { try { recRef.current && recRef.current.stop(); } catch (e) { /* niente */ } setAscolto(false); };
  const avvia = () => {
    setErrMic("");
    if (!SR) { setErrMic("Su questo telefono il microfono dell'app non è disponibile: usa il microfono della tastiera 🫶🏻"); return; }
    try {
      const r = new SR();
      r.lang = "it-IT"; r.interimResults = true; r.continuous = true;
      const base = testo.trim();
      r.onresult = (e) => {
        let fin = "", tmp = "";
        for (let i = 0; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += t + " "; else tmp += t; }
        setTesto((base + " " + fin + tmp).trim());
      };
      r.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") setErrMic("Il microfono non è autorizzato per questa app. Puoi permetterlo dalle impostazioni del telefono, oppure usare il microfono della tastiera 🫶🏻");
        else if (e.error !== "no-speech" && e.error !== "aborted") setErrMic("Non siamo riusciti ad ascoltarti: riprova, oppure usa il microfono della tastiera 🫶🏻");
        setAscolto(false);
      };
      r.onend = () => setAscolto(false);
      recRef.current = r; r.start(); setAscolto(true);
    } catch (e) { setErrMic("Il microfono non è partito: usa quello della tastiera 🫶🏻"); setAscolto(false); }
  };

  const interpreta = () => {
    ferma();
    const { pasto: p, righe: r } = righeDa(testo, foods);
    if (p) setPasto(p);
    setRighe(r);
    setAperti({});
  };

  const cambiaRiga = (id, patch) => setRighe((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const scegliFood = (r, fid) => {
    const f = r.cand.find((c) => c.id === fid) || null;
    const { q, nota } = quantitaPer(f, r.seg);
    cambiaRiga(r.id, { sel: f ? f.id : null, qty: q == null ? r.qty : String(q), nota });
  };

  const valida = (r) => { const q = Number(String(r.qty).replace(",", ".")); return q > 0; };
  const pronto = righe && righe.length > 0 && righe.every(valida);

  const salva = async () => {
    if (!pronto) return;
    setSalvando(true);
    const daInserire = righe.map((r) => {
      const q = Number(String(r.qty).replace(",", "."));
      const f = r.cand.find((c) => c.id === r.sel);
      const base = { client_id: clientId, data: date, pasto, creato_da: isAdmin ? "coach" : "cliente" };
      if (f) {
        const mac = hasMacro(f) ? { p: round1((f.proteine * q) / f.per), c: round1((f.carboidrati * q) / f.per), g: round1((f.grassi * q) / f.per) } : null;
        return {
          ...base, food_id: f.comune ? null : f.id || null, nome: f.nome, marca: f.marca || null, unit: f.unit, uname: f.uname || null,
          quantita: q, kcal: foodKcal(f, q), proteine: mac?.p ?? null, carboidrati: mac?.c ?? null, grassi: mac?.g ?? null,
          sale: f.sale != null ? round2((f.sale * q) / f.per) : null, da_completare: false,
        };
      }
      const pz = !r.seg.unita || (UNITA[r.seg.unita] && UNITA[r.seg.unita].t === "pz");
      const u = r.seg.unita && UNITA[r.seg.unita] ? UNITA[r.seg.unita].t : null;
      return {
        ...base, food_id: null, nome: cap(r.frase), marca: null,
        unit: u === "ml" ? "ml" : pz && !u ? "pz" : u === "pz" ? "pz" : "g", uname: pz ? "pezzo" : null,
        quantita: q, kcal: 0, proteine: null, carboidrati: null, grassi: null, sale: null, da_completare: true,
      };
    });
    const { error } = await supabase.from("kcal_voci").insert(daInserire);
    setSalvando(false);
    if (error) { alert("Non siamo riusciti a salvare: riprova tra un attimo 🫶🏻"); return; }
    onFatto();
  };

  const nomePasto = (MEALS.find((m) => m[0] === pasto) || [0, pasto])[1];

  return (
    <div className="fixed inset-0 bg-black/50 z-[66] flex items-end sm:items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) { ferma(); onChiudi(); } }}>
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4">
        {!righe ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold" style={{ color: "#27466D" }}>Racconta il pasto</h3>
                <p className="text-xs mt-1" style={{ color: "#7a8da3" }}>Esempio: «150 grammi di pasta, 100 grammi di petto di pollo, due uova»</p>
              </div>
              <button onClick={() => { ferma(); onChiudi(); }} className="flex-shrink-0" style={{ color: "#7a8da3" }}><X size={20} /></button>
            </div>
            {SR && (
              <div className="text-center">
                <button onClick={ascolto ? ferma : avvia} className="mx-auto w-20 h-20 rounded-full flex items-center justify-center text-white" style={{ background: "#27466D", boxShadow: ascolto ? "0 0 0 8px #C9E0F7, 0 0 0 16px #E1EEFB" : "0 0 0 6px #E1EEFB" }} aria-label={ascolto ? "Ferma" : "Parla"}>
                  <Mic size={32} />
                </button>
                <p className="text-xs font-semibold mt-3" style={{ color: ascolto ? "#3F78B3" : "#7a8da3" }}>{ascolto ? "Ti ascolto… tocca per fermare" : "Tocca il microfono e parla"}</p>
              </div>
            )}
            {errMic && <p className="text-xs rounded-xl px-3 py-2" style={{ background: "#FFFBEF", border: "1px solid #F7E9BE", color: "#27466D" }}>{errMic}</p>}
            <textarea value={testo} onChange={(e) => setTesto(e.target.value)} rows={4} placeholder="Scrivi qui, oppure usa il microfono della tastiera del telefono"
              className="w-full rounded-xl px-3 py-2.5 text-sm" style={{ border: "1px solid #C9E0F7", background: "#F5FAFE", color: "#27466D" }} />
            <p className="text-xs" style={{ color: "#7a8da3" }}>Cerco solo alimenti singoli della libreria. Quello che non trovo lo segno «da completare» 🫶🏻</p>
            <button onClick={interpreta} disabled={!testo.trim()} className="w-full text-white text-sm font-semibold rounded-xl py-3 disabled:opacity-40" style={{ background: "#27466D" }}>Interpreta</button>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold" style={{ color: "#27466D" }}>Ho capito questo ✨</h3>
                <p className="text-xs mt-1" style={{ color: "#7a8da3" }}>Controlla alimenti e quantità, poi aggiungi a {nomePasto}.</p>
              </div>
              <button onClick={() => { ferma(); onChiudi(); }} className="flex-shrink-0" style={{ color: "#7a8da3" }}><X size={20} /></button>
            </div>
            <div className="flex gap-1.5">
              {MEALS.map(([k, l]) => (
                <button key={k} onClick={() => setPasto(k)} className="flex-1 text-xs rounded-xl py-2 font-semibold" style={pasto === k ? { background: "#27466D", color: "#fff" } : { background: "#E1EEFB", color: "#27466D" }}>{l}</button>
              ))}
            </div>
            {!righe.length && <p className="text-sm" style={{ color: "#7a8da3" }}>Non ho capito nessun alimento. Prova a dirlo con la quantità, ad esempio «100 grammi di riso».</p>}
            <div>
              {righe.map((r) => {
                const f = r.cand.find((c) => c.id === r.sel) || null;
                const q = Number(String(r.qty).replace(",", "."));
                const ok = q > 0;
                const kc = f && ok ? Math.round(foodKcal(f, q)) : null;
                const aperto = !!aperti[r.id];
                const dett = f && ok ? {
                  p: hasMacro(f) ? round1((f.proteine * q) / f.per) : null, c: hasMacro(f) ? round1((f.carboidrati * q) / f.per) : null,
                  g: hasMacro(f) ? round1((f.grassi * q) / f.per) : null, s: f.sale != null ? round2((f.sale * q) / f.per) : null,
                } : null;
                const unitaVista = f ? (f.unit === "pz" ? (f.uname || "pezzi").replace(/\s*\(.*\)/, "") : f.unit) : (r.seg.unita && UNITA[r.seg.unita] ? (UNITA[r.seg.unita].t === "pz" ? "pezzi" : UNITA[r.seg.unita].t) : "g");
                return (
                  <div key={r.id} className="py-2.5" style={{ borderBottom: "1px solid #E1EEFB" }}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        {r.cand.length ? (
                          <select value={r.sel || ""} onChange={(e) => scegliFood(r, e.target.value)} className="w-full text-sm font-semibold rounded-lg px-2 py-1.5 bg-white" style={{ border: "1px solid #C9E0F7", color: "#27466D" }}>
                            {r.cand.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.marca ? ` · ${c.marca}` : ""}</option>)}
                            <option value="">Non in libreria (da completare)</option>
                          </select>
                        ) : <div className="text-sm font-semibold" style={{ color: "#27466D" }}>{cap(r.frase)}</div>}
                        {f ? <p className="text-[11px] mt-1" style={{ color: "#3F78B3" }}>✓ nella libreria{f.marca ? ` · ${f.marca}` : ""}</p>
                          : <span className="inline-block mt-1 text-[11px] rounded-lg px-2 py-0.5" style={{ background: "#FFFBEF", border: "1px solid #F7E9BE", color: "#27466D" }}>non in libreria · da completare{r.cand.length ? "" : ` («${r.frase}»)`}</span>}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="flex items-center gap-1">
                          <input type="number" inputMode="decimal" step="any" min="0" value={r.qty} onChange={(e) => cambiaRiga(r.id, { qty: e.target.value, nota: null })}
                            className="w-16 text-center text-sm font-semibold rounded-lg px-1 py-1.5" style={{ border: `1px solid ${ok ? "#C9E0F7" : "#F7E9BE"}`, color: "#27466D", background: ok ? "#fff" : "#FFFBEF" }} />
                          <span className="text-xs" style={{ color: "#7a8da3" }}>{unitaVista}</span>
                        </div>
                        <div className="text-xs font-semibold mt-1" style={{ color: "#27466D" }}>{f ? (kc == null ? "" : kc + " kcal") : "—"}</div>
                      </div>
                      <button onClick={() => setRighe((rs) => rs.filter((x) => x.id !== r.id))} className="flex-shrink-0 pt-1.5" style={{ color: "#7a8da3" }} aria-label="Togli"><X size={16} /></button>
                    </div>
                    {r.nota && <p className="text-[11px] mt-1" style={{ color: "#27466D" }}>{r.nota}</p>}
                    {r.cottoCrudo && f && <p className="text-[11px] mt-1" style={{ color: "#27466D" }}>Controlla: l'alimento è cotto o crudo? Il peso cambia molto.</p>}
                    {f && (
                      <button onClick={() => setAperti((a) => ({ ...a, [r.id]: !aperto }))} className="mt-1.5 text-[11px] font-semibold flex items-center gap-1" style={{ color: "#3F78B3" }}>
                        Dettagli {aperto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    )}
                    {f && aperto && (
                      <div className="mt-1.5 rounded-xl p-3 text-xs space-y-1" style={{ background: "#F5FAFE", border: "1px solid #C9E0F7", color: "#27466D" }}>
                        <div className="font-semibold">{f.nome}</div>
                        <div style={{ color: "#7a8da3" }}>{f.marca || "Senza marchio"} · valori per {perLabel(f)}: {num(f.kcal)} kcal</div>
                        {dett ? (
                          <div className="grid grid-cols-5 gap-1 pt-1.5 text-center">
                            {[["kcal", kc], ["Prot.", dett.p], ["Carb.", dett.c], ["Grassi", dett.g], ["Sale", dett.s]].map(([l, v]) => (
                              <div key={l} className="rounded-lg py-1.5" style={{ background: l === "Sale" ? "#E1EEFB" : "#fff", border: "1px solid #E1EEFB" }}>
                                <div className="font-bold">{v == null ? "—" : num(v)}</div><div className="text-[10px]" style={{ color: "#7a8da3" }}>{l}{l === "kcal" ? "" : " g"}</div>
                              </div>
                            ))}
                          </div>
                        ) : <div style={{ color: "#7a8da3" }}>Inserisci la quantità per vedere i valori.</div>}
                        {dett && (dett.p == null || dett.s == null) && <div style={{ color: "#7a8da3" }}>«—» = dato non ancora inserito: i totali del giorno saranno parziali.</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {righe.some((r) => !r.sel) && <p className="text-xs" style={{ color: "#7a8da3" }}>Gli alimenti «da completare» li segno comunque, così non te li dimentichi: i valori si aggiungono dopo 🫶🏻</p>}
            {righe.length > 0 && !pronto && <p className="text-xs font-semibold" style={{ color: "#27466D" }}>Manca la quantità di qualche alimento: scrivila nel riquadro giallo.</p>}
            <div className="flex gap-2">
              <button onClick={salva} disabled={!pronto || salvando} className="flex-1 text-white text-sm font-semibold rounded-xl py-3 disabled:opacity-40" style={{ background: "#27466D" }}>{salvando ? "Salvo..." : `Aggiungi a ${nomePasto}`}</button>
              <button onClick={() => setRighe(null)} className="px-4 text-sm font-semibold rounded-xl" style={{ border: "1px solid #C9E0F7", color: "#27466D" }}>Indietro</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Completa una voce "da completare": valori totali per la quantità    */
/* ------------------------------------------------------------------ */
export function CompletaVoce({ voce, clientId, isAdmin, onChiudi, onFatto }) {
  const [kcal, setKcal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [g, setG] = useState("");
  const [s, setS] = useState("");
  const [salvaLib, setSalvaLib] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const n = (x) => { const v = Number(String(x).replace(",", ".")); return x === "" || isNaN(v) ? null : v; };
  const q = Number(voce.quantita);

  const salva = async () => {
    if (n(kcal) == null) return;
    setSalvando(true);
    await supabase.from("kcal_voci").update({ kcal: n(kcal), proteine: n(p), carboidrati: n(c), grassi: n(g), sale: n(s), da_completare: false }).eq("id", voce.id);
    if (salvaLib && q > 0) {
      const per = voce.unit === "pz" ? 1 : 100;
      const f = per / q;
      const sc = (x) => (n(x) == null ? null : Math.round(n(x) * f * 100) / 100);
      const riga = { nome: voce.nome, marca: voce.marca || null, unit: voce.unit, uname: voce.unit === "pz" ? (voce.uname || "pezzo") : null, per, kcal: sc(kcal), proteine: sc(p), carboidrati: sc(c), grassi: sc(g), sale: sc(s) };
      try {
        if (isAdmin) await supabase.from("kcal_foods_comuni").insert(riga);
        else await supabase.from("kcal_foods").insert({ ...riga, client_id: clientId });
      } catch (e) { /* la voce è comunque completata */ }
    }
    setSalvando(false);
    onFatto();
  };
  const elimina = async () => { await supabase.from("kcal_voci").delete().eq("id", voce.id); onFatto(); };
  const campo = (label, v, set) => (
    <div>
      <label className="text-xs block mb-1" style={{ color: "#7a8da3" }}>{label}</label>
      <input type="number" inputMode="decimal" step="any" min="0" value={v} onChange={(e) => set(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ border: "1px solid #C9E0F7", color: "#27466D" }} />
    </div>
  );
  return (
    <div className="fixed inset-0 bg-black/50 z-[66] flex items-end sm:items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onChiudi(); }}>
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl max-h-[88vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: "#27466D" }}>Completa «{voce.nome}»</h3>
            <p className="text-xs mt-1" style={{ color: "#7a8da3" }}>Valori totali per {voce.unit === "pz" ? `${num(q)} ${voce.uname || "pezzi"}` : `${num(q)} ${voce.unit}`}. Li trovi sull'etichetta: moltiplica i valori «per 100 g» per la quantità.</p>
          </div>
          <button onClick={onChiudi} className="flex-shrink-0" style={{ color: "#7a8da3" }}><X size={20} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {campo("Kcal", kcal, setKcal)}{campo("Proteine (g)", p, setP)}{campo("Carboidrati (g)", c, setC)}{campo("Grassi (g)", g, setG)}{campo("Sale (g)", s, setS)}
        </div>
        <label className="flex items-start gap-2 text-xs" style={{ color: "#27466D" }}>
          <input type="checkbox" checked={salvaLib} onChange={(e) => setSalvaLib(e.target.checked)} className="mt-0.5" />
          <span>{isAdmin ? "Aggiungilo alla libreria di tutte le clienti, così la prossima volta lo riconosce da solo" : "Salvalo nei miei alimenti, così la prossima volta lo riconosce da solo"}</span>
        </label>
        <div className="flex gap-2">
          <button onClick={salva} disabled={salvando || n(kcal) == null} className="flex-1 text-white text-sm font-semibold rounded-xl py-3 disabled:opacity-40" style={{ background: "#27466D" }}>{salvando ? "Salvo..." : "Salva"}</button>
          <button onClick={elimina} className="px-4 text-sm font-semibold rounded-xl" style={{ border: "1px solid #C9E0F7", color: "#27466D" }}>Elimina</button>
        </div>
      </div>
    </div>
  );
}
