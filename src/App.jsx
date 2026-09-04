import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import {
  Home, ClipboardList, TrendingUp, Dumbbell, Phone, BookOpen,
  LogOut, ChevronRight, CheckCircle2, Clock, ArrowLeft, Camera,
  ChefHat, Flame, Droplets, ExternalLink, FileText, Apple, AlertCircle, X, CreditCard,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

/* ------------------------------------------------------------------ */
/* Approfondimenti — link ai tuoi PDF ospitati su GitHub Pages         */
/* ------------------------------------------------------------------ */
const APPROFONDIMENTI_LINKS = [
  { titolo: "Se fai così resti uguale", descrizione: "Progressioni, alimentazione, sgarri, ciclo mestruale.", link: "https://morgana-workout.github.io/morgana-tarquino/SE.FAI.COSI%CC%80.RESTI.UGUALE.pdf", icon: Droplets },
  { titolo: "Manuale di nutrizione consapevole", descrizione: "Un rapporto più equilibrato con il cibo.", link: "https://morgana-workout.github.io/morgana-tarquino/Manuale_Nutrizione_Consapevole_Clienti.pdf", icon: Droplets },
  { titolo: "Ricettario fit", descrizione: "14 ricette con macro indicativi e sostituzioni.", link: "https://morgana-workout.github.io/morgana-tarquino/Ricettario.pdf", icon: ChefHat },
  { titolo: "Respirazione in palestra", descrizione: "Come respirare correttamente durante le serie.", link: "https://morgana-workout.github.io/morgana-tarquino/guida.respirazione.palestra.pdf", icon: Flame },
  { titolo: "Manuale progressioni", descrizione: "Come e quando aumentare carico, ripetizioni o serie.", link: "https://morgana-workout.github.io/morgana-tarquino/Manuale_Progressione_Allenamento.pdf", icon: Flame },
  { titolo: "Guida alle tecniche di intensità", descrizione: "Top set, back-off, drop set, rest-pause, myo-reps.", link: "https://morgana-workout.github.io/morgana-tarquino/Guida.Tecniche.Bodybuilding.pdf", icon: Flame },
  { titolo: "Come leggere la tua scheda di allenamento", descrizione: "Terminologia, RIR/RPE e tecniche speciali.", link: "https://morgana-workout.github.io/morgana-tarquino/leggere_una_scheda.pdf", icon: Dumbbell },
];

const CALENDLY_URL = "https://calendly.com/morgana-workout/30min";

/* ------------------------------------------------------------------ */
/* UI helpers                                                          */
/* ------------------------------------------------------------------ */
function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>{children}</div>;
}
function Badge({ children, className = "" }) {
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>{children}</span>;
}
function Spinner() {
  return <div className="flex justify-center pt-20"><div className="w-8 h-8 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" /></div>;
}
const STATO_LABEL = {
  programmato: { t: "Programmato", c: "bg-sky-100 text-sky-700" },
  da_compilare: { t: "Da compilare", c: "bg-amber-100 text-amber-700" },
  ricevuto: { t: "Ricevuto", c: "bg-violet-100 text-violet-700" },
  revisionato: { t: "Revisionato", c: "bg-emerald-100 text-emerald-700" },
};
function StatoBadge({ stato }) {
  const s = STATO_LABEL[stato] || { t: stato || "—", c: "bg-slate-100 text-slate-500" };
  return <Badge className={s.c}>{s.t}</Badge>;
}

