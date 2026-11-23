import Ic from "./Ic";
import { confermaApp } from "./Dialoghi";
import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { X, Plus, Utensils, ClipboardList, TrendingUp, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { AcquaCliente } from "./Acqua";
import { VoceAggiungi, CompletaVoce } from "./Voce";
import { RicetteVista, RicettaDettaglio, PastiVista, SceltaAggiunta, SalvaPastoModal, inserisciPasto } from "./MacrosExtra";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine,
} from "recharts";

/* ------------------------------------------------------------------ */
/* Helpers locali (lo stesso stile di App.jsx, duplicati qui perché   */
/* App.jsx non esporta i suoi componenti interni)                      */
/* ------------------------------------------------------------------ */
function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>{children}</div>;
}
function Spinner() {
  return <div className="flex justify-center pt-20"><div className="w-8 h-8 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" /></div>;
}

const MEALS = [["colazione", "Colazione"], ["pranzo", "Pranzo"], ["spuntini", "Spuntini"], ["cena", "Cena"]];

function pad(n) { return n < 10 ? "0" + n : "" + n; }
function fmtDate(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function todayStr() { return fmtDate(new Date()); }
function parseDate(s) { const p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); }
function round1(n) { return Math.round(n * 10) / 10; }
function round2(n) { return Math.round(n * 100) / 100; }
const SALE_RIF = 5; // g al giorno: riferimento OMS (indicativo)
function saleFor(f, amt) { return f && f.sale != null ? round2((f.sale * amt) / f.per) : null; }
const chiaveAl = (f) => [(f.nome || "").trim().toLowerCase(), (f.marca || "").trim().toLowerCase(), f.unit, Number(f.per), Number(f.kcal)].join("|");
function num(n) { return Number(n ?? 0).toLocaleString("it-IT", { maximumFractionDigits: 1 }); }

function foodKcal(f, amt) { return round1((f.kcal * amt) / f.per); }
function hasMacro(f) { return f && f.proteine != null && f.carboidrati != null && f.grassi != null; }
function macroFor(f, amt) {
  return hasMacro(f)
    ? { p: round1((f.proteine * amt) / f.per), c: round1((f.carboidrati * amt) / f.per), g: round1((f.grassi * amt) / f.per) }
    : null;
}
function perLabel(f) { return f.unit === "pz" ? "1 " + (f.uname || "pezzo") : num(f.per) + " " + f.unit; }
function amtLabel(unit, uname, amt) { return unit === "pz" ? num(amt) + " × " + (uname || "pezzo") : num(amt) + " " + unit; }
function mLine(m, sale) { return m ? `P ${num(m.p)} · C ${num(m.c)} · G ${num(m.g)}${sale != null ? ` · Sale ${num(sale)}` : ""}` : "Macro non inseriti"; }

