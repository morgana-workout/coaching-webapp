import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { Droplets, Minus, Pencil } from "lucide-react";

const pad = (n) => (n < 10 ? "0" + n : "" + n);
const dataLocale = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const oggiStr = () => dataLocale(new Date());
const giorniFa = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dataLocale(d); };
const litri = (ml) => (ml / 1000).toLocaleString("it-IT", { maximumFractionDigits: 2 });
const BICCHIERE = 250;
const BOTTIGLIA = 500;
const NOMI_G = ["D", "L", "M", "M", "G", "V", "S"];

function messaggio(ml, ob) {
  const resta = Math.max(0, ob - ml);
  const bicchieri = Math.ceil(resta / BICCHIERE);
  const ora = new Date().getHours();
  const pct = ml / ob;
  if (pct >= 1) return "Obiettivo raggiunto, bravissima! ✨";
  if (pct >= 0.75) return `Quasi arrivata, ancora ${bicchieri} ${bicchieri === 1 ? "bicchiere" : "bicchieri"} 🫶🏻`;
  if (ora < 11 && pct < 0.25) return "Inizia con un bicchiere d'acqua, ti aiuta a partire bene ✨";
  const atteso = ob * Math.min(1, Math.max(0, (ora - 7) / 14));
  if (ml >= atteso - BICCHIERE) return `Sei in linea 🫶🏻 Ancora ${bicchieri} ${bicchieri === 1 ? "bicchiere" : "bicchieri"} per oggi`;
  return "Un bicchiere adesso e ti rimetti in pari 💧";
}

export function AcquaCliente({ clientId }) {
  const [righe, setRighe] = useState(null); // ultime righe, dalla più recente
  const [modificaOb, setModificaOb] = useState(false);
  const [storico, setStorico] = useState(false);
  const [errore, setErrore] = useState("");
  const oggi = oggiStr();
  const carica = async () => {
    const { data } = await supabase.from("acqua_giorni").select("*").eq("client_id", clientId).gte("data", giorniFa(13)).order("data", { ascending: false });
    setRighe(data || []);
  };
  useEffect(() => { carica(); }, [clientId]);
  if (!righe) return null;
  const rigaOggi = righe.find((r) => r.data === oggi);
  const ultimoOb = righe[0]?.obiettivo_ml || 2000;
  const ob = rigaOggi?.obiettivo_ml || ultimoOb;
  const ml = rigaOggi?.ml || 0;
  const salva = async (nuovoMl, nuovoOb) => {
    setErrore("");
    const riga = { client_id: clientId, data: oggi, ml: Math.max(0, Math.min(10000, nuovoMl)), obiettivo_ml: nuovoOb, updated_at: new Date().toISOString() };
    setRighe((rr) => [riga, ...rr.filter((r) => r.data !== oggi)].sort((a, b) => b.data.localeCompare(a.data)));
    const { error } = await supabase.from("acqua_giorni").upsert(riga, { onConflict: "client_id,data" });
    if (error) { setErrore("Non sono riuscita a salvare, riprova 🫶🏻"); carica(); }
  };
  const nBicchieri = Math.min(12, Math.max(1, Math.ceil(ob / BICCHIERE)));
  const pieni = Math.floor(ml / BICCHIERE);
  const giorni = Array.from({ length: 7 }, (_, i) => { const d = giorniFa(6 - i); const r = righe.find((x) => x.data === d); return { d, ml: r?.ml || 0, ob: r?.obiettivo_ml || ob, lett: NOMI_G[new Date(d + "T12:00:00").getDay()] }; });
  const raggiunti = giorni.filter((g) => g.ml >= g.ob && g.ml > 0).length;
  const registrati = giorni.filter((g) => g.ml > 0);
  const media = registrati.length ? registrati.reduce((a, g) => a + g.ml, 0) / registrati.length : 0;
  return (
    <div className="rounded-3xl p-4 space-y-3" style={{ background: "#fff", border: "1.5px solid #C9E0F7" }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: "#27466D" }}><Droplets size={17} strokeWidth={1.8} style={{ color: "#3F78B3" }} /> Acqua di oggi</p>
        {modificaOb ? (
          <select value={ob} onChange={(e) => { salva(ml, Number(e.target.value)); setModificaOb(false); }} className="text-xs rounded-lg px-2 py-1" style={{ border: "1px solid #C9E0F7", color: "#27466D" }}>
            {Array.from({ length: 15 }, (_, i) => 1000 + i * 250).map((v) => <option key={v} value={v}>{litri(v)} L</option>)}
          </select>
        ) : (
          <button onClick={() => setModificaOb(true)} className="text-[11px] flex items-center gap-1" style={{ color: "#7a8da3" }}>obiettivo {litri(ob)} L <Pencil size={11} /></button>
        )}
      </div>
      <p className="text-3xl font-bold" style={{ color: "#27466D" }}>{litri(ml)} <span className="text-sm font-medium" style={{ color: "#7a8da3" }}>/ {litri(ob)} litri</span></p>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "#E1EEFB" }}><div className="h-full rounded-full" style={{ width: `${Math.min(100, (ml / ob) * 100)}%`, background: "linear-gradient(90deg,#4F8FD0,#7DB4E8)", transition: "width .3s" }} /></div>
      <div className="flex gap-1">{Array.from({ length: nBicchieri }, (_, i) => <span key={i} className="flex-1 h-6 rounded-md" style={{ background: i < pieni ? "#4F8FD0" : "#E1EEFB", border: `1px solid ${i < pieni ? "#4F8FD0" : "#C9E0F7"}` }} />)}</div>
      <p className="text-xs" style={{ color: "#3F78B3" }}>{messaggio(ml, ob)}</p>
      <div className="flex gap-2">
        <button onClick={() => salva(ml + BICCHIERE, ob)} className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white" style={{ background: "#27466D" }}>+ Bicchiere</button>
        <button onClick={() => salva(ml + BOTTIGLIA, ob)} className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white" style={{ background: "#27466D" }}>+ Bottiglia 500</button>
        <button onClick={() => salva(ml - BICCHIERE, ob)} disabled={ml <= 0} aria-label="Togli un bicchiere" className="w-11 rounded-xl flex items-center justify-center disabled:opacity-40" style={{ background: "#E1EEFB", color: "#27466D" }}><Minus size={16} /></button>
      </div>
      {errore && <p className="text-xs" style={{ color: "#7a6a3a" }}>{errore}</p>}
      <button onClick={() => setStorico(!storico)} className="text-xs font-semibold" style={{ color: "#3F78B3" }}>{storico ? "Nascondi" : "Ultimi 7 giorni"}</button>
      {storico && (
        <div>
          <p className="text-[11px]" style={{ color: "#7a8da3" }}>{registrati.length ? `Media ${litri(media)} L · obiettivo raggiunto ${raggiunti} ${raggiunti === 1 ? "giorno" : "giorni"} su 7` : "Ancora nessun giorno registrato"}</p>
          <div className="flex items-end gap-1.5 h-16 mt-2">
            {giorni.map((g) => <div key={g.d} className="flex-1 rounded-t-md" style={{ height: `${Math.max(4, Math.min(100, (g.ml / g.ob) * 100))}%`, background: g.ml >= g.ob && g.ml > 0 ? "#4F8FD0" : "#C9E0F7" }} />)}
          </div>
          <div className="flex gap-1.5 mt-1">{giorni.map((g) => <span key={g.d} className="flex-1 text-center text-[9px]" style={{ color: "#7a8da3" }}>{g.lett}</span>)}</div>
        </div>
      )}
    </div>
  );
}

