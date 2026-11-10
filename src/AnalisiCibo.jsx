import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

/* Solo coach: cosa mangiano DAVVERO le clienti (diario alimentare), con andamento, errori e confronto col piano se c'è. */

function pad(n) { return n < 10 ? "0" + n : "" + n; }
function fmt(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function addG(s, n) { const p = s.split("-"); const d = new Date(+p[0], +p[1] - 1, +p[2]); d.setDate(d.getDate() + n); return fmt(d); }
function dow(s) { const p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).getDay(); } // 0 = domenica
function breve(s) { return s.split("-").reverse().slice(0, 2).join("/"); }
const GIORNI = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const n0 = (v) => Math.round(Number(v) || 0);

function pianoAttivoLocale(lista) {
  const oggi = fmt(new Date());
  const k = (r) => r.data_inizio || r.data_aggiornamento || "";
  const iniz = (lista || []).filter((r) => r.kcal != null && k(r) && k(r) <= oggi);
  const validi = iniz.filter((r) => !r.data_fine || r.data_fine >= oggi);
  const pool = validi.length ? validi : iniz;
  return [...pool].sort((a, b) => k(b).localeCompare(k(a)) || (b.created_at || "").localeCompare(a.created_at || ""))[0] || null;
}

function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>{children}</div>;
}

function Barra({ etichetta, valore, target, colore }) {
  const perc = target ? Math.min(100, (valore / target) * 100) : 100;
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-600"><span>{etichetta}</span><span><b className="text-slate-800">{valore}</b>{target ? ` / ${target}` : ""}</span></div>
      <div className="h-2 bg-slate-100 rounded-full mt-1 overflow-hidden"><div className={`h-full rounded-full ${colore}`} style={{ width: `${perc}%` }} /></div>
    </div>
  );
}

// pendenza del peso (kg/settimana) dai check: regressione lineare sugli ultimi ~8 settimane; serve almeno 2 check a >= 10 giorni di distanza
function trendPeso(checks) {
  const oggi = fmt(new Date());
  const da = addG(oggi, -56);
  const pts = (checks || []).filter((c) => c.peso_kg != null && c.data_check && c.data_check >= da).map((c) => ({ t: Math.round((new Date(c.data_check + "T12:00:00") - new Date(da + "T12:00:00")) / 86400000), kg: Number(c.peso_kg) })).sort((a, b) => a.t - b.t);
  if (pts.length < 2 || pts[pts.length - 1].t - pts[0].t < 10) return null;
  const n = pts.length, mt = pts.reduce((x, p) => x + p.t, 0) / n, mk = pts.reduce((x, p) => x + p.kg, 0) / n;
  const num = pts.reduce((x, p) => x + (p.t - mt) * (p.kg - mk), 0), den = pts.reduce((x, p) => x + (p.t - mt) ** 2, 0);
  if (!den) return null;
  const kgSett = (num / den) * 7;
  return { kgSett, pct: (kgSett / mk) * 100, n, primo: pts[0].kg, ultimo: pts[n - 1].kg, giorni: pts[n - 1].t - pts[0].t, pesoMedio: mk };
}

