import React, { useState, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { X, Plus, Search, Trash2, Pencil, BookOpen, UtensilsCrossed, Apple } from "lucide-react";

/* Ricette e pasti standard della sezione Macros (usati da DiarioKcal) */

export const MEALS = [["colazione", "Colazione"], ["pranzo", "Pranzo"], ["spuntini", "Spuntini"], ["cena", "Cena"]];
const nomePasto = (k) => (MEALS.find((m) => m[0] === k) || [k, k])[1];

function pad(n) { return n < 10 ? "0" + n : "" + n; }
function oggiStr() { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function round1(n) { return Math.round(n * 10) / 10; }
function num(n) { return Number(n ?? 0).toLocaleString("it-IT", { maximumFractionDigits: 1 }); }
function foodKcal(f, amt) { return round1((f.kcal * amt) / f.per); }
function hasMacro(f) { return f && f.proteine != null && f.carboidrati != null && f.grassi != null; }
function macroFor(f, amt) {
  return hasMacro(f) ? { p: round1((f.proteine * amt) / f.per), c: round1((f.carboidrati * amt) / f.per), g: round1((f.grassi * amt) / f.per) } : null;
}
function perLabel(f) { return f.unit === "pz" ? "1 " + (f.uname || "pezzo") : num(f.per) + " " + f.unit; }
function amtLabel(unit, uname, amt) { return unit === "pz" ? num(amt) + " × " + (uname || "pezzo") : num(amt) + " " + unit; }
function labelData(date) {
  if (date === oggiStr()) return "oggi";
  const p = date.split("-");
  return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("it-IT", { day: "numeric", month: "long" });
}

export function voceDa(food, a) {
  const m = macroFor(food, a);
  return {
    food_id: food.id || null, nome: food.nome, marca: food.marca || null, unit: food.unit, uname: food.uname || null,
    quantita: a, kcal: foodKcal(food, a), proteine: m?.p ?? null, carboidrati: m?.c ?? null, grassi: m?.g ?? null,
  };
}
function somma(voci) {
  const t = { kcal: 0, p: 0, c: 0, g: 0, incompleto: false };
  voci.forEach((v) => {
    t.kcal += Number(v.kcal || 0);
    if (v.proteine == null || v.carboidrati == null || v.grassi == null) t.incompleto = true;
    t.p += Number(v.proteine || 0); t.c += Number(v.carboidrati || 0); t.g += Number(v.grassi || 0);
  });
  return { kcal: round1(t.kcal), p: round1(t.p), c: round1(t.c), g: round1(t.g), incompleto: t.incompleto };
}
const macroTxt = (t) => (t.incompleto && !t.p && !t.c && !t.g ? "Macro non inseriti" : `P ${num(t.p)} · C ${num(t.c)} · G ${num(t.g)}`);

function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>{children}</div>;
}
function Foglio({ children, onChiudi, alto = false }) {
  return (
    <div className={`fixed inset-0 bg-black/50 ${alto ? "z-[60]" : "z-50"} flex items-end sm:items-center justify-center`} onClick={(e) => { if (e.target === e.currentTarget) onChiudi(); }}>
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl max-h-[88vh] overflow-y-auto p-5 space-y-4">{children}</div>
    </div>
  );
}
const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2 text-sm";

/* ---------- inserimento nel diario ---------- */
export async function inserisciPasto(p, { clientId, date, meal, isAdmin }) {
  const righe = (p.voci || []).map((v) => ({
    client_id: clientId, data: date, pasto: meal, food_id: v.food_id || null, nome: v.nome, marca: v.marca || null,
    unit: v.unit, uname: v.uname || null, quantita: v.quantita, kcal: v.kcal, proteine: v.proteine, carboidrati: v.carboidrati, grassi: v.grassi,
    creato_da: isAdmin ? "coach" : "cliente",
  }));
  if (!righe.length) return;
  await supabase.from("kcal_voci").insert(righe);
}

/* ---------- scelta alimento con quantità (per ingredienti e pasti) ---------- */
function PickerAlimento({ foods, onScegli, onChiudi, libero = false, titolo = "Scegli alimento" }) {
  const [q, setQ] = useState("");
  const [food, setFood] = useState(null);
  const [amt, setAmt] = useState("");
  const [modoLibero, setModoLibero] = useState(false);
  const [l, setL] = useState({ nome: "", quantita: "", kcal: "", p: "", c: "", g: "" });
  const risultati = useMemo(() => {
    const t = q.trim().toLowerCase();
    return foods.filter((f) => !t || (f.nome + " " + (f.marca || "")).toLowerCase().includes(t)).sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  }, [foods, q]);
  const step = food ? (food.unit === "pz" ? 0.5 : food.per <= 20 ? 5 : 10) : 1;
  const n = (x) => (x === "" || isNaN(Number(String(x).replace(",", "."))) ? null : Number(String(x).replace(",", ".")));

  return (
    <Foglio onChiudi={onChiudi} alto>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">{modoLibero ? "Ingrediente libero" : titolo}</h3>
        <button onClick={onChiudi} className="text-slate-400"><X size={20} /></button>
      </div>
      {modoLibero ? (
        <div className="space-y-2">
          <input className={inputCls} placeholder="Nome (es. Passata di pomodoro)" value={l.nome} onChange={(e) => setL({ ...l, nome: e.target.value })} />
          <input className={inputCls} inputMode="decimal" placeholder="Quantità in grammi" value={l.quantita} onChange={(e) => setL({ ...l, quantita: e.target.value })} />
          <p className="text-xs text-slate-500">Valori totali per questa quantità:</p>
          <div className="grid grid-cols-2 gap-2">
            {[["kcal", "kcal"], ["p", "Proteine g"], ["c", "Carboidrati g"], ["g", "Grassi g"]].map(([k, lab]) => (
              <input key={k} className={inputCls} inputMode="decimal" placeholder={lab} value={l[k]} onChange={(e) => setL({ ...l, [k]: e.target.value })} />
            ))}
          </div>
          <button disabled={!l.nome.trim() || !n(l.quantita) || n(l.kcal) == null}
            onClick={() => onScegli({ food_id: null, nome: l.nome.trim(), marca: null, unit: "g", uname: null, quantita: n(l.quantita), kcal: n(l.kcal), proteine: n(l.p), carboidrati: n(l.c), grassi: n(l.g) })}
            className="w-full bg-slate-800 text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-40">Aggiungi</button>
        </div>
      ) : !food ? (
        <>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-3 text-sky-600" />
            <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Cerca tra gli alimenti" className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm" />
          </div>
          {libero && <button onClick={() => setModoLibero(true)} className="w-full border border-sky-200 bg-sky-50 text-sky-700 text-sm font-medium rounded-xl py-2">+ Ingrediente libero (macro a mano)</button>}
          <div className="space-y-1 max-h-[50vh] overflow-y-auto">
            {risultati.map((f) => (
              <button key={f.id} onClick={() => { setFood(f); setAmt(f.quantita_abituale || (f.unit === "pz" ? 1 : f.per)); }} className="w-full flex items-center justify-between text-left border-b border-slate-100 py-2.5">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 text-sm">{f.nome}</div>
                  <div className="text-slate-400 text-xs">{f.marca || "Senza marca"}</div>
                </div>
                <span className="text-slate-500 text-xs text-right flex-shrink-0 ml-2">{num(f.kcal)} kcal<br />per {perLabel(f)}</span>
              </button>
            ))}
            {!risultati.length && <p className="text-slate-400 text-sm py-3">Nessun alimento trovato. Puoi aggiungerlo dalla sezione Alimenti.</p>}
          </div>
        </>
      ) : (
        <>
          <div><h3 className="font-semibold text-slate-800">{food.nome}</h3><p className="text-slate-400 text-xs">{num(food.kcal)} kcal per {perLabel(food)}</p></div>
          <div className="flex items-center gap-2">
            <button onClick={() => setAmt((v) => Math.max(0, round1(Number(v || 0) - step)))} className="w-10 h-10 rounded-full border border-slate-200 text-slate-500 text-lg">−</button>
            <input type="number" inputMode="decimal" step="any" min="0" value={amt} onChange={(e) => setAmt(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-center text-lg font-medium" />
            <button onClick={() => setAmt((v) => round1(Number(v || 0) + step))} className="w-10 h-10 rounded-full border border-slate-200 text-slate-500 text-lg">+</button>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-slate-800">{Math.round(foodKcal(food, Number(amt || 0)))} <span className="text-sm font-normal text-slate-400">kcal</span></div>
            <div className="text-slate-400 text-sm">{macroFor(food, Number(amt || 0)) ? `P ${num(macroFor(food, Number(amt)).p)} · C ${num(macroFor(food, Number(amt)).c)} · G ${num(macroFor(food, Number(amt)).g)}` : "Macro non inseriti"}</div>
          </div>
          <div className="flex gap-2">
            <button disabled={!Number(amt)} onClick={() => onScegli(voceDa(food, Number(amt)))} className="flex-1 bg-slate-800 text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-40">Aggiungi</button>
            <button onClick={() => setFood(null)} className="px-4 border border-slate-200 text-slate-500 text-sm rounded-xl">Cambia</button>
          </div>
        </>
      )}
    </Foglio>
  );
}

/* ---------- elenco voci modificabili (usato nei form) ---------- */
function ElencoVoci({ voci, setVoci, aggiungi }) {
  return (
    <div className="space-y-1">
      {voci.map((v, i) => (
        <div key={i} className="flex items-center gap-2 border-b border-slate-100 py-2">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-slate-800 truncate">{v.nome}</div>
            <div className="text-xs text-slate-400">{amtLabel(v.unit, v.uname, v.quantita)} · {Math.round(v.kcal)} kcal</div>
          </div>
          <button onClick={() => setVoci(voci.filter((_, j) => j !== i))} className="text-slate-400 p-1"><X size={16} /></button>
        </div>
      ))}
      <button onClick={aggiungi} className="w-full text-sky-600 text-sm font-medium border border-dashed border-sky-200 rounded-xl py-2 mt-2 flex items-center justify-center gap-1"><Plus size={14} /> Aggiungi ingrediente</button>
    </div>
  );
}

/* ====================== RICETTE ====================== */
export function RicetteVista({ ricette, foods, clientId, isAdmin, date, onCambiato, aperta, setAperta }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("tutte");
  const [modifica, setModifica] = useState(undefined); // undefined chiuso, null nuova, oggetto

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    return ricette.filter((r) => (cat === "tutte" || r.categoria === cat) && (!t || r.nome.toLowerCase().includes(t))).sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  }, [ricette, q, cat]);

  if (modifica !== undefined) {
    return <RicettaForm r={modifica} foods={foods} clientId={clientId} isAdmin={isAdmin} onAnnulla={() => setModifica(undefined)} onSalvata={() => { setModifica(undefined); onCambiato(); }} />;
  }
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-3 text-sky-600" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca ricetta" className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm bg-white" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[["tutte", "Tutte"], ...MEALS].map(([k, l]) => (
          <button key={k} onClick={() => setCat(k)} className={`px-3 py-1 rounded-full text-xs whitespace-nowrap flex-shrink-0 ${cat === k ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>{l}</button>
        ))}
      </div>
      <button onClick={() => setModifica(null)} className="w-full border border-sky-200 bg-sky-50 text-sky-700 text-sm font-medium rounded-xl py-2.5">+ Nuova ricetta</button>
      {lista.map((r) => (
        <button key={r.id} onClick={() => setAperta(r)} className="w-full text-left">
          <Card className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-slate-800 text-sm">{r.nome}</div>
                <div className="text-xs text-slate-400 mt-0.5">{r.categoria ? nomePasto(r.categoria) + " · " : ""}{r.tempo_min ? r.tempo_min + " min · " : ""}{r.client_id ? "solo per te" : "per tutte"}</div>
              </div>
              <span className="text-slate-700 text-sm font-medium flex-shrink-0">{Math.round(r.kcal || 0)} kcal</span>
            </div>
            <div className="text-xs text-slate-500 mt-1.5">a porzione · {r.proteine == null ? "Macro non inseriti" : `P ${num(r.proteine)} · C ${num(r.carboidrati)} · G ${num(r.grassi)}`}</div>
          </Card>
        </button>
      ))}
      {!lista.length && <p className="text-slate-400 text-sm text-center py-6">{ricette.length ? "Nessuna ricetta con questi filtri." : "Ancora nessuna ricetta. Quando ne arriveranno, le trovi qui."}</p>}
      {aperta && (
        <RicettaDettaglio r={aperta} clientId={clientId} isAdmin={isAdmin} date={date}
          onChiudi={() => setAperta(null)}
          onModifica={() => { const r = aperta; setAperta(null); setModifica(r); }}
          onFatto={() => { setAperta(null); onCambiato(); }} />
      )}
    </div>
  );
}

export function RicettaDettaglio({ r, clientId, isAdmin, date, mealIniziale, onChiudi, onModifica, onFatto, onEliminata }) {
  const [porz, setPorz] = useState(1);
  const [meal, setMeal] = useState(mealIniziale || (MEALS.some((m) => m[0] === r.categoria) ? r.categoria : "pranzo"));
  const [salvando, setSalvando] = useState(false);
  const puoModificare = isAdmin || r.client_id === clientId;
  const base = Number(r.porzioni) || 1;
  const k = Number(porz) || 0;
  const scala = (x) => (x == null ? null : round1(Number(x) * k));

  const aggiungi = async () => {
    if (!k) return;
    setSalvando(true);
    await supabase.from("kcal_voci").insert({
      client_id: clientId, data: date, pasto: meal, food_id: null, nome: r.nome, marca: null, unit: "pz", uname: "porzione", quantita: k,
      kcal: scala(r.kcal) ?? 0, proteine: scala(r.proteine), carboidrati: scala(r.carboidrati), grassi: scala(r.grassi),
      creato_da: isAdmin ? "coach" : "cliente",
    });
    setSalvando(false);
    onFatto();
  };
  const elimina = async () => {
    if (!confirm("Eliminare questa ricetta?")) return;
    await supabase.from("kcal_ricette").delete().eq("id", r.id);
    (onEliminata || onFatto)();
  };

  return (
    <Foglio onChiudi={onChiudi}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-slate-800 break-words">{r.nome}</h3>
          <p className="text-slate-400 text-xs">{r.categoria ? nomePasto(r.categoria) + " · " : ""}{base} {base === 1 ? "porzione" : "porzioni"}{r.tempo_min ? " · " + r.tempo_min + " min" : ""}</p>
        </div>
        <button onClick={onChiudi} className="text-slate-400 flex-shrink-0"><X size={20} /></button>
      </div>
      <div className="bg-slate-50 rounded-xl px-4 py-3 text-center">
        <div className="text-2xl font-semibold text-slate-800">{Math.round(scala(r.kcal) || 0)} <span className="text-sm font-normal text-slate-400">kcal</span></div>
        <div className="text-slate-500 text-xs mt-0.5">{r.proteine == null ? "Macro non inseriti" : `P ${num(scala(r.proteine))} · C ${num(scala(r.carboidrati))} · G ${num(scala(r.grassi))}`}</div>
      </div>
      {!!(r.ingredienti || []).length && (
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">Ingredienti ({num(k)} {k === 1 ? "porzione" : "porzioni"})</p>
          {r.ingredienti.map((v, i) => (
            <div key={i} className="flex justify-between text-sm py-1.5 border-b border-slate-100">
              <span className="text-slate-700">{v.nome}</span>
              <span className="text-slate-400 text-xs">{amtLabel(v.unit, v.uname, round1((Number(v.quantita) * k) / base))}</span>
            </div>
          ))}
        </div>
      )}
      {r.procedimento && (
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">Procedimento</p>
          <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{r.procedimento}</p>
        </div>
      )}
      <div className="border-t border-slate-100 pt-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Porzioni</span>
          <button onClick={() => setPorz((v) => Math.max(0.5, round1(Number(v) - 0.5)))} className="w-9 h-9 rounded-full border border-slate-200 text-slate-500">−</button>
          <input type="number" inputMode="decimal" step="any" min="0" value={porz} onChange={(e) => setPorz(e.target.value)} className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-center font-medium" />
          <button onClick={() => setPorz((v) => round1(Number(v) + 0.5))} className="w-9 h-9 rounded-full border border-slate-200 text-slate-500">+</button>
          <select value={meal} onChange={(e) => setMeal(e.target.value)} className="flex-1 min-w-0 border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white">
            {MEALS.map(([key, l]) => <option key={key} value={key}>{l}</option>)}
          </select>
        </div>
        <button onClick={aggiungi} disabled={salvando || !k} className="w-full bg-slate-800 text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-40">
          {salvando ? "Aggiungo..." : `Aggiungi a ${nomePasto(meal)} (${labelData(date)})`}
        </button>
        {puoModificare && onModifica && (
          <div className="flex gap-2">
            <button onClick={onModifica} className="flex-1 border border-slate-200 text-slate-600 text-sm rounded-xl py-2 flex items-center justify-center gap-1"><Pencil size={14} /> Modifica</button>
            <button onClick={elimina} className="flex-1 border border-slate-200 text-slate-600 text-sm rounded-xl py-2 flex items-center justify-center gap-1"><Trash2 size={14} /> Elimina</button>
          </div>
        )}
      </div>
    </Foglio>
  );
}

function RicettaForm({ r, foods, clientId, isAdmin, onAnnulla, onSalvata }) {
  const [nome, setNome] = useState(r?.nome || "");
  const [categoria, setCategoria] = useState(r?.categoria || "pranzo");
  const [porzioni, setPorzioni] = useState(String(r?.porzioni || 1));
  const [tempo, setTempo] = useState(r?.tempo_min ? String(r.tempo_min) : "");
  const [ingr, setIngr] = useState(r?.ingredienti || []);
  const [proc, setProc] = useState(r?.procedimento || "");
  const [per, setPer] = useState(r ? (r.client_id ? "questa" : "tutte") : "tutte");
  const [picker, setPicker] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const np = Math.max(0.5, Number(String(porzioni).replace(",", ".")) || 1);
  const tot = somma(ingr);

  const salva = async () => {
    if (!nome.trim() || !ingr.length) { alert("Inserisci almeno il nome e un ingrediente."); return; }
    setSalvando(true);
    const riga = {
      nome: nome.trim(), categoria, porzioni: np, tempo_min: tempo ? Number(tempo) : null, ingredienti: ingr, procedimento: proc.trim() || null,
      kcal: round1(tot.kcal / np),
      proteine: tot.incompleto && !tot.p ? null : round1(tot.p / np),
      carboidrati: tot.incompleto && !tot.p ? null : round1(tot.c / np),
      grassi: tot.incompleto && !tot.p ? null : round1(tot.g / np),
      client_id: isAdmin && per === "tutte" ? null : clientId,
    };
    const { error } = r?.id
      ? await supabase.from("kcal_ricette").update(riga).eq("id", r.id)
      : await supabase.from("kcal_ricette").insert({ ...riga, creato_da: isAdmin ? "coach" : "cliente" });
    setSalvando(false);
    if (error) { alert("Non sono riuscita a salvare la ricetta."); return; }
    onSalvata();
  };

  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700">{r?.id ? "Modifica ricetta" : "Nuova ricetta"}</p>
      <input className={inputCls} placeholder="Nome ricetta" value={nome} onChange={(e) => setNome(e.target.value)} />
      <div className="grid grid-cols-3 gap-2">
        <select className={inputCls + " bg-white"} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          {MEALS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input className={inputCls} inputMode="decimal" placeholder="Porzioni" value={porzioni} onChange={(e) => setPorzioni(e.target.value)} />
        <input className={inputCls} inputMode="numeric" placeholder="Minuti" value={tempo} onChange={(e) => setTempo(e.target.value)} />
      </div>
      <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Ingredienti (per tutta la ricetta)</p>
      <ElencoVoci voci={ingr} setVoci={setIngr} aggiungi={() => setPicker(true)} />
      {!!ingr.length && (
        <div className="bg-slate-50 rounded-xl px-3 py-2 text-xs text-slate-600">
          A porzione: <b>{Math.round(tot.kcal / np)} kcal</b> · {tot.incompleto && !tot.p ? "Macro non inseriti" : `P ${num(tot.p / np)} · C ${num(tot.c / np)} · G ${num(tot.g / np)}`}
          {tot.incompleto && tot.p > 0 && <span className="block text-slate-500 mt-0.5">Alcuni ingredienti non hanno i macro: i valori sono parziali.</span>}
        </div>
      )}
      <textarea className={inputCls} rows={5} placeholder="Procedimento" value={proc} onChange={(e) => setProc(e.target.value)} />
      {isAdmin && (
        <div className="flex gap-2">
          {[["tutte", "Per tutte le clienti"], ["questa", "Solo per questa cliente"]].map(([k, l]) => (
            <button key={k} onClick={() => setPer(k)} className={`flex-1 text-xs rounded-xl py-2 ${per === k ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>{l}</button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={salva} disabled={salvando} className="flex-1 bg-slate-800 text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-40">{salvando ? "Salvo..." : "Salva ricetta"}</button>
        <button onClick={onAnnulla} className="px-4 text-sm text-slate-500 border border-slate-200 rounded-xl">Annulla</button>
      </div>
      {picker && <PickerAlimento foods={foods} libero titolo="Aggiungi ingrediente" onChiudi={() => setPicker(false)} onScegli={(v) => { setIngr([...ingr, v]); setPicker(false); }} />}
    </Card>
  );
}

/* ====================== PASTI STANDARD ====================== */
export function PastiVista({ pasti, foods, clientId, isAdmin, date, onCambiato }) {
  const [modifica, setModifica] = useState(undefined);
  if (modifica !== undefined) {
    return <PastoForm p={modifica} foods={foods} clientId={clientId} isAdmin={isAdmin} onAnnulla={() => setModifica(undefined)} onSalvato={() => { setModifica(undefined); onCambiato(); }} />;
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Pasti già pronti: con un tocco finiscono nel diario di {labelData(date)}. Puoi crearne di nuovi qui, oppure dal Diario con «Salva come pasto standard».</p>
      <button onClick={() => setModifica(null)} className="w-full border border-sky-200 bg-sky-50 text-sky-700 text-sm font-medium rounded-xl py-2.5">+ Nuovo pasto standard</button>
      {pasti.map((p) => <PastoCard key={p.id} p={p} clientId={clientId} isAdmin={isAdmin} date={date} onCambiato={onCambiato} onModifica={() => setModifica(p)} />)}
      {!pasti.length && <p className="text-slate-400 text-sm text-center py-6">Ancora nessun pasto standard.</p>}
    </div>
  );
}

function PastoCard({ p, clientId, isAdmin, date, onCambiato, onModifica }) {
  const [meal, setMeal] = useState(MEALS.some((m) => m[0] === p.pasto) ? p.pasto : "pranzo");
  const [lavoro, setLavoro] = useState(false);
  const t = somma(p.voci || []);
  const puoModificare = isAdmin || p.client_id === clientId;
  const aggiungi = async () => {
    setLavoro(true);
    await inserisciPasto(p, { clientId, date, meal, isAdmin });
    setLavoro(false);
    onCambiato();
    alert(`Aggiunto a ${nomePasto(meal)} ✨`);
  };
  const elimina = async () => {
    if (!confirm("Eliminare questo pasto standard?")) return;
    await supabase.from("kcal_pasti_standard").delete().eq("id", p.id);
    onCambiato();
  };
  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-slate-800 text-sm">{p.nome}</div>
          <div className="text-xs text-slate-400">{p.client_id ? "solo per te" : "per tutte"}</div>
        </div>
        <span className="text-slate-700 text-sm font-medium flex-shrink-0">{Math.round(t.kcal)} kcal</span>
      </div>
      <div className="text-xs text-slate-500">{(p.voci || []).map((v) => `${v.nome} ${amtLabel(v.unit, v.uname, v.quantita)}`).join(" · ")}</div>
      <div className="text-xs text-slate-500">{macroTxt(t)}</div>
      <div className="flex items-center gap-2">
        <select value={meal} onChange={(e) => setMeal(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white">
          {MEALS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button onClick={aggiungi} disabled={lavoro} className="flex-1 bg-slate-800 text-white text-xs font-medium rounded-lg py-2.5 disabled:opacity-40">Aggiungi a {labelData(date)}</button>
        {puoModificare && <button onClick={onModifica} className="p-2 border border-slate-200 rounded-lg text-sky-600"><Pencil size={14} /></button>}
        {puoModificare && <button onClick={elimina} className="p-2 border border-slate-200 rounded-lg text-sky-600"><Trash2 size={14} /></button>}
      </div>
    </Card>
  );
}

function PastoForm({ p, foods, clientId, isAdmin, onAnnulla, onSalvato }) {
  const [nome, setNome] = useState(p?.nome || "");
  const [pasto, setPasto] = useState(p?.pasto || "pranzo");
  const [voci, setVoci] = useState(p?.voci || []);
  const [per, setPer] = useState(p ? (p.client_id ? "questa" : "tutte") : "tutte");
  const [picker, setPicker] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const t = somma(voci);
  const salva = async () => {
    if (!nome.trim() || !voci.length) { alert("Inserisci un nome e almeno un alimento."); return; }
    setSalvando(true);
    const riga = { nome: nome.trim(), pasto, voci, client_id: isAdmin && per === "tutte" ? null : clientId };
    const { error } = p?.id
      ? await supabase.from("kcal_pasti_standard").update(riga).eq("id", p.id)
      : await supabase.from("kcal_pasti_standard").insert({ ...riga, creato_da: isAdmin ? "coach" : "cliente" });
    setSalvando(false);
    if (error) { alert("Non sono riuscita a salvare il pasto."); return; }
    onSalvato();
  };
  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700">{p?.id ? "Modifica pasto standard" : "Nuovo pasto standard"}</p>
      <input className={inputCls} placeholder="Nome (es. Colazione tipo)" value={nome} onChange={(e) => setNome(e.target.value)} />
      <select className={inputCls + " bg-white"} value={pasto} onChange={(e) => setPasto(e.target.value)}>
        {MEALS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <ElencoVoci voci={voci} setVoci={setVoci} aggiungi={() => setPicker(true)} />
      {!!voci.length && <div className="bg-slate-50 rounded-xl px-3 py-2 text-xs text-slate-600"><b>{Math.round(t.kcal)} kcal</b> · {macroTxt(t)}</div>}
      {isAdmin && (
        <div className="flex gap-2">
          {[["tutte", "Per tutte le clienti"], ["questa", "Solo per questa cliente"]].map(([k, l]) => (
            <button key={k} onClick={() => setPer(k)} className={`flex-1 text-xs rounded-xl py-2 ${per === k ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>{l}</button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={salva} disabled={salvando} className="flex-1 bg-slate-800 text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-40">{salvando ? "Salvo..." : "Salva pasto"}</button>
        <button onClick={onAnnulla} className="px-4 text-sm text-slate-500 border border-slate-200 rounded-xl">Annulla</button>
      </div>
      {picker && <PickerAlimento foods={foods} libero titolo="Aggiungi alimento" onChiudi={() => setPicker(false)} onScegli={(v) => { setVoci([...voci, v]); setPicker(false); }} />}
    </Card>
  );
}

/* ---------- salva un pasto del diario come pasto standard ---------- */
export function SalvaPastoModal({ voci, meal, clientId, isAdmin, onChiudi, onSalvato }) {
  const [nome, setNome] = useState("");
  const [per, setPer] = useState("questa");
  const [salvando, setSalvando] = useState(false);
  const salva = async () => {
    if (!nome.trim()) return;
    setSalvando(true);
    const snap = voci.map((v) => ({ food_id: v.food_id || null, nome: v.nome, marca: v.marca || null, unit: v.unit, uname: v.uname || null, quantita: v.quantita, kcal: v.kcal, proteine: v.proteine, carboidrati: v.carboidrati, grassi: v.grassi }));
    const { error } = await supabase.from("kcal_pasti_standard").insert({
      nome: nome.trim(), pasto: meal, voci: snap, client_id: isAdmin && per === "tutte" ? null : clientId, creato_da: isAdmin ? "coach" : "cliente",
    });
    setSalvando(false);
    if (error) { alert("Non sono riuscita a salvarlo."); return; }
    onSalvato();
  };
  const t = somma(voci);
  return (
    <Foglio onChiudi={onChiudi}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Salva come pasto standard</h3>
        <button onClick={onChiudi} className="text-slate-400"><X size={20} /></button>
      </div>
      <p className="text-xs text-slate-500">{nomePasto(meal)} · {voci.length} alimenti · {Math.round(t.kcal)} kcal</p>
      <input autoFocus className={inputCls} placeholder="Nome (es. Colazione tipo)" value={nome} onChange={(e) => setNome(e.target.value)} />
      {isAdmin && (
        <div className="flex gap-2">
          {[["tutte", "Per tutte le clienti"], ["questa", "Solo per questa cliente"]].map(([k, l]) => (
            <button key={k} onClick={() => setPer(k)} className={`flex-1 text-xs rounded-xl py-2 ${per === k ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>{l}</button>
          ))}
        </div>
      )}
      <button onClick={salva} disabled={salvando || !nome.trim()} className="w-full bg-slate-800 text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-40">{salvando ? "Salvo..." : "Salva"}</button>
    </Foglio>
  );
}

/* ---------- "+ Aggiungi" nel diario: pasto standard / ricetta / alimento ---------- */
export function SceltaAggiunta({ meal, pasti, ricette, onAlimento, onPasto, onRicetta, onChiudi }) {
  const [modo, setModo] = useState(null);
  const ordinati = (arr, key) => [...arr].sort((a, b) => (b[key] === meal) - (a[key] === meal) || a.nome.localeCompare(b.nome, "it"));
  const bottone = (Icon, titolo, sotto, onClick) => (
    <button onClick={onClick} className="w-full flex items-center gap-3 text-left border border-slate-200 rounded-xl px-4 py-3">
      <Icon size={20} className="text-sky-600 flex-shrink-0" />
      <div><div className="text-sm font-medium text-slate-800">{titolo}</div><div className="text-xs text-slate-400">{sotto}</div></div>
    </button>
  );
  return (
    <Foglio onChiudi={onChiudi}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">{modo ? (modo === "pasto" ? "Pasti standard" : "Ricette") : `Aggiungi a ${nomePasto(meal)}`}</h3>
        <button onClick={onChiudi} className="text-slate-400"><X size={20} /></button>
      </div>
      {!modo && (
        <div className="space-y-2">
          {bottone(UtensilsCrossed, "Pasto standard", `${pasti.length} disponibili · tutto il pasto con un tocco`, () => setModo("pasto"))}
          {bottone(BookOpen, "Ricetta", `${ricette.length} disponibili · con macro a porzione`, () => setModo("ricetta"))}
          {bottone(Apple, "Singolo alimento", "Cerca nella tua lista alimenti", onAlimento)}
        </div>
      )}
      {modo === "pasto" && (
        <div className="space-y-1">
          {ordinati(pasti, "pasto").map((p) => {
            const t = somma(p.voci || []);
            return (
              <button key={p.id} onClick={() => onPasto(p)} className="w-full text-left border-b border-slate-100 py-2.5">
                <div className="flex justify-between"><span className="text-sm font-medium text-slate-800">{p.nome}</span><span className="text-sm text-slate-600">{Math.round(t.kcal)} kcal</span></div>
                <div className="text-xs text-slate-400 truncate">{(p.voci || []).map((v) => v.nome).join(" · ")}</div>
              </button>
            );
          })}
          {!pasti.length && <p className="text-slate-400 text-sm py-3">Ancora nessun pasto standard. Puoi crearne uno dalla sezione Pasti standard.</p>}
        </div>
      )}
      {modo === "ricetta" && (
        <div className="space-y-1">
          {ordinati(ricette, "categoria").map((r) => (
            <button key={r.id} onClick={() => onRicetta(r)} className="w-full text-left border-b border-slate-100 py-2.5">
              <div className="flex justify-between"><span className="text-sm font-medium text-slate-800">{r.nome}</span><span className="text-sm text-slate-600">{Math.round(r.kcal || 0)} kcal</span></div>
              <div className="text-xs text-slate-400">a porzione{r.proteine == null ? "" : ` · P ${num(r.proteine)} · C ${num(r.carboidrati)} · G ${num(r.grassi)}`}</div>
            </button>
          ))}
          {!ricette.length && <p className="text-slate-400 text-sm py-3">Ancora nessuna ricetta.</p>}
        </div>
      )}
    </Foglio>
  );
}
