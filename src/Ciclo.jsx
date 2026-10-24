import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";

/* ------------------------------------------------------------------ */
/* Calendario del ciclo mestruale                                      */
/* La cliente segna l'inizio del ciclo; l'app calcola la fase e        */
/* mostra consigli generali (modificabili da Morgana).                 */
/* ------------------------------------------------------------------ */
function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>{children}</div>;
}
function Spinner() {
  return <div className="flex justify-center pt-12"><div className="w-8 h-8 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" /></div>;
}

function pad(n) { return n < 10 ? "0" + n : "" + n; }
function fmtDate(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function oggiStr() { return fmtDate(new Date()); }
function parseDate(s) { const p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); }
function diffDays(a, b) { // a - b in giorni
  const A = parseDate(a), B = parseDate(b);
  return Math.round((Date.UTC(A.getFullYear(), A.getMonth(), A.getDate()) - Date.UTC(B.getFullYear(), B.getMonth(), B.getDate())) / 86400000);
}
function fmtIt(s) { return s ? s.split("-").reverse().join("/") : ""; }
function fmtCorta(s) { return parseDate(s).toLocaleDateString("it-IT", { day: "numeric", month: "long" }); }

const FASI = ["mestruale", "follicolare", "ovulatoria", "luteale", "premestruale"];
const STILE = {
  mestruale: { bg: "bg-rose-100", testo: "text-rose-700", punto: "bg-rose-400", barra: "bg-rose-50 border-rose-100" },
  follicolare: { bg: "bg-emerald-100", testo: "text-emerald-700", punto: "bg-emerald-400", barra: "bg-emerald-50 border-emerald-100" },
  ovulatoria: { bg: "bg-amber-100", testo: "text-amber-700", punto: "bg-amber-400", barra: "bg-amber-50 border-amber-100" },
  luteale: { bg: "bg-indigo-100", testo: "text-indigo-700", punto: "bg-indigo-400", barra: "bg-indigo-50 border-indigo-100" },
  premestruale: { bg: "bg-slate-200", testo: "text-slate-700", punto: "bg-slate-500", barra: "bg-slate-50 border-slate-200" },
};

// Durata abituale: quella impostata da Morgana, altrimenti la media degli ultimi cicli registrati, altrimenti 28 giorni
function durataCiclo(inizi, override) {
  if (override && override >= 20 && override <= 45) return override;
  const diffs = [];
  for (let i = 1; i < inizi.length; i++) {
    const d = diffDays(inizi[i], inizi[i - 1]);
    if (d >= 20 && d <= 45) diffs.push(d);
  }
  const ultimi = diffs.slice(-6);
  return ultimi.length ? Math.round(ultimi.reduce((a, b) => a + b, 0) / ultimi.length) : 28;
}

function faseDelGiorno(giorno, L, flusso) {
  const ov = L - 14;
  const ovInizio = Math.max(flusso + 1, ov - 1);
  const ovFine = ovInizio + 2;
  const prem = Math.max(ovFine + 1, L - 4);
  if (giorno <= flusso) return "mestruale";
  if (giorno < ovInizio) return "follicolare";
  if (giorno <= ovFine) return "ovulatoria";
  if (giorno < prem) return "luteale";
  return "premestruale";
}

// Fase di un giorno qualsiasi (passato, oggi o futuro previsto)
function faseInData(data, inizi, L, flusso) {
  if (!inizi.length || data < inizi[0]) return null;
  let idx = -1;
  for (let i = 0; i < inizi.length; i++) if (inizi[i] <= data) idx = i;
  const inizio = inizi[idx];
  const prossimo = inizi[idx + 1];
  let giorno = diffDays(data, inizio) + 1;
  let previsto = false;
  let lun = prossimo ? diffDays(prossimo, inizio) : L;
  if (!prossimo && giorno > L) { // oltre la fine prevista: proietta i cicli futuri
    giorno = ((giorno - 1) % L) + 1;
    previsto = true;
  }
  return { fase: faseDelGiorno(giorno, Math.max(lun, 20), flusso), giorno, previsto };
}

export function cicloAttivoPer(client, impostazioni) {
  if (client?.sesso === "M" && !impostazioni) return false;
  return impostazioni ? impostazioni.attivo !== false : client?.sesso !== "M";
}

function CampoTesto({ etichetta, valore, onChange, righe = 3 }) {
  return (
    <div>
      <label className="text-slate-400 text-xs">{etichetta}</label>
      <textarea value={valore || ""} onChange={(e) => onChange(e.target.value)} rows={righe}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
    </div>
  );
}