export function AcquaCoach({ clientId, nome }) {
  const [righe, setRighe] = useState(null);
  useEffect(() => { supabase.from("acqua_giorni").select("*").eq("client_id", clientId).gte("data", giorniFa(13)).order("data", { ascending: false }).then(({ data }) => setRighe(data || [])); }, [clientId]);
  if (!righe) return null;
  const reg = righe.filter((r) => r.ml > 0);
  const media = reg.length ? reg.reduce((a, r) => a + r.ml, 0) / reg.length : 0;
  const ob = righe[0]?.obiettivo_ml || 2000;
  const ok = reg.filter((r) => r.ml >= r.obiettivo_ml).length;
  const giorni = Array.from({ length: 14 }, (_, i) => { const d = giorniFa(13 - i); const r = righe.find((x) => x.data === d); return { d, ml: r?.ml || 0, ob: r?.obiettivo_ml || ob }; });
  return (
    <div className="rounded-2xl p-4 space-y-2" style={{ background: "#fff", border: "1px solid #dbe7f3" }}>
      <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "#27466D" }}><Droplets size={16} strokeWidth={1.8} style={{ color: "#3F78B3" }} /> Idratazione</p>
      <p className="text-[11px]" style={{ color: "#7a8da3" }}>Ultimi 14 giorni</p>
      {reg.length === 0 ? <p className="text-xs" style={{ color: "#7a8da3" }}>{(nome || "").split(" ")[0]} non ha ancora registrato acqua.</p> : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-2.5 text-center" style={{ background: "#F5FAFE", border: "1px solid #dbe7f3" }}><p className="text-lg font-semibold" style={{ color: "#27466D" }}>{litri(media)} L</p><p className="text-[10px]" style={{ color: "#7a8da3" }}>media giornaliera</p></div>
            <div className="rounded-xl p-2.5 text-center" style={{ background: "#F5FAFE", border: "1px solid #dbe7f3" }}><p className="text-lg font-semibold" style={{ color: "#27466D" }}>{ok}/{reg.length}</p><p className="text-[10px]" style={{ color: "#7a8da3" }}>giorni all'obiettivo</p></div>
          </div>
          <div className="flex items-end gap-1 h-12">{giorni.map((g) => <div key={g.d} className="flex-1 rounded-t" style={{ height: `${Math.max(4, Math.min(100, (g.ml / g.ob) * 100))}%`, background: g.ml >= g.ob && g.ml > 0 ? "#4F8FD0" : "#C9E0F7" }} />)}</div>
          {media < ob * 0.75 && <div className="rounded-xl p-2.5 text-xs leading-snug" style={{ background: "#FFFBEF", border: "1px solid #F7E9BE", color: "#6b5d2e" }}>Apporto idrico medio inferiore all'obiettivo: una buona idratazione supporta sazietà, digestione e recupero, soprattutto con fibre e proteine alte.</div>}
        </>
      )}
    </div>
  );
}