/* ------------------------------------------------------------------ */
/* Componente principale — usato sia nell'area cliente sia, con       */
/* isAdmin, nella scheda cliente lato coach (stesso pattern di         */
/* DiarioAllenamento).                                                 */
/* ------------------------------------------------------------------ */
export default function DiarioKcal({ clientId, isAdmin = false, pianoNode = null, vistaIniziale = "diario", senzaDiario = false, soloPianoERicette = false }) {
  const [caricando, setCaricando] = useState(true);
  const [foods, setFoods] = useState([]);
  const [voci, setVoci] = useState([]);
  const [obiettivo, setObiettivo] = useState(null);
  const [vista, setVista] = useState(soloPianoERicette ? "piano" : senzaDiario ? "piano" : vistaIniziale); // diario | piano | ricette | pasti | storico | libreria | analisi
  const [ricette, setRicette] = useState([]);
  const [pasti, setPasti] = useState([]);
  const [ricettaAperta, setRicettaAperta] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [macroOb, setMacroOb] = useState(null);
  const [piani, setPiani] = useState([]);
  const [sez, setSez] = useState(vistaIniziale === "piano" && pianoNode ? "piano" : "oggi"); // oggi | piano | storico | altro | ricette | pasti | libreria | spesa

  const carica = async () => {
    if (senzaDiario && !soloPianoERicette) { setCaricando(false); return; }
    // libreria_con: eventuale persona con cui condivido gli alimenti (es. Morgana e Giacomo)
    const { data: cl } = await supabase.from("clients").select("nutrizione_attiva, libreria_con").eq("id", clientId).single();
    const idLibrerie = cl?.libreria_con ? [clientId, cl.libreria_con] : [clientId];
    const [{ data: fd }, { data: vc }] = await Promise.all([
      supabase.from("kcal_foods").select("*").in("client_id", idLibrerie).order("nome"),
      supabase.from("kcal_voci").select("*").eq("client_id", clientId).order("data"),
    ]);
    // Libreria comune (uguale per tutte le clienti) + alimenti personali non già presenti nella comune
    let comuni = [];
    try {
      const { data: cm } = await supabase.from("kcal_foods_comuni").select("*").order("nome");
      comuni = (cm || []).map((x) => ({ ...x, comune: true }));
    } catch (e) { /* senza libreria comune si usa quella personale */ }
    const chiaviComuni = new Set(comuni.map(chiaveAl));
    // una copia personale che ha il sale inserito sostituisce l'alimento comune identico (che non ha il dato)
    const chiaviPersConSale = new Set((fd || []).filter((f) => f.sale != null).map(chiaveAl));
    let alimenti = [...comuni.filter((c) => c.sale != null || !chiaviPersConSale.has(chiaveAl(c))), ...(fd || []).filter((f) => !chiaviComuni.has(chiaveAl(f)) || f.sale != null)].sort((x, y) => x.nome.localeCompare(y.nome, "it"));
    // Libreria completamente vuota (cliente nuova): inserisce gli alimenti base, che poi si possono modificare o eliminare
    if (alimenti.length === 0 && !(vc || []).length && !cl?.libreria_con && !comuni.length) {
      try {
        const { data: base } = await supabase.from("kcal_foods_base").select("*");
        if (base?.length) {
          const { data: creati } = await supabase.from("kcal_foods").insert(base.map((b) => ({ client_id: clientId, nome: b.nome, unit: b.unit, uname: b.uname, per: b.per, kcal: b.kcal, proteine: b.proteine, carboidrati: b.carboidrati, grassi: b.grassi }))).select("*");
          if (creati) alimenti = creati.sort((x, y) => x.nome.localeCompare(y.nome, "it"));
        }
      } catch (e) { /* senza alimenti base si parte da zero */ }
    }
    setFoods(alimenti);
    setVoci(vc || []);
    try {
      const [{ data: rc }, { data: ps }] = await Promise.all([
        supabase.from("kcal_ricette").select("*").or(`client_id.is.null,client_id.eq.${clientId}`).order("nome"),
        supabase.from("kcal_pasti_standard").select("*").or(`client_id.is.null,client_id.eq.${clientId}`).order("nome"),
      ]);
      setRicette(rc || []); setPasti(ps || []);
    } catch (e) { /* tabelle non disponibili: si continua senza */ }
    // Obiettivo = kcal del piano nutrizionale attivo (se c'è); altrimenti nessun obiettivo
    let ob = null;
    if (cl?.nutrizione_attiva !== false) {
      const { data: pianiDb } = await supabase.from("nutrition_plans").select("kcal, proteine_g, carboidrati_g, grassi_g, data_inizio, data_fine, data_aggiornamento, created_at").eq("client_id", clientId);
      const oggi = todayStr();
      setPiani(pianiDb || []);
      const k = (r) => r.data_inizio || r.data_aggiornamento || "";
      const iniz = (pianiDb || []).filter((r) => r.kcal != null && k(r) && k(r) <= oggi);
      const validi = iniz.filter((r) => !r.data_fine || r.data_fine >= oggi);
      const pool = validi.length ? validi : iniz;
      const att = [...pool].sort((a, b) => k(b).localeCompare(k(a)) || (b.created_at || "").localeCompare(a.created_at || ""))[0];
      ob = att ? Number(att.kcal) : null;
      setMacroOb(att && att.proteine_g != null && att.carboidrati_g != null && att.grassi_g != null ? { p: Number(att.proteine_g), c: Number(att.carboidrati_g), g: Number(att.grassi_g) } : null);
    }
    setObiettivo(ob);
    setCaricando(false);
  };
  useEffect(() => { carica(); }, [clientId]);

  const vociPerGiorno = useMemo(() => {
    const m = {};
    voci.forEach((v) => { (m[v.data] = m[v.data] || []).push(v); });
    return m;
  }, [voci]);

  // Obiettivo del giorno scelto: ogni giorno può avere il suo piano (date di inizio/fine), quindi si cerca quello valido per quella data
  const pianoPerData = (d) => {
    const k = (r) => r.data_inizio || r.data_aggiornamento || "";
    const iniz = piani.filter((r) => r.kcal != null && k(r) && k(r) <= d);
    const validi = iniz.filter((r) => !r.data_fine || r.data_fine >= d);
    const pool = validi.length ? validi : iniz;
    const att = [...pool].sort((a, b) => k(b).localeCompare(k(a)) || (b.created_at || "").localeCompare(a.created_at || ""))[0];
    if (!att) return { ob: null, macro: null };
    return { ob: Number(att.kcal), macro: att.proteine_g != null && att.carboidrati_g != null && att.grassi_g != null ? { p: Number(att.proteine_g), c: Number(att.carboidrati_g), g: Number(att.grassi_g) } : null };
  };
  const giornoPiano = piani.length ? pianoPerData(date) : { ob: obiettivo, macro: macroOb };

  if (caricando) return <Spinner />;

  if (senzaDiario && !soloPianoERicette) return <div>{pianoNode}</div>;

  if (!isAdmin && !senzaDiario && !soloPianoERicette) {
    const vociOggi = vociPerGiorno[date] || [];
    const tot = vociOggi.reduce((a, v) => ({ kcal: a.kcal + Number(v.kcal || 0), p: a.p + Number(v.proteine || 0), c: a.c + Number(v.carboidrati || 0), g: a.g + Number(v.grassi || 0), s: a.s + Number(v.sale || 0) }), { kcal: 0, p: 0, c: 0, g: 0, s: 0 });
    const lun = (() => { const d = parseDate(date); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return fmtDate(d); })();
    const settimana = Array.from({ length: 7 }, (_, i) => addDays(lun, i));
    const NOMI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
    const sub = ["ricette", "pasti", "libreria", "spesa"].includes(sez);
    const TITOLI = { ricette: "Ricette", pasti: "Pasti standard", libreria: "I miei alimenti", spesa: "Lista della spesa" };
    const voceBarra = (k, label, Icona, attiva) => (
      <button key={k} onClick={() => setSez(k)} className="flex-1 flex flex-col items-center gap-0.5 py-1.5" style={{ color: attiva ? "#27466D" : "#7a8da3" }}>
        <Icona size={24} strokeWidth={attiva ? 2.2 : 1.7} />
        <span className="text-[11px] font-semibold">{label}</span>
      </button>
    );
    return (
      <div className="space-y-3 pb-28">
        <TestataNutrizione tot={tot} ob={giornoPiano.ob} macroOb={giornoPiano.macro} data={date} />
        {sez === "oggi" && (
          <>
            <div className="flex items-center gap-1">
              <button onClick={() => setDate(addDays(date, -7))} className="w-7 h-14 flex items-center justify-center" style={{ color: "#7a8da3" }}><ChevronLeft size={18} /></button>
              <div className="flex-1 grid grid-cols-7 gap-1">
                {settimana.map((d, i) => { const on = d === date; const oggiG = d === todayStr(); return (
                  <button key={d} onClick={() => setDate(d)} className="rounded-xl py-1.5 text-center" style={on ? { background: "#27466D", color: "#fff", border: "1px solid #27466D" } : { background: "#fff", color: "#7a8da3", border: oggiG ? "1.5px solid #4F8FD0" : "1px solid #C9E0F7" }}>
                    <span className="block text-[10px]">{NOMI[i]}</span><span className="block text-sm font-bold" style={{ color: on ? "#fff" : "#27466D" }}>{d.slice(8)}</span>
                  </button>
                ); })}
              </div>
              <button onClick={() => setDate(addDays(date, 7))} className="w-7 h-14 flex items-center justify-center" style={{ color: "#7a8da3" }}><ChevronRight size={18} /></button>
            </div>
            {date === todayStr() && <AcquaCliente clientId={clientId} />}
            <DiarioGiorno compatto
              clientId={clientId} isAdmin={isAdmin} date={date} setDate={setDate}
              foods={foods} vociGiorno={vociOggi} vociIeri={vociPerGiorno[addDays(date, -1)] || []}
              obiettivo={giornoPiano.ob} onCambiato={carica} ricette={ricette} pasti={pasti}
            />
          </>
        )}
        {sez === "piano" && pianoNode}
        {sez === "storico" && <StoricoKcal voci={voci} obiettivo={obiettivo} onVaiAGiorno={(d) => { setDate(d); setSez("oggi"); }} />}
        {sez === "altro" && (
          <div className="rounded-3xl p-4 space-y-3" style={{ background: "#fff", border: "1.5px solid #C9E0F7" }}>
            <p className="text-sm font-bold" style={{ color: "#27466D" }}>Altri strumenti</p>
            <div className="grid grid-cols-2 gap-2">
              {[["ricette", "Ricette", "Idee con i macro già calcolati"], ["pasti", "Pasti standard", "I tuoi pasti ricorrenti"], ["libreria", "I miei alimenti", "Aggiungi anche col barcode"], ["spesa", "Lista della spesa", "Dalle ricette che scegli"]].map(([k, t, d]) => (
                <button key={k} onClick={() => setSez(k)} className="text-left rounded-2xl p-3" style={{ background: "#F5FAFE", border: "1px solid #C9E0F7" }}>
                  <span className="block text-sm font-bold" style={{ color: "#27466D" }}>{t}</span><span className="block text-[11px] mt-0.5" style={{ color: "#7a8da3" }}>{d}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {sub && (
          <>
            <button onClick={() => setSez("altro")} className="flex items-center gap-1 text-sm font-semibold" style={{ color: "#3F78B3" }}><ChevronLeft size={16} /> {TITOLI[sez]}</button>
            {sez === "ricette" && <RicetteVista ricette={ricette} foods={foods} clientId={clientId} isAdmin={isAdmin} date={date} onCambiato={carica} aperta={ricettaAperta} setAperta={setRicettaAperta} senzaLog={false} />}
            {sez === "pasti" && <PastiVista pasti={pasti} foods={foods} clientId={clientId} isAdmin={isAdmin} date={date} onCambiato={carica} />}
            {sez === "libreria" && <LibreriaAlimenti clientId={clientId} isAdmin={isAdmin} foods={foods} onCambiato={carica} />}
            {sez === "spesa" && <ListaSpesa clientId={clientId} ricette={ricette} pasti={pasti} />}
          </>
        )}
        <div className="fixed left-0 right-0 bottom-0 z-[55]" style={{ background: "#fff", borderTop: "1px solid #C9E0F7", paddingBottom: "calc(env(safe-area-inset-bottom) + 6px)" }}>
          <div className="max-w-md mx-auto flex px-2 pt-1">
            {voceBarra("oggi", "Oggi", Utensils, sez === "oggi")}
            {pianoNode && voceBarra("piano", "Piano", ClipboardList, sez === "piano")}
            {voceBarra("storico", "Storico", TrendingUp, sez === "storico")}
            {voceBarra("altro", "Altro", MoreHorizontal, sez === "altro" || sub)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(soloPianoERicette ? [...(pianoNode ? [["piano", "Programma"]] : []), ["ricette", "Ricette"]] : [["diario", "Diario"], ...(pianoNode ? [["piano", "Piano"]] : []), ["ricette", "Ricette"], ["pasti", "Pasti standard"], ...(!isAdmin ? [["spesa", "Spesa"]] : []), ["libreria", "Alimenti"], ["storico", "Storico"], ...(isAdmin ? [["analisi", "Analisi"]] : [])]).map(([k, l]) => (
          <button key={k} onClick={() => setVista(k)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex-shrink-0 ${vista === k ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>
            {l}
          </button>
        ))}
      </div>

      {vista === "diario" && (
        <DiarioGiorno
          clientId={clientId} isAdmin={isAdmin} date={date} setDate={setDate}
          foods={foods} vociGiorno={vociPerGiorno[date] || []} vociIeri={vociPerGiorno[addDays(date, -1)] || []}
          obiettivo={giornoPiano.ob} onCambiato={carica} ricette={ricette} pasti={pasti}
        />
      )}
      {vista === "piano" && pianoNode}
      {vista === "ricette" && <RicetteVista ricette={ricette} foods={foods} clientId={clientId} isAdmin={isAdmin} date={date} onCambiato={carica} aperta={ricettaAperta} setAperta={setRicettaAperta} senzaLog={soloPianoERicette} />}
      {vista === "pasti" && <PastiVista pasti={pasti} foods={foods} clientId={clientId} isAdmin={isAdmin} date={date} onCambiato={carica} />}
      {vista === "spesa" && <ListaSpesa clientId={clientId} ricette={ricette} pasti={pasti} />}
      {vista === "storico" && <StoricoKcal voci={voci} obiettivo={obiettivo} onVaiAGiorno={(d) => { setDate(d); setVista("diario"); }} />}
      {vista === "libreria" && <LibreriaAlimenti clientId={clientId} isAdmin={isAdmin} foods={foods} onCambiato={carica} />}
      {vista === "analisi" && isAdmin && <AnalisiCoach voci={voci} obiettivo={obiettivo} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Diario del giorno                                                   */
/* ------------------------------------------------------------------ */
function TotaliGiorno({ clientId, isAdmin, date, esistente, onChiudi, onFatto }) {
  const val = (x) => (x == null ? "" : String(x));
  const [kcal, setKcal] = useState(val(esistente?.kcal));
  const [p, setP] = useState(val(esistente?.proteine));
  const [c, setC] = useState(val(esistente?.carboidrati));
  const [g, setG] = useState(val(esistente?.grassi));
  const [sl, setSl] = useState(val(esistente?.sale));
  const [salvando, setSalvando] = useState(false);
  const n = (x) => (x === "" || isNaN(Number(x)) ? null : Number(x));
  const salva = async () => {
    if (n(kcal) == null) return;
    setSalvando(true);
    const riga = { client_id: clientId, data: date, pasto: "totale", food_id: null, nome: "Totali del giorno", marca: null, unit: "pz", uname: "giorno", quantita: 1, kcal: n(kcal), proteine: n(p), carboidrati: n(c), grassi: n(g), sale: n(sl) };
    if (esistente?.id) await supabase.from("kcal_voci").update(riga).eq("id", esistente.id);
    else await supabase.from("kcal_voci").insert({ ...riga, creato_da: isAdmin ? "coach" : "cliente" });
    setSalvando(false);
    onFatto();
  };
  const elimina = async () => {
    if (!esistente?.id) return;
    await supabase.from("kcal_voci").delete().eq("id", esistente.id);
    onFatto();
  };
  const campo = (label, v, set) => (
    <div>
      <label className="text-xs text-slate-500 block mb-1">{label}</label>
      <input type="number" inputMode="decimal" step="any" min="0" value={v} onChange={(e) => set(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
    </div>
  );
  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700">Totali del giorno</p>
      <p className="text-xs text-slate-500">Se hai calcolato tutto con un'altra app, scrivi qui i totali di oggi.</p>
      <div className="grid grid-cols-2 gap-3">
        {campo("Calorie (kcal)", kcal, setKcal)}
        {campo("Proteine (g)", p, setP)}
        {campo("Carboidrati (g)", c, setC)}
        {campo("Grassi (g)", g, setG)}
        {campo("Sale (g)", sl, setSl)}
      </div>
      <div className="flex gap-2">
        <button onClick={salva} disabled={salvando || n(kcal) == null} className="flex-1 bg-slate-800 text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-40">{salvando ? "Salvo..." : "Salva totali"}</button>
        <button onClick={onChiudi} className="px-4 text-sm text-slate-500 border border-slate-200 rounded-xl">Annulla</button>
      </div>
      {esistente?.id && <button onClick={elimina} className="text-xs text-slate-800 underline">Elimina i totali di questo giorno</button>}
    </Card>
  );
}

/* Testata sempre visibile: kcal rimaste (anello) e barre dei macros rispetto al piano */
function TestataNutrizione({ tot, ob, macroOb, data }) {
  const R = 38, C = 2 * Math.PI * R;
  const frac = ob ? Math.min(1, tot.kcal / ob) : 0;
  const resta = ob ? Math.round(ob - tot.kcal) : null;
  const barre = [["Proteine", tot.p, macroOb?.p, "#fff"], ["Carboidrati", tot.c, macroOb?.c, "#C9E0F7"], ["Grassi", tot.g, macroOb?.g, "#8EBDED"], ["Sale", tot.s || 0, SALE_RIF, "#E1EEFB"]];
  const label = parseDate(data).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="rounded-3xl p-4 text-white" style={{ background: "#27466D" }}>
      <p className="text-xs capitalize" style={{ color: "#C9E0F7" }}>{data === todayStr() ? "Oggi" : label}{ob ? ` · piano ${num(ob)} kcal` : ""}</p>
      <div className="flex items-center gap-4 mt-2">
        <svg width="96" height="96" viewBox="0 0 96 96" className="flex-shrink-0">
          <circle cx="48" cy="48" r={R} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="9" />
          {ob && <circle cx="48" cy="48" r={R} fill="none" stroke="#C9E0F7" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90 48 48)" />}
          <text x="48" y={ob ? 47 : 53} textAnchor="middle" fill="#fff" fontSize="21" fontWeight="700">{ob ? Math.abs(resta) : Math.round(tot.kcal)}</text>
          <text x="48" y="62" textAnchor="middle" fill="#C9E0F7" fontSize="9">{ob ? (resta >= 0 ? "kcal rimaste" : "kcal oltre") : "kcal"}</text>
        </svg>
        <div className="flex-1 space-y-2">
          {barre.map(([nome, v, obj, col]) => (
            <div key={nome}>
              <div className="flex justify-between text-xs font-semibold"><span>{nome}</span><span style={{ color: "#C9E0F7", fontWeight: 400 }}>{num(round1(v))}{obj ? ` / ${num(obj)}` : ""} g</span></div>
              <div className="h-2 rounded-full mt-1 overflow-hidden" style={{ background: "rgba(255,255,255,.2)" }}><div className="h-full rounded-full" style={{ width: `${obj ? Math.min(100, (v / obj) * 100) : 0}%`, background: col }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DiarioGiorno({ clientId, isAdmin, date, setDate, foods, vociGiorno, vociIeri, obiettivo, onCambiato, ricette = [], pasti = [], compatto = false }) {
  const [sheet, setSheet] = useState(null); // { meal } | { meal, food, amt, entryId }
  const [scelta, setScelta] = useState(null); // { meal } scelta tra pasto standard / ricetta / alimento
  const [ricettaDa, setRicettaDa] = useState(null); // { r, meal }
  const [salvaPasto, setSalvaPasto] = useState(null); // { meal, voci }
  const [mostraTotali, setMostraTotali] = useState(false);
  const [voceMeal, setVoceMeal] = useState(null); // inserimento a voce
  const [completa, setCompleta] = useState(null); // voce da completare
  const totaleManuale = vociGiorno.find((v) => v.pasto === "totale");

  const totaleKcal = vociGiorno.reduce((a, v) => a + Number(v.kcal), 0);
  const totaleMacro = vociGiorno.reduce((a, v) => ({
    p: a.p + (v.proteine ?? 0), c: a.c + (v.carboidrati ?? 0), g: a.g + (v.grassi ?? 0),
    s: a.s + (v.sale ?? 0),
    mancanti: a.mancanti + (v.proteine == null && !v.da_completare ? 1 : 0),
    senzaSale: a.senzaSale + (v.sale == null && !v.da_completare && v.pasto !== "totale" ? 1 : 0),
    daCompletare: a.daCompletare + (v.da_completare ? 1 : 0),
  }), { p: 0, c: 0, g: 0, s: 0, mancanti: 0, senzaSale: 0, daCompletare: 0 });

  const label = parseDate(date).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  const pct = obiettivo ? Math.min(100, (totaleKcal / obiettivo) * 100) : 0;
  const sopra = obiettivo && totaleKcal > obiettivo;

  const copiaIeri = async (meal) => {
    const daCopiare = vociIeri.filter((v) => v.pasto === meal);
    if (!daCopiare.length) return;
    await supabase.from("kcal_voci").insert(daCopiare.map((v) => ({
      client_id: clientId, data: date, pasto: meal, food_id: v.food_id, nome: v.nome, marca: v.marca,
      unit: v.unit, uname: v.uname, quantita: v.quantita, kcal: v.kcal, proteine: v.proteine, carboidrati: v.carboidrati, grassi: v.grassi, sale: v.sale ?? null, da_completare: !!v.da_completare,
      creato_da: isAdmin ? "coach" : "cliente",
    })));
    onCambiato();
  };

  return (
    <div className="space-y-4">
      {!compatto && <div className="flex items-center gap-2">
        <button onClick={() => setDate(addDays(date, -1))} className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500">‹</button>
        <div className="flex-1 text-center text-sm font-medium text-slate-700 capitalize">{label}</div>
        <button onClick={() => setDate(addDays(date, 1))} className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500">›</button>
      </div>}

      {!compatto && <Card className="p-4 space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold text-slate-800">{Math.round(totaleKcal)}</span>
          <span className="text-slate-400 text-sm">kcal {date === todayStr() ? "oggi" : "in questo giorno"}</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-slate-50 rounded-xl px-2.5 py-2"><div className="font-semibold text-slate-800">{num(totaleMacro.p)} g</div><div className="text-slate-400 text-xs">Proteine</div></div>
          <div className="bg-slate-50 rounded-xl px-2.5 py-2"><div className="font-semibold text-slate-800">{num(totaleMacro.c)} g</div><div className="text-slate-400 text-xs">Carboidrati</div></div>
          <div className="bg-slate-50 rounded-xl px-2.5 py-2"><div className="font-semibold text-slate-800">{num(totaleMacro.g)} g</div><div className="text-slate-400 text-xs">Grassi</div></div>
          <div className="rounded-xl px-2.5 py-2" style={{ background: "#E1EEFB" }}><div className="font-semibold text-slate-800">{num(round1(totaleMacro.s))} g</div><div className="text-slate-500 text-xs">Sale</div></div>
        </div>
        <div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: Math.min(100, (totaleMacro.s / SALE_RIF) * 100) + "%", background: totaleMacro.s > SALE_RIF ? "#27466D" : "#4F8FD0" }} /></div>
          <p className="text-slate-500 text-xs mt-1">Sale: {num(round1(totaleMacro.s))} g su {SALE_RIF} g · riferimento OMS (indicativo){totaleMacro.senzaSale > 0 ? ` · ${totaleMacro.senzaSale} alimento/i senza dato: valore parziale` : ""}</p>
        </div>
        {totaleMacro.mancanti > 0 && <p className="text-slate-600 text-xs">Macro parziali: {totaleMacro.mancanti} alimento/i senza valori inseriti.</p>}
        {totaleMacro.daCompletare > 0 && <p className="text-slate-600 text-xs">{totaleMacro.daCompletare} alimento/i da completare: i totali sono parziali.</p>}

        {obiettivo ? (
          <div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${sopra ? "bg-slate-500" : "bg-sky-500"}`} style={{ width: pct + "%" }} /></div>
            <div className="mt-1.5">
              <span className="text-slate-500 text-xs">{sopra ? `Sopra di ${Math.round(totaleKcal - obiettivo)}` : `Restano ${Math.round(obiettivo - totaleKcal)}`} kcal su {num(obiettivo)} (dal tuo piano)</span>
            </div>
          </div>
        ) : null}
      </Card>}

      {mostraTotali ? (
        <TotaliGiorno clientId={clientId} isAdmin={isAdmin} date={date} esistente={totaleManuale} onChiudi={() => setMostraTotali(false)} onFatto={() => { setMostraTotali(false); onCambiato(); }} />
      ) : totaleManuale ? (
        <button onClick={() => setMostraTotali(true)} className="w-full flex items-center justify-between text-left bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
          <span className="text-sm text-slate-700 font-medium">Totali inseriti a mano</span>
          <span className="text-xs text-slate-500">{Math.round(totaleManuale.kcal)} kcal · P {num(totaleManuale.proteine ?? 0)} · C {num(totaleManuale.carboidrati ?? 0)} · G {num(totaleManuale.grassi ?? 0)} · Modifica</span>
        </button>
      ) : (
        <button onClick={() => setMostraTotali(true)} className="w-full text-sky-600 text-sm font-medium border border-dashed border-sky-200 rounded-xl py-2.5">Inserisci solo i totali del giorno</button>
      )}

      <div className="space-y-4">
        {MEALS.map(([key, nome]) => {
          const list = vociGiorno.filter((v) => v.pasto === key);
          const totMeal = list.reduce((a, v) => a + Number(v.kcal), 0);
          const ieriMeal = vociIeri.filter((v) => v.pasto === key);
          return (
            <div key={key} className={compatto ? "rounded-2xl p-3" : ""} style={compatto ? { background: "#fff", border: "1px solid #C9E0F7" } : undefined}>
              <div className={compatto ? "flex items-center justify-between pb-1 mb-1" : "flex items-center justify-between border-b-2 border-slate-800 pb-1.5 mb-2"}>
                <h3 className="font-semibold" style={{ color: compatto ? "#27466D" : undefined }}>{nome}</h3>
                <span className="text-slate-400 text-sm ml-auto mr-3">{Math.round(totMeal)} kcal</span>
                {compatto
                  ? <button onClick={() => setScelta({ meal: key })} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#E1EEFB", color: "#27466D" }}><Plus size={18} /></button>
                  : <button onClick={() => setScelta({ meal: key })} className="text-sky-600 text-sm font-medium flex items-center gap-1"><Plus size={14} /> Aggiungi</button>}
              </div>
              {!list.length && (
                <div className="flex items-center justify-between text-slate-400 text-sm py-2">
                  <span>Ancora niente.</span>
                  {!!ieriMeal.length && <button onClick={() => copiaIeri(key)} className="text-sky-600 font-medium">Copia da ieri ({ieriMeal.length})</button>}
                </div>
              )}
              {list.length > 1 && (
                <button onClick={() => setSalvaPasto({ meal: key, voci: list })} className="text-sky-600 text-xs font-medium py-1.5">Salva come pasto standard</button>
              )}
              {list.map((v) => (
                <button key={v.id} onClick={() => (v.da_completare ? setCompleta(v) : setSheet({ meal: key, entryId: v.id, food: v, amt: v.quantita }))}
                  className="w-full flex items-center gap-3 text-left border-b border-slate-100 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 text-sm">{v.nome}</div>
                    <div className="text-slate-400 text-xs">{amtLabel(v.unit, v.uname, v.quantita)}{v.marca ? " · " + v.marca : ""}{v.creato_da === "coach" ? " · aggiunto dal coach" : ""}</div>
                    {v.da_completare && <span className="inline-block mt-1 text-[11px] rounded-lg px-2 py-0.5" style={{ background: "#FFFBEF", border: "1px solid #F7E9BE", color: "#27466D" }}>da completare</span>}
                  </div>
                  {v.da_completare
                    ? <span className="text-xs font-semibold flex-shrink-0" style={{ color: "#3F78B3" }}>Completa</span>
                    : <span className="text-slate-700 text-sm font-medium flex-shrink-0">{Math.round(v.kcal)} kcal</span>}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {compatto && !scelta && !sheet && !ricettaDa && !salvaPasto && !voceMeal && !completa && (
        <button onClick={() => { const h = new Date().getHours(); setScelta({ meal: h < 10 ? "colazione" : h < 15 ? "pranzo" : h < 18 ? "spuntini" : "cena" }); }} className="fixed z-[56] right-4 rounded-full px-5 py-3 text-sm font-bold text-white shadow-xl" style={{ background: "#27466D", bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}>+ Aggiungi cibo</button>
      )}
      {scelta && (
        <SceltaAggiunta meal={scelta.meal} pasti={pasti} ricette={ricette}
          onChiudi={() => setScelta(null)}
          onAlimento={() => { const m = scelta.meal; setScelta(null); setSheet({ meal: m }); }}
          onPasto={async (p) => { const m = scelta.meal; setScelta(null); await inserisciPasto(p, { clientId, date, meal: m, isAdmin }); onCambiato(); }}
          onVoce={() => { const m = scelta.meal; setScelta(null); setVoceMeal(m); }}
          onRicetta={(r) => { const m = scelta.meal; setScelta(null); setRicettaDa({ r, meal: m }); }} />
      )}
      {ricettaDa && (
        <RicettaDettaglio r={ricettaDa.r} mealIniziale={ricettaDa.meal} clientId={clientId} isAdmin={isAdmin} date={date}
          onChiudi={() => setRicettaDa(null)} onFatto={() => { setRicettaDa(null); onCambiato(); }} />
      )}
      {salvaPasto && (
        <SalvaPastoModal voci={salvaPasto.voci} meal={salvaPasto.meal} clientId={clientId} isAdmin={isAdmin}
          onChiudi={() => setSalvaPasto(null)} onSalvato={() => { setSalvaPasto(null); onCambiato(); }} />
      )}
      {voceMeal && (
        <VoceAggiungi clientId={clientId} isAdmin={isAdmin} date={date} meal={voceMeal} foods={foods}
          onChiudi={() => setVoceMeal(null)} onFatto={() => { setVoceMeal(null); onCambiato(); }} />
      )}
      {completa && (
        <CompletaVoce voce={completa} clientId={clientId} isAdmin={isAdmin}
          onChiudi={() => setCompleta(null)} onFatto={() => { setCompleta(null); onCambiato(); }} />
      )}
      {sheet && (
        <SchedaAggiungi clientId={clientId} isAdmin={isAdmin} date={date} foods={foods} sheet={sheet} setSheet={setSheet} onSalvato={onCambiato} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scheda (bottom sheet) per cercare l'alimento, scegliere la          */
/* quantità e aggiungere/modificare/eliminare una voce                 */
/* ------------------------------------------------------------------ */
function SchedaAggiungi({ clientId, isAdmin, date, foods, sheet, setSheet, onSalvato }) {
  const [q, setQ] = useState("");
  const [food, setFood] = useState(sheet.food && sheet.entryId ? null : sheet.food || null);
  const [amt, setAmt] = useState(sheet.amt || "");
  const [salvando, setSalvando] = useState(false);
  const [nuovo, setNuovo] = useState(false); // creazione di un alimento direttamente dal pasto
  const [marchio, setMarchio] = useState(""); // "" = tutti, "__none" = senza marchio
  const [saleTxt, setSaleTxt] = useState("");
  const [savSale, setSavSale] = useState(false);

  // In modifica di una voce già salvata, ricostruiamo un "alimento" equivalente a partire
  // dalla voce stessa (così la modifica funziona anche se l'alimento originale è stato
  // nel frattempo cambiato o eliminato dalla libreria — la voce è indipendente).
  useEffect(() => {
    if (sheet.entryId && !food) {
      const originale = foods.find((f) => f.id === sheet.food.food_id);
      setFood(originale || {
        id: sheet.food.food_id, nome: sheet.food.nome, marca: sheet.food.marca, unit: sheet.food.unit,
        uname: sheet.food.uname, per: sheet.food.quantita, kcal: sheet.food.kcal,
        proteine: sheet.food.proteine, carboidrati: sheet.food.carboidrati, grassi: sheet.food.grassi, sale: sheet.food.sale,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const risultati = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = foods.filter((f) => (!t || (f.nome + " " + (f.marca || "")).toLowerCase().includes(t))
      && (!marchio || (marchio === "__none" ? !f.marca : (f.marca || "").toLowerCase() === marchio.toLowerCase())));
    return list.sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  }, [foods, q, marchio]);
  // marchi presenti in libreria (i più frequenti per primi), per i filtri rapidi
  const marchi = useMemo(() => {
    const c = {};
    foods.forEach((f) => { const m = (f.marca || "").trim(); if (m) c[m] = (c[m] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "it")).slice(0, 8).map((x) => x[0]);
  }, [foods]);

  const chiudi = () => setSheet(null);

  // aggiunge il dato del sale a un alimento che non lo ha: il coach lo salva dove sta l'alimento,
  // la cliente su una sua copia personale (la libreria comune non si tocca)
  const salvaSale = async () => {
    const n = Number(String(saleTxt).replace(",", "."));
    if (!String(saleTxt).trim() || isNaN(n) || n < 0) { alert("Scrivi il sale in grammi (anche 0) ✨"); return; }
    setSavSale(true);
    let agg = null;
    const reale = foods.find((f) => f.id === food.id);
    if (reale && (!reale.comune || isAdmin)) {
      const { data, error } = await supabase.from(reale.comune ? "kcal_foods_comuni" : "kcal_foods").update({ sale: n }).eq("id", reale.id).select().single();
      if (!error && data) agg = { ...data, comune: !!reale.comune };
    } else {
      const { data, error } = await supabase.from("kcal_foods").insert({ client_id: clientId, nome: food.nome, marca: food.marca || null, unit: food.unit, uname: food.uname || null, per: food.per, kcal: food.kcal, proteine: food.proteine ?? null, carboidrati: food.carboidrati ?? null, grassi: food.grassi ?? null, sale: n, quantita_abituale: food.quantita_abituale ?? null }).select().single();
      if (!error && data) agg = data;
    }
    setSavSale(false);
    if (!agg) { alert("Non siamo riusciti a salvare il sale. Riprova tra un attimo 🫶🏻"); return; }
    setFood(agg); setSaleTxt(""); onSalvato();
  };

  const scegli = (f) => { setFood(f); setAmt(f.quantita_abituale || (f.unit === "pz" ? 1 : f.per)); };

  const conferma = async () => {
    const a = Number(String(amt).replace(",", "."));
    if (!a || a <= 0) { alert("Inserisci una quantità maggiore di zero ✨"); return; }
    setSalvando(true);
    const m = macroFor(food, a);
    const riga = {
      client_id: clientId, data: date, pasto: sheet.meal, food_id: food.comune ? null : food.id || null,
      nome: food.nome, marca: food.marca || null, unit: food.unit, uname: food.uname || null,
      quantita: a, kcal: foodKcal(food, a), proteine: m?.p ?? null, carboidrati: m?.c ?? null, grassi: m?.g ?? null,
      sale: saleFor(food, a), da_completare: false,
    };
    if (sheet.entryId) {
      await supabase.from("kcal_voci").update(riga).eq("id", sheet.entryId);
    } else {
      await supabase.from("kcal_voci").insert({ ...riga, creato_da: isAdmin ? "coach" : "cliente" });
    }
    setSalvando(false);
    chiudi();
    onSalvato();
  };

  const elimina = async () => {
    setSalvando(true);
    await supabase.from("kcal_voci").delete().eq("id", sheet.entryId);
    setSalvando(false);
    chiudi();
    onSalvato();
  };

  const nomeTitolo = MEALS.find((m) => m[0] === sheet.meal)[1];

  // L'alimento creato da qui resta salvato nella lista Alimenti e si può usare subito per il pasto
  const creato = (nuovoAlimento) => { setNuovo(false); onSalvato(); if (nuovoAlimento) scegli(nuovoAlimento); };

  return (
    <div className="fixed inset-0 bg-black/50 z-[65] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) chiudi(); }}>
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl max-h-[88vh] overflow-y-auto p-5 space-y-4">
        {nuovo ? (
          <FormAlimento clientId={clientId} isAdmin={isAdmin} alimento={null} nomeIniziale={q.trim()} avviaScanner={nuovo === "scan"} onAnnulla={() => setNuovo(false)} onSalvato={creato} />
        ) : !food ? (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">{nomeTitolo}</h3>
              <button onClick={chiudi} className="text-slate-400"><X size={20} /></button>
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Cerca tra i tuoi alimenti"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm" />
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {[["", "Tutti"], ...marchi.map((m) => [m, m]), ["__none", "Senza marchio"]].map(([k, l]) => (
                <button key={k || "tutti"} onClick={() => setMarchio(k)} className="text-xs rounded-full px-3 py-1 whitespace-nowrap flex-shrink-0 font-medium" style={marchio === k ? { background: "#27466D", color: "#fff", border: "1px solid #27466D" } : { background: "#fff", color: "#27466D", border: "1px solid #C9E0F7" }}>{l}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setNuovo(true)} className="flex-1 border border-sky-200 bg-sky-50 text-sky-700 text-sm font-medium rounded-xl py-2.5">+ Nuovo alimento{q.trim() ? ` «${q.trim()}»` : ""}</button>
              <button onClick={() => setNuovo("scan")} className="px-4 border border-sky-200 bg-white text-sky-700 text-sm font-medium rounded-xl py-2.5">Scansiona</button>
            </div>
            <div className="space-y-1 max-h-[50vh] overflow-y-auto">
              {risultati.map((f) => (
                <button key={f.id} onClick={() => scegli(f)} className="w-full flex items-center justify-between text-left border-b border-slate-100 py-2.5">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 text-sm">{f.nome}</div>
                    <div className="text-slate-400 text-xs">{f.marca ? <b style={{ color: "#3F78B3" }}>{f.marca}</b> : "Senza marchio"} · {mLine(hasMacro(f) ? macroFor(f, f.per) : null, f.sale)}</div>
                  </div>
                  <span className="text-slate-500 text-xs text-right flex-shrink-0 ml-2">{num(f.kcal)} kcal<br />per {perLabel(f)}</span>
                </button>
              ))}
              {!risultati.length && (
                <p className="text-slate-400 text-sm py-3">
                  {foods.length ? "Nessun alimento con questo nome." : "La libreria è ancora vuota."}{" "}
                  Non lo trovi? Crealo qui con il pulsante «Nuovo alimento»: resta salvato nella tua lista.
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><h3 className="text-lg font-semibold text-slate-800 break-words">{food.nome}</h3><p className="text-slate-400 text-xs">{food.marca ? <b style={{ color: "#3F78B3" }}>{food.marca}</b> : "Senza marchio"} · {num(food.kcal)} kcal per {perLabel(food)}</p></div>
              <button onClick={chiudi} className="text-slate-400 flex-shrink-0"><X size={20} /></button>
            </div>
            <div>
              <label className="text-slate-400 text-xs">Quantità ({food.unit === "pz" ? (food.uname || "pezzi") : food.unit})</label>
              <div className="flex items-center gap-2 mt-1">
                <button onClick={() => setAmt((v) => Math.max(0, round1(Number(v || 0) - (food.unit === "pz" ? 0.5 : food.per <= 20 ? 5 : 10))))} className="w-10 h-10 rounded-full border border-slate-200 text-slate-500 text-lg flex-shrink-0">−</button>
                <input type="number" inputMode="decimal" step="any" min="0" value={amt} onChange={(e) => setAmt(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-center text-lg font-medium" />
                <button onClick={() => setAmt((v) => round1(Number(v || 0) + (food.unit === "pz" ? 0.5 : food.per <= 20 ? 5 : 10)))} className="w-10 h-10 rounded-full border border-slate-200 text-slate-500 text-lg flex-shrink-0">+</button>
              </div>
            </div>
            <div className="text-center py-2">
              <div className="text-3xl font-semibold text-slate-800">{Math.round(foodKcal(food, Number(amt || 0)))} <span className="text-base font-normal text-slate-400">kcal</span></div>
              <div className="text-slate-400 text-sm mt-1">{mLine(macroFor(food, Number(amt || 0)), saleFor(food, Number(amt || 0)))}</div>
              {food.sale == null && (
                <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-400">
                  <span>Sale (g per {perLabel(food)})</span>
                  <input type="number" inputMode="decimal" step="any" min="0" value={saleTxt} onChange={(e) => setSaleTxt(e.target.value)} placeholder="es. 0,5" className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-center text-sm text-slate-800" />
                  <button onClick={salvaSale} disabled={savSale} className="px-3 py-1 rounded-lg text-xs font-medium border disabled:opacity-50" style={{ color: "#27466D", borderColor: "#C9E0F7" }}>{savSale ? "Salvo..." : "Aggiungi"}</button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={conferma} disabled={salvando} className="flex-1 bg-slate-800 text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50">{salvando ? "Salvo..." : sheet.entryId ? "Salva modifica" : `Aggiungi a ${nomeTitolo}`}</button>
              {sheet.entryId
                ? <button onClick={elimina} disabled={salvando} className="px-4 border border-slate-300 text-slate-800 text-sm font-medium rounded-xl">Elimina</button>
                : <button onClick={() => setFood(null)} className="px-4 border border-slate-200 text-slate-500 text-sm font-medium rounded-xl">Cambia</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Libreria alimenti personale                                        */
/* ------------------------------------------------------------------ */
function LibreriaAlimenti({ clientId, isAdmin = false, foods, onCambiato }) {
  const [modifica, setModifica] = useState(undefined); // undefined = form chiuso, null = nuovo, oggetto = modifica

  if (modifica !== undefined) {
    return <FormAlimento clientId={clientId} isAdmin={isAdmin} alimento={modifica} onAnnulla={() => setModifica(undefined)} onSalvato={() => { setModifica(undefined); onCambiato(); }} />;
  }

  return (
    <div className="space-y-3">
      <button onClick={() => setModifica(null)} className="w-full bg-slate-800 text-white text-sm font-medium rounded-xl py-2.5">+ Nuovo alimento</button>
      <Card className="divide-y divide-slate-100">
        {[...foods].sort((a, b) => a.nome.localeCompare(b.nome, "it")).map((f) => (
          <button key={f.id} onClick={() => setModifica(f.comune && !isAdmin ? { ...f, id: undefined, comune: false } : f)} className="w-full flex items-center justify-between text-left px-4 py-3">
            <div className="min-w-0">
              <div className="font-medium text-slate-800 text-sm">{f.nome}</div>
              <div className="text-slate-400 text-xs">{f.marca ? <b style={{ color: "#3F78B3" }}>{f.marca}</b> : "Senza marchio"} · {mLine(hasMacro(f) ? macroFor(f, f.per) : null, f.sale)}{f.comune ? " · libreria comune" : ""}{f.da_controllare && isAdmin ? " · da controllare" : ""}</div>
            </div>
            <span className="text-slate-500 text-xs text-right flex-shrink-0 ml-2">{num(f.kcal)} kcal<br />per {perLabel(f)}</span>
          </button>
        ))}
        {!foods.length && <p className="text-slate-400 text-sm p-4">Non ci sono ancora alimenti. Aggiungine uno per iniziare a usare il diario.</p>}
      </Card>
    </div>
  );
}

/* Scanner codice a barre: fotocamera (BarcodeDetector, oppure lettore ZXing sui telefoni che non lo hanno) + inserimento manuale.
   Accetta solo codici con cifra di controllo valida e letti due volte uguali: niente più prodotti sbagliati per una lettura storta. */
function eanValido(c) {
  const d = String(c || "").replace(/\D/g, "");
  if (![8, 12, 13].includes(d.length)) return false;
  const cifre = d.split("").map(Number); const ctrl = cifre.pop();
  const somma = cifre.reverse().reduce((a, x, i) => a + x * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (somma % 10)) % 10 === ctrl;
}
function ScannerBarcode({ onCodice, onChiudi }) {
  const videoRef = React.useRef(null);
  const trackRef = React.useRef(null);
  const [errore, setErrore] = useState("");
  const [manuale, setManuale] = useState("");
  const [torcia, setTorcia] = useState(false);
  const [torciaOk, setTorciaOk] = useState(false);
  const [letto, setLetto] = useState("");
  useEffect(() => {
    let attivo = true; let stream = null; let controlli = null; let timer = null;
    let ultimo = ""; let volte = 0;
    const lettura = (testo) => {
      if (!attivo) return;
      const c = String(testo || "").replace(/\D/g, "");
      if (!eanValido(c)) return;
      if (c === ultimo) volte++; else { ultimo = c; volte = 1; }
      setLetto(c);
      if (volte >= 2) { attivo = false; try { navigator.vibrate && navigator.vibrate(60); } catch (e) { /* ok */ } onCodice(c); }
    };
    (async () => {
      try {
        const vincoli = { video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 }, advanced: [{ focusMode: "continuous" }] }, audio: false };
        stream = await navigator.mediaDevices.getUserMedia(vincoli);
        if (!attivo) { stream.getTracks().forEach((t) => t.stop()); return; }
        const tr = stream.getVideoTracks()[0]; trackRef.current = tr;
        try { const cap = tr.getCapabilities ? tr.getCapabilities() : {}; if (cap.torch) setTorciaOk(true); if (cap.focusMode && cap.focusMode.includes("continuous")) await tr.applyConstraints({ advanced: [{ focusMode: "continuous" }] }); } catch (e) { /* non supportato */ }
        videoRef.current.srcObject = stream; await videoRef.current.play();
        if ("BarcodeDetector" in window) {
          const det = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
          timer = setInterval(async () => {
            try { const r = await det.detect(videoRef.current); if (r.length) lettura(r[0].rawValue); } catch (e) { /* frame non leggibile */ }
          }, 200);
        } else {
          // lettore compatibile caricato solo al bisogno (nessuna installazione): libreria ZXing da CDN
          if (!window.ZXing) await new Promise((ok, ko) => { const sc = document.createElement("script"); sc.src = "https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js"; sc.onload = ok; sc.onerror = ko; document.head.appendChild(sc); });
          const Z = window.ZXing;
          const hints = new Map();
          hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
          hints.set(Z.DecodeHintType.TRY_HARDER, true);
          const rd = new Z.BrowserMultiFormatReader(hints, 150);
          controlli = { stop: () => rd.reset() };
          rd.decodeFromVideoElement(videoRef.current, (res) => { if (res) lettura(res.getText()); });
        }
      } catch (e) { setErrore("Non riusciamo ad aprire la fotocamera. Controlla che l'app abbia il permesso, oppure scrivi il numero qui sotto 🫶🏻"); }
    })();
    return () => { attivo = false; if (timer) clearInterval(timer); try { controlli?.stop(); } catch (e) { /* ok */ } if (stream) stream.getTracks().forEach((t) => t.stop()); };
  }, []);
  const accendi = async () => { try { await trackRef.current.applyConstraints({ advanced: [{ torch: !torcia }] }); setTorcia(!torcia); } catch (e) { /* ok */ } };
  const okManuale = manuale.length >= 8 && eanValido(manuale);
  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-4 space-y-3">
        <div className="flex items-center justify-between"><p className="font-semibold text-slate-800 text-sm">Inquadra il codice a barre</p><button onClick={onChiudi} className="text-slate-400"><X size={18} /></button></div>
        <div className="relative">
          <video ref={videoRef} playsInline muted className="w-full rounded-xl bg-slate-100 aspect-[4/3] object-cover" />
          <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-16 rounded-lg pointer-events-none" style={{ border: "2px solid rgba(255,255,255,.9)", boxShadow: "0 0 0 999px rgba(0,0,0,.25)" }} />
        </div>
        <p className="text-[11px] text-slate-500">Tieni il codice dentro il riquadro, ben fermo e a circa 15 cm. {letto ? `Letto ${letto}: lo controllo…` : "Se è buio accendi la luce."}</p>
        {torciaOk && <button onClick={accendi} className="w-full py-2 rounded-lg text-xs font-semibold" style={{ border: "1.5px solid #C9E0F7", color: "#27466D" }}>{torcia ? "Spegni la luce" : "Accendi la luce"}</button>}
        {errore && <p className="text-xs text-slate-600">{errore}</p>}
        <div className="flex gap-2">
          <input value={manuale} onChange={(e) => setManuale(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Oppure scrivi il numero" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <button onClick={() => okManuale ? onCodice(manuale) : alert("Il numero non sembra corretto: controlla le cifre sotto le barre ✨")} className="px-3 rounded-lg text-sm text-white" style={{ background: "#27466D" }}>Cerca</button>
        </div>
      </div>
    </div>
  );
}

function FormAlimento({ clientId, isAdmin = false, alimento, onAnnulla, onSalvato, nomeIniziale = "", avviaScanner = false }) {
  const x = alimento || { nome: nomeIniziale, marca: "", unit: "g", uname: "", per: 100, kcal: "", proteine: "", carboidrati: "", grassi: "", sale: "", quantita_abituale: "" };
  const [f, setF] = useState({ ...x, marca: x.marca || "", sale: x.sale == null ? "" : x.sale });
  const [perTutte, setPerTutte] = useState(false); // solo coach: nuovo alimento nella libreria comune
  const [salvando, setSalvando] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const [scanner, setScanner] = useState(!!avviaScanner);
  const [cerca, setCerca] = useState("");
  const daCodice = async (codice) => {
    setScanner(false); setCerca("Cerco il prodotto...");
    const prova = async (host) => { const r = await fetch(`https://${host}/api/v2/product/${codice}.json?fields=product_name,product_name_it,brands,nutriments`); return r.json(); };
    try {
      let j = null;
      for (const host of ["world.openfoodfacts.org", "it.openfoodfacts.org"]) {
        try { const x = await prova(host); if (x?.status === 1 && x.product?.nutriments) { j = x; break; } } catch (e) { /* prossimo server */ }
      }
      const n = j?.product?.nutriments;
      if (!n) { setCerca(`Codice ${codice} non trovato nella banca dati: inserisci i valori a mano (etichetta, per 100 g), ci metti un attimo 🫶🏻`); return; }
      const kcal = n["energy-kcal_100g"] ?? (n["energy_100g"] != null ? n["energy_100g"] / 4.184 : null);
      const r1 = (v) => (v == null || isNaN(Number(v)) ? "" : String(Math.round(Number(v) * 10) / 10));
      const r2 = (v) => (v == null || isNaN(Number(v)) ? "" : String(Math.round(Number(v) * 100) / 100));
      const sale = n.salt_100g != null ? n.salt_100g : n.sodium_100g != null ? Number(n.sodium_100g) * 2.5 : null;
      const p = j.product;
      setF((s) => ({ ...s, nome: p.product_name_it || p.product_name || s.nome, marca: (p.brands || "").split(",")[0].trim() || s.marca, unit: "g", per: 100, kcal: r1(kcal), proteine: r1(n.proteins_100g), carboidrati: r1(n.carbohydrates_100g), grassi: r1(n.fat_100g), sale: r2(sale) }));
      const mancano = [kcal == null && "kcal", n.proteins_100g == null && "proteine", n.carbohydrates_100g == null && "carboidrati", n.fat_100g == null && "grassi", sale == null && "sale"].filter(Boolean);
      setCerca(`Trovato ✨ Valori per 100 g: controllali con l'etichetta prima di salvare.${mancano.length ? ` Mancano nella banca dati: ${mancano.join(", ")}.` : ""}`);
    } catch (e) { setCerca("Non riusciamo a collegarci ora: riprova tra poco oppure inserisci a mano."); }
  };

  const salva = async (e) => {
    e.preventDefault();
    const nome = f.nome.trim();
    const kcal = Number(String(f.kcal).replace(",", "."));
    if (!nome || !kcal || kcal < 0) { alert("Per salvare servono almeno il nome e le kcal ✨"); return; }
    const per = f.unit === "pz" ? 1 : (Number(String(f.per).replace(",", ".")) || 100);
    const mv = (v) => { const n = Number(String(v).replace(",", ".")); return v === "" || isNaN(n) ? null : n; };
    const riga = {
      ...(alimento?.comune || (isAdmin && perTutte && !alimento?.id) ? {} : { client_id: clientId }), nome, marca: (f.marca || "").trim() || null, unit: f.unit,
      uname: f.unit === "pz" ? (f.uname.trim() || "pezzo") : null, per, kcal,
      proteine: mv(f.proteine), carboidrati: mv(f.carboidrati), grassi: mv(f.grassi), sale: mv(f.sale),
      quantita_abituale: mv(f.quantita_abituale),
    };
    setSalvando(true);
    const tab = alimento?.comune || (isAdmin && perTutte && !alimento?.id) ? "kcal_foods_comuni" : "kcal_foods";
    if (tab === "kcal_foods_comuni" && alimento?.id) { const completo = riga.proteine != null && riga.carboidrati != null && riga.grassi != null; riga.da_controllare = !completo; if (completo) riga.nota = null; }
    const { data: salvato, error } = alimento?.id
      ? await supabase.from(tab).update(riga).eq("id", alimento.id).select().single()
      : await supabase.from(tab).insert(riga).select().single();
    setSalvando(false);
    if (error) { alert("Non siamo riusciti a salvare l'alimento. Riprova tra un attimo 🫶🏻"); return; }
    onSalvato(salvato && tab === "kcal_foods_comuni" ? { ...salvato, comune: true } : salvato);
  };

  const elimina = async () => {
    if (!await confermaApp(`Eliminare "${alimento.nome}" dalla libreria${alimento.comune ? " COMUNE (sparisce per tutte le clienti)" : ""}? Le voci già registrate nel diario non vengono toccate.`)) return;
    setSalvando(true);
    await supabase.from(alimento.comune ? "kcal_foods_comuni" : "kcal_foods").delete().eq("id", alimento.id);
    setSalvando(false);
    onSalvato();
  };

  return (
    <Card className="p-4">
      <form onSubmit={salva} className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">{alimento ? "Modifica alimento" : "Nuovo alimento"}</h3>
          <button type="button" onClick={onAnnulla} className="text-slate-400"><X size={18} /></button>
        </div>
        {!alimento?.id && (
          <div>
            <button type="button" onClick={() => setScanner(true)} className="w-full py-2.5 rounded-xl text-sm font-medium" style={{ background: "#E1EEFB", color: "#27466D" }}><Ic n="scan"/> Scansiona il codice a barre</button>
            {cerca && <p className="text-xs text-slate-500 mt-1.5">{cerca}</p>}
          </div>
        )}
        {scanner && <ScannerBarcode onCodice={daCodice} onChiudi={() => setScanner(false)} />}
        <div><label className="text-slate-400 text-xs">Nome</label><input value={f.nome} onChange={set("nome")} required placeholder="Es. Albume d'uovo" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" /></div>
        <div><label className="text-slate-400 text-xs">Marchio (facoltativo)</label><input value={f.marca} onChange={set("marca")} placeholder="Es. Lidl" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" /></div>
        <div>
          <label className="text-slate-400 text-xs">Come lo pesi</label>
          <select value={f.unit} onChange={set("unit")} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
            <option value="g">In grammi</option><option value="ml">In millilitri</option><option value="pz">A pezzi</option>
          </select>
        </div>
        {f.unit === "pz" && <div><label className="text-slate-400 text-xs">Nome del pezzo</label><input value={f.uname} onChange={set("uname")} placeholder="Es. fetta, uovo, vasetto" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" /></div>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-slate-400 text-xs">Kcal</label><input type="number" inputMode="decimal" step="any" min="0" value={f.kcal} onChange={set("kcal")} required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" /></div>
          {f.unit !== "pz" && <div><label className="text-slate-400 text-xs">Ogni quanti {f.unit}</label><input type="number" inputMode="decimal" step="any" min="0" value={f.per} onChange={set("per")} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" /></div>}
        </div>
        <div>
          <label className="text-slate-400 text-xs">Macro in grammi (per la stessa quantità delle kcal)</label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <input type="number" inputMode="decimal" step="any" min="0" value={f.proteine} onChange={set("proteine")} placeholder="Proteine" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input type="number" inputMode="decimal" step="any" min="0" value={f.carboidrati} onChange={set("carboidrati")} placeholder="Carboidrati" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input type="number" inputMode="decimal" step="any" min="0" value={f.grassi} onChange={set("grassi")} placeholder="Grassi" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div><label className="text-slate-400 text-xs">Sale in grammi (come da etichetta, per la stessa quantità; facoltativo)</label><input type="number" inputMode="decimal" step="any" min="0" value={f.sale} onChange={set("sale")} placeholder="Es. 0,9" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" /></div>
        {isAdmin && alimento?.da_controllare && alimento?.nota && <p className="text-xs rounded-lg px-3 py-2" style={{ background: "#FFFBEF", border: "1px solid #F7E9BE", color: "#27466D" }}>{alimento.nota}</p>}
        {isAdmin && !alimento?.id && <label className="flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" checked={perTutte} onChange={(e) => setPerTutte(e.target.checked)} className="mt-0.5" /><span>Aggiungilo alla libreria comune (visibile a tutte le clienti)</span></label>}
        <div><label className="text-slate-400 text-xs">Quantità abituale (facoltativa)</label><input type="number" inputMode="decimal" step="any" min="0" value={f.quantita_abituale} onChange={set("quantita_abituale")} placeholder="Compare già pronta quando lo aggiungi" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" /></div>
        <div className="flex gap-2 pt-1">
          <button disabled={salvando} className="flex-1 bg-slate-800 text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50">{salvando ? "Salvo..." : "Salva alimento"}</button>
          {alimento?.id && <button type="button" onClick={elimina} disabled={salvando} className="px-4 border border-slate-300 text-slate-800 text-sm font-medium rounded-xl">Elimina</button>}
        </div>
        {alimento?.id && <p className="text-slate-400 text-[11px]">Se modifichi le kcal, le voci già registrate nel diario restano com'erano.</p>}
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Storico — giorno / settimana / mese (visibile a cliente e coach)    */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Lista della spesa: somma gli ingredienti di ricette e pasti scelti  */
/* ------------------------------------------------------------------ */
function ListaSpesa({ clientId, ricette, pasti }) {
  const chiave = "spesa_" + clientId;
  const leggi = () => { try { return JSON.parse(localStorage.getItem(chiave) || "{}"); } catch (e) { return {}; } };
  const [st, setSt] = useState(leggi);
  const [nuovo, setNuovo] = useState("");
  const [aperto, setAperto] = useState(false);
  const salva = (n) => { setSt(n); try { localStorage.setItem(chiave, JSON.stringify(n)); } catch (e) { /* senza memoria locale */ } };
  const q = st.q || {}; const spunte = st.s || {}; const extra = st.x || [];
  const setQ = (id, v) => salva({ ...st, q: { ...q, [id]: Math.max(0, v) } });
  const righe = {};
  const aggiungi = (ing, k) => {
    const nome = (ing.nome || ing.testo || "").trim(); if (!nome) return;
    const unit = ing.unit || "";
    const key = (nome + "|" + unit).toLowerCase();
    const o = (righe[key] = righe[key] || { nome, unit, uname: ing.uname, tot: 0, testo: !ing.quantita });
    o.tot += Number(ing.quantita || 0) * k;
  };
  ricette.forEach((r) => { const k = q["r" + r.id] || 0; if (k > 0) (r.ingredienti || []).forEach((i) => aggiungi(i, k / (Number(r.porzioni) || 1))); });
  pasti.forEach((p) => { const k = q["p" + p.id] || 0; if (k > 0) (p.voci || []).forEach((i) => aggiungi(i, k)); });
  const elenco = Object.entries(righe).sort((a, b) => a[1].nome.localeCompare(b[1].nome, "it"));
  const qtaTxt = (o) => (o.testo || !o.tot ? "" : o.unit === "pz" ? `${num(round1(o.tot))} ${o.uname || "pz"}` : `${num(round1(o.tot))} ${o.unit}`);
  const scelti = ricette.filter((r) => q["r" + r.id] > 0).length + pasti.filter((p) => q["p" + p.id] > 0).length;
  const Riga = ({ id, nome, sotto }) => (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <div className="min-w-0"><p className="text-sm text-slate-700 truncate">{nome}</p>{sotto && <p className="text-[11px] text-slate-400">{sotto}</p>}</div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={() => setQ(id, (q[id] || 0) - 1)} className="w-7 h-7 rounded-full text-sm" style={{ background: "#E1EEFB", color: "#27466D" }}>−</button>
        <span className="w-5 text-center text-sm font-semibold text-slate-700">{q[id] || 0}</span>
        <button onClick={() => setQ(id, (q[id] || 0) + 1)} className="w-7 h-7 rounded-full text-sm" style={{ background: "#27466D", color: "#fff" }}>+</button>
      </div>
    </div>
  );
  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">La tua lista della spesa</p>
        <p className="text-slate-500 text-xs">Scegli quante porzioni (ricette) o quante volte (pasti standard) vuoi preparare: sommo io gli ingredienti ✨</p>
        {elenco.length === 0 && extra.length === 0 && <p className="text-slate-400 text-sm py-2">La lista è vuota: scegli qualcosa qui sotto.</p>}
        {elenco.map(([k, o]) => (
          <label key={k} className="flex items-center gap-2 py-1 border-b border-slate-100 last:border-0">
            <input type="checkbox" checked={!!spunte[k]} onChange={() => salva({ ...st, s: { ...spunte, [k]: !spunte[k] } })} />
            <span className={`flex-1 text-sm ${spunte[k] ? "line-through text-slate-300" : "text-slate-700"}`}>{o.nome}</span>
            <span className={`text-sm font-medium ${spunte[k] ? "text-slate-300" : "text-slate-600"}`}>{qtaTxt(o)}</span>
          </label>
        ))}
        {extra.map((x, i) => (
          <label key={"x" + i} className="flex items-center gap-2 py-1 border-b border-slate-100 last:border-0">
            <input type="checkbox" checked={!!spunte["x" + i]} onChange={() => salva({ ...st, s: { ...spunte, ["x" + i]: !spunte["x" + i] } })} />
            <span className={`flex-1 text-sm ${spunte["x" + i] ? "line-through text-slate-300" : "text-slate-700"}`}>{x}</span>
            <button onClick={(e) => { e.preventDefault(); salva({ ...st, x: extra.filter((_, k) => k !== i), s: { ...spunte, ["x" + i]: false } }); }} className="text-slate-300 text-xs"><Ic n="x" bare/></button>
          </label>
        ))}
        <div className="flex gap-2 pt-1">
          <input value={nuovo} onChange={(e) => setNuovo(e.target.value)} placeholder="Aggiungi altro (es. caffè)" className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
          <button onClick={() => { if (nuovo.trim()) { salva({ ...st, x: [...extra, nuovo.trim()] }); setNuovo(""); } }} className="px-3 rounded-lg text-sm text-white" style={{ background: "#27466D" }}>+</button>
        </div>
        {(elenco.length > 0 || extra.length > 0) && (
          <div className="flex gap-3 pt-1">
            <button onClick={() => { const t = [...elenco.map(([k, o]) => `${spunte[k] ? "✓" : "•"} ${o.nome}${qtaTxt(o) ? " — " + qtaTxt(o) : ""}`), ...extra.map((x, i) => `${spunte["x" + i] ? "✓" : "•"} ${x}`)].join("\n"); if (navigator.share) navigator.share({ title: "Lista della spesa", text: t }).catch(() => {}); else { try { navigator.clipboard.writeText(t); alert("Lista copiata ✨"); } catch (e) { /* niente */ } } }} className="text-xs font-medium" style={{ color: "#3F78B3" }}>Condividi / copia</button>
            <button onClick={async () => { if (await confermaApp("Svuotare la lista?")) salva({}); }} className="text-xs text-slate-400">Svuota</button>
          </div>
        )}
      </Card>
      <Card className="p-4">
        <button onClick={() => setAperto(!aperto)} className="w-full flex items-center justify-between text-left">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Cosa preparo ({scelti} scelte)</p>
          <span className="text-slate-400 text-xs">{aperto ? "Chiudi" : "Apri"}</span>
        </button>
        {aperto && (
          <div className="mt-2">
            {ricette.length === 0 && pasti.length === 0 && <p className="text-slate-400 text-sm">Non ci sono ancora ricette o pasti standard.</p>}
            {ricette.length > 0 && <p className="text-[11px] text-slate-400 mt-1">Ricette (porzioni)</p>}
            {ricette.map((r) => <Riga key={"r" + r.id} id={"r" + r.id} nome={r.nome} sotto={r.porzioni ? `ricetta per ${r.porzioni} porz.` : null} />)}
            {pasti.length > 0 && <p className="text-[11px] text-slate-400 mt-2">Pasti standard (volte)</p>}
            {pasti.map((p) => <Riga key={"p" + p.id} id={"p" + p.id} nome={p.nome} />)}
          </div>
        )}
      </Card>
    </div>
  );
}

function totaliPerGiorno(voci) {
  const m = {};
  voci.forEach((v) => { m[v.data] = (m[v.data] || 0) + Number(v.kcal); });
  return m;
}

function StoricoKcal({ voci, obiettivo, onVaiAGiorno }) {
  const [periodo, setPeriodo] = useState("giorno");
  const perGiorno = useMemo(() => totaliPerGiorno(voci), [voci]);

  const datiGiorno = useMemo(() => {
    const oggi = todayStr();
    const arr = [];
    for (let i = 13; i >= 0; i--) { const d = addDays(oggi, -i); arr.push({ x: d, label: d.slice(8) + "/" + d.slice(5, 7), kcal: Math.round(perGiorno[d] || 0) }); }
    return arr;
  }, [perGiorno]);

  const datiSettimana = useMemo(() => {
    const oggi = parseDate(todayStr());
    const inizi = [];
    const lun = new Date(oggi); lun.setDate(oggi.getDate() - ((oggi.getDay() + 6) % 7));
    for (let i = 9; i >= 0; i--) { const d = new Date(lun); d.setDate(lun.getDate() - 7 * i); inizi.push(fmtDate(d)); }
    return inizi.map((inizio) => {
      let tot = 0, giorni = 0;
      for (let i = 0; i < 7; i++) { const d = addDays(inizio, i); if (perGiorno[d] != null) { tot += perGiorno[d]; giorni++; } }
      return { x: inizio, label: inizio.slice(8) + "/" + inizio.slice(5, 7), kcal: giorni ? Math.round(tot / giorni) : 0, giorni };
    });
  }, [perGiorno]);

  const datiMese = useMemo(() => {
    const oggi = new Date();
    const mesi = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1); mesi.push(d); }
    return mesi.map((d) => {
      const anno = d.getFullYear(), mese = d.getMonth();
      let tot = 0, giorni = 0;
      Object.keys(perGiorno).forEach((k) => {
        const kd = parseDate(k);
        if (kd.getFullYear() === anno && kd.getMonth() === mese) { tot += perGiorno[k]; giorni++; }
      });
      return { x: d, label: d.toLocaleDateString("it-IT", { month: "short" }), kcal: giorni ? Math.round(tot / giorni) : 0, giorni };
    });
  }, [perGiorno]);

  const dati = periodo === "giorno" ? datiGiorno : periodo === "settimana" ? datiSettimana : datiMese;
  const sottotitolo = periodo === "giorno" ? "Totale kcal negli ultimi 14 giorni. Tocca una barra per aprire quel giorno." : periodo === "settimana" ? "Media kcal al giorno nelle ultime 10 settimane (lun-dom)." : "Media kcal al giorno negli ultimi 6 mesi.";

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {[["giorno", "Giorno"], ["settimana", "Settimana"], ["mese", "Mese"]].map(([k, l]) => (
          <button key={k} onClick={() => setPeriodo(k)} className={`flex-1 py-1.5 rounded-full text-sm font-medium ${periodo === k ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>{l}</button>
        ))}
      </div>
      <Card className="p-4">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dati} onClick={(e) => { if (periodo === "giorno" && e?.activePayload?.[0]) onVaiAGiorno(e.activePayload[0].payload.x); }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
            <Tooltip formatter={(v) => [v + " kcal", periodo === "giorno" ? "Totale" : "Media/giorno"]} />
            {obiettivo && <ReferenceLine y={obiettivo} stroke="#94a3b8" strokeDasharray="4 4" />}
            <Bar dataKey="kcal" fill="#0ea5e9" radius={[4, 4, 0, 0]} cursor={periodo === "giorno" ? "pointer" : "default"} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-slate-400 text-xs mt-2">{sottotitolo}{obiettivo ? " Linea tratteggiata = obiettivo." : ""}</p>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Analisi — solo coach: andamento, aderenza, macro medi               */
/* ------------------------------------------------------------------ */
function AnalisiCoach({ voci, obiettivo }) {
  const perGiorno = useMemo(() => totaliPerGiorno(voci), [voci]);

  const dati60 = useMemo(() => {
    const oggi = todayStr();
    const arr = [];
    for (let i = 59; i >= 0; i--) { const d = addDays(oggi, -i); arr.push({ label: d.slice(8) + "/" + d.slice(5, 7), kcal: perGiorno[d] != null ? Math.round(perGiorno[d]) : null }); }
    return arr;
  }, [perGiorno]);

  const ultimi30 = useMemo(() => {
    const oggi = todayStr();
    const giorni = []; for (let i = 29; i >= 0; i--) giorni.push(addDays(oggi, -i));
    const registrati = giorni.filter((d) => perGiorno[d] != null);
    const aderenza = Math.round((registrati.length / 30) * 100);
    const vociPeriodo = voci.filter((v) => giorni.includes(v.data));
    const conMacro = vociPeriodo.filter((v) => v.proteine != null);
    const p = conMacro.reduce((a, v) => a + Number(v.proteine), 0);
    const c = conMacro.reduce((a, v) => a + Number(v.carboidrati), 0);
    const g = conMacro.reduce((a, v) => a + Number(v.grassi), 0);
    const giorniConMacro = new Set(conMacro.map((v) => v.data)).size || 1;
    const mediaKcal = registrati.length ? Math.round(registrati.reduce((a, d) => a + perGiorno[d], 0) / registrati.length) : null;
    return { aderenza, giorniRegistrati: registrati.length, mediaKcal, p: p / giorniConMacro, c: c / giorniConMacro, g: g / giorniConMacro };
  }, [voci, perGiorno]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4"><div className="text-2xl font-semibold text-slate-800">{ultimi30.aderenza}%</div><div className="text-slate-400 text-xs mt-0.5">Giorni registrati (ultimi 30, {ultimi30.giorniRegistrati}/30)</div></Card>
        <Card className="p-4"><div className="text-2xl font-semibold text-slate-800">{ultimi30.mediaKcal ?? "—"}</div><div className="text-slate-400 text-xs mt-0.5">Media kcal/giorno (ultimi 30)</div></Card>
      </div>
      <Card className="p-4">
        <p className="text-sm font-medium text-slate-700 mb-2">Macro medi al giorno (ultimi 30gg)</p>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="bg-slate-50 rounded-xl px-3 py-2"><div className="font-semibold text-slate-800">{num(ultimi30.p)} g</div><div className="text-slate-400 text-xs">Proteine</div></div>
          <div className="bg-slate-50 rounded-xl px-3 py-2"><div className="font-semibold text-slate-800">{num(ultimi30.c)} g</div><div className="text-slate-400 text-xs">Carboidrati</div></div>
          <div className="bg-slate-50 rounded-xl px-3 py-2"><div className="font-semibold text-slate-800">{num(ultimi30.g)} g</div><div className="text-slate-400 text-xs">Grassi</div></div>
        </div>
      </Card>
      <Card className="p-4">
        <p className="text-sm font-medium text-slate-700 mb-2">Andamento kcal — ultimi 60 giorni</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={dati60}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} interval={6} />
            <YAxis tick={{ fontSize: 12, fill: "#64748b" }} domain={["auto", "auto"]} />
            <Tooltip />
            {obiettivo && <ReferenceLine y={obiettivo} stroke="#94a3b8" strokeDasharray="4 4" />}
            <Line type="monotone" dataKey="kcal" stroke="#0ea5e9" strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-slate-400 text-xs mt-2">I giorni senza voci registrate non sono mostrati in linea.{obiettivo ? " Linea tratteggiata = obiettivo." : ""}</p>
      </Card>
    </div>
  );
}
