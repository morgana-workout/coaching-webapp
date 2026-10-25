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

export default function AnalisiCibo({ client }) {
  const [giorni, setGiorni] = useState(14);
  const [voci, setVoci] = useState(null);
  const [piano, setPiano] = useState(null);
  const [imp, setImp] = useState({ prep: false, fase: null });
  const [invio, setInvio] = useState(false);
  const [inviato, setInviato] = useState(false);

  const oggi = fmt(new Date());
  const da = addG(oggi, -(giorni - 1));

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
      if (!vivo) return;
      setPiano(client.nutrizione_attiva === false ? null : pianoAttivoLocale(p));
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
      const g = (perGiorno[v.data] = perGiorno[v.data] || { data: v.data, kcal: 0, p: 0, c: 0, g: 0, pasti: new Set(), voci: [] });
      g.kcal += Number(v.kcal) || 0; g.p += Number(v.proteine) || 0; g.c += Number(v.carboidrati) || 0; g.g += Number(v.grassi) || 0;
      if (v.pasto) g.pasti.add(v.pasto);
      g.voci.push(v);
    });
    const tutti = [];
    for (let i = 0; i < giorni; i++) { const d = addG(da, i); tutti.push(perGiorno[d] || { data: d, kcal: 0, p: 0, c: 0, g: 0, pasti: new Set(), voci: [] }); }
    const compilati = tutti.filter((g) => g.kcal > 0);
    const media = (campo, lista = compilati) => (lista.length ? lista.reduce((t, g) => t + g[campo], 0) / lista.length : 0);
    const mk = media("kcal"), mp = media("p"), mc = media("c"), mg = media("g");
    const weekend = compilati.filter((g) => [0, 6].includes(dow(g.data)));
    const feriali = compilati.filter((g) => ![0, 6].includes(dow(g.data)));
    const mkW = media("kcal", weekend), mkF = media("kcal", feriali);
    const incompleti = compilati.filter((g) => g.pasti.size < 3);
    const senzaCena = compilati.filter((g) => !g.pasti.has("cena"));
    const kcalCena = compilati.reduce((t, g) => t + g.voci.filter((v) => v.pasto === "cena").reduce((s, v) => s + (Number(v.kcal) || 0), 0), 0);
    const kcalTot = compilati.reduce((t, g) => t + g.kcal, 0);
    const quota = kcalTot ? kcalCena / kcalTot : 0;
    // alimenti che pesano di più
    const alim = {};
    voci.forEach((v) => { const k = `${v.nome}${v.marca ? " " + v.marca : ""}`; alim[k] = (alim[k] || 0) + (Number(v.kcal) || 0); });
    const top = Object.entries(alim).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { tutti, compilati, mk, mp, mc, mg, mkW, mkF, weekend, feriali, incompleti, senzaCena, quota, top };
  }, [voci, giorni]);

  if (!analisi) return <p className="text-slate-400 text-sm px-1">Carico il diario...</p>;
  const a = analisi;
  const prep = imp.prep;
  const fase = imp.fase;
  const peso = Number(client.peso_kg) || null;

  // ---- errori (soglie più strette se in prep) ----
  const err = [];
  const push = (livello, testo) => err.push({ livello, testo });
  const soglia = prep ? 0.05 : 0.1;
  const quotaGiorni = a.compilati.length / giorni;
  if (a.compilati.length === 0) push("r", "Nessun giorno compilato nel periodo: non riesco a valutare cosa mangia.");
  else {
    if (quotaGiorni < (prep ? 0.9 : 0.6)) push(prep ? "r" : "a", `Diario compilato ${a.compilati.length} giorni su ${giorni}${prep ? ": in prep serve tutti i giorni" : ""}.`);
    if (a.incompleti.length >= Math.max(2, a.compilati.length * 0.3)) push("a", `${a.incompleti.length} giorni con meno di 3 pasti segnati: i totali potrebbero essere sottostimati.`);
    if (a.senzaCena.length >= Math.max(2, a.compilati.length * 0.3)) push("a", `Cena mancante in ${a.senzaCena.length} giorni.`);
    if (a.weekend.length && a.feriali.length) {
      const diff = a.mkW - a.mkF;
      if (diff > a.mkF * (prep ? 0.1 : 0.15)) push("r", `Weekend fuori controllo: sabato e domenica +${n0(diff)} kcal rispetto ai giorni feriali.`);
      else if (-diff > a.mkF * 0.2) push("a", `Nel weekend mangia molto meno (-${n0(-diff)} kcal): rischio di recupero con le abbuffate.`);
    }
    if (a.quota > 0.45) push("a", `La cena pesa il ${Math.round(a.quota * 100)}% delle kcal giornaliere.`);
    if (piano) {
      const tk = Number(piano.kcal), tp = Number(piano.proteine_g), tc = Number(piano.carboidrati_g), tg = Number(piano.grassi_g);
      const dk = (a.mk - tk) / tk;
      if (fase === "cut" && dk > 0.03) push("r", `In cut ma mangia ${n0(a.mk - tk)} kcal sopra il piano in media.`);
      else if (fase === "leanbulk" && dk < -0.03) push("r", `In lean bulk ma mangia ${n0(tk - a.mk)} kcal sotto il piano: non sta crescendo come dovrebbe.`);
      else if (Math.abs(dk) > soglia) push(dk > 0 ? "r" : "a", `Media ${dk > 0 ? "sopra" : "sotto"} il piano di ${n0(Math.abs(a.mk - tk))} kcal.`);
      if (tp && a.mp < tp * (prep ? 0.95 : 0.9)) push("r", `Proteine basse: ${Math.round((a.mp / tp) * 100)}% del target.`);
      if (tc && Math.abs(a.mc - tc) / tc > (prep ? 0.12 : 0.2)) push("a", `Carboidrati ${a.mc > tc ? "sopra" : "sotto"} il piano di ${n0(Math.abs(a.mc - tc))} g.`);
      if (tg && a.mg > tg * (prep ? 1.1 : 1.2)) push("a", `Grassi sopra il piano di ${n0(a.mg - tg)} g.`);
    } else if (peso) {
      const gk = a.mp / peso;
      const minimo = prep || fase === "cut" ? 2.0 : 1.6;
      if (gk < minimo) push("r", `Proteine basse: ${gk.toFixed(1)} g per kg (ne servirebbero almeno ${minimo.toFixed(1)}).`);
    }
  }
  if (err.length && !err.some((e) => e.livello === "r" || e.livello === "a")) err.length = 0;
  const ok = a.compilati.length > 0 && err.length === 0;

  const datiGrafico = a.tutti.map((g) => ({ data: breve(g.data), Proteine: g.kcal ? n0(g.p) : null, Carboidrati: g.kcal ? n0(g.c) : null, Grassi: g.kcal ? n0(g.g) : null, kcal: g.kcal ? n0(g.kcal) : null }));
  const colori = { r: "bg-rose-50 text-rose-700", a: "bg-amber-50 text-amber-700", g: "bg-emerald-50 text-emerald-700" };
  const icone = { r: "🔴", a: "🟡", g: "🟢" };

  const scrivi = async () => {
    const nome1 = (client.nome || "").trim().split(" ")[0];
    const punti = err.filter((e) => e.livello !== "g").slice(0, 3).map((e) => `• ${e.testo}`).join("\n");
    const testo = `Ciao ${nome1}! 🫶🏻 Ho guardato il tuo diario alimentare e vorrei parlarne con te:\n\n${punti}\n\nNiente di grave, sistemiamo insieme 💪🏻 Scrivimi pure come ti sembra sia andata la settimana ✨`;
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

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Cosa mangia davvero · diario</p>
        <p className="text-[11px] text-slate-400 -mt-2">Solo per te, la cliente non lo vede.</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-700">In prep gara</span>
          <button onClick={() => salvaImp({ prep: !prep })} className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors ${prep ? "bg-emerald-500 justify-end" : "bg-slate-300 justify-start"}`}><span className="w-5 h-5 bg-white rounded-full shadow" /></button>
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

      {a.compilati.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="flex gap-3 text-[11px] text-slate-600">
            <span><i className="inline-block w-2 h-2 rounded-full bg-sky-500 mr-1" />Proteine</span>
            <span><i className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Carbo</span>
            <span><i className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />Grassi</span>
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
                <Line type="monotone" dataKey="Carboidrati" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                <Line type="monotone" dataKey="Grassi" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium pt-1">Media al giorno{piano ? " vs piano" : ""}</p>
          <Barra etichetta="Kcal" valore={n0(a.mk)} target={piano ? Number(piano.kcal) : null} colore="bg-slate-500" />
          <Barra etichetta="Proteine g" valore={n0(a.mp)} target={piano ? Number(piano.proteine_g) : null} colore="bg-sky-500" />
          <Barra etichetta="Carboidrati g" valore={n0(a.mc)} target={piano ? Number(piano.carboidrati_g) : null} colore="bg-emerald-500" />
          <Barra etichetta="Grassi g" valore={n0(a.mg)} target={piano ? Number(piano.grassi_g) : null} colore="bg-amber-500" />
          {!piano && <p className="text-[11px] text-slate-400">Nessun piano attivo: vedi solo cosa mangia, senza confronto.{peso ? ` Proteine: ${(a.mp / peso).toFixed(1)} g per kg.` : ""}</p>}
        </Card>
      )}

      <Card className="p-4 space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Cosa non va</p>
        {err.map((e, i) => <div key={i} className={`${colori[e.livello]} rounded-xl px-3 py-2 text-[13px] leading-snug`}>{icone[e.livello]} {e.testo}</div>)}
        {ok && <div className={`${colori.g} rounded-xl px-3 py-2 text-[13px]`}>🟢 Tutto in linea nel periodo ✨</div>}
        {err.length > 0 && (inviato
          ? <p className="text-emerald-600 text-xs pt-1">Messaggio inviato ✓</p>
          : <button onClick={scrivi} disabled={invio} className="text-sky-700 text-[13px] font-medium pt-1 disabled:opacity-50">✨ Scrivi un messaggio su questo →</button>)}
      </Card>

      {a.compilati.length > 0 && (
        <Card className="p-4 space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium pb-1">Giorno per giorno</p>
          {[...a.tutti].reverse().map((g) => (
            <div key={g.data} className="flex justify-between items-center text-xs border-t border-slate-100 py-1.5 text-slate-700">
              <span className="text-slate-500 w-20">{GIORNI[dow(g.data)]} {breve(g.data)}</span>
              {g.kcal > 0 ? <><span className="font-medium">{n0(g.kcal)} kcal</span><span className="text-slate-400">P{n0(g.p)} C{n0(g.c)} G{n0(g.g)}</span></> : <span className="text-slate-300 flex-1 text-right">non compilato</span>}
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