export default function AnalisiCibo({ client }) {
  const [giorni, setGiorni] = useState(14);
  const [voci, setVoci] = useState(null);
  const [piano, setPiano] = useState(null);
  const [checks, setChecks] = useState([]);
  const [imp, setImp] = useState({ prep: false, fase: null });
  const [invio, setInvio] = useState(false);
  const [inviato, setInviato] = useState(false);

  const oggi = fmt(new Date());
  const da = addG(oggi, -(giorni - 1));
  const daNutrizionista = !!client.seguita_da_nutrizionista;

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: v } = await supabase.from("kcal_voci").select("data, pasto, nome, marca, quantita, kcal, proteine, carboidrati, grassi").eq("client_id", client.id).gte("data", da).lte("data", oggi).order("data").limit(5000);
      if (vivo) setVoci(v || []);
    })();
    return () => { vivo = false; };
  }, [client.id, giorni]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: p } = await supabase.from("nutrition_plans").select("*").eq("client_id", client.id);
      const { data: i } = await supabase.from("analisi_cibo_impostazioni").select("*").eq("client_id", client.id).maybeSingle();
      const { data: ck } = await supabase.from("checkins").select("data_check, peso_kg").eq("client_id", client.id).order("data_check");
      if (!vivo) return;
      setPiano(client.nutrizione_attiva === false && !daNutrizionista ? null : pianoAttivoLocale(p));
      setChecks(ck || []);
      if (i) setImp({ prep: !!i.prep, fase: i.fase || null });
    })();
    return () => { vivo = false; };
  }, [client.id]);

  const salvaImp = async (patch) => {
    const nuovo = { ...imp, ...patch };
    setImp(nuovo);
    await supabase.from("analisi_cibo_impostazioni").upsert({ client_id: client.id, prep: nuovo.prep, fase: nuovo.fase, updated_at: new Date().toISOString() });
  };

  const analisi = useMemo(() => {
    if (!voci) return null;
    const perGiorno = {};
    voci.forEach((v) => {
      const g = (perGiorno[v.data] = perGiorno[v.data] || { data: v.data, kcal: 0, p: 0, c: 0, g: 0, pasti: new Set(), voci: [], dettaglio: false, totali: false });
      g.kcal += Number(v.kcal) || 0; g.p += Number(v.proteine) || 0; g.c += Number(v.carboidrati) || 0; g.g += Number(v.grassi) || 0;
      if (v.pasto === "totale") g.totali = true; else { g.dettaglio = true; if (v.pasto) g.pasti.add(v.pasto); }
      g.voci.push(v);
    });
    const tutti = [];
    for (let i = 0; i < giorni; i++) { const d = addG(da, i); tutti.push(perGiorno[d] || { data: d, kcal: 0, p: 0, c: 0, g: 0, pasti: new Set(), voci: [], dettaglio: false, totali: false }); }
    const compilati = tutti.filter((g) => g.kcal > 0);
    const dettagliati = compilati.filter((g) => g.dettaglio);
    const soloTotali = compilati.filter((g) => !g.dettaglio && g.totali);
    const media = (campo, lista = compilati) => (lista.length ? lista.reduce((t, g) => t + g[campo], 0) / lista.length : 0);
    const mk = media("kcal"), mp = media("p"), mc = media("c"), mg = media("g");
    const weekend = compilati.filter((g) => [0, 6].includes(dow(g.data)));
    const feriali = compilati.filter((g) => ![0, 6].includes(dow(g.data)));
    const mkW = media("kcal", weekend), mkF = media("kcal", feriali);
    // controlli sui pasti: solo sui giorni in cui l'alimentazione è registrata alimento per alimento
    const incompleti = dettagliati.filter((g) => g.pasti.size < 3);
    const senzaCena = dettagliati.filter((g) => !g.pasti.has("cena"));
    const kcalCena = dettagliati.reduce((t, g) => t + g.voci.filter((v) => v.pasto === "cena").reduce((s, v) => s + (Number(v.kcal) || 0), 0), 0);
    const kcalTotDett = dettagliati.reduce((t, g) => t + g.kcal, 0);
    const quota = kcalTotDett ? kcalCena / kcalTotDett : 0;
    const alim = {};
    voci.filter((v) => v.pasto !== "totale").forEach((v) => { const k = `${v.nome}${v.marca ? " " + v.marca : ""}`; alim[k] = (alim[k] || 0) + (Number(v.kcal) || 0); });
    const top = Object.entries(alim).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { tutti, compilati, dettagliati, soloTotali, mk, mp, mc, mg, mkW, mkF, weekend, feriali, incompleti, senzaCena, quota, top };
  }, [voci, giorni]);

  if (!analisi) return <p className="text-slate-400 text-sm px-1">Carico i dati...</p>;
  const a = analisi;
  const prep = imp.prep;
  const fase = imp.fase;
  const tp = trendPeso(checks);
  const ultimoCheckPeso = [...checks].filter((c) => c.peso_kg != null).pop();
  const peso = Number(ultimoCheckPeso?.peso_kg) || Number(client.peso_kg) || null;
  const haIntake = a.compilati.length > 0;
  const haPiano = !!(piano && piano.kcal);
  const soglia = prep ? 0.05 : 0.1;

  // ---- fonti disponibili: si valuta solo ciò che c'è, quello che manca non viene penalizzato ----
  const fonti = [
    { ok: a.dettagliati.length > 0, t: `Diario alimento per alimento${a.dettagliati.length ? `: ${a.dettagliati.length} gg` : ""}` },
    { ok: a.soloTotali.length > 0, t: `Totali giornalieri inseriti${a.soloTotali.length ? `: ${a.soloTotali.length} gg` : ""}` },
    { ok: haPiano, t: daNutrizionista ? "Macros approssimativi della nutrizionista" : "Piano macros assegnato" },
    { ok: !!tp, t: tp ? `Trend del peso (${tp.n} check, ${tp.giorni} gg)` : "Trend del peso" },
  ];

  const err = [];
  const push = (livello, testo) => err.push({ livello, testo });

  // 1) aderenza all'intake registrato (solo se ci sono giorni registrati)
  if (haIntake) {
    if (prep && a.compilati.length / giorni < 0.9) push("r", `In prep: registrati ${a.compilati.length} giorni su ${giorni}, il monitoraggio è insufficiente per una valutazione affidabile.`);
    if (a.dettagliati.length >= 3) {
      if (a.incompleti.length >= Math.max(2, a.dettagliati.length * 0.3)) push("a", `${a.incompleti.length} giorni (tra quelli registrati alimento per alimento) con meno di 3 pasti: possibile under-reporting dell'intake.`);
      if (a.senzaCena.length >= Math.max(2, a.dettagliati.length * 0.3)) push("a", `Cena non registrata in ${a.senzaCena.length} giorni del diario dettagliato: dato incompleto.`);
      if (a.quota > 0.45) push("a", `Distribuzione energetica sbilanciata: la cena apporta il ${Math.round(a.quota * 100)}% dell'energia giornaliera.`);
    }
    if (a.weekend.length >= 2 && a.feriali.length >= 3) {
      const diff = a.mkW - a.mkF;
      if (diff > a.mkF * (prep ? 0.1 : 0.15)) push("r", `Aderenza ridotta nel weekend: intake +${n0(diff)} kcal rispetto ai giorni feriali.`);
      else if (-diff > a.mkF * 0.2) push("a", `Restrizione nel weekend (−${n0(-diff)} kcal): rischio di compenso con iperalimentazione.`);
    }
  }

  // 2) confronto con il piano (macros assegnati da te, o approssimativi della nutrizionista)
  if (haPiano) {
    const tk = Number(piano.kcal), tpro = Number(piano.proteine_g), tc = Number(piano.carboidrati_g), tg = Number(piano.grassi_g);
    if (haIntake && a.compilati.length >= 3) {
      const dk = (a.mk - tk) / tk;
      if (fase === "cut" && dk > 0.03) push("r", `In fase di deficit (cut): intake medio +${n0(a.mk - tk)} kcal rispetto al piano, bilancio energetico non negativo.`);
      else if (fase === "leanbulk" && dk < -0.03) push("r", `In fase di surplus (lean bulk): intake medio −${n0(tk - a.mk)} kcal rispetto al piano, surplus insufficiente per l'ipertrofia.`);
      else if (Math.abs(dk) > soglia) push(dk > 0 ? "r" : "a", `Intake medio ${dk > 0 ? "sopra" : "sotto"} il piano di ${n0(Math.abs(a.mk - tk))} kcal (sui ${a.compilati.length} giorni registrati).`);
      if (tpro && a.mp < tpro * (prep ? 0.95 : 0.9)) push("r", `Apporto proteico insufficiente: ${Math.round((a.mp / tpro) * 100)}% del target.`);
      if (tc && a.mc > 0 && Math.abs(a.mc - tc) / tc > (prep ? 0.12 : 0.2)) push("a", `Carboidrati ${a.mc > tc ? "superiori" : "inferiori"} al piano di ${n0(Math.abs(a.mc - tc))} g/die.`);
      if (tg && a.mg > tg * (prep ? 1.1 : 1.2)) push("a", `Lipidi superiori al piano di ${n0(a.mg - tg)} g/die.`);
    }
    // adeguatezza del piano stesso (non richiede alcun diario)
    if (peso && tpro) {
      const gk = tpro / peso;
      const minimo = prep || fase === "cut" ? 2.0 : 1.6;
      if (gk < minimo) push("a", `Piano con ${gk.toFixed(1)} g/kg di proteine: sotto l'intervallo indicato per ipertrofia/ritenzione di massa magra (≥ ${minimo.toFixed(1)} g/kg).`);
    }
    if (peso && tg && tg / peso < 0.6) push("a", `Piano con ${(tg / peso).toFixed(2).replace(".", ",")} g/kg di lipidi: sotto la soglia di ~0,6 g/kg utile per la funzione ormonale.`);
    if (tk && tpro != null && tc != null && tg != null) {
      const calc = tpro * 4 + tc * 4 + tg * 9;
      if (calc > 0 && Math.abs(calc - tk) / tk > 0.1) push("a", `Macros e kcal non coerenti: P·4 + C·4 + G·9 = ${n0(calc)} kcal contro ${n0(tk)} indicate.`);
    }
  } else if (haIntake && peso) {
    const gk = a.mp / peso;
    const minimo = prep || fase === "cut" ? 2.0 : 1.6;
    if (a.compilati.length >= 3 && a.mp > 0 && gk < minimo) push("r", `Apporto proteico insufficiente: ${gk.toFixed(1)} g/kg di peso corporeo (minimo indicato ${minimo.toFixed(1)} g/kg).`);
  }

  // 3) controllo incrociato con il peso: usa il dato più oggettivo disponibile
  if (tp) {
    const p = tp.pct;
    const sulPiano = haIntake && haPiano ? Math.abs((a.mk - Number(piano.kcal)) / Number(piano.kcal)) <= 0.07 : null;
    if (fase === "cut") {
      if (p > -0.1) push("a", `Peso ${p > 0.1 ? "in aumento" : "stabile"} (${tp.kgSett >= 0 ? "+" : ""}${tp.kgSett.toFixed(2).replace(".", ",")} kg/sett.) in fase di cut${sulPiano ? ": intake registrato in linea col piano, quindi verificare accuratezza del tracciamento (porzioni, condimenti, fuori pasto) e dispendio (NEAT)" : haPiano ? ": verificare l'aderenza al piano" : ""}.`);
      else if (p < -1) push("r", `Calo ponderale rapido (${tp.pct.toFixed(2).replace(".", ",")}% a settimana): rischio di perdita di massa magra, valutare di aumentare le kcal.`);
    } else if (fase === "leanbulk") {
      if (p < 0.05) push("a", `Peso non in aumento (${tp.kgSett >= 0 ? "+" : ""}${tp.kgSett.toFixed(2).replace(".", ",")} kg/sett.) in lean bulk: surplus non evidente${sulPiano ? " pur con intake in linea col piano: rivedere il surplus" : ""}.`);
      else if (p > 0.5) push("a", `Aumento ponderale rapido (+${tp.pct.toFixed(2).replace(".", ",")}% a settimana): quota di massa grassa probabilmente elevata, valutare di ridurre il surplus.`);
    } else if (Math.abs(p) > 0.5) push("a", `Variazione ponderale di ${tp.pct.toFixed(2).replace(".", ",")}% a settimana: coerente con l'obiettivo di ${fase === "recomp" ? "ricomposizione" : "questa fase"}?`);
  }

  if (err.length && !err.some((e) => e.livello === "r" || e.livello === "a")) err.length = 0;
  const datiPresenti = haIntake || haPiano || !!tp;
  const ok = datiPresenti && err.length === 0;

  const datiGrafico = a.tutti.map((g) => ({ data: breve(g.data), Proteine: g.kcal ? n0(g.p) : null, Carboidrati: g.kcal ? n0(g.c) : null, Grassi: g.kcal ? n0(g.g) : null }));
  const colori = { r: "bg-slate-800 text-white", a: "bg-slate-100 text-slate-700", g: "bg-sky-50 text-sky-700" };
  const icone = { r: "●", a: "◐", g: "✓" };

  const scrivi = async () => {
    const nome1 = (client.nome || "").trim().split(" ")[0];
    const punti = err.filter((e) => e.livello !== "g").slice(0, 3).map((e) => `• ${e.testo}`).join("\n");
    const testo = `Ciao ${nome1}! 🫶🏻 Ho guardato come sta andando l'alimentazione e vorrei parlarne con te:\n\n${punti}\n\nNiente di grave, sistemiamo insieme 💪🏻 Scrivimi pure come ti sembra sia andata la settimana ✨`;
    if (!confirm(`Mando questo messaggio a ${client.nome}?\n\n${testo}`)) return;
    setInvio(true);
    try {
      const { data: nm, error } = await supabase.from("messaggi").insert({ client_id: client.id, mittente: "coach", testo }).select("id").single();
      if (error) throw error;
      const { data: { session } } = await supabase.auth.getSession();
      if (session && nm?.id) supabase.functions.invoke("invia-push", { body: { evento: "messaggio", messaggio_id: nm.id }, headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => {});
      setInviato(true);
    } catch (e) { alert("Non sono riuscita a mandare il messaggio. Riprova."); }
    setInvio(false);
  };

  const Chip = ({ attivo, onClick, children }) => (
    <button onClick={onClick} className={`px-2.5 py-1 rounded-full text-xs font-medium ${attivo ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}>{children}</button>
  );

  const pk = haPiano ? Number(piano.kcal) : 0;
  const pctKcal = (g, k) => (pk && g ? Math.round(((g * k) / pk) * 100) : null);

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Analisi dell'alimentazione</p>
        <p className="text-[11px] text-slate-400 -mt-2">Solo per te, la cliente non lo vede. Si basa solo sui dati disponibili: quello che manca viene ignorato, non segnalato come errore.</p>
        <div className="space-y-1">
          {fonti.map((f) => <p key={f.t} className={`text-xs ${f.ok ? "text-slate-700" : "text-slate-300"}`}>{f.ok ? "✓" : "—"} {f.t}</p>)}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-700">In prep gara</span>
          <button onClick={() => salvaImp({ prep: !prep })} className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors ${prep ? "bg-sky-600 justify-end" : "bg-slate-300 justify-start"}`}><span className="w-5 h-5 bg-white rounded-full shadow" /></button>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Fase</p>
          <div className="flex gap-1.5 flex-wrap">
            <Chip attivo={!fase} onClick={() => salvaImp({ fase: null })}>Non indicata</Chip>
            <Chip attivo={fase === "recomp"} onClick={() => salvaImp({ fase: "recomp" })}>Recomp</Chip>
            <Chip attivo={fase === "cut"} onClick={() => salvaImp({ fase: "cut" })}>Cut</Chip>
            <Chip attivo={fase === "leanbulk"} onClick={() => salvaImp({ fase: "leanbulk" })}>Lean bulk</Chip>
          </div>
        </div>
        <div className="flex gap-1.5 pt-1">
          {[7, 14, 30, 90].map((g) => <Chip key={g} attivo={giorni === g} onClick={() => setGiorni(g)}>{g} gg</Chip>)}
        </div>
      </Card>

      {haPiano && (
        <Card className="p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">{daNutrizionista ? "Piano della nutrizionista (valori approssimativi)" : "Piano macros assegnato"}</p>
          <p className="text-sm text-slate-800 font-medium">{n0(piano.kcal)} kcal{peso ? ` · ${(Number(piano.kcal) / peso).toFixed(0)} kcal/kg` : ""}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["Proteine", piano.proteine_g, 4], ["Carboidrati", piano.carboidrati_g, 4], ["Grassi", piano.grassi_g, 9]].map(([l, g, k]) => (
              <div key={l} className="bg-slate-50 rounded-xl py-2">
                <p className="text-[11px] text-slate-500">{l}</p>
                <p className="text-sm font-semibold text-slate-800">{g != null ? `${n0(g)} g` : "—"}</p>
                <p className="text-[11px] text-slate-400">{g != null && peso ? `${(Number(g) / peso).toFixed(1).replace(".", ",")} g/kg` : ""}{pctKcal(Number(g), k) != null ? ` · ${pctKcal(Number(g), k)}%` : ""}</p>
              </div>
            ))}
          </div>
          {piano.note && <p className="text-xs text-slate-600 whitespace-pre-wrap border-t border-slate-100 pt-2"><span className="text-slate-400">Note sulla dieta: </span>{piano.note}</p>}
          {(piano.data_inizio || piano.data_aggiornamento) && <p className="text-[11px] text-slate-400">In vigore dal {(piano.data_inizio || piano.data_aggiornamento).split("-").reverse().join("/")}</p>}
        </Card>
      )}

      {tp && (
        <Card className="p-4 space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Trend del peso (check)</p>
          <p className="text-sm text-slate-800 font-medium">{tp.kgSett >= 0 ? "+" : ""}{tp.kgSett.toFixed(2).replace(".", ",")} kg a settimana · {tp.pct >= 0 ? "+" : ""}{tp.pct.toFixed(2).replace(".", ",")}%</p>
          <p className="text-[11px] text-slate-400">Da {tp.primo} a {tp.ultimo} kg in {tp.giorni} giorni, {tp.n} check (regressione lineare sulle ultime 8 settimane).</p>
        </Card>
      )}

      {haIntake && (
        <Card className="p-4 space-y-3">
          <div className="flex gap-3 text-[11px] text-slate-600">
            <span><i className="inline-block w-2 h-2 rounded-full bg-sky-500 mr-1" />Proteine</span>
            <span><i className="inline-block w-2 h-2 rounded-full bg-slate-800 mr-1" />Carbo</span>
            <span><i className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-1" />Grassi</span>
            <span className="text-slate-400">grammi al giorno</span>
          </div>
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer>
              <LineChart data={datiGrafico}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="data" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} width={34} />
                <Tooltip />
                <Line type="monotone" dataKey="Proteine" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                <Line type="monotone" dataKey="Carboidrati" stroke="#1e293b" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                <Line type="monotone" dataKey="Grassi" stroke="#94a3b8" strokeWidth={2} dot={{ r: 2 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium pt-1">Media al giorno sui {a.compilati.length} giorni registrati{haPiano ? " vs piano" : ""}</p>
          <Barra etichetta="Kcal" valore={n0(a.mk)} target={haPiano ? Number(piano.kcal) : null} colore="bg-slate-500" />
          <Barra etichetta="Proteine g" valore={n0(a.mp)} target={haPiano ? Number(piano.proteine_g) : null} colore="bg-sky-500" />
          <Barra etichetta="Carboidrati g" valore={n0(a.mc)} target={haPiano ? Number(piano.carboidrati_g) : null} colore="bg-slate-800" />
          <Barra etichetta="Grassi g" valore={n0(a.mg)} target={haPiano ? Number(piano.grassi_g) : null} colore="bg-slate-400" />
          {!haPiano && <p className="text-[11px] text-slate-400">Nessun piano attivo: vedi solo cosa mangia, senza confronto.{peso ? ` Proteine: ${(a.mp / peso).toFixed(1)} g per kg.` : ""}</p>}
        </Card>
      )}

      <Card className="p-4 space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Cosa emerge</p>
        {!datiPresenti && <p className="text-sm text-slate-500">Per ora non ci sono dati utili da valutare: servono un piano macros, il diario (anche solo i totali) o almeno 2 check con il peso a ≥10 giorni di distanza.</p>}
        {err.map((e, i) => <div key={i} className={`${colori[e.livello]} rounded-xl px-3 py-2 text-[13px] leading-snug`}>{icone[e.livello]} {e.testo}</div>)}
        {ok && <div className={`${colori.g} rounded-xl px-3 py-2 text-[13px]`}>✓ Tutto in linea sui dati disponibili ✨</div>}
        {err.length > 0 && (inviato
          ? <p className="text-sky-700 text-xs pt-1">Messaggio inviato ✓</p>
          : <button onClick={scrivi} disabled={invio} className="text-sky-700 text-[13px] font-medium pt-1 disabled:opacity-50">✨ Scrivi un messaggio su questo →</button>)}
      </Card>

      {haIntake && (
        <Card className="p-4 space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium pb-1">Giorno per giorno</p>
          {[...a.tutti].reverse().filter((g) => g.kcal > 0).map((g) => (
            <div key={g.data} className="flex justify-between items-center text-xs border-t border-slate-100 py-1.5 text-slate-700">
              <span className="text-slate-500 w-24">{GIORNI[dow(g.data)]} {breve(g.data)}{!g.dettaglio ? " · totali" : ""}</span>
              <span className="font-medium">{n0(g.kcal)} kcal</span><span className="text-slate-400">P{n0(g.p)} C{n0(g.c)} G{n0(g.g)}</span>
            </div>
          ))}
        </Card>
      )}

      {a.top.length > 0 && (
        <Card className="p-4 space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium pb-1">Alimenti che pesano di più (kcal nel periodo)</p>
          {a.top.map(([nome, k]) => <div key={nome} className="flex justify-between text-xs text-slate-700 border-t border-slate-100 py-1.5"><span className="truncate pr-2">{nome}</span><span className="text-slate-500">{n0(k)}</span></div>)}
        </Card>
      )}
    </div>
  );
}
