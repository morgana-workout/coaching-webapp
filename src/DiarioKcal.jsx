import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { X, Plus } from "lucide-react";
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
function mLine(m) { return m ? `P ${num(m.p)} · C ${num(m.c)} · G ${num(m.g)}` : "Macro non inseriti"; }

/* ------------------------------------------------------------------ */
/* Componente principale — usato sia nell'area cliente sia, con       */
/* isAdmin, nella scheda cliente lato coach (stesso pattern di         */
/* DiarioAllenamento).                                                 */
/* ------------------------------------------------------------------ */
export default function DiarioKcal({ clientId, isAdmin = false }) {
  const [caricando, setCaricando] = useState(true);
  const [foods, setFoods] = useState([]);
  const [voci, setVoci] = useState([]);
  const [obiettivo, setObiettivo] = useState(null);
  const [vista, setVista] = useState("diario"); // diario | storico | libreria | analisi
  const [date, setDate] = useState(todayStr());

  const carica = async () => {
    const [{ data: fd }, { data: vc }, { data: cl }] = await Promise.all([
      supabase.from("kcal_foods").select("*").eq("client_id", clientId).order("nome"),
      supabase.from("kcal_voci").select("*").eq("client_id", clientId).order("data"),
      supabase.from("clients").select("obiettivo_kcal").eq("id", clientId).single(),
    ]);
    setFoods(fd || []);
    setVoci(vc || []);
    setObiettivo(cl?.obiettivo_kcal ?? null);
    setCaricando(false);
  };
  useEffect(() => { carica(); }, [clientId]);

  const salvaObiettivo = async (v) => {
    setObiettivo(v);
    await supabase.from("clients").update({ obiettivo_kcal: v }).eq("id", clientId);
  };

  const vociPerGiorno = useMemo(() => {
    const m = {};
    voci.forEach((v) => { (m[v.data] = m[v.data] || []).push(v); });
    return m;
  }, [voci]);

  if (caricando) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[["diario", "Diario"], ["storico", "Storico"], ["libreria", "Alimenti"], ...(isAdmin ? [["analisi", "Analisi"]] : [])].map(([k, l]) => (
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
          obiettivo={obiettivo} onObiettivoCambiato={salvaObiettivo} onCambiato={carica}
        />
      )}
      {vista === "storico" && <StoricoKcal voci={voci} obiettivo={obiettivo} onVaiAGiorno={(d) => { setDate(d); setVista("diario"); }} />}
      {vista === "libreria" && <LibreriaAlimenti clientId={clientId} foods={foods} onCambiato={carica} />}
      {vista === "analisi" && isAdmin && <AnalisiCoach voci={voci} obiettivo={obiettivo} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Diario del giorno                                                   */
/* ------------------------------------------------------------------ */
function DiarioGiorno({ clientId, isAdmin, date, setDate, foods, vociGiorno, vociIeri, obiettivo, onObiettivoCambiato, onCambiato }) {
  const [sheet, setSheet] = useState(null); // { meal } | { meal, food, amt, entryId }
  const [editObiettivo, setEditObiettivo] = useState(false);

  const totaleKcal = vociGiorno.reduce((a, v) => a + Number(v.kcal), 0);
  const totaleMacro = vociGiorno.reduce((a, v) => ({
    p: a.p + (v.proteine ?? 0), c: a.c + (v.carboidrati ?? 0), g: a.g + (v.grassi ?? 0),
    mancanti: a.mancanti + (v.proteine == null ? 1 : 0),
  }), { p: 0, c: 0, g: 0, mancanti: 0 });

  const label = parseDate(date).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  const pct = obiettivo ? Math.min(100, (totaleKcal / obiettivo) * 100) : 0;
  const sopra = obiettivo && totaleKcal > obiettivo;

  const copiaIeri = async (meal) => {
    const daCopiare = vociIeri.filter((v) => v.pasto === meal);
    if (!daCopiare.length) return;
    await supabase.from("kcal_voci").insert(daCopiare.map((v) => ({
      client_id: clientId, data: date, pasto: meal, food_id: v.food_id, nome: v.nome, marca: v.marca,
      unit: v.unit, uname: v.uname, quantita: v.quantita, kcal: v.kcal, proteine: v.proteine, carboidrati: v.carboidrati, grassi: v.grassi,
      creato_da: isAdmin ? "coach" : "cliente",
    })));
    onCambiato();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => setDate(addDays(date, -1))} className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500">‹</button>
        <div className="flex-1 text-center text-sm font-medium text-slate-700 capitalize">{label}</div>
        <button onClick={() => setDate(addDays(date, 1))} className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500">›</button>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold text-slate-800">{Math.round(totaleKcal)}</span>
          <span className="text-slate-400 text-sm">kcal {date === todayStr() ? "oggi" : "in questo giorno"}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-50 rounded-xl px-3 py-2"><div className="font-semibold text-slate-800">{num(totaleMacro.p)} g</div><div className="text-slate-400 text-xs">Proteine</div></div>
          <div className="bg-slate-50 rounded-xl px-3 py-2"><div className="font-semibold text-slate-800">{num(totaleMacro.c)} g</div><div className="text-slate-400 text-xs">Carboidrati</div></div>
          <div className="bg-slate-50 rounded-xl px-3 py-2"><div className="font-semibold text-slate-800">{num(totaleMacro.g)} g</div><div className="text-slate-400 text-xs">Grassi</div></div>
        </div>
        {totaleMacro.mancanti > 0 && <p className="text-amber-600 text-xs">Macro parziali: {totaleMacro.mancanti} alimento/i senza valori inseriti.</p>}

        {!editObiettivo ? (
          obiettivo ? (
            <div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${sopra ? "bg-amber-500" : "bg-sky-500"}`} style={{ width: pct + "%" }} /></div>
              <div className="flex justify-between items-center mt-1.5">
                <span className="text-slate-500 text-xs">{sopra ? `Sopra di ${Math.round(totaleKcal - obiettivo)}` : `Restano ${Math.round(obiettivo - totaleKcal)}`} kcal su {num(obiettivo)}</span>
                <button onClick={() => setEditObiettivo(true)} className="text-sky-600 text-xs font-medium flex-shrink-0">Cambia obiettivo</button>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center"><span className="text-slate-400 text-xs">Nessun obiettivo impostato</span><button onClick={() => setEditObiettivo(true)} className="text-sky-600 text-xs font-medium">Imposta obiettivo</button></div>
          )
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); const v = Number(new FormData(e.target).get("t")); onObiettivoCambiato(v > 0 ? v : null); setEditObiettivo(false); }} className="flex gap-2">
            <input name="t" type="number" min="0" defaultValue={obiettivo || ""} placeholder="kcal al giorno" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" autoFocus />
            <button className="bg-slate-800 text-white text-sm font-medium rounded-lg px-3">Salva</button>
          </form>
        )}
      </Card>

      <div className="space-y-4">
        {MEALS.map(([key, nome]) => {
          const list = vociGiorno.filter((v) => v.pasto === key);
          const totMeal = list.reduce((a, v) => a + Number(v.kcal), 0);
          const ieriMeal = vociIeri.filter((v) => v.pasto === key);
          return (
            <div key={key}>
              <div className="flex items-center justify-between border-b-2 border-slate-800 pb-1.5 mb-2">
                <h3 className="font-semibold text-slate-800">{nome}</h3>
                <span className="text-slate-400 text-sm">{Math.round(totMeal)} kcal</span>
                <button onClick={() => setSheet({ meal: key })} className="text-sky-600 text-sm font-medium flex items-center gap-1"><Plus size={14} /> Aggiungi</button>
              </div>
              {!list.length && (
                <div className="flex items-center justify-between text-slate-400 text-sm py-2">
                  <span>Ancora niente.</span>
                  {!!ieriMeal.length && <button onClick={() => copiaIeri(key)} className="text-sky-600 font-medium">Copia da ieri ({ieriMeal.length})</button>}
                </div>
              )}
              {list.map((v) => (
                <button key={v.id} onClick={() => setSheet({ meal: key, entryId: v.id, food: v, amt: v.quantita })}
                  className="w-full flex items-center gap-3 text-left border-b border-slate-100 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 text-sm">{v.nome}</div>
                    <div className="text-slate-400 text-xs">{amtLabel(v.unit, v.uname, v.quantita)}{v.marca ? " · " + v.marca : ""}{v.creato_da === "coach" ? " · aggiunto dal coach" : ""}</div>
                  </div>
                  <span className="text-slate-700 text-sm font-medium flex-shrink-0">{Math.round(v.kcal)} kcal</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>

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

  // In modifica di una voce già salvata, ricostruiamo un "alimento" equivalente a partire
  // dalla voce stessa (così la modifica funziona anche se l'alimento originale è stato
  // nel frattempo cambiato o eliminato dalla libreria — la voce è indipendente).
  useEffect(() => {
    if (sheet.entryId && !food) {
      const originale = foods.find((f) => f.id === sheet.food.food_id);
      setFood(originale || {
        id: sheet.food.food_id, nome: sheet.food.nome, marca: sheet.food.marca, unit: sheet.food.unit,
        uname: sheet.food.uname, per: sheet.food.quantita, kcal: sheet.food.kcal,
        proteine: sheet.food.proteine, carboidrati: sheet.food.carboidrati, grassi: sheet.food.grassi,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const risultati = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = foods.filter((f) => !t || (f.nome + " " + (f.marca || "")).toLowerCase().includes(t));
    return list.sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  }, [foods, q]);

  const chiudi = () => setSheet(null);

  const scegli = (f) => { setFood(f); setAmt(f.quantita_abituale || (f.unit === "pz" ? 1 : f.per)); };

  const conferma = async () => {
    const a = Number(String(amt).replace(",", "."));
    if (!a || a <= 0) { alert("Inserisci una quantità maggiore di zero."); return; }
    setSalvando(true);
    const m = macroFor(food, a);
    const riga = {
      client_id: clientId, data: date, pasto: sheet.meal, food_id: food.id || null,
      nome: food.nome, marca: food.marca || null, unit: food.unit, uname: food.uname || null,
      quantita: a, kcal: foodKcal(food, a), proteine: m?.p ?? null, carboidrati: m?.c ?? null, grassi: m?.g ?? null,
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) chiudi(); }}>
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl max-h-[88vh] overflow-y-auto p-5 space-y-4">
        {!food ? (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">{nomeTitolo}</h3>
              <button onClick={chiudi} className="text-slate-400"><X size={20} /></button>
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Cerca tra i tuoi alimenti"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm" />
            <div className="space-y-1 max-h-[50vh] overflow-y-auto">
              {risultati.map((f) => (
                <button key={f.id} onClick={() => scegli(f)} className="w-full flex items-center justify-between text-left border-b border-slate-100 py-2.5">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 text-sm">{f.nome}</div>
                    <div className="text-slate-400 text-xs">{f.marca || "Senza marca"} · {mLine(hasMacro(f) ? macroFor(f, f.per) : null)}</div>
                  </div>
                  <span className="text-slate-500 text-xs text-right flex-shrink-0 ml-2">{num(f.kcal)} kcal<br />per {perLabel(f)}</span>
                </button>
              ))}
              {!risultati.length && (
                <p className="text-slate-400 text-sm py-3">
                  {foods.length ? "Nessun alimento con questo nome." : "La libreria è ancora vuota."}{" "}
                  Vai nella scheda "Alimenti" per aggiungerne uno nuovo, poi torna qui per usarlo.
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><h3 className="text-lg font-semibold text-slate-800 break-words">{food.nome}</h3><p className="text-slate-400 text-xs">{food.marca || "Senza marca"} · {num(food.kcal)} kcal per {perLabel(food)}</p></div>
              <button onClick={chiudi} className="text-slate-400 flex-shrink-0"><X size={20} /></button>
            </div>
            <div>
              <label className="text-slate-400 text-xs">Quantità ({food.unit === "pz" ? (food.uname || "pezzi") : food.unit})</label>
              <div className="flex items-center gap-2 mt-1">
                <button onClick={() => setAmt((v) => Math.max(0, round1(Number(v || 0) - (food.unit === "pz" ? 0.5 : food.per <= 20 ? 5 : 10))))} className="w-10 h-10 rounded-full border border-slate-200 text-slate-500 text-lg flex-shrink-0">−</button>
                <input type="number" inputMode="decimal" min="0" value={amt} onChange={(e) => setAmt(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-center text-lg font-medium" />
                <button onClick={() => setAmt((v) => round1(Number(v || 0) + (food.unit === "pz" ? 0.5 : food.per <= 20 ? 5 : 10)))} className="w-10 h-10 rounded-full border border-slate-200 text-slate-500 text-lg flex-shrink-0">+</button>
              </div>
            </div>
            <div className="text-center py-2">
              <div className="text-3xl font-semibold text-slate-800">{Math.round(foodKcal(food, Number(amt || 0)))} <span className="text-base font-normal text-slate-400">kcal</span></div>
              <div className="text-slate-400 text-sm mt-1">{mLine(macroFor(food, Number(amt || 0)))}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={conferma} disabled={salvando} className="flex-1 bg-slate-800 text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50">{salvando ? "Salvo..." : sheet.entryId ? "Salva modifica" : `Aggiungi a ${nomeTitolo}`}</button>
              {sheet.entryId
                ? <button onClick={elimina} disabled={salvando} className="px-4 border border-rose-200 text-rose-600 text-sm font-medium rounded-xl">Elimina</button>
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
function LibreriaAlimenti({ clientId, foods, onCambiato }) {
  const [modifica, setModifica] = useState(undefined); // undefined = form chiuso, null = nuovo, oggetto = modifica

  if (modifica !== undefined) {
    return <FormAlimento clientId={clientId} alimento={modifica} onAnnulla={() => setModifica(undefined)} onSalvato={() => { setModifica(undefined); onCambiato(); }} />;
  }

  return (
    <div className="space-y-3">
      <button onClick={() => setModifica(null)} className="w-full bg-slate-800 text-white text-sm font-medium rounded-xl py-2.5">+ Nuovo alimento</button>
      <Card className="divide-y divide-slate-100">
        {[...foods].sort((a, b) => a.nome.localeCompare(b.nome, "it")).map((f) => (
          <button key={f.id} onClick={() => setModifica(f)} className="w-full flex items-center justify-between text-left px-4 py-3">
            <div className="min-w-0">
              <div className="font-medium text-slate-800 text-sm">{f.nome}</div>
              <div className="text-slate-400 text-xs">{f.marca || "Senza marca"} · {mLine(hasMacro(f) ? macroFor(f, f.per) : null)}</div>
            </div>
            <span className="text-slate-500 text-xs text-right flex-shrink-0 ml-2">{num(f.kcal)} kcal<br />per {perLabel(f)}</span>
          </button>
        ))}
        {!foods.length && <p className="text-slate-400 text-sm p-4">Non hai ancora alimenti. Aggiungine uno per iniziare a usare il diario.</p>}
      </Card>
    </div>
  );
}

function FormAlimento({ clientId, alimento, onAnnulla, onSalvato }) {
  const x = alimento || { nome: "", marca: "", unit: "g", uname: "", per: 100, kcal: "", proteine: "", carboidrati: "", grassi: "", quantita_abituale: "" };
  const [f, setF] = useState({ ...x });
  const [salvando, setSalvando] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const salva = async (e) => {
    e.preventDefault();
    const nome = f.nome.trim();
    const kcal = Number(String(f.kcal).replace(",", "."));
    if (!nome || !kcal || kcal < 0) { alert("Servono almeno nome e kcal."); return; }
    const per = f.unit === "pz" ? 1 : (Number(String(f.per).replace(",", ".")) || 100);
    const mv = (v) => { const n = Number(String(v).replace(",", ".")); return v === "" || isNaN(n) ? null : n; };
    const riga = {
      client_id: clientId, nome, marca: f.marca.trim() || null, unit: f.unit,
      uname: f.unit === "pz" ? (f.uname.trim() || "pezzo") : null, per, kcal,
      proteine: mv(f.proteine), carboidrati: mv(f.carboidrati), grassi: mv(f.grassi),
      quantita_abituale: mv(f.quantita_abituale),
    };
    setSalvando(true);
    if (alimento?.id) await supabase.from("kcal_foods").update(riga).eq("id", alimento.id);
    else await supabase.from("kcal_foods").insert(riga);
    setSalvando(false);
    onSalvato();
  };

  const elimina = async () => {
    if (!confirm(`Eliminare "${alimento.nome}" dalla libreria? Le voci già registrate nel diario non vengono toccate.`)) return;
    setSalvando(true);
    await supabase.from("kcal_foods").delete().eq("id", alimento.id);
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
        <div><label className="text-slate-400 text-xs">Nome</label><input value={f.nome} onChange={set("nome")} required placeholder="Es. Albume d'uovo" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" /></div>
        <div><label className="text-slate-400 text-xs">Marca (facoltativa)</label><input value={f.marca} onChange={set("marca")} placeholder="Es. Lidl" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" /></div>
        <div>
          <label className="text-slate-400 text-xs">Come lo pesi</label>
          <select value={f.unit} onChange={set("unit")} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
            <option value="g">In grammi</option><option value="ml">In millilitri</option><option value="pz">A pezzi</option>
          </select>
        </div>
        {f.unit === "pz" && <div><label className="text-slate-400 text-xs">Nome del pezzo</label><input value={f.uname} onChange={set("uname")} placeholder="Es. fetta, uovo, vasetto" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" /></div>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-slate-400 text-xs">Kcal</label><input type="number" inputMode="decimal" min="0" value={f.kcal} onChange={set("kcal")} required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" /></div>
          {f.unit !== "pz" && <div><label className="text-slate-400 text-xs">Ogni quanti {f.unit}</label><input type="number" inputMode="decimal" min="0" value={f.per} onChange={set("per")} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" /></div>}
        </div>
        <div>
          <label className="text-slate-400 text-xs">Macro in grammi (per la stessa quantità delle kcal)</label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <input type="number" inputMode="decimal" min="0" value={f.proteine} onChange={set("proteine")} placeholder="Proteine" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input type="number" inputMode="decimal" min="0" value={f.carboidrati} onChange={set("carboidrati")} placeholder="Carboidrati" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input type="number" inputMode="decimal" min="0" value={f.grassi} onChange={set("grassi")} placeholder="Grassi" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div><label className="text-slate-400 text-xs">Quantità abituale (facoltativa)</label><input type="number" inputMode="decimal" min="0" value={f.quantita_abituale} onChange={set("quantita_abituale")} placeholder="Compare già pronta quando lo aggiungi" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" /></div>
        <div className="flex gap-2 pt-1">
          <button disabled={salvando} className="flex-1 bg-slate-800 text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50">{salvando ? "Salvo..." : "Salva alimento"}</button>
          {alimento?.id && <button type="button" onClick={elimina} disabled={salvando} className="px-4 border border-rose-200 text-rose-600 text-sm font-medium rounded-xl">Elimina</button>}
        </div>
        {alimento?.id && <p className="text-slate-400 text-[11px]">Se modifichi le kcal, le voci già registrate nel diario restano com'erano.</p>}
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Storico — giorno / settimana / mese (visibile a cliente e coach)    */
/* ------------------------------------------------------------------ */
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
            {obiettivo && <ReferenceLine y={obiettivo} stroke="#f59e0b" strokeDasharray="4 4" />}
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
            {obiettivo && <ReferenceLine y={obiettivo} stroke="#f59e0b" strokeDasharray="4 4" />}
            <Line type="monotone" dataKey="kcal" stroke="#0ea5e9" strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-slate-400 text-xs mt-2">I giorni senza voci registrate non sono mostrati in linea.{obiettivo ? " Linea tratteggiata = obiettivo." : ""}</p>
      </Card>
    </div>
  );
}