function EditorConsigli({ consigli, onSalvato, onChiudi }) {
  const [bozza, setBozza] = useState(() => Object.fromEntries(consigli.map((c) => [c.fase, { ...c }])));
  const [aperta, setAperta] = useState(consigli[0]?.fase || null);
  const [salvando, setSalvando] = useState(false);

  const salva = async () => {
    setSalvando(true);
    const righe = Object.values(bozza).map((c) => ({
      fase: c.fase, ordine: c.ordine, emoji: c.emoji, titolo: c.titolo,
      ormoni: c.ormoni || null, sensazioni: c.sensazioni || null, allenamento: c.allenamento || null, extra: c.extra || null,
    }));
    const { error } = await supabase.from("ciclo_consigli").upsert(righe, { onConflict: "fase" });
    setSalvando(false);
    if (error) { alert("Non sono riuscita a salvare i consigli. Riprova."); return; }
    onSalvato();
  };
  const set = (fase, campo, v) => setBozza((b) => ({ ...b, [fase]: { ...b[fase], [campo]: v } }));

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-800">Consigli per fase</p>
        <button onClick={onChiudi} className="text-slate-400 text-sm">Chiudi</button>
      </div>
      <p className="text-slate-400 text-xs">Valgono per tutte le clienti. Le modifiche si vedono subito nell'app.</p>
      {consigli.map((c) => {
        const b = bozza[c.fase];
        const st = STILE[c.fase] || STILE.premestruale;
        return (
          <div key={c.fase} className={`border rounded-xl ${st.barra}`}>
            <button onClick={() => setAperta(aperta === c.fase ? null : c.fase)} className="w-full flex items-center justify-between px-3 py-2.5 text-left">
              <span className="text-sm font-medium text-slate-800">{b.emoji} {b.titolo}</span>
              <span className="text-slate-400 text-xs">{aperta === c.fase ? "Chiudi" : "Modifica"}</span>
            </button>
            {aperta === c.fase && (
              <div className="px-3 pb-3 space-y-2">
                <CampoTesto etichetta="Cosa succede (ormoni)" valore={b.ormoni} onChange={(v) => set(c.fase, "ormoni", v)} />
                <CampoTesto etichetta="Come potresti sentirti" valore={b.sensazioni} onChange={(v) => set(c.fase, "sensazioni", v)} />
                <CampoTesto etichetta="Allenamento" valore={b.allenamento} onChange={(v) => set(c.fase, "allenamento", v)} righe={4} />
                <CampoTesto etichetta="Consigli extra" valore={b.extra} onChange={(v) => set(c.fase, "extra", v)} righe={4} />
              </div>
            )}
          </div>
        );
      })}
      <button onClick={salva} disabled={salvando} className="w-full bg-slate-800 text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-50">
        {salvando ? "Salvo..." : "Salva i consigli"}
      </button>
    </Card>
  );
}