/* ------------------------------------------------------------------ */
/* LOGIN                                                               */
/* ------------------------------------------------------------------ */
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState("");
  const [caricando, setCaricando] = useState(false);

  const entra = async (e) => {
    e.preventDefault();
    setErrore("");
    setCaricando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErrore("Email o password non corrette.");
    setCaricando(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-800 to-slate-900 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-slate-700 mx-auto mb-4 flex items-center justify-center">
            <Dumbbell className="text-sky-300" size={26} />
          </div>
          <h1 className="text-white text-2xl font-semibold tracking-tight">Coaching by Morgana</h1>
          <p className="text-slate-400 text-sm mt-1">Il tuo spazio di allenamento, sempre con te</p>
        </div>
        <form onSubmit={entra} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 space-y-3">
          <input
            type="email" placeholder="Email" value={email} required
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <input
            type="password" placeholder="Password" value={password} required
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          {errore && <p className="text-rose-400 text-xs">{errore}</p>}
          <button disabled={caricando} className="w-full bg-sky-500 hover:bg-sky-400 transition-colors text-white font-medium rounded-xl py-3">
            {caricando ? "Accesso in corso..." : "Accedi"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AREA CLIENTE                                                        */
/* ------------------------------------------------------------------ */
function ClientHome({ client, goTo }) {
  return (
    <div className="px-5 pt-6 pb-24 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Ciao {client.nome} 👋</h1>
        <p className="text-slate-500 text-sm mt-1">Costanza batte perfezione, sempre.</p>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-500 text-xs uppercase tracking-wide font-medium">Prossimo check</span>
          <StatoBadge stato={client.stato_check} />
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-semibold text-slate-800">{client.prossimo_check || "—"}</p>
            <p className="text-slate-500 text-sm mt-1">Ultimo check: {client.ultimo_check || "—"}</p>
          </div>
          <Clock className="text-sky-500" size={32} />
        </div>
      </Card>

      {client.stato_pacchetto === "in scadenza" && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm">
          <AlertCircle size={18} />
          Il tuo coaching scade il {client.data_scadenza}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {(client.scheda_pdf_path || client.link_scheda) && (
          <button
            onClick={async () => {
              if (client.scheda_pdf_path) {
                const { data } = await supabase.storage.from("workout-plans").createSignedUrl(client.scheda_pdf_path, 3600);
                if (data?.signedUrl) window.open(data.signedUrl, "_blank");
              } else {
                window.open(client.link_scheda, "_blank");
              }
            }}
            className="bg-slate-800 text-white rounded-2xl p-4 flex flex-col items-start gap-2"
          >
            <Dumbbell size={20} /><span className="font-medium text-sm">Scheda</span>
          </button>
        )}
        <a href={CALENDLY_URL} target="_blank" rel="noreferrer" className="bg-sky-500 text-white rounded-2xl p-4 flex flex-col items-start gap-2">
          <Phone size={20} /><span className="font-medium text-sm">Prenota call</span>
        </a>
      </div>
    </div>
  );
}

async function caricaFotoStorage(file, clientId, dataCheck, slot) {
  if (!file) return null;
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${clientId}/${dataCheck}-${slot}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("progress-photos").upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

function FotoInputs({ files, setFiles }) {
  const slot = (label, key) => (
    <div>
      <label className="text-xs text-slate-500 block mb-1">{label}</label>
      <input type="file" accept="image/*" onChange={(e) => setFiles({ ...files, [key]: e.target.files[0] || null })}
        className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-600" />
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      {slot("Frontale", "frontale")}
      {slot("Laterale destra", "laterale")}
      {slot("Laterale sinistra", "extra")}
      {slot("Posteriore", "posteriore")}
    </div>
  );
}

function ClientCheckin({ client, onInviato }) {
  const [form, setForm] = useState({
    peso_kg: "", petto_cm: "", spalle_cm: "", sopra_ombelico_cm: "", ombelico_cm: "", sotto_ombelico_cm: "",
    coscia_dx_cm: "", braccio_dx_cm: "", collo_cm: "", glutei_cm: "", energia: 3, sonno: 3, aderenza_cibo: 3, aderenza_allenamento: 3,
    fase_mestruale: "",
  });
  const [notaFinale, setNotaFinale] = useState("");
  const [files, setFiles] = useState({ frontale: null, laterale: null, posteriore: null, extra: null });
  const [inviando, setInviando] = useState(false);
  const [inviato, setInviato] = useState(false);
  const [errore, setErrore] = useState("");

  const campo = (label, key, unit) => (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      <div className="flex items-center gap-2 mt-1">
        <input type="number" step="0.1" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" />
        {unit && <span className="text-xs text-slate-400">{unit}</span>}
      </div>
    </div>
  );
  const slider = (label, key) => (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-1"><span>{label}</span><span>{form[key]}/5</span></div>
      <input type="range" min="1" max="5" value={form[key]} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} className="w-full accent-sky-500" />
    </div>
  );

  const invia = async () => {
    setInviando(true);
    setErrore("");
    const dataCheck = new Date().toISOString().slice(0, 10);
    const payload = { client_id: client.id, data_check: dataCheck, stato: "ricevuto" };
    for (const k of ["peso_kg", "petto_cm", "spalle_cm", "sopra_ombelico_cm", "ombelico_cm", "sotto_ombelico_cm", "coscia_dx_cm", "braccio_dx_cm", "collo_cm", "glutei_cm"]) {
      payload[k] = form[k] === "" ? null : Number(form[k]);
    }
    payload.energia = form.energia;
    payload.sonno = form.sonno;
    payload.aderenza_cibo = form.aderenza_cibo;
    payload.aderenza_allenamento = form.aderenza_allenamento;
    payload.note_cliente = notaFinale || null;
    payload.fase_mestruale = form.fase_mestruale || null;

    try {
      payload.foto_frontale_path = await caricaFotoStorage(files.frontale, client.id, dataCheck, "frontale");
      payload.foto_laterale_path = await caricaFotoStorage(files.laterale, client.id, dataCheck, "laterale");
      payload.foto_posteriore_path = await caricaFotoStorage(files.posteriore, client.id, dataCheck, "posteriore");
      payload.foto_extra_path = await caricaFotoStorage(files.extra, client.id, dataCheck, "extra");
    } catch (e) {
      setInviando(false);
      setErrore("Errore nel caricamento delle foto: " + e.message);
      return;
    }

    const { data: inserito, error } = await supabase.from("checkins").insert(payload).select().single();
    setInviando(false);
    if (error) { setErrore("Non sono riuscita a inviare il check: " + error.message); return; }

    // Aggiorna in automatico il prossimo check a +4 settimane (tramite funzione sicura)
    supabase.rpc("aggiorna_prossimo_check", { check_date: dataCheck }).then(() => {});

    // Notifica il coach via email (non blocca l'invio se fallisce)
    supabase.auth.getSession().then(({ data: { session } }) => {
      supabase.functions.invoke("notify-checkin", {
        body: { checkin_id: inserito.id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {});
    });

    setInviato(true);
    onInviato?.();
  };

  if (inviato) {
    return (
      <div className="px-5 pt-16 flex flex-col items-center text-center">
        <CheckCircle2 className="text-emerald-500 mb-4" size={48} />
        <h2 className="text-lg font-semibold text-slate-800">Check inviato</h2>
        <p className="text-slate-500 text-sm mt-2">Morgana riceverà i tuoi dati e li revisionerà a breve.</p>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-24 space-y-5">
      <h1 className="text-xl font-semibold text-slate-800">Nuovo check</h1>
      <Card className="p-4 space-y-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Misure</p>
        <div className="grid grid-cols-2 gap-3">
          {campo("Peso", "peso_kg", "kg")}
          {campo("Petto", "petto_cm", "cm")}
          {client.sesso === "M" && campo("Spalle", "spalle_cm", "cm")}
          {campo("Sopra ombelico", "sopra_ombelico_cm", "cm")}
          {campo("Ombelico", "ombelico_cm", "cm")}
          {campo("Sotto ombelico", "sotto_ombelico_cm", "cm")}
          {campo("Coscia dx", "coscia_dx_cm", "cm")}
          {campo("Braccio dx", "braccio_dx_cm", "cm")}
          {campo("Collo", "collo_cm", "cm")}
          {campo("Glutei", "glutei_cm", "cm")}
        </div>
      </Card>
      {client.sesso !== "M" && (
        <Card className="p-4 space-y-4">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Ciclo mestruale</p>
          <select value={form.fase_mestruale} onChange={(e) => setForm({ ...form, fase_mestruale: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Preferisco non specificare</option>
            <option value="mestruale">Fase mestruale</option>
            <option value="follicolare">Fase follicolare</option>
            <option value="ovulatoria">Fase ovulatoria</option>
            <option value="luteale">Fase luteale</option>
          </select>
        </Card>
      )}
      <Card className="p-4 space-y-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Come stai andando</p>
        {slider("Livello di energia", "energia")}
        {slider("Qualità del sonno", "sonno")}
        {slider("Aderenza all'alimentazione", "aderenza_cibo")}
        {slider("Aderenza all'allenamento", "aderenza_allenamento")}
      </Card>
      <Card className="p-4 space-y-3">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Foto progressi</p>
        <FotoInputs files={files} setFiles={setFiles} />
      </Card>
      <Card className="p-4 space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Nota finale</p>
        <textarea placeholder="Difficoltà, feedback, tutto quello che vuoi dire a Morgana..." value={notaFinale}
          onChange={(e) => setNotaFinale(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" rows={3} />
      </Card>
      {errore && <p className="text-rose-500 text-sm">{errore}</p>}
      <button onClick={invia} disabled={inviando} className="w-full bg-slate-800 text-white font-medium rounded-xl py-3">
        {inviando ? "Invio in corso..." : "Invia check"}
      </button>
    </div>
  );
}

function getCampiMisura(sesso) {
  const base = [
    { key: "peso_kg", label: "Peso", unit: "kg" },
    { key: "petto_cm", label: "Petto", unit: "cm" },
  ];
  if (sesso === "M") base.push({ key: "spalle_cm", label: "Spalle", unit: "cm" });
  base.push(
    { key: "sopra_ombelico_cm", label: "Sopra ombelico", unit: "cm" },
    { key: "ombelico_cm", label: "Ombelico", unit: "cm" },
    { key: "sotto_ombelico_cm", label: "Sotto ombelico", unit: "cm" },
    { key: "coscia_dx_cm", label: "Coscia dx", unit: "cm" },
    { key: "braccio_dx_cm", label: "Braccio dx", unit: "cm" },
    { key: "collo_cm", label: "Collo", unit: "cm" },
    { key: "glutei_cm", label: "Glutei", unit: "cm" }
  );
  return base;
}

function calcolaBMI(peso, altezzaCm) {
  if (!peso || !altezzaCm) return null;
  const h = altezzaCm / 100;
  return peso / (h * h);
}
function calcolaWHtR(ombelico, altezzaCm) {
  if (!ombelico || !altezzaCm) return null;
  return ombelico / altezzaCm;
}
function calcolaWHR(vita, fianchi) {
  if (!vita || !fianchi) return null;
  return vita / fianchi;
}
// Stima Body Fat % — metodo US Navy (misure in cm, nessuna plica richiesta)
function calcolaBodyFat(sesso, vita, collo, glutei, altezzaCm) {
  if (!vita || !collo || !altezzaCm) return null;
  if (sesso === "M") {
    const diff = vita - collo;
    if (diff <= 0) return null;
    return 495 / (1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(altezzaCm)) - 450;
  }
  if (sesso === "F") {
    if (!glutei) return null;
    const diff = vita + glutei - collo;
    if (diff <= 0) return null;
    return 495 / (1.29579 - 0.35004 * Math.log10(diff) + 0.2210 * Math.log10(altezzaCm)) - 450;
  }
  return null;
}
// BMR — formula Mifflin-St Jeor
function calcolaBMR(sesso, peso, altezzaCm, eta) {
  if (!peso || !altezzaCm || !eta || !sesso) return null;
  const base = 10 * peso + 6.25 * altezzaCm - 5 * eta;
  return sesso === "M" ? base + 5 : base - 161;
}

/* Tabella 1 — solo circonferenze grezze, con variazione dal check precedente */
function HistoryTable({ checkins, sesso }) {
  const campi = getCampiMisura(sesso);
  const ordinati = [...checkins].sort((a, b) => (a.data_check || "").localeCompare(b.data_check || ""));
  const righe = ordinati.map((c, i) => ({ ...c, prev: ordinati[i - 1] || null })).reverse();

  if (righe.length === 0) return <p className="text-slate-400 text-sm px-1">Nessun check ancora registrato.</p>;

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm min-w-[820px]">
        <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
          <tr>
            <th className="text-left px-3 py-2 sticky left-0 bg-slate-50">Data</th>
            {campi.map((c) => <th key={c.key} className="text-right px-3 py-2 whitespace-nowrap">{c.label}</th>)}
            <th className="text-left px-3 py-2 whitespace-nowrap">Fase ciclo</th>
          </tr>
        </thead>
        <tbody>
          {righe.map((r) => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="px-3 py-2 text-slate-600 whitespace-nowrap sticky left-0 bg-white font-medium">{r.data_check}</td>
              {campi.map((c) => {
                const val = r[c.key];
                const prevVal = r.prev ? r.prev[c.key] : null;
                let delta = null;
                if (val != null && prevVal != null && Math.abs(val - prevVal) > 0.001) {
                  const d = val - prevVal;
                  delta = (d > 0 ? "+" : "") + d.toFixed(1);
                }
                return (
                  <td key={c.key} className="px-3 py-2 text-right text-slate-700 whitespace-nowrap">
                    {val ?? "—"}
                    {delta && <span className="text-slate-400 text-xs ml-1">({delta})</span>}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-slate-500 whitespace-nowrap capitalize">{sesso === "M" ? "—" : (r.fase_mestruale || "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-slate-400 text-xs px-3 py-2">Tra parentesi la variazione rispetto al check precedente.</p>
    </Card>
  );
}

/* Tabella 2 — valori calcolati, righe = indicatori, colonne = date (per confronto rapido) */
function TabellaEstrapolati({ checkins, altezza, sesso, eta }) {
  const ordinati = [...checkins].sort((a, b) => (a.data_check || "").localeCompare(b.data_check || ""));
  if (ordinati.length === 0) return null;

  const righe = [
    { label: "Peso (kg)", calc: (c) => c.peso_kg },
    { label: "BMI", calc: (c) => calcolaBMI(c.peso_kg, altezza), dec: 1 },
    ...(sesso === "M" ? [{ label: "Circonferenza Spalle (cm)", calc: (c) => c.spalle_cm }] : []),
    { label: "Circonferenza Vita (cm)", calc: (c) => c.sopra_ombelico_cm },
    { label: "Circonferenza Fianchi (cm)", calc: (c) => c.glutei_cm },
    { label: "Circonferenza Addome (cm)", calc: (c) => c.ombelico_cm },
    { label: "Circonferenza Coscia (cm)", calc: (c) => c.coscia_dx_cm },
    { label: "Circonferenza Braccio (cm)", calc: (c) => c.braccio_dx_cm },
    { label: "Rapporto Vita/Fianchi", calc: (c) => calcolaWHR(c.sopra_ombelico_cm, c.glutei_cm), dec: 2 },
    { label: "Body Fat % (US Navy)", calc: (c) => calcolaBodyFat(sesso, c.ombelico_cm ?? c.sopra_ombelico_cm, c.collo_cm, c.glutei_cm, altezza), dec: 1, suffix: "%" },
    { label: "BMR (kcal)", calc: (c) => calcolaBMR(sesso, c.peso_kg, altezza, eta), dec: 0 },
  ];

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm min-w-[480px]">
        <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
          <tr>
            <th className="text-left px-2 py-2 sticky left-0 bg-slate-50 w-24 max-w-[6rem]">Indicatore</th>
            {ordinati.map((c) => <th key={c.id} className="text-right px-3 py-2 whitespace-nowrap">{c.data_check}</th>)}
          </tr>
        </thead>
        <tbody>
          {righe.map((r) => (
            <tr key={r.label} className="border-t border-slate-100">
              <td className="px-2 py-2 text-slate-600 sticky left-0 bg-white font-medium w-24 max-w-[6rem] leading-tight text-xs">{r.label}</td>
              {ordinati.map((c) => {
                const v = r.calc(c);
                return (
                  <td key={c.id} className="px-3 py-2 text-right text-slate-700 whitespace-nowrap">
                    {v != null ? v.toFixed(r.dec ?? 1) + (r.suffix || "") : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-slate-400 text-xs px-3 py-2">
        Valori calcolati da peso/circonferenze/altezza/età/sesso in anagrafica — se mancano, la cella resta vuota.
      </p>
    </Card>
  );
}

function ClientProgress({ checkins, altezza, sesso, eta, titolo = "I tuoi progressi" }) {
  const [metrica, setMetrica] = useState("peso_kg");
  const opzioni = getCampiMisura(sesso).map((c) => ({ key: c.key, label: c.label }));
  const dati = [...checkins]
    .sort((a, b) => (a.data_check || "").localeCompare(b.data_check || ""))
    .map((c) => ({ ...c, dataLabel: c.data_check?.slice(5).split("-").reverse().join("/") }));

  if (checkins.length === 0) {
    return <div className="px-5 pt-16 text-center text-slate-400 text-sm">Non ci sono ancora check registrati.</div>;
  }

  return (
    <div className="px-5 pt-6 pb-24 space-y-5">
      <h1 className="text-xl font-semibold text-slate-800">{titolo}</h1>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {opzioni.map((o) => (
          <button key={o.key} onClick={() => setMetrica(o.key)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${metrica === o.key ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>
            {o.label}
          </button>
        ))}
      </div>
      <Card className="p-4">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={dati}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="dataLabel" tick={{ fontSize: 12, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 12, fill: "#64748b" }} domain={["auto", "auto"]} />
            <Tooltip />
            <Line type="monotone" dataKey={metrica} stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <HistoryTable checkins={checkins} sesso={sesso} />

      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2 px-1">Valori estrapolati</p>
        <TabellaEstrapolati checkins={checkins} altezza={altezza} sesso={sesso} eta={eta} />
      </div>
    </div>
  );
}

function ClientNutrizione({ piano }) {
  if (!piano) {
    return <div className="px-5 pt-16 text-center text-slate-400 text-sm">Morgana non ha ancora impostato i tuoi valori nutrizionali.</div>;
  }
  const macro = [
    { label: "Proteine", val: piano.proteine_g, color: "bg-sky-500" },
    { label: "Carboidrati", val: piano.carboidrati_g, color: "bg-emerald-500" },
    { label: "Grassi", val: piano.grassi_g, color: "bg-amber-500" },
  ];
  return (
    <div className="px-5 pt-6 pb-24 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Nutrizione</h1>
        <p className="text-slate-500 text-sm mt-1">Valori indicativi, aggiornati il {piano.data_aggiornamento}</p>
      </div>
      <div className="rounded-2xl border border-slate-700 shadow-sm p-5 bg-slate-800">
        <div className="flex items-center gap-2 text-slate-300 text-xs uppercase tracking-wide font-medium mb-1"><Apple size={14} /> Kcal indicative giornaliere</div>
        <p className="text-4xl font-semibold text-white">{piano.kcal ?? "—"} <span className="text-lg font-normal text-slate-400">kcal</span></p>
      </div>
      <Card className="p-4 space-y-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Macros indicativi</p>
        {macro.map((m) => (
          <div key={m.label}>
            <div className="flex justify-between text-sm mb-1"><span className="text-slate-600">{m.label}</span><span className="font-medium text-slate-800">{m.val} g</span></div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${m.color}`} style={{ width: "100%" }} /></div>
          </div>
        ))}
      </Card>
      {piano.note && (
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">Note di Morgana</p>
          <p className="text-slate-700 text-sm leading-relaxed">{piano.note}</p>
        </Card>
      )}
    </div>
  );
}

function DiarioAllenamento({ clientId }) {
  const [righe, setRighe] = useState([]);
  const [form, setForm] = useState({ data: new Date().toISOString().slice(0, 10), esercizio: "", serie: "", ripetizioni: "", carico_kg: "", note: "" });
  const [salvando, setSalvando] = useState(false);
  const [mostraForm, setMostraForm] = useState(false);

  const carica = async () => {
    const { data } = await supabase.from("training_log").select("*").eq("client_id", clientId).order("data", { ascending: false });
    setRighe(data || []);
  };
  useEffect(() => { carica(); }, [clientId]);

  const salva = async () => {
    if (!form.esercizio) return;
    setSalvando(true);
    await supabase.from("training_log").insert({
      client_id: clientId,
      data: form.data || null,
      esercizio: form.esercizio,
      serie: form.serie === "" ? null : Number(form.serie),
      ripetizioni: form.ripetizioni || null,
      carico_kg: form.carico_kg === "" ? null : Number(form.carico_kg),
      note: form.note || null,
    });
    setSalvando(false);
    setForm({ ...form, esercizio: "", serie: "", ripetizioni: "", carico_kg: "", note: "" });
    carica();
  };

  const elimina = async (id) => {
    await supabase.from("training_log").delete().eq("id", id);
    carica();
  };

  return (
    <div className="px-5 pt-6 pb-24 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Diario allenamento</h1>
          <p className="text-slate-500 text-sm mt-1">Traccia carichi, serie e ripetizioni settimana dopo settimana.</p>
        </div>
        {!mostraForm && (
          <button onClick={() => setMostraForm(true)} className="bg-slate-800 text-white text-xs font-medium rounded-lg px-3 py-2 whitespace-nowrap">+ Aggiungi</button>
        )}
      </div>

      {mostraForm && (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-500">Data</label>
              <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div><label className="text-xs text-slate-500">Esercizio</label>
              <input value={form.esercizio} onChange={(e) => setForm({ ...form, esercizio: e.target.value })} placeholder="Es. Squat" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div><label className="text-xs text-slate-500">Serie</label>
              <input type="number" value={form.serie} onChange={(e) => setForm({ ...form, serie: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div><label className="text-xs text-slate-500">Ripetizioni</label>
              <input value={form.ripetizioni} onChange={(e) => setForm({ ...form, ripetizioni: e.target.value })} placeholder="Es. 8-10" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div className="col-span-2"><label className="text-xs text-slate-500">Carico (kg)</label>
              <input type="number" step="0.5" value={form.carico_kg} onChange={(e) => setForm({ ...form, carico_kg: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
          </div>
          <textarea placeholder="Note (facoltative)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button onClick={salva} disabled={salvando} className="flex-1 bg-slate-800 text-white rounded-xl py-2 text-sm font-medium">{salvando ? "Salvo..." : "Salva riga"}</button>
            <button onClick={() => setMostraForm(false)} className="px-4 rounded-xl border border-slate-200 text-sm text-slate-500">Chiudi</button>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {righe.map((r) => (
          <Card key={r.id} className="p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-slate-800 truncate">{r.esercizio}</p>
              <p className="text-slate-500 text-xs mt-0.5">
                {r.data} · {r.serie ?? "—"} serie · {r.ripetizioni || "—"} rip. · {r.carico_kg ? `${r.carico_kg} kg` : "—"}
              </p>
            </div>
            <button onClick={() => elimina(r.id)} className="text-slate-300 hover:text-rose-500 flex-shrink-0"><X size={16} /></button>
          </Card>
        ))}
        {righe.length === 0 && (
          <Card className="p-6 text-center text-slate-400 text-sm">Ancora nessuna riga registrata.</Card>
        )}
      </div>
    </div>
  );
}

function ClientApprofondimenti() {
  return (
    <div className="px-5 pt-6 pb-24 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Approfondimenti</h1>
        <p className="text-slate-500 text-sm mt-1">Tocca un titolo per aprire la guida completa.</p>
      </div>
      <div className="space-y-3">
        {APPROFONDIMENTI_LINKS.map((item, i) => (
          <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="block">
            <Card className="p-4 flex items-start gap-3 hover:border-sky-300 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0"><item.icon size={18} className="text-sky-600" /></div>
              <div className="flex-1 min-w-0"><p className="font-medium text-slate-800">{item.titolo}</p><p className="text-slate-500 text-xs mt-1">{item.descrizione}</p></div>
              <ExternalLink size={16} className="text-slate-300 flex-shrink-0 mt-1" />
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}

function ClientApp({ session }) {
  const [tab, setTab] = useState("home");
  const [client, setClient] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [piano, setPiano] = useState(null);
  const [caricando, setCaricando] = useState(true);

  const carica = async () => {
    setCaricando(true);
    const { data: c } = await supabase.from("clients").select("*").eq("user_id", session.user.id).single();
    setClient(c);
    if (c) {
      const { data: ck } = await supabase.from("checkins").select("*").eq("client_id", c.id).order("data_check", { ascending: true });
      setCheckins(ck || []);
      const { data: nu } = await supabase.from("nutrition_plans").select("*").eq("client_id", c.id).order("data_aggiornamento", { ascending: false }).limit(1).maybeSingle();
      setPiano(nu);
    }
    setCaricando(false);
  };

  useEffect(() => { carica(); }, [session.user.id]);

  if (caricando) return <Spinner />;
  if (!client) return <div className="px-6 pt-16 text-center text-slate-500 text-sm">Il tuo account non è ancora collegato a una scheda cliente. Contatta Morgana.</div>;

  const nav = [
    { key: "home", label: "Home", icon: Home },
    { key: "checkin", label: "Check", icon: ClipboardList },
    { key: "log", label: "Log", icon: Dumbbell },
    { key: "progressi", label: "Progressi", icon: TrendingUp },
    { key: "nutrizione", label: "Nutrizione", icon: Apple },
    { key: "extra", label: "Extra", icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto relative">
      <div className="flex items-center justify-between px-5 pt-5">
        <span className="text-slate-400 text-xs font-medium tracking-wide">COACHING BY MORGANA</span>
        <button onClick={() => supabase.auth.signOut()} className="text-slate-400"><LogOut size={16} /></button>
      </div>
      {tab === "home" && <ClientHome client={client} />}
      {tab === "checkin" && <ClientCheckin client={client} onInviato={carica} />}
      {tab === "log" && <DiarioAllenamento clientId={client.id} />}
      {tab === "progressi" && <ClientProgress checkins={checkins} altezza={client.altezza_cm} sesso={client.sesso} eta={client.eta} />}
      {tab === "nutrizione" && <ClientNutrizione piano={piano} />}
      {tab === "extra" && <ClientApprofondimenti />}
      <div className="fixed bottom-0 max-w-md w-full bg-white border-t border-slate-200 flex justify-around py-3">
        {nav.map((n) => (
          <button key={n.key} onClick={() => setTab(n.key)} className={`flex flex-col items-center gap-1.5 px-4 py-2 text-xs min-w-[60px] ${tab === n.key ? "text-sky-500" : "text-slate-400"}`}>
            <n.icon size={24} />{n.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AREA ADMIN                                                          */
/* ------------------------------------------------------------------ */
function NuovoCheckForm({ clientId, sesso, onSalvato, onAnnulla }) {
  const [f, setF] = useState({ data_check: "", peso_kg: "", petto_cm: "", spalle_cm: "", sopra_ombelico_cm: "", ombelico_cm: "", sotto_ombelico_cm: "", coscia_dx_cm: "", braccio_dx_cm: "", collo_cm: "", glutei_cm: "", note_cliente: "", stato: "revisionato", fase_mestruale: "" });
  const [files, setFiles] = useState({ frontale: null, laterale: null, posteriore: null, extra: null });
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState("");
  const campo = (label, key, unit) => (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      <input type="number" step="0.1" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
    </div>
  );
  const salva = async () => {
    if (!f.data_check) { setErrore("Inserisci la data del check."); return; }
    setSalvando(true);
    setErrore("");
    const payload = { client_id: clientId, data_check: f.data_check || null, note_cliente: f.note_cliente || null, stato: f.stato, fase_mestruale: f.fase_mestruale || null };
    for (const k of ["peso_kg", "petto_cm", "spalle_cm", "sopra_ombelico_cm", "ombelico_cm", "sotto_ombelico_cm", "coscia_dx_cm", "braccio_dx_cm", "collo_cm", "glutei_cm"]) {
      payload[k] = f[k] === "" ? null : Number(f[k]);
    }
    try {
      payload.foto_frontale_path = await caricaFotoStorage(files.frontale, clientId, f.data_check, "frontale");
      payload.foto_laterale_path = await caricaFotoStorage(files.laterale, clientId, f.data_check, "laterale");
      payload.foto_posteriore_path = await caricaFotoStorage(files.posteriore, clientId, f.data_check, "posteriore");
      payload.foto_extra_path = await caricaFotoStorage(files.extra, clientId, f.data_check, "extra");
    } catch (e) {
      setSalvando(false);
      setErrore("Errore caricamento foto: " + e.message);
      return;
    }
    await supabase.from("checkins").insert(payload);
    setSalvando(false);
    onSalvato();
  };
  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700">Aggiungi check</p>
      <div><label className="text-xs text-slate-500">Data</label>
        <input type="date" value={f.data_check} onChange={(e) => setF({ ...f, data_check: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {campo("Peso (kg)", "peso_kg")}
        {campo("Petto (cm)", "petto_cm")}
        {sesso === "M" && campo("Spalle (cm)", "spalle_cm")}
        {campo("Sopra ombelico (cm)", "sopra_ombelico_cm")}
        {campo("Ombelico (cm)", "ombelico_cm")}
        {campo("Sotto ombelico (cm)", "sotto_ombelico_cm")}
        {campo("Coscia dx (cm)", "coscia_dx_cm")}
        {campo("Braccio dx (cm)", "braccio_dx_cm")}
        {campo("Collo (cm)", "collo_cm")}
        {campo("Glutei (cm)", "glutei_cm")}
      </div>
      {sesso !== "M" && (
        <div>
          <label className="text-xs text-slate-500">Fase ciclo mestruale</label>
          <select value={f.fase_mestruale} onChange={(e) => setF({ ...f, fase_mestruale: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
            <option value="">Non specificata</option>
            <option value="mestruale">Mestruale</option>
            <option value="follicolare">Follicolare</option>
            <option value="ovulatoria">Ovulatoria</option>
            <option value="luteale">Luteale</option>
          </select>
        </div>
      )}
      <textarea placeholder="Note" value={f.note_cliente} onChange={(e) => setF({ ...f, note_cliente: e.target.value })} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      <div>
        <label className="text-xs text-slate-500 block mb-1">Foto progressi (facoltative)</label>
        <FotoInputs files={files} setFiles={setFiles} />
      </div>
      {errore && <p className="text-rose-500 text-xs">{errore}</p>}
      <div className="flex gap-2">
        <button onClick={salva} disabled={salvando} className="flex-1 bg-slate-800 text-white rounded-xl py-2 text-sm font-medium">{salvando ? "Salvo..." : "Salva check"}</button>
        <button onClick={onAnnulla} className="px-4 rounded-xl border border-slate-200 text-sm text-slate-500">Annulla</button>
      </div>
    </Card>
  );
}

function NuovaNotaForm({ clientId, onSalvato, onAnnulla }) {
  const [testo, setTesto] = useState("");
  const [tipo, setTipo] = useState("coach");
  const [salvando, setSalvando] = useState(false);
  const salva = async () => {
    if (!testo) return;
    setSalvando(true);
    await supabase.from("notes").insert({ client_id: clientId, data: new Date().toISOString().slice(0, 10), tipo, testo });
    setSalvando(false);
    setTesto("");
    onSalvato();
  };
  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700">Nuova nota</p>
      <div className="flex gap-2">
        <button onClick={() => setTipo("coach")} className={`px-3 py-1.5 rounded-full text-sm ${tipo === "coach" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>Privata (solo tu)</button>
        <button onClick={() => setTipo("cliente")} className={`px-3 py-1.5 rounded-full text-sm ${tipo === "cliente" ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-600"}`}>Visibile alla cliente</button>
      </div>
      <textarea value={testo} onChange={(e) => setTesto(e.target.value)} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Scrivi la nota..." />
      <div className="flex gap-2">
        <button onClick={salva} disabled={salvando} className="flex-1 bg-slate-800 text-white rounded-xl py-2 text-sm font-medium">{salvando ? "Salvo..." : "Salva nota"}</button>
        <button onClick={onAnnulla} className="px-4 rounded-xl border border-slate-200 text-sm text-slate-500">Annulla</button>
      </div>
    </Card>
  );
}

function NutrizioneForm({ clientId, ultimo, onSalvato }) {
  const [f, setF] = useState({
    kcal: ultimo?.kcal || "", proteine_g: ultimo?.proteine_g || "", carboidrati_g: ultimo?.carboidrati_g || "",
    grassi_g: ultimo?.grassi_g || "", note: ultimo?.note || "",
  });
  const [salvando, setSalvando] = useState(false);
  const campo = (label, key) => (
    <div><label className="text-xs text-slate-500">{label}</label>
      <input type="number" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
    </div>
  );
  const salva = async () => {
    setSalvando(true);
    await supabase.from("nutrition_plans").insert({
      client_id: clientId, data_aggiornamento: new Date().toISOString().slice(0, 10),
      kcal: f.kcal || null, proteine_g: f.proteine_g || null, carboidrati_g: f.carboidrati_g || null,
      grassi_g: f.grassi_g || null, note: f.note || null,
    });
    setSalvando(false);
    onSalvato();
  };
  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700">Valori nutrizionali indicativi</p>
      <div className="grid grid-cols-2 gap-3">
        {campo("Kcal", "kcal")}
        {campo("Proteine (g)", "proteine_g")}
        {campo("Carboidrati (g)", "carboidrati_g")}
        {campo("Grassi (g)", "grassi_g")}
      </div>
      <textarea placeholder="Note per la cliente" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      <button onClick={salva} disabled={salvando} className="w-full bg-slate-800 text-white rounded-xl py-2 text-sm font-medium">{salvando ? "Salvo..." : "Salva valori"}</button>
      {ultimo && <p className="text-slate-400 text-xs">Ultimo aggiornamento: {ultimo.data_aggiornamento}</p>}
    </Card>
  );
}

function addMesi(dataStr, mesi) {
  const d = new Date(dataStr + "T00:00:00");
  d.setMonth(d.getMonth() + mesi);
  return d.toISOString().slice(0, 10);
}
function addGiorni(dataStr, giorni) {
  const d = new Date(dataStr + "T00:00:00");
  d.setDate(d.getDate() + giorni);
  return d.toISOString().slice(0, 10);
}

function RegistraPagamento({ client, pagamenti, onRegistrato }) {
  const [tipo, setTipo] = useState("Mensile");
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10));
  const [salvando, setSalvando] = useState(false);
  const [fatto, setFatto] = useState(false);
  const mesiPerTipo = { Mensile: 1, Trimestrale: 3, Semestrale: 6 };
  const isGratuito = tipo === "Gratuito";

  const registra = async () => {
    setSalvando(true);
    setFatto(false);

    if (isGratuito) {
      await supabase.from("clients").update({ piano: "Gratuito", stato_pacchetto: "gratuito" }).eq("id", client.id);
    } else {
      const oggi = new Date().toISOString().slice(0, 10);
      const base = (client.data_scadenza && client.data_scadenza > oggi) ? client.data_scadenza : dataPagamento;
      const nuovaScadenza = addMesi(base, mesiPerTipo[tipo]);
      await supabase.from("payments").insert({ client_id: client.id, data_pagamento: dataPagamento, tipo_piano: tipo });
      await supabase.from("clients").update({
        piano: tipo,
        data_scadenza: nuovaScadenza,
        data_inizio: client.data_inizio || dataPagamento,
        stato_pacchetto: "attivo",
      }).eq("id", client.id);
    }
    setSalvando(false);
    setFatto(true);
    onRegistrato();
  };

  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700 flex items-center gap-2"><CreditCard size={16} /> Registra pagamento</p>
      <div className="grid grid-cols-2 gap-3 [&>div]:min-w-0">
        <div>
          <label className="text-xs text-slate-500">Tipo di rinnovo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
            <option value="Mensile">Mensile (+1 mese)</option>
            <option value="Trimestrale">Trimestrale (+3 mesi)</option>
            <option value="Semestrale">Semestrale (+6 mesi)</option>
            <option value="Gratuito">Gratuito</option>
          </select>
        </div>
        {!isGratuito && (
          <div>
            <label className="text-xs text-slate-500">Data pagamento</label>
            <input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
        )}
      </div>
      <button onClick={registra} disabled={salvando} className="w-full bg-slate-800 text-white rounded-xl py-2 text-sm font-medium">
        {salvando ? "Registro..." : isGratuito ? "Imposta come gratuito" : "Registra e aggiorna scadenza"}
      </button>
      {fatto && <p className="text-emerald-600 text-xs">Fatto! {isGratuito ? "Pacchetto impostato su gratuito." : "Piano e scadenza aggiornati."}</p>}
      {pagamenti.length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <p className="text-slate-400 text-xs mb-1">Storico pagamenti</p>
          <ul className="space-y-1">
            {pagamenti.map((p) => (
              <li key={p.id} className="text-xs text-slate-500 flex justify-between">
                <span>{p.data_pagamento}</span><span>{p.tipo_piano}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function InvitaClienteForm({ client, onInvitato, riinvia = false }) {
  const [email, setEmail] = useState(client.email || "");
  const [inviando, setInviando] = useState(false);
  const [errore, setErrore] = useState("");
  const [fatto, setFatto] = useState(false);

  const invita = async () => {
    if (!email) { setErrore("Inserisci un'email."); return; }
    setInviando(true);
    setErrore("");
    setFatto(false);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("invite-client", {
      body: { client_id: client.id, email },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    setInviando(false);
    if (error || data?.error) { setErrore(data?.error || error.message); return; }
    setFatto(true);
    onInvitato();
  };

  return (
    <div className="space-y-2">
      <label className="text-slate-400 text-xs">{riinvia ? "Reinvia l'accesso (nuovo link via email)" : "Invita questa cliente via email"}</label>
      <div className="flex gap-2">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@esempio.com"
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        <button onClick={invita} disabled={inviando} className="bg-sky-500 text-white text-sm font-medium rounded-lg px-4">
          {inviando ? "Invio..." : riinvia ? "Reinvia" : "Invita"}
        </button>
      </div>
      {errore && <p className="text-rose-500 text-xs">{errore}</p>}
      {fatto && <p className="text-emerald-600 text-xs">Fatto! Nuovo link inviato via email.</p>}
    </div>
  );
}

function SchedaPdfUpload({ client, onCaricato }) {
  const [caricando, setCaricando] = useState(false);
  const [errore, setErrore] = useState("");

  const carica = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCaricando(true);
    setErrore("");
    const path = `${client.id}/scheda.pdf`;
    const { error: upErr } = await supabase.storage.from("workout-plans").upload(path, file, { upsert: true });
    if (upErr) { setCaricando(false); setErrore(upErr.message); return; }
    const { error: updErr } = await supabase.from("clients").update({ scheda_pdf_path: path }).eq("id", client.id);
    setCaricando(false);
    if (updErr) { setErrore(updErr.message); return; }
    onCaricato();
  };

  return (
    <div className="space-y-1">
      <input type="file" accept="application/pdf" onChange={carica} disabled={caricando}
        className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-600" />
      {caricando && <p className="text-slate-400 text-xs">Caricamento...</p>}
      {errore && <p className="text-rose-500 text-xs">{errore}</p>}
      {client.scheda_pdf_path && <p className="text-emerald-600 text-xs">PDF caricato ✓ (sostituiscilo caricandone un altro)</p>}
    </div>
  );
}

function EliminaClienteBottone({ client, onEliminato }) {
  const [confermare, setConfermare] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const elimina = async () => {
    setEliminando(true);
    await supabase.from("clients").delete().eq("id", client.id);
    setEliminando(false);
    onEliminato();
  };

  if (!confermare) {
    return <button onClick={() => setConfermare(true)} className="text-rose-500 text-sm font-medium">Elimina cliente</button>;
  }
  return (
    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2">
      <p className="text-rose-700 text-sm">Eliminare <strong>{client.nome} {client.cognome}</strong>? Tutti i suoi check, note e dati nutrizionali verranno cancellati per sempre.</p>
      <div className="flex gap-2">
        <button onClick={elimina} disabled={eliminando} className="bg-rose-600 text-white text-sm font-medium rounded-lg px-4 py-2">
          {eliminando ? "Elimino..." : "Sì, elimina definitivamente"}
        </button>
        <button onClick={() => setConfermare(false)} className="text-slate-500 text-sm px-3">Annulla</button>
      </div>
    </div>
  );
}

function AdminClientDetail({ clientId, onBack, onChanged }) {
  const [client, setClient] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [notes, setNotes] = useState([]);
  const [nutrizione, setNutrizione] = useState(null);
  const [pagamenti, setPagamenti] = useState([]);
  const [tab, setTab] = useState("dati");
  const [salvando, setSalvando] = useState(false);
  const [mostraCheckForm, setMostraCheckForm] = useState(false);
  const [mostraNotaForm, setMostraNotaForm] = useState(false);

  const carica = async () => {
    const { data: c } = await supabase.from("clients").select("*").eq("id", clientId).single();
    setClient(c);
    const { data: ck } = await supabase.from("checkins").select("*").eq("client_id", clientId).order("data_check", { ascending: false });
    setCheckins(ck || []);
    const { data: nt } = await supabase.from("notes").select("*").eq("client_id", clientId).order("data", { ascending: false });
    setNotes(nt || []);
    const { data: nu } = await supabase.from("nutrition_plans").select("*").eq("client_id", clientId).order("data_aggiornamento", { ascending: false }).limit(1).maybeSingle();
    setNutrizione(nu);
    const { data: pg } = await supabase.from("payments").select("*").eq("client_id", clientId).order("data_pagamento", { ascending: false });
    setPagamenti(pg || []);
  };
  useEffect(() => { carica(); }, [clientId]);

  const salvaCliente = async (campi) => {
    setSalvando(true);
    await supabase.from("clients").update(campi).eq("id", clientId);
    setSalvando(false);
    carica();
    onChanged?.();
  };

  if (!client) return <Spinner />;
  const tabs = [{ key: "dati", label: "Dati" }, { key: "check", label: "Check" }, { key: "progressi", label: "Progressi" }, { key: "allenamento", label: "Allenamento" }, { key: "nutrizione", label: "Nutrizione" }, { key: "note", label: "Note" }];

  return (
    <div className="px-6 pt-6 pb-16 max-w-3xl mx-auto space-y-5">
      <button onClick={onBack} className="flex items-center gap-1 text-slate-500 text-sm"><ArrowLeft size={16} /> Tutti i clienti</button>
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold text-slate-800">{client.nome} {client.cognome}</h1><p className="text-slate-500 text-sm">{client.codice}</p></div>
        <StatoBadge stato={client.stato_check} />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-6 px-6">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex-shrink-0 ${tab === t.key ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>{t.label}</button>
        ))}
      </div>

      {tab === "dati" && (
        <Card className="p-4 grid grid-cols-2 gap-4 text-sm [&_input]:min-w-0 [&_select]:min-w-0 [&>div]:min-w-0">
          <div>
            <label className="text-slate-400 text-xs">Piano</label>
            <select defaultValue={client.piano || ""} onBlur={(e) => salvaCliente({ piano: e.target.value || null })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">—</option>
              <option value="Mensile">Mensile</option>
              <option value="Trimestrale">Trimestrale</option>
              <option value="Semestrale">Semestrale</option>
              <option value="FRIEND">FRIEND</option>
              <option value="Gratuito">Gratuito</option>
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-xs">Stato pacchetto</label>
            <select defaultValue={client.stato_pacchetto || ""} onBlur={(e) => salvaCliente({ stato_pacchetto: e.target.value || null })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">—</option>
              <option value="attivo">attivo</option>
              <option value="in scadenza">in scadenza</option>
              <option value="scaduto">scaduto</option>
              <option value="in attivazione">in attivazione</option>
              <option value="gratuito">gratuito</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-slate-400 text-xs">Data inizio</label>
            <input type="date" defaultValue={client.data_inizio || ""} onBlur={(e) => salvaCliente({ data_inizio: e.target.value || null })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div className="col-span-2">
            <label className="text-slate-400 text-xs">Data scadenza</label>
            <input type="date" defaultValue={client.data_scadenza || ""} onBlur={(e) => salvaCliente({ data_scadenza: e.target.value || null })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label className="text-slate-400 text-xs">Altezza (cm)</label>
            <input type="number" defaultValue={client.altezza_cm || ""} onBlur={(e) => salvaCliente({ altezza_cm: e.target.value ? Number(e.target.value) : null })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label className="text-slate-400 text-xs">Sesso (per Body Fat %)</label>
            <select defaultValue={client.sesso || ""} onBlur={(e) => salvaCliente({ sesso: e.target.value || null })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">—</option>
              <option value="F">F</option>
              <option value="M">M</option>
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-xs">Età</label>
            <input type="number" defaultValue={client.eta || ""} onBlur={(e) => salvaCliente({ eta: e.target.value ? Number(e.target.value) : null })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div className="col-span-2">
            <label className="text-slate-400 text-xs">Prossimo check</label>
            <input type="date" defaultValue={client.prossimo_check || ""} onBlur={(e) => salvaCliente({ prossimo_check: e.target.value || null })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label className="text-slate-400 text-xs">Stato check</label>
            <select defaultValue={client.stato_check || ""} onBlur={(e) => salvaCliente({ stato_check: e.target.value || null })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">—</option>
              <option value="programmato">Programmato</option>
              <option value="da_compilare">Da compilare</option>
              <option value="ricevuto">Ricevuto</option>
              <option value="revisionato">Revisionato</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-slate-400 text-xs">Link scheda (esterno, es. Drive)</label>
            <input defaultValue={client.link_scheda || ""} onBlur={(e) => salvaCliente({ link_scheda: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div className="col-span-2">
            <label className="text-slate-400 text-xs">Oppure carica la scheda come PDF</label>
            <SchedaPdfUpload client={client} onCaricato={carica} />
          </div>
          <div className="col-span-2">
            <RegistraPagamento client={client} pagamenti={pagamenti} onRegistrato={carica} />
          </div>
          {salvando && <p className="text-slate-400 text-xs col-span-2">Salvataggio...</p>}
          <div className="col-span-2 border-t border-slate-100 pt-4 space-y-3">
            {client.user_id && (
              <p className="text-emerald-600 text-sm flex items-center gap-1"><CheckCircle2 size={16} /> Accesso attivo ({client.email})</p>
            )}
            <InvitaClienteForm client={client} onInvitato={carica} riinvia={!!client.user_id} />
          </div>
          <div className="col-span-2 border-t border-slate-100 pt-4">
            <EliminaClienteBottone client={client} onEliminato={() => { onBack(); onChanged?.(); }} />
          </div>
        </Card>
      )}

      {tab === "check" && (
        <div className="space-y-3">
          {!mostraCheckForm && (
            <button onClick={() => setMostraCheckForm(true)} className="w-full bg-slate-800 text-white text-sm font-medium rounded-xl py-2">+ Aggiungi check</button>
          )}
          {mostraCheckForm && (
            <NuovoCheckForm clientId={clientId} sesso={client.sesso} onAnnulla={() => setMostraCheckForm(false)} onSalvato={() => { setMostraCheckForm(false); carica(); }} />
          )}
          <Card className="p-4">
            <ul className="space-y-2">
              {checkins.map((r) => (
                <li key={r.id} className="border-b border-slate-100 pb-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">{r.data_check}</span>
                    <span className="text-slate-700">{r.peso_kg ? `${r.peso_kg} kg` : "—"}</span>
                    <StatoBadge stato={r.stato} />
                  </div>
                  <FotoCheck checkin={r} />
                </li>
              ))}
              {checkins.length === 0 && <p className="text-slate-400 text-sm">Nessun check ancora.</p>}
            </ul>
          </Card>
        </div>
      )}

      {tab === "progressi" && <ClientProgress checkins={checkins} altezza={client.altezza_cm} sesso={client.sesso} eta={client.eta} titolo="Progressi e storico check" />}

      {tab === "allenamento" && <DiarioAllenamento clientId={clientId} />}

      {tab === "nutrizione" && (
        <NutrizioneForm clientId={clientId} ultimo={nutrizione} onSalvato={carica} />
      )}

      {tab === "note" && (
        <div className="space-y-3">
          {!mostraNotaForm && (
            <button onClick={() => setMostraNotaForm(true)} className="w-full bg-slate-800 text-white text-sm font-medium rounded-xl py-2">+ Nuova nota</button>
          )}
          {mostraNotaForm && (
            <NuovaNotaForm clientId={clientId} onAnnulla={() => setMostraNotaForm(false)} onSalvato={() => { setMostraNotaForm(false); carica(); }} />
          )}
          {notes.map((n) => (
            <Card key={n.id} className="p-4">
              <div className="flex justify-between mb-1">
                <Badge className={n.tipo === "coach" ? "bg-slate-100 text-slate-500" : "bg-sky-100 text-sky-600"}>{n.tipo === "coach" ? "Privata" : "Visibile alla cliente"}</Badge>
                <span className="text-slate-400 text-xs">{n.data}</span>
              </div>
              <p className="text-slate-700 text-sm">{n.testo}</p>
            </Card>
          ))}
          {notes.length === 0 && <p className="text-slate-400 text-sm">Nessuna nota ancora.</p>}
        </div>
      )}
    </div>
  );
}

function NuovoClienteForm({ onCreato, onAnnulla }) {
  const [f, setF] = useState({ codice: "", nome: "", cognome: "", piano: "", data_inizio: "", data_scadenza: "", stato_pacchetto: "attivo", link_scheda: "", altezza_cm: "" });
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState("");

  const campo = (label, key, type = "text") => (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      <input type={type} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
    </div>
  );

  const salva = async () => {
    if (!f.codice || !f.nome) { setErrore("Codice e nome sono obbligatori."); return; }
    setSalvando(true);
    setErrore("");
    const payload = { ...f };
    payload.altezza_cm = payload.altezza_cm ? Number(payload.altezza_cm) : null;
    for (const k of ["data_inizio", "data_scadenza"]) if (!payload[k]) payload[k] = null;
    const { error } = await supabase.from("clients").insert(payload);
    setSalvando(false);
    if (error) { setErrore("Errore: " + error.message); return; }
    onCreato();
  };

  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700">Nuovo cliente</p>
      <div className="grid grid-cols-2 gap-3">
        {campo("Codice (es. c10)", "codice")}
        {campo("Nome", "nome")}
        {campo("Cognome", "cognome")}
        {campo("Piano", "piano")}
        {campo("Data inizio", "data_inizio", "date")}
        {campo("Data scadenza", "data_scadenza", "date")}
        {campo("Altezza (cm)", "altezza_cm", "number")}
      </div>
      {campo("Link scheda", "link_scheda")}
      <div>
        <label className="text-xs text-slate-500">Stato pacchetto</label>
        <select value={f.stato_pacchetto} onChange={(e) => setF({ ...f, stato_pacchetto: e.target.value })}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
          <option value="attivo">attivo</option>
          <option value="in scadenza">in scadenza</option>
          <option value="scaduto">scaduto</option>
          <option value="in attivazione">in attivazione</option>
          <option value="gratuito">gratuito</option>
        </select>
      </div>
      {errore && <p className="text-rose-500 text-sm">{errore}</p>}
      <div className="flex gap-2">
        <button onClick={salva} disabled={salvando} className="flex-1 bg-slate-800 text-white rounded-xl py-2 text-sm font-medium">{salvando ? "Salvo..." : "Crea cliente"}</button>
        <button onClick={onAnnulla} className="px-4 rounded-xl border border-slate-200 text-sm text-slate-500">Annulla</button>
      </div>
    </Card>
  );
}

function FotoCheck({ checkin }) {
  const slots = [
    { key: "foto_frontale_path", label: "Frontale" },
    { key: "foto_laterale_path", label: "Laterale destra" },
    { key: "foto_posteriore_path", label: "Posteriore" },
    { key: "foto_extra_path", label: "Laterale sinistra" },
  ].filter((s) => checkin[s.key]);
  const [urls, setUrls] = useState(null);
  const [aperto, setAperto] = useState(false);
  const [caricando, setCaricando] = useState(false);

  const apri = async () => {
    if (!aperto && !urls) {
      setCaricando(true);
      const risultati = await Promise.all(slots.map(async (s) => {
        const { data } = await supabase.storage.from("progress-photos").createSignedUrl(checkin[s.key], 3600);
        return { label: s.label, url: data?.signedUrl };
      }));
      setUrls(risultati);
      setCaricando(false);
    }
    setAperto(!aperto);
  };

  if (slots.length === 0) return null;
  return (
    <div className="mt-1">
      <button onClick={apri} className="text-sky-600 text-xs font-medium flex items-center gap-1">
        <Camera size={13} /> {caricando ? "Carico..." : aperto ? "Nascondi foto" : `Vedi foto (${slots.length})`}
      </button>
      {aperto && urls && (
        <div className="flex gap-2 mt-2 flex-wrap">
          {urls.map((u, i) => u.url && (
            <a key={i} href={u.url} target="_blank" rel="noreferrer" title={u.label}>
              <img src={u.url} alt={u.label} className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminList({ clients, onSelect, onChanged }) {
  const [mostraForm, setMostraForm] = useState(false);
  const inScadenza = clients.filter((c) => c.stato_pacchetto === "in scadenza");
  const daFare = clients.filter((c) => c.stato_check === "da_compilare");

  return (
    <div className="px-6 pt-6 pb-16 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Dashboard coach</h1>
        {!mostraForm && (
          <button onClick={() => setMostraForm(true)} className="bg-slate-800 text-white text-sm font-medium rounded-xl px-4 py-2">+ Nuovo cliente</button>
        )}
      </div>

      {mostraForm && (
        <NuovoClienteForm onAnnulla={() => setMostraForm(false)} onCreato={() => { setMostraForm(false); onChanged(); }} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4"><p className="text-xs text-slate-500">Check in scadenza</p><p className="text-2xl font-semibold text-amber-600 mt-1">{daFare.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Pacchetti in scadenza</p><p className="text-2xl font-semibold text-rose-600 mt-1">{inScadenza.length}</p></Card>
      </div>
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100"><p className="text-sm font-medium text-slate-700">Clienti ({clients.length})</p></div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr><th className="text-left px-4 py-2">Nome</th><th className="text-left px-4 py-2">Piano</th><th className="text-left px-4 py-2">Prossimo check</th><th className="text-left px-4 py-2">Stato</th><th></th></tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} onClick={() => onSelect(c.id)} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer">
                <td className="px-4 py-3 font-medium text-slate-700">{c.nome} {c.cognome}</td>
                <td className="px-4 py-3 text-slate-500">{c.piano || "—"}</td>
                <td className="px-4 py-3 text-slate-500">{c.prossimo_check || "—"}</td>
                <td className="px-4 py-3"><StatoBadge stato={c.stato_check} /></td>
                <td className="px-4 py-3 text-slate-300"><ChevronRight size={16} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function AdminApp() {
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [caricando, setCaricando] = useState(true);

  const carica = async () => {
    const { data } = await supabase.from("clients").select("*").order("nome");
    setClients(data || []);
    setCaricando(false);
  };
  useEffect(() => { carica(); }, []);

  if (caricando) return <Spinner />;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex items-center justify-between px-6 pt-5 max-w-3xl mx-auto">
        <span className="text-slate-400 text-xs font-medium tracking-wide">PANNELLO COACH</span>
        <button onClick={() => supabase.auth.signOut()} className="text-slate-400 flex items-center gap-1 text-xs"><LogOut size={14} /> Esci</button>
      </div>
      {selectedId ? (
        <AdminClientDetail clientId={selectedId} onBack={() => setSelectedId(null)} onChanged={carica} />
      ) : (
        <AdminList clients={clients} onSelect={setSelectedId} onChanged={carica} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ROOT — decide se sei admin o cliente in base al database            */
/* ------------------------------------------------------------------ */
function ImpostaPassword({ onFatto }) {
  const [password, setPassword] = useState("");
  const [conferma, setConferma] = useState("");
  const [errore, setErrore] = useState("");
  const [salvando, setSalvando] = useState(false);

  const salva = async (e) => {
    e.preventDefault();
    setErrore("");
    if (password.length < 6) { setErrore("La password deve avere almeno 6 caratteri."); return; }
    if (password !== conferma) { setErrore("Le due password non coincidono."); return; }
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSalvando(false);
    if (error) { setErrore(error.message); return; }
    window.history.replaceState(null, "", window.location.pathname);
    onFatto();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-800 to-slate-900 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-slate-700 mx-auto mb-4 flex items-center justify-center"><Dumbbell className="text-sky-300" size={26} /></div>
          <h1 className="text-white text-xl font-semibold">Benvenuta!</h1>
          <p className="text-slate-400 text-sm mt-1">Crea una password per accedere da qui in poi con email e password.</p>
        </div>
        <form onSubmit={salva} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 space-y-3">
          <input type="password" placeholder="Nuova password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
          <input type="password" placeholder="Ripeti la password" value={conferma} onChange={(e) => setConferma(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
          {errore && <p className="text-rose-400 text-xs">{errore}</p>}
          <button disabled={salvando} className="w-full bg-sky-500 hover:bg-sky-400 transition-colors text-white font-medium rounded-xl py-3">
            {salvando ? "Salvo..." : "Crea password ed entra"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [ruolo, setRuolo] = useState(null); // "admin" | "client" | null
  const [devImpostarePassword, setDevImpostarePassword] = useState(
    () => window.location.hash.includes("type=invite") || window.location.hash.includes("type=recovery")
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setRuolo(null); return; }
    (async () => {
      const { data } = await supabase.from("admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
      setRuolo(data ? "admin" : "client");
    })();
  }, [session]);

  if (session === undefined) return <Spinner />;
  if (!session) return <Login />;
  if (devImpostarePassword) return <ImpostaPassword onFatto={() => setDevImpostarePassword(false)} />;
  if (ruolo === null) return <Spinner />;

  return ruolo === "admin" ? <AdminApp /> : <ClientApp session={session} />;
}