function CalendarioMese({ mese, setMese, inizi, L, flusso, oggi }) {
  const primo = new Date(mese.anno, mese.mese, 1);
  const giorniNelMese = new Date(mese.anno, mese.mese + 1, 0).getDate();
  const offset = (primo.getDay() + 6) % 7; // lunedì = 0
  const celle = [];
  for (let i = 0; i < offset; i++) celle.push(null);
  for (let d = 1; d <= giorniNelMese; d++) celle.push(fmtDate(new Date(mese.anno, mese.mese, d)));
  const titolo = primo.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const vai = (n) => {
    const d = new Date(mese.anno, mese.mese + n, 1);
    setMese({ anno: d.getFullYear(), mese: d.getMonth() });
  };
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => vai(-1)} className="w-9 h-9 rounded-full border border-slate-200 text-slate-500">‹</button>
        <p className="text-sm font-medium text-slate-700 capitalize">{titolo}</p>
        <button onClick={() => vai(1)} className="w-9 h-9 rounded-full border border-slate-200 text-slate-500">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["L", "M", "M", "G", "V", "S", "D"].map((g, i) => <div key={i} className="text-slate-400 text-xs py-1">{g}</div>)}
        {celle.map((data, i) => {
          if (!data) return <div key={i} />;
          const f = faseInData(data, inizi, L, flusso);
          const st = f ? STILE[f.fase] : null;
          const èOggi = data === oggi;
          const èInizio = inizi.includes(data);
          return (
            <div key={i} className={`h-9 rounded-lg flex items-center justify-center text-xs ${st ? st.bg + " " + st.testo : "text-slate-500"} ${f?.previsto ? "opacity-60" : ""} ${èOggi ? "ring-2 ring-slate-800" : ""} ${èInizio ? "font-bold" : ""}`}>
              {parseDate(data).getDate()}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
        {FASI.map((k) => (
          <span key={k} className="flex items-center gap-1 text-xs text-slate-500">
            <span className={`w-2.5 h-2.5 rounded-full ${STILE[k].punto}`} />{k}
          </span>
        ))}
      </div>
      <p className="text-slate-400 text-xs">I giorni più sbiaditi sono una previsione, basata sui tuoi cicli precedenti.</p>
    </Card>
  );
}

export default function CicloCliente({ client, isAdmin = false }) {
  const [caricando, setCaricando] = useState(true);
  const [righe, setRighe] = useState([]);
  const [impostazioni, setImpostazioni] = useState(null);
  const [consigli, setConsigli] = useState([]);
  const [nuovaData, setNuovaData] = useState(oggiStr());
  const [salvando, setSalvando] = useState(false);
  const [modificaConsigli, setModificaConsigli] = useState(false);
  const [mese, setMese] = useState(() => { const d = new Date(); return { anno: d.getFullYear(), mese: d.getMonth() }; });
  const oggi = oggiStr();

  const carica = async () => {
    const [{ data: r }, { data: imp }, { data: c }] = await Promise.all([
      supabase.from("ciclo_mestruale").select("*").eq("client_id", client.id).order("data_inizio"),
      supabase.from("ciclo_impostazioni").select("*").eq("client_id", client.id).maybeSingle(),
      supabase.from("ciclo_consigli").select("*").order("ordine"),
    ]);
    setRighe(r || []);
    setImpostazioni(imp || null);
    setConsigli(c || []);
    setCaricando(false);
  };
  useEffect(() => { carica(); }, [client.id]);

  const inizi = useMemo(() => righe.map((r) => r.data_inizio), [righe]);
  const attivo = cicloAttivoPer(client, impostazioni);
  const L = durataCiclo(inizi, impostazioni?.durata);
  const ultima = righe[righe.length - 1];
  const flusso = ultima?.giorni_flusso || 5;

  const segna = async (data) => {
    if (!data) return;
    setSalvando(true);
    const { error } = await supabase.from("ciclo_mestruale").insert({ client_id: client.id, data_inizio: data });
    setSalvando(false);
    if (error && !String(error.message).toLowerCase().includes("duplicate")) { alert("Non sono riuscita a salvare la data. Riprova."); return; }
    carica();
  };
  const elimina = async (r) => {
    if (!confirm(`Eliminare l'inizio ciclo del ${fmtIt(r.data_inizio)}?`)) return;
    await supabase.from("ciclo_mestruale").delete().eq("id", r.id);
    carica();
  };
  const salvaImpostazioni = async (patch) => {
    const nuove = { client_id: client.id, attivo: impostazioni?.attivo ?? true, durata: impostazioni?.durata ?? null, ...patch };
    const { error } = await supabase.from("ciclo_impostazioni").upsert(nuove, { onConflict: "client_id" });
    if (error) { alert("Non sono riuscita a salvare. Riprova."); return; }
    carica();
  };

  if (caricando) return <Spinner />;
  if (!attivo && !isAdmin) return null;

  const oggiInfo = (() => {
    if (!inizi.length) return null;
    const ultimoInizio = inizi[inizi.length - 1];
    const giorno = diffDays(oggi, ultimoInizio) + 1;
    if (giorno < 1) return null;
    const ritardo = giorno > L ? giorno - L : 0;
    return { fase: ritardo ? "premestruale" : faseDelGiorno(giorno, L, flusso), giorno, ritardo, prossimo: addDays(ultimoInizio, L) };
  })();
  const consiglio = oggiInfo ? consigli.find((c) => c.fase === oggiInfo.fase) : null;
  const st = oggiInfo ? STILE[oggiInfo.fase] : null;

  return (
    <div className="space-y-4">
      {isAdmin && (
        <Card className="p-4 space-y-3">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Impostazioni (solo coach)</p>
          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
            <span className="text-sm text-slate-700">Calendario ciclo visibile alla cliente</span>
            <button onClick={() => salvaImpostazioni({ attivo: !attivo })}
              className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors ${attivo ? "bg-emerald-500 justify-end" : "bg-slate-300 justify-start"}`}>
              <span className="w-5 h-5 bg-white rounded-full block" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-500 text-sm flex-1">Durata del ciclo (giorni)</label>
            <input type="number" min="20" max="45" placeholder={`auto: ${L}`} defaultValue={impostazioni?.durata || ""}
              onBlur={(e) => { const v = Number(e.target.value); salvaImpostazioni({ durata: v >= 20 && v <= 45 ? v : null }); }}
              className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm text-center" />
          </div>
          <p className="text-slate-400 text-xs">Se lasci vuoto, l'app usa la media dei cicli registrati (28 giorni se ce n'è uno solo).</p>
          <button onClick={() => setModificaConsigli(true)} className="w-full border border-slate-200 text-slate-600 text-sm font-medium rounded-xl py-2.5">✏️ Modifica i consigli per fase</button>
        </Card>
      )}

      {modificaConsigli && isAdmin && (
        <EditorConsigli consigli={consigli} onSalvato={() => { setModificaConsigli(false); carica(); }} onChiudi={() => setModificaConsigli(false)} />
      )}

      {oggiInfo && consiglio ? (
        <Card className={`p-4 space-y-3 border ${st.barra}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-slate-400 text-xs">Giorno {oggiInfo.giorno} del ciclo</p>
              <p className="text-xl font-semibold text-slate-800">{consiglio.emoji} {consiglio.titolo}</p>
            </div>
            <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${st.bg} ${st.testo}`}>{oggiInfo.fase}</span>
          </div>
          {oggiInfo.ritardo > 0 ? (
            <p className="text-slate-500 text-xs">Il ciclo sembra in ritardo di {oggiInfo.ritardo} {oggiInfo.ritardo === 1 ? "giorno" : "giorni"}. Appena arriva, segnalo qui sotto.</p>
          ) : (
            <p className="text-slate-500 text-xs">Prossimo ciclo previsto intorno al {fmtCorta(oggiInfo.prossimo)}.</p>
          )}
          {consiglio.ormoni && <div><p className="text-xs font-medium text-slate-500">Cosa succede nel corpo</p><p className="text-sm text-slate-700 mt-0.5">{consiglio.ormoni}</p></div>}
          {consiglio.sensazioni && <div><p className="text-xs font-medium text-slate-500">Come potresti sentirti</p><p className="text-sm text-slate-700 mt-0.5">{consiglio.sensazioni}</p></div>}
          {consiglio.allenamento && <div><p className="text-xs font-medium text-slate-500">Allenamento 💪🏻</p><p className="text-sm text-slate-700 mt-0.5">{consiglio.allenamento}</p></div>}
          {consiglio.extra && <div><p className="text-xs font-medium text-slate-500">Un consiglio in più ✨</p><p className="text-sm text-slate-700 mt-0.5">{consiglio.extra}</p></div>}
          <p className="text-slate-400 text-xs pt-1">Sono consigli generali: ogni donna è diversa e risponde in modo diverso. Ascolta come stai e, se qualcosa ti preoccupa, parlane con il tuo medico.</p>
        </Card>
      ) : (
        <Card className="p-4 space-y-2">
          <p className="font-semibold text-slate-800">Il tuo ciclo 🫶🏻</p>
          <p className="text-slate-500 text-sm">
            {isAdmin
              ? "La cliente non ha ancora inserito nessuna data. Puoi aggiungere tu l'inizio dell'ultimo ciclo qui sotto."
              : "Segna il primo giorno dell'ultimo ciclo: ti dirò in che fase sei e come potresti sentirti, con qualche consiglio per allenarti al meglio."}
          </p>
        </Card>
      )}

      <Card className="p-4 space-y-3">
        <button onClick={() => segna(oggi)} disabled={salvando || inizi.includes(oggi)}
          className="w-full bg-slate-800 text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-40">
          {inizi.includes(oggi) ? "Oggi è già segnato ✓" : isAdmin ? "Segna inizio ciclo oggi" : "Mi sono arrivate le mestruazioni oggi"}
        </button>
        <div className="flex gap-2 items-center">
          <input type="date" value={nuovaData} max={oggi} onChange={(e) => setNuovaData(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <button onClick={() => segna(nuovaData)} disabled={salvando || !nuovaData}
            className="border border-slate-200 text-slate-600 text-sm font-medium rounded-lg px-3 py-2 disabled:opacity-40">Aggiungi data</button>
        </div>
        <p className="text-slate-400 text-xs">Puoi inserire anche i cicli passati: più date aggiungi, più le previsioni sono precise.</p>
      </Card>

      {inizi.length > 0 && <CalendarioMese mese={mese} setMese={setMese} inizi={inizi} L={L} flusso={flusso} oggi={oggi} />}

      {righe.length > 0 && (
        <Card className="p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Cicli registrati · durata media {L} giorni</p>
          {[...righe].reverse().map((r, i, arr) => {
            const succ = i === 0 ? null : arr[i - 1]; // il ciclo più recente successivo
            const durata = succ ? diffDays(succ.data_inizio, r.data_inizio) : null;
            return (
              <div key={r.id} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
                <div>
                  <p className="text-sm text-slate-700">{fmtIt(r.data_inizio)}</p>
                  <p className="text-slate-400 text-xs">{durata ? `Ciclo di ${durata} giorni` : "Ciclo in corso"}</p>
                </div>
                <button onClick={() => elimina(r)} className="text-slate-300 text-xs">Elimina</button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
