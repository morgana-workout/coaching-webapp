import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import {
  Home, ClipboardList, TrendingUp, Dumbbell, Phone, BookOpen,
  LogOut, ChevronRight, CheckCircle2, Clock, ArrowLeft, Camera,
  ChefHat, Flame, Droplets, ExternalLink, FileText, Apple, AlertCircle, X, CreditCard, Bell, Check, Plus,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
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

const LUOGHI = ["Via San Secondo 39, Torino", "Via Fratelli Calandra 6, Torino"];

function fasceOrarie() {
  const slots = [];
  for (let h = 7; h <= 19; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}
const SLOT_ORARI = fasceOrarie().filter((s) => s <= "19:00");

function pasquaDiPasqua(anno) {
  const a = anno % 19, b = Math.floor(anno / 100), c = anno % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31);
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anno, mese - 1, giorno);
}

function festivitaItaliane(anno) {
  const fisse = ["01-01", "01-06", "04-25", "05-01", "06-02", "08-15", "11-01", "12-08", "12-25", "12-26"];
  const pasqua = pasquaDiPasqua(anno);
  const pasquetta = new Date(pasqua); pasquetta.setDate(pasqua.getDate() + 1);
  const fmt = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return new Set([...fisse, fmt(pasqua), fmt(pasquetta)]);
}

function giornoDisponibile(dataStr) {
  if (!dataStr) return true;
  const d = new Date(dataStr + "T00:00:00");
  const weekday = d.getDay();
  if (weekday === 0 || weekday === 6) return false;
  const mm_dd = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (festivitaItaliane(d.getFullYear()).has(mm_dd)) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* UI helpers                                                          */
/* ------------------------------------------------------------------ */
function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>{children}</div>;
}
function Badge({ children, className = "" }) {
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>{children}</span>;
}
function PullToRefresh({ onRefresh, children, ownScroll = false, className = "" }) {
  const [pullY, setPullY] = useState(0);
  const [aggiornando, setAggiornando] = useState(false);
  const startY = React.useRef(null);
  const scrollRef = React.useRef(null);

  const inCima = () => (ownScroll ? (scrollRef.current?.scrollTop ?? 0) <= 0 : window.scrollY <= 0);

  const onTouchStart = (e) => {
    if (inCima()) startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e) => {
    if (startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0 && inCima()) setPullY(Math.min(delta, 90));
  };
  const onTouchEnd = async () => {
    if (pullY > 60) {
      setAggiornando(true);
      await onRefresh();
      setAggiornando(false);
    }
    setPullY(0);
    startY.current = null;
  };

  return (
    <div ref={scrollRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} className={`${ownScroll ? "overflow-y-auto" : ""} ${className}`}>
      <div style={{ height: aggiornando ? 50 : pullY, transition: pullY === 0 ? "height 0.2s" : "none" }} className="flex items-center justify-center overflow-hidden">
        {(pullY > 10 || aggiornando) && (
          <div className={`w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full ${aggiornando || pullY > 60 ? "animate-spin" : ""}`} />
        )}
      </div>
      {children}
    </div>
  );
}

function InputData({ value, defaultValue, onChange, onBlur, className = "" }) {
  return (
    <div className={`overflow-hidden rounded-lg border border-slate-200 ${className}`}>
      <input type="date" value={value} defaultValue={defaultValue} onChange={onChange} onBlur={onBlur}
        className="w-full border-0 px-3 py-2 text-sm block" style={{ maxWidth: "100%" }} />
    </div>
  );
}

function Spinner() {
  return <div className="flex justify-center pt-20"><div className="w-8 h-8 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" /></div>;
}
const STATO_LABEL = {
  programmato: { t: "Programmato", c: "bg-sky-100 text-sky-700" },
  da_compilare: { t: "Da compilare", c: "bg-amber-100 text-amber-700" },
  ricevuto: { t: "In revisione", c: "bg-violet-100 text-violet-700" },
  revisionato: { t: "Revisionato", c: "bg-emerald-100 text-emerald-700" },
};
function StatoBadge({ stato }) {
  const s = STATO_LABEL[stato] || { t: stato || "—", c: "bg-slate-100 text-slate-500" };
  return <Badge className={s.c}>{s.t}</Badge>;
}

/* ------------------------------------------------------------------ */
/* LOGIN                                                               */
/* ------------------------------------------------------------------ */
function Login({ erroreLink }) {
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
        {erroreLink && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm rounded-xl px-4 py-3 mb-5">
            Il link che hai usato non è più valido o è scaduto ({erroreLink}). Chiedi a Morgana di inviartene uno nuovo, poi accedi qui sotto con la password che avevi già impostato.
          </div>
        )}
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
function calcolaEta(dataNascita) {
  if (!dataNascita) return null;
  const oggi = new Date();
  const nascita = new Date(dataNascita);
  let eta = oggi.getFullYear() - nascita.getFullYear();
  const m = oggi.getMonth() - nascita.getMonth();
  if (m < 0 || (m === 0 && oggi.getDate() < nascita.getDate())) eta--;
  return eta;
}

const LIVELLI_ATTIVITA = [
  { value: "sedentario", label: "Sedentario", descrizione: "meno di 5.000 passi/giorno" },
  { value: "intermedio", label: "Intermedio", descrizione: "circa 8.000 passi/giorno" },
  { value: "attivo", label: "Attivo", descrizione: "oltre 10.000 passi/giorno" },
];

function ProfiloCliente({ client, onAggiornato }) {
  const profiloGiaCompilato = !!(client.data_nascita || client.altezza_cm || client.livello_attivita || client.note_particolari);
  const [modifica, setModifica] = useState(!profiloGiaCompilato);
  const [form, setForm] = useState({
    data_nascita: client.data_nascita || "", altezza_cm: client.altezza_cm || "",
    livello_attivita: client.livello_attivita || "", note_particolari: client.note_particolari || "",
  });
  const [salvando, setSalvando] = useState(false);

  const salva = async () => {
    setSalvando(true);
    await supabase.rpc("aggiorna_profilo_cliente", {
      p_data_nascita: form.data_nascita || null,
      p_altezza_cm: form.altezza_cm ? Number(form.altezza_cm) : null,
      p_livello_attivita: form.livello_attivita || null,
      p_note_particolari: form.note_particolari || null,
    });
    setSalvando(false);
    setModifica(false);
    onAggiornato?.();
  };

  if (!modifica) {
    const livello = LIVELLI_ATTIVITA.find((l) => l.value === client.livello_attivita);
    return (
      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Il tuo profilo</p>
          <button onClick={() => setModifica(true)} className="text-sky-600 text-xs font-medium">Modifica</button>
        </div>
        <div className="text-sm text-slate-700 space-y-1">
          {client.data_nascita && <p>Data di nascita: {client.data_nascita.split("-").reverse().join("/")}</p>}
          {client.altezza_cm && <p>Altezza: {client.altezza_cm} cm</p>}
          {livello && <p>Attività quotidiana: {livello.label}</p>}
          {client.note_particolari && <p className="text-slate-500">Segni particolari: {client.note_particolari}</p>}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Il tuo profilo</p>
      <div>
        <label className="text-xs text-slate-500">Data di nascita</label>
        <InputData value={form.data_nascita} onChange={(e) => setForm({ ...form, data_nascita: e.target.value })}
          className="mt-1" />
      </div>
      <div>
        <label className="text-xs text-slate-500">Altezza (cm)</label>
        <input type="number" value={form.altezza_cm} onChange={(e) => setForm({ ...form, altezza_cm: e.target.value })}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
      </div>
      <div>
        <label className="text-xs text-slate-500">Tipo di lavoro / attività quotidiana</label>
        <select value={form.livello_attivita} onChange={(e) => setForm({ ...form, livello_attivita: e.target.value })}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
          <option value="">Seleziona...</option>
          {LIVELLI_ATTIVITA.map((l) => <option key={l.value} value={l.value}>{l.label} ({l.descrizione})</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-500">Segni particolari (infortuni, condizioni da segnalare...)</label>
        <textarea value={form.note_particolari} onChange={(e) => setForm({ ...form, note_particolari: e.target.value })} rows={2}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
      </div>
      <div className="flex gap-2">
        <button onClick={salva} disabled={salvando} className="flex-1 bg-slate-800 text-white rounded-xl py-2 text-sm font-medium">{salvando ? "Salvo..." : "Salva profilo"}</button>
        {profiloGiaCompilato && <button onClick={() => setModifica(false)} className="px-4 rounded-xl border border-slate-200 text-sm text-slate-500">Annulla</button>}
      </div>
    </Card>
  );
}

function PrenotaLezioneForm({ client, extra = false, onFatto }) {
  const [data, setData] = useState("");
  const [ora, setOra] = useState(SLOT_ORARI[6]);
  const [luogo, setLuogo] = useState(client.sede_abituale || LUOGHI[0]);
  const [nota, setNota] = useState("");
  const [inviando, setInviando] = useState(false);

  const disponibile = giornoDisponibile(data);

  const invia = async () => {
    if (!data) return;
    setInviando(true);
    const { data: creato } = await supabase.from("calendar_events").insert({
      client_id: client.id, tipo: "lezione", data, ora, luogo, nota,
      stato: "richiesta", extra_euro: extra ? 30 : null, fuori_disponibilita: !disponibile,
    }).select().single();
    if (creato && !extra) await collegaLezionePacchetto(client.id, creato);
    setInviando(false);
    onFatto();
  };

  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700">Richiedi una lezione (60 min)</p>
      <p className="text-slate-500 text-xs">Morgana confermerà la disponibilità appena possibile.</p>
      {extra && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2 text-xs">
          Questa lezione in presenza ha un costo aggiuntivo di 30€, da saldare direttamente con Morgana.
        </div>
      )}
      <InputData value={data} onChange={(e) => setData(e.target.value)} />
      {data && !disponibile && (
        <div className="bg-slate-50 border border-slate-200 text-slate-600 rounded-lg px-3 py-2 text-xs">
          Questo giorno è normalmente non disponibile (weekend o festivo). Puoi comunque inviare la richiesta come eccezione: Morgana valuterà se può confermarla.
        </div>
      )}
      <div>
        <label className="text-xs text-slate-500">Orario (durata 60 minuti)</label>
        <select value={ora} onChange={(e) => setOra(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
          {SLOT_ORARI.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-500">Sede</label>
        <select value={luogo} onChange={(e) => setLuogo(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
          {LUOGHI.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      <textarea placeholder="Nota (facoltativa)" value={nota} onChange={(e) => setNota(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      <button onClick={invia} disabled={inviando} className="w-full bg-slate-800 text-white rounded-xl py-2 text-sm font-medium">{inviando ? "Invio..." : "Invia richiesta"}</button>
    </Card>
  );
}

function ClientHome({ client, onAggiornato }) {
  const [prenotaAperto, setPrenotaAperto] = useState(false);
  const [inviata, setInviata] = useState(false);
  const [lezioniSvolte, setLezioniSvolte] = useState(null);
  const [prossimaLezione, setProssimaLezione] = useState(undefined);
  const isBulb = client.tipo_servizio === "presenza" || client.tipo_servizio === "ibrido";
  const isOnline = client.tipo_servizio === "online" || client.tipo_servizio === "ibrido";
  const isSoloOnline = client.tipo_servizio === "online";
  const lezioniIncluse = client.pacchetto_lezioni ? Number(client.pacchetto_lezioni) : null;
  const pacchettoSingolo = client.pacchetto_lezioni === "1";

  useEffect(() => {
    if (!isBulb) return;
    if (pacchettoSingolo) {
      const oggi = new Date().toISOString().slice(0, 10);
      supabase.from("calendar_events").select("*").eq("client_id", client.id).eq("tipo", "lezione")
        .neq("stato", "annullata").neq("stato", "persa").gte("data", oggi).order("data").limit(1).maybeSingle()
        .then(({ data }) => setProssimaLezione(data || null));
    } else {
      supabase.from("lezioni_svolte").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("fatta", true)
        .then(({ count }) => setLezioniSvolte(count ?? 0));
    }
  }, [client.id, isBulb, pacchettoSingolo]);

  return (
    <div className="px-5 pt-6 pb-24 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Ciao {client.nome} 👋</h1>
        <p className="text-slate-500 text-sm mt-1">Costanza batte perfezione, sempre.</p>
      </div>

      {isOnline && (
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
      )}

      {isBulb && pacchettoSingolo && (
        <Card className="p-5">
          <span className="text-slate-500 text-xs uppercase tracking-wide font-medium">Prossima lezione</span>
          {prossimaLezione === undefined ? (
            <p className="text-slate-400 text-sm mt-2">Caricamento...</p>
          ) : prossimaLezione ? (
            <p className="text-2xl font-semibold text-slate-800 mt-2">
              {prossimaLezione.data.split("-").reverse().join("/")}{prossimaLezione.ora ? ` · ${prossimaLezione.ora.slice(0, 5)}` : ""}
              {prossimaLezione.stato === "richiesta" && <span className="block text-amber-600 text-sm font-normal mt-1">Da confermare</span>}
            </p>
          ) : (
            <p className="text-slate-500 text-sm mt-2">Nessuna lezione ancora programmata.</p>
          )}
        </Card>
      )}

      {isBulb && !pacchettoSingolo && (
        <Card className="p-5">
          <span className="text-slate-500 text-xs uppercase tracking-wide font-medium">Il tuo pacchetto</span>
          <p className="text-3xl font-semibold text-slate-800 mt-2">
            {lezioniSvolte ?? 0}{lezioniIncluse ? ` / ${lezioniIncluse}` : ""} <span className="text-lg font-normal text-slate-400">lezioni</span>
          </p>
        </Card>
      )}

      {client.stato_pacchetto === "in scadenza" && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm">
          <AlertCircle size={18} />
          Il tuo coaching scade il {client.data_scadenza}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {isOnline && (client.scheda_pdf_path || client.link_scheda) && (
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
        {isBulb && (
          <button onClick={() => setPrenotaAperto(true)} className="bg-sky-500 text-white rounded-2xl p-4 flex flex-col items-start gap-2">
            <Phone size={20} /><span className="font-medium text-sm">Prenota lezione</span>
          </button>
        )}
        {isSoloOnline && (
          <a href={CALENDLY_URL} target="_blank" rel="noreferrer" className="bg-sky-500 text-white rounded-2xl p-4 flex flex-col items-start gap-2">
            <Phone size={20} /><span className="font-medium text-sm">Prenota call</span>
          </a>
        )}
      </div>

      {isSoloOnline && (
        <button onClick={() => setPrenotaAperto(true)} className="w-full border border-dashed border-slate-300 text-slate-600 rounded-2xl p-3 text-sm font-medium">
          Prenota lezione in presenza
        </button>
      )}

      {prenotaAperto && !inviata && (
        <PrenotaLezioneForm client={client} extra={isSoloOnline} onFatto={() => setInviata(true)} />
      )}
      {inviata && (
        <p className="text-emerald-600 text-sm px-1">Richiesta inviata! Morgana ti confermerà orario e data.</p>
      )}

      <ProfiloCliente client={client} onAggiornato={onAggiornato} />
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
    if (!files.frontale || !files.laterale || !files.posteriore || !files.extra) {
      setErrore("Le 4 foto (frontale, laterale destra, laterale sinistra, posteriore) sono obbligatorie.");
      return;
    }
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
      <a href="/guida-check-misure-foto.pdf" target="_blank" rel="noopener noreferrer" download
        className="flex items-center gap-3 bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
        <FileText size={20} className="text-sky-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700">Guida misure e foto</p>
          <p className="text-xs text-slate-500">Come prenderle correttamente prima di inviare il check</p>
        </div>
        <span className="text-sky-600 text-xs font-medium flex-shrink-0">Scarica</span>
      </a>
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
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Foto progressi <span className="text-rose-400 normal-case font-normal">(obbligatorie)</span></p>
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

/* Analizza la serie storica dei check e produce un giudizio testuale in italiano
   sull'andamento generale (peso, vita, circonferenze muscolari), utile a chi legge
   il grafico senza saperlo interpretare da sola. */
function analizzaAndamento(ordinati) {
  const estrai = (key) => ordinati.map((c) => ({ data: c.data_check, v: c[key] })).filter((p) => p.v != null);
  const peso = estrai("peso_kg");
  const vita = estrai("sopra_ombelico_cm");
  const muscolo = ordinati
    .map((c) => {
      const vals = [c.braccio_dx_cm, c.coscia_dx_cm].filter((v) => v != null);
      return vals.length ? { data: c.data_check, v: vals.reduce((a, b) => a + b, 0) / vals.length } : null;
    })
    .filter(Boolean);

  const puntiUtili = Math.max(peso.length, vita.length, muscolo.length);
  if (puntiUtili < 2) return null;

  const trend = (serie, soglia) => {
    if (serie.length < 2) return { direzione: null, delta: null, oscillante: false };
    const delta = serie[serie.length - 1].v - serie[0].v;
    let cambiDirezione = 0;
    for (let i = 2; i < serie.length; i++) {
      const prevD = serie[i - 1].v - serie[i - 2].v;
      const curD = serie[i].v - serie[i - 1].v;
      if (prevD !== 0 && curD !== 0 && Math.sign(prevD) !== Math.sign(curD)) cambiDirezione++;
    }
    const direzione = Math.abs(delta) < soglia ? "stabile" : delta < 0 ? "calo" : "aumento";
    return { direzione, delta, oscillante: cambiDirezione >= 2 && serie.length >= 4 };
  };

  return { peso, vita, muscolo, tPeso: trend(peso, 0.4), tVita: trend(vita, 0.5), tMuscolo: trend(muscolo, 0.5) };
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function generaNotaAndamento({ tPeso, tVita, tMuscolo }, obiettivo) {
  const frasi = [];
  if (tPeso.oscillante) {
    frasi.push("Il peso ha avuto alti e bassi nelle ultime settimane — è normale, dipende da ritenzione idrica, ciclo, stress o digestione — ma guardando l'insieme dei dati:");
  }
  const pesoTxt = tPeso.direzione === "calo" ? "il peso è sceso" : tPeso.direzione === "aumento" ? "il peso è salito" : tPeso.direzione === "stabile" ? "il peso è rimasto stabile" : null;
  const vitaTxt = tVita.direzione === "calo" ? "la circonferenza vita si è ridotta" : tVita.direzione === "aumento" ? "la circonferenza vita è aumentata" : tVita.direzione === "stabile" ? "la circonferenza vita è rimasta stabile" : null;
  const muscTxt = tMuscolo.direzione === "calo" ? "le circonferenze di braccio/coscia sono leggermente calate" : tMuscolo.direzione === "aumento" ? "le circonferenze di braccio/coscia sono aumentate" : tMuscolo.direzione === "stabile" ? "le circonferenze di braccio/coscia si sono mantenute" : null;

  if (tVita.direzione === "calo" && (tMuscolo.direzione === "stabile" || tMuscolo.direzione === "aumento")) {
    frasi.push(`${cap(vitaTxt)}${muscTxt ? " mentre " + muscTxt : ""}: è il segno di una ricomposizione corporea in corso — il grasso cala e la massa muscolare tiene o cresce, anche se ${pesoTxt || "il peso da solo non racconta tutta la storia"}. La definizione che si vede nelle foto è proprio questo: meno grasso attorno al muscolo che c'è già.`);
  } else if (tVita.direzione === "calo" && tMuscolo.direzione === "calo") {
    frasi.push(`${cap(vitaTxt)}, insieme a un calo anche delle circonferenze muscolari: la definizione sta procedendo, ma vale la pena monitorare che il calo non coinvolga troppo la massa magra — parlane con la coach.`);
  } else if (tVita.direzione === "stabile" && tMuscolo.direzione === "aumento") {
    frasi.push("La vita è rimasta stabile mentre le circonferenze muscolari crescono: è il segno di una costruzione di massa muscolare senza accumulo significativo in zona addominale.");
  } else if (tVita.direzione === "aumento" && tMuscolo.direzione === "aumento") {
    frasi.push("Sia la vita che le circonferenze muscolari sono in aumento: coerente con una fase di crescita, in parte muscolo e in parte — fisiologicamente — un po' di massa grassa.");
  } else if (tVita.direzione === "stabile" && tMuscolo.direzione === "stabile" && tPeso.direzione === "stabile") {
    frasi.push("I valori sono rimasti stabili nel periodo: il corpo è in una fase di mantenimento, senza grandi cambiamenti in una direzione o nell'altra.");
  } else {
    const parti = [pesoTxt, vitaTxt, muscTxt].filter(Boolean);
    if (parti.length) frasi.push(cap(parti.join(", ")) + ".");
    else frasi.push("Servono ancora un paio di check per vedere un trend chiaro.");
  }

  if (obiettivo === "definizione") {
    if (tVita.direzione === "calo") frasi.push("Il trend è coerente con l'obiettivo attuale di definizione.");
    else if (tVita.direzione === "aumento") frasi.push("Rispetto all'obiettivo di definizione, la vita in aumento merita attenzione: parlane con la coach per eventuali aggiustamenti.");
  } else if (obiettivo === "massa") {
    if (tMuscolo.direzione === "aumento" || tPeso.direzione === "aumento") frasi.push("Il trend è coerente con l'obiettivo attuale di aumento massa.");
  } else if (obiettivo === "mantenimento") {
    if (tPeso.direzione === "stabile" && tVita.direzione === "stabile") frasi.push("In linea con l'obiettivo attuale di mantenimento.");
  }

  return frasi.join(" ");
}

function serieConVariazione(rows, key) {
  let base = null;
  return rows.map((r) => {
    if (r[key] == null) return { ...r, [key + "Pct"]: null };
    if (base == null) base = r[key];
    const pct = base ? ((r[key] - base) / base) * 100 : 0;
    return { ...r, [key + "Pct"]: Number(pct.toFixed(2)) };
  });
}

function AndamentoGenerale({ checkins, obiettivo }) {
  const ordinati = [...checkins].sort((a, b) => (a.data_check || "").localeCompare(b.data_check || ""));
  const analisi = analizzaAndamento(ordinati);
  if (!analisi) return null;

  const nota = generaNotaAndamento(analisi, obiettivo);
  const chartDataRaw = ordinati.map((c) => {
    const vals = [c.braccio_dx_cm, c.coscia_dx_cm].filter((v) => v != null);
    return {
      dataLabel: c.data_check ? c.data_check.slice(5).split("-").reverse().join("/") : "",
      peso: c.peso_kg ?? null,
      vita: c.sopra_ombelico_cm ?? null,
      muscolo: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
    };
  });
  let chartData = serieConVariazione(chartDataRaw, "peso");
  chartData = serieConVariazione(chartData, "vita");
  chartData = serieConVariazione(chartData, "muscolo");

  return (
    <Card className="p-4 space-y-3">
      <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Andamento generale</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="dataLabel" tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${v}%`} width={40} />
          <Tooltip formatter={(v) => (v == null ? "—" : `${v}%`)} />
          <Line type="monotone" dataKey="pesoPct" name="Peso" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          <Line type="monotone" dataKey="vitaPct" name="Vita" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          <Line type="monotone" dataKey="muscoloPct" name="Braccio/coscia" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500" /> Peso</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Vita</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Braccio/coscia</span>
      </div>
      <p className="text-slate-400 text-[11px]">Variazione % rispetto al primo valore disponibile di ogni misura, così puoi confrontare peso e circonferenze sullo stesso grafico.</p>
      <div className="bg-sky-50 border border-sky-100 rounded-lg p-3">
        <p className="text-sm text-slate-700 leading-relaxed">{nota}</p>
      </div>
    </Card>
  );
}

function ClientProgress({ checkins, altezza, sesso, eta, obiettivo, titolo = "I tuoi progressi" }) {
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
      <AndamentoGenerale checkins={checkins} obiettivo={obiettivo} />
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

function formattaPeriodo(r) {
  const ini = r.data_inizio ? r.data_inizio.split("-").reverse().join("/") : r.data_aggiornamento?.split("-").reverse().join("/");
  const fine = r.data_fine ? r.data_fine.split("-").reverse().join("/") : null;
  return fine ? `${ini} → ${fine}` : `dal ${ini}`;
}

function StoricoNutrizione({ storico, isAdmin, onModifica }) {
  const [vista, setVista] = useState("aggiornamenti");
  const conKcal = (storico || []).filter((r) => r.kcal != null && r.data_aggiornamento);
  if (conKcal.length === 0) return null;

  const perMese = (() => {
    const map = {};
    conKcal.forEach((r) => {
      const mese = r.data_aggiornamento.slice(0, 7);
      if (!map[mese]) map[mese] = { mese, somma: 0, conteggio: 0 };
      map[mese].somma += Number(r.kcal);
      map[mese].conteggio += 1;
    });
    return Object.values(map).sort((a, b) => b.mese.localeCompare(a.mese))
      .map((m) => ({ ...m, media: Math.round(m.somma / m.conteggio) }));
  })();

  const datiGrafico = conKcal.map((r) => ({
    data: r.data_aggiornamento.split("-").reverse().slice(0, 2).join("/"),
    kcal: Number(r.kcal),
  }));

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Storico kcal</p>
        <div className="flex gap-1">
          <button onClick={() => setVista("aggiornamenti")} className={`px-2.5 py-1 rounded-full text-xs font-medium ${vista === "aggiornamenti" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}>Settimanale</button>
          <button onClick={() => setVista("mensile")} className={`px-2.5 py-1 rounded-full text-xs font-medium ${vista === "mensile" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}>Mensile</button>
        </div>
      </div>
      {datiGrafico.length > 1 && (
        <div style={{ width: "100%", height: 150 }}>
          <ResponsiveContainer>
            <LineChart data={datiGrafico}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="data" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={["dataMin - 100", "dataMax + 100"]} width={40} />
              <Tooltip />
              <Line type="monotone" dataKey="kcal" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {vista === "aggiornamenti" ? (
        <ul className="space-y-1.5 max-h-64 overflow-y-auto">
          {[...conKcal].reverse().map((r) => {
            const Riga = isAdmin ? "button" : "div";
            return (
              <Riga key={r.id} onClick={isAdmin ? () => onModifica?.(r) : undefined}
                className={`w-full flex justify-between items-center text-sm border-b border-slate-100 pb-1.5 ${isAdmin ? "text-left hover:bg-slate-50 rounded px-1 -mx-1" : ""}`}>
                <span className="text-slate-500">{formattaPeriodo(r)}</span>
                <span className="text-slate-700 font-medium">{r.kcal} kcal</span>
                <span className="text-slate-400 text-xs">P{r.proteine_g ?? "—"} C{r.carboidrati_g ?? "—"} G{r.grassi_g ?? "—"}</span>
              </Riga>
            );
          })}
        </ul>
      ) : (
        <ul className="space-y-1.5">
          {perMese.map((m) => (
            <li key={m.mese} className="flex justify-between items-center text-sm border-b border-slate-100 pb-1.5">
              <span className="text-slate-500 capitalize">{new Date(m.mese + "-02").toLocaleDateString("it-IT", { month: "long", year: "numeric" })}</span>
              <span className="text-slate-700 font-medium">{m.media} kcal medie</span>
              <span className="text-slate-400 text-xs">{m.conteggio} aggiornament{m.conteggio === 1 ? "o" : "i"}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ClientNutrizione({ piano, storico }) {
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
        <p className="text-slate-500 text-sm mt-1">Valori indicativi, {formattaPeriodo(piano)}</p>
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
      <StoricoNutrizione storico={storico} />
    </div>
  );
}

function RigaSerieAllenamento({ exerciseId, data, clientId, numeroSerie, entry, onSaved }) {
  const [kg, setKg] = useState(entry?.kg ?? "");
  const [rip, setRip] = useState(entry?.ripetizioni ?? "");
  const [id, setId] = useState(entry?.id ?? null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setKg(entry?.kg ?? "");
    setRip(entry?.ripetizioni ?? "");
    setId(entry?.id ?? null);
  }, [entry?.id]);

  const salva = async () => {
    if (kg === "" && rip === "" && !id) return;
    setSalvando(true);
    if (kg === "" && rip === "" && id) {
      // riga svuotata: la rimuoviamo invece di lasciare un record vuoto
      await supabase.from("training_entries").delete().eq("id", id);
      setId(null);
      setSalvando(false);
      onSaved();
      return;
    }
    const payload = { kg: kg === "" ? null : Number(kg), ripetizioni: rip || null };
    if (id) {
      await supabase.from("training_entries").update(payload).eq("id", id);
    } else {
      const { data: inserito } = await supabase.from("training_entries")
        .insert({ client_id: clientId, exercise_id: exerciseId, data, numero_serie: numeroSerie, ...payload })
        .select().single();
      if (inserito) setId(inserito.id);
    }
    setSalvando(false);
    onSaved();
  };

  return (
    <div className="flex gap-1 items-center">
      <span className="text-[9px] text-slate-300 w-2.5 flex-shrink-0">{numeroSerie}</span>
      <input type="number" step="0.5" value={kg} onChange={(e) => setKg(e.target.value)} onBlur={salva} disabled={salvando}
        placeholder="kg" className="w-1/2 min-w-0 text-center border border-slate-200 rounded px-1 py-1 text-xs" />
      <input value={rip} onChange={(e) => setRip(e.target.value)} onBlur={salva} disabled={salvando}
        placeholder="rip" className="w-1/2 min-w-0 text-center border border-slate-200 rounded px-1 py-1 text-xs" />
    </div>
  );
}

function CellaAllenamento({ exerciseId, data, clientId, entries, serieRichieste, onSaved }) {
  const nSerie = Math.max(1, Math.min(Number(serieRichieste) || 3, 10));
  const primaRigaConNota = entries.find((e) => e.note) || entries.find((e) => e.numero_serie === 1) || entries[0];
  const [nota, setNota] = useState(primaRigaConNota?.note ?? "");
  const [salvandoNota, setSalvandoNota] = useState(false);

  useEffect(() => { setNota(primaRigaConNota?.note ?? ""); }, [primaRigaConNota?.id, primaRigaConNota?.note]);

  const salvaNota = async () => {
    setSalvandoNota(true);
    const primaRiga = entries.find((e) => e.numero_serie === 1) || entries[0];
    if (primaRiga) {
      await supabase.from("training_entries").update({ note: nota || null }).eq("id", primaRiga.id);
    } else if (nota) {
      await supabase.from("training_entries").insert({ client_id: clientId, exercise_id: exerciseId, data, numero_serie: 1, note: nota });
    }
    setSalvandoNota(false);
    onSaved();
  };

  return (
    <div className="flex flex-col gap-1 w-28">
      {Array.from({ length: nSerie }).map((_, i) => {
        const numeroSerie = i + 1;
        const entry = entries.find((e) => e.numero_serie === numeroSerie);
        return (
          <RigaSerieAllenamento key={numeroSerie} exerciseId={exerciseId} data={data} clientId={clientId}
            numeroSerie={numeroSerie} entry={entry} onSaved={onSaved} />
        );
      })}
      <input value={nota} onChange={(e) => setNota(e.target.value)} onBlur={salvaNota} disabled={salvandoNota}
        placeholder="note" className="w-full border border-slate-200 rounded px-1 py-1 text-[11px] mt-0.5" />
    </div>
  );
}

function EsercizioNome({ id, nome, onSaved }) {
  const [val, setVal] = useState(nome);
  const salva = async () => {
    if (val === nome || !val.trim()) { setVal(nome); return; }
    await supabase.from("training_exercises").update({ nome: val }).eq("id", id);
    onSaved();
  };
  return (
    <textarea value={val} onChange={(e) => setVal(e.target.value)} onBlur={salva} rows={2}
      className="w-full min-w-0 border-0 bg-transparent font-medium text-slate-800 text-sm focus:outline-none focus:bg-slate-50 rounded px-1 -mx-1 resize-none leading-snug" />
  );
}

function GiornoAllenamento({ clientId, giorno, onGiornoRinominato }) {
  const [esercizi, setEsercizi] = useState([]);
  const [entries, setEntries] = useState([]);
  const [nuovoEsercizio, setNuovoEsercizio] = useState("");
  const [caricando, setCaricando] = useState(true);

  const carica = async () => {
    const { data: es } = await supabase.from("training_exercises").select("*").eq("training_day_id", giorno.id).order("ordine");
    setEsercizi(es || []);
    if (es && es.length > 0) {
      const { data: en } = await supabase.from("training_entries").select("*").in("exercise_id", es.map((e) => e.id));
      setEntries(en || []);
    } else {
      setEntries([]);
    }
    setCaricando(false);
  };
  useEffect(() => { carica(); }, [giorno.id]);

  const date = [...new Set(entries.map((e) => e.data))].sort();

  const aggiungiEsercizio = async () => {
    if (!nuovoEsercizio.trim()) return;
    await supabase.from("training_exercises").insert({
      client_id: clientId, training_day_id: giorno.id, nome: nuovoEsercizio, ordine: esercizi.length + 1,
    });
    setNuovoEsercizio("");
    carica();
  };

  const aggiungiData = async () => {
    if (esercizi.length === 0) { alert("Aggiungi prima almeno un esercizio."); return; }
    const nuovaData = prompt("Data del nuovo allenamento (gg/mm/aaaa oppure lascia vuoto per oggi):");
    let d = new Date().toISOString().slice(0, 10);
    if (nuovaData) {
      const parti = nuovaData.split("/");
      if (parti.length === 3) d = `${parti[2]}-${parti[1].padStart(2, "0")}-${parti[0].padStart(2, "0")}`;
    }
    if (date.includes(d)) { alert("Esiste già una colonna per questa data."); return; }
    await supabase.from("training_entries").insert(
      esercizi.map((e) => ({ client_id: clientId, exercise_id: e.id, data: d, kg: null }))
    );
    carica();
  };

  const rinominaGiorno = async (e) => {
    const nuovoNome = e.target.value;
    if (nuovoNome === giorno.nome || !nuovoNome.trim()) return;
    await supabase.from("training_days").update({ nome: nuovoNome }).eq("id", giorno.id);
    onGiornoRinominato();
  };

  const rinominaData = async (vecchiaData, nuovaDataStr) => {
    if (!nuovaDataStr || nuovaDataStr === vecchiaData) return;
    if (date.includes(nuovaDataStr)) { alert("Esiste già una colonna con questa data."); return; }
    await supabase.from("training_entries").update({ data: nuovaDataStr })
      .in("exercise_id", esercizi.map((e) => e.id)).eq("data", vecchiaData);
    carica();
  };

  const aggiornaEsercizioCampo = async (id, campo, valore) => {
    await supabase.from("training_exercises").update({ [campo]: valore }).eq("id", id);
    carica();
  };

  const eliminaEsercizio = async (id) => {
    if (!confirm("Eliminare questo esercizio e tutto il suo storico di carichi registrati?")) return;
    await supabase.from("training_entries").delete().eq("exercise_id", id);
    await supabase.from("training_exercises").delete().eq("id", id);
    carica();
  };

  const muoviEsercizio = async (id, direzione) => {
    const idx = esercizi.findIndex((e) => e.id === id);
    const altroIdx = idx + direzione;
    if (altroIdx < 0 || altroIdx >= esercizi.length) return;
    const nuovo = [...esercizi];
    [nuovo[idx], nuovo[altroIdx]] = [nuovo[altroIdx], nuovo[idx]];
    setEsercizi(nuovo);
    await Promise.all(nuovo.map((e, i) => supabase.from("training_exercises").update({ ordine: i + 1 }).eq("id", e.id)));
  };

  if (caricando) return <p className="text-slate-400 text-sm px-1">Caricamento...</p>;

  return (
    <div className="space-y-3">
      <input defaultValue={giorno.nome} onBlur={rinominaGiorno}
        className="text-lg font-semibold text-slate-800 border-0 bg-transparent focus:outline-none focus:bg-slate-50 rounded px-1 -mx-1 w-full" />

      {esercizi.length === 0 ? (
        <Card className="p-6 text-center text-slate-400 text-sm">Nessun esercizio ancora. Aggiungine uno qui sotto.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2 sticky left-0 bg-slate-50 w-[210px] max-w-[210px]">Esercizio</th>
                {date.map((d) => (
                  <th key={d} className="text-center px-2 py-2 whitespace-nowrap">
                    <input type="date" defaultValue={d} onBlur={(e) => rinominaData(d, e.target.value)}
                      className="bg-transparent border-0 text-xs text-slate-500 uppercase text-center w-28 focus:outline-none focus:bg-white rounded" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {esercizi.map((es) => (
                <tr key={es.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 sticky left-0 bg-white w-[210px] max-w-[210px]">
                    <div className="flex items-center gap-1">
                      <EsercizioNome id={es.id} nome={es.nome} onSaved={carica} />
                      <button onClick={() => muoviEsercizio(es.id, -1)} className="text-slate-300 hover:text-slate-600 px-0.5 flex-shrink-0">▲</button>
                      <button onClick={() => muoviEsercizio(es.id, 1)} className="text-slate-300 hover:text-slate-600 px-0.5 flex-shrink-0">▼</button>
                      <button onClick={() => eliminaEsercizio(es.id)} className="text-slate-300 hover:text-rose-500 px-0.5 flex-shrink-0"><X size={14} /></button>
                    </div>
                    {(es.serie || es.ripetizioni) && (
                      <p className="text-slate-600 text-[11px] font-medium mt-0.5">
                        {es.serie ? `${es.serie} serie` : ""}{es.serie && es.ripetizioni ? " x " : ""}{es.ripetizioni || ""}
                      </p>
                    )}
                    {es.note && <p className="text-slate-400 text-[11px] mt-0.5 pr-1 break-words whitespace-normal leading-snug">{es.note}</p>}
                  </td>
                  {date.map((d) => {
                    const entriesCella = entries.filter((en) => en.exercise_id === es.id && en.data === d);
                    return (
                      <td key={d} className="px-2 py-2 text-center">
                        <CellaAllenamento exerciseId={es.id} data={d} clientId={clientId} entries={entriesCella} serieRichieste={es.serie} onSaved={carica} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="flex gap-2">
        <input value={nuovoEsercizio} onChange={(e) => setNuovoEsercizio(e.target.value)} placeholder="Nuovo esercizio (es. Squat)"
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        <button onClick={aggiungiEsercizio} className="bg-slate-800 text-white text-sm font-medium rounded-lg px-3">+ Riga</button>
      </div>
      <button onClick={aggiungiData} className="w-full border border-slate-200 text-slate-600 text-sm font-medium rounded-xl py-2">+ Nuova data di allenamento</button>
    </div>
  );
}

function parseCSV(testo) {
  const righe = [];
  let riga = [], campo = "", dentroVirgolette = false;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (dentroVirgolette) {
      if (c === '"') {
        if (testo[i + 1] === '"') { campo += '"'; i++; }
        else dentroVirgolette = false;
      } else campo += c;
    } else if (c === '"') dentroVirgolette = true;
    else if (c === ",") { riga.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && testo[i + 1] === "\n") i++;
      riga.push(campo); campo = "";
      if (riga.some((v) => v.trim() !== "")) righe.push(riga);
      riga = [];
    } else campo += c;
  }
  if (campo !== "" || riga.length > 0) { riga.push(campo); righe.push(riga); }
  return righe;
}

function DiarioAllenamento({ clientId, isAdmin }) {
  const [giorni, setGiorni] = useState([]);
  const [giornoAttivo, setGiornoAttivo] = useState(null);
  const [caricando, setCaricando] = useState(true);
  const [importando, setImportando] = useState(false);

  const carica = async () => {
    const { data } = await supabase.from("training_days").select("*").eq("client_id", clientId).order("ordine");
    setGiorni(data || []);
    if (data && data.length > 0 && !giornoAttivo) setGiornoAttivo(data[0].id);
    setCaricando(false);
  };
  useEffect(() => { carica(); }, [clientId]);

  const eliminaGiorno = async (giornoId) => {
    if (!confirm("Eliminare questo giorno e tutti i suoi esercizi/carichi registrati? Non si può annullare.")) return;
    const { data: es } = await supabase.from("training_exercises").select("id").eq("training_day_id", giornoId);
    const idsEsercizi = (es || []).map((e) => e.id);
    if (idsEsercizi.length) await supabase.from("training_entries").delete().in("exercise_id", idsEsercizi);
    await supabase.from("training_exercises").delete().eq("training_day_id", giornoId);
    await supabase.from("training_days").delete().eq("id", giornoId);
    if (giornoAttivo === giornoId) setGiornoAttivo(null);
    await carica();
  };

  const creaGiorno = async () => {
    if (giorni.length >= 30) return;
    const { data } = await supabase.from("training_days").insert({
      client_id: clientId, nome: `Giorno ${giorni.length + 1}`, ordine: giorni.length + 1,
    }).select().single();
    await carica();
    if (data) setGiornoAttivo(data.id);
  };

  const importaSchedaDaCSV = async (file, giorniIniziali = giorni) => {
    setImportando(true);
    const testo = await file.text();
    const righe = parseCSV(testo);
    if (righe.length < 2) { alert("File vuoto o non leggibile."); setImportando(false); return; }

    const header = righe[0].map((h) => h.trim().toLowerCase());
    const idx = {
      scheda: header.indexOf("scheda"), giorno: header.indexOf("giorno"), esercizio: header.indexOf("esercizio"),
      serie: header.indexOf("serie"), ripetizioni: header.indexOf("ripetizioni"), recupero: header.indexOf("recupero"),
      tecnica: header.indexOf("tecnica"), note: header.indexOf("note"),
    };
    if (idx.giorno === -1 || idx.esercizio === -1) {
      alert('Il file deve avere almeno le colonne "giorno" e "esercizio" nella prima riga.');
      setImportando(false);
      return;
    }

    let giorniLocali = [...giorniIniziali];
    const cacheGiorni = {};
    let giorniCreati = 0, eserciziCreati = 0, saltati = 0;

    for (let r = 1; r < righe.length; r++) {
      const riga = righe[r];
      if (riga.every((v) => !v || !v.trim())) continue;
      const schedaVal = idx.scheda !== -1 ? (riga[idx.scheda] || "").trim() : "";
      const giornoVal = (riga[idx.giorno] || "").trim();
      const nomeEsercizio = (riga[idx.esercizio] || "").trim();
      if (!giornoVal || !nomeEsercizio) continue;

      const nomeGiornoCompleto = schedaVal ? `${schedaVal} - ${giornoVal}` : giornoVal;
      let giornoId = cacheGiorni[nomeGiornoCompleto];
      if (!giornoId) {
        const esistente = giorniLocali.find((g) => g.nome === nomeGiornoCompleto);
        if (esistente) {
          giornoId = esistente.id;
        } else if (giorniLocali.length >= 30) {
          saltati++;
          continue;
        } else {
          const { data: nuovo } = await supabase.from("training_days").insert({ client_id: clientId, nome: nomeGiornoCompleto, ordine: giorniLocali.length + 1 }).select().single();
          if (!nuovo) continue;
          giorniLocali.push(nuovo);
          giornoId = nuovo.id;
          giorniCreati++;
        }
        cacheGiorni[nomeGiornoCompleto] = giornoId;
      }

      const { data: eserciziEsistenti } = await supabase.from("training_exercises").select("nome").eq("training_day_id", giornoId);
      const nomiEsistenti = (eserciziEsistenti || []).map((e) => e.nome);
      if (nomiEsistenti.includes(nomeEsercizio)) continue;

      const noteParti = [];
      if (idx.recupero !== -1 && riga[idx.recupero]?.trim()) noteParti.push(`Recupero: ${riga[idx.recupero].trim()}`);
      if (idx.tecnica !== -1 && riga[idx.tecnica]?.trim()) noteParti.push(riga[idx.tecnica].trim());
      if (idx.note !== -1 && riga[idx.note]?.trim()) noteParti.push(riga[idx.note].trim());

      await supabase.from("training_exercises").insert({
        client_id: clientId, training_day_id: giornoId, nome: nomeEsercizio,
        ordine: nomiEsistenti.length + 1,
        serie: idx.serie !== -1 && riga[idx.serie]?.trim() ? Number(riga[idx.serie].trim()) : null,
        ripetizioni: idx.ripetizioni !== -1 ? (riga[idx.ripetizioni] || "").trim() || null : null,
        note: noteParti.join(" — ") || null,
      });
      eserciziCreati++;
    }
    await carica();
    setImportando(false);
    alert(`Importati ${giorniCreati} giorno/i nuovo/i e ${eserciziCreati} esercizio/i dal file.${saltati ? ` ${saltati} riga/e saltata/e (limite massimo di giorni raggiunto).` : ""}`);
  };

  const esportaLogCompleto = async (giorniDaEsportare) => {
    const r = [];
    r.push("# Diario allenamento completo");
    r.push(`Esportato il ${new Date().toLocaleDateString("it-IT")}`);
    r.push("");
    for (const g of giorniDaEsportare) {
      r.push(`## ${g.nome}`);
      const { data: esercizi } = await supabase.from("training_exercises").select("*").eq("training_day_id", g.id).order("ordine");
      for (const es of esercizi || []) {
        r.push(`### ${es.nome}${es.note ? " — " + es.note : ""}`);
        const { data: entries } = await supabase.from("training_entries").select("*").eq("exercise_id", es.id).order("data").order("numero_serie");
        const perData = {};
        (entries || []).forEach((en) => { (perData[en.data] = perData[en.data] || []).push(en); });
        const dateOrdinate = Object.keys(perData).sort();
        dateOrdinate.forEach((d) => {
          const righeSet = perData[d];
          const note = righeSet.map((en) => en.note).find(Boolean);
          const serieTxt = righeSet
            .filter((en) => en.kg != null || en.ripetizioni)
            .map((en) => `serie ${en.numero_serie}: ${en.kg ?? "-"}kg${en.ripetizioni ? " x " + en.ripetizioni : ""}`)
            .join(", ");
          r.push(`- ${d}: ${serieTxt || "(nessun carico registrato)"}${note ? " — " + note : ""}`);
        });
        if (!dateOrdinate.length) r.push("- (nessun carico registrato)");
      }
      r.push("");
    }
    scaricaFile(`diario-allenamento-${new Date().toISOString().slice(0, 10)}.md`, r.join("\n"), "text/markdown");
  };

  const sostituisciConNuovaScheda = async (file) => {
    if (giorni.length > 0 && !confirm(`Questo esporterà in un file tutto il diario attuale (${giorni.length} giorno/i), poi eliminerà TUTTI i giorni esistenti prima di importare la nuova scheda dal CSV. Vuoi procedere?`)) return;
    setImportando(true);
    if (giorni.length > 0) {
      await esportaLogCompleto(giorni);
      for (const g of giorni) {
        const { data: es } = await supabase.from("training_exercises").select("id").eq("training_day_id", g.id);
        const idsEsercizi = (es || []).map((e) => e.id);
        if (idsEsercizi.length) await supabase.from("training_entries").delete().in("exercise_id", idsEsercizi);
        await supabase.from("training_exercises").delete().eq("training_day_id", g.id);
        await supabase.from("training_days").delete().eq("id", g.id);
      }
      setGiorni([]);
      setGiornoAttivo(null);
    }
    setImportando(false);
    await importaSchedaDaCSV(file, []);
  };

  if (caricando) return <Spinner />;

  return (
    <div className="px-5 pt-6 pb-24 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Diario allenamento</h1>
        <p className="text-slate-500 text-sm mt-1">Un giorno per ogni allenamento della settimana, con lo storico dei carichi.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {giorni.map((g) => (
          <div key={g.id} className="relative flex-shrink-0">
            <button onClick={() => setGiornoAttivo(g.id)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${giornoAttivo === g.id ? "bg-slate-800 text-white pr-6" : "bg-slate-100 text-slate-600 pr-6"}`}>
              {g.nome}
            </button>
            {isAdmin && (
              <button onClick={() => eliminaGiorno(g.id)} className={`absolute right-1.5 top-1/2 -translate-y-1/2 ${giornoAttivo === g.id ? "text-slate-300 hover:text-white" : "text-slate-400 hover:text-rose-500"}`}>
                <X size={12} />
              </button>
            )}
          </div>
        ))}
        {giorni.length < 30 && (
          <button onClick={creaGiorno} className="px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex-shrink-0 border border-dashed border-slate-300 text-slate-500">+ Giorno</button>
        )}
      </div>

      {isAdmin && (
        <div className="space-y-2">
          <label className={`w-full border border-slate-200 text-slate-600 text-sm font-medium rounded-xl py-2 flex items-center justify-center cursor-pointer ${importando ? "opacity-50 pointer-events-none" : ""}`}>
            {importando ? "Importo..." : "📥 Importa scheda da file CSV (aggiungi ai giorni esistenti)"}
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { if (e.target.files[0]) importaSchedaDaCSV(e.target.files[0]); e.target.value = ""; }} />
          </label>
          <label className={`w-full border border-amber-200 bg-amber-50 text-amber-700 text-sm font-medium rounded-xl py-2 flex items-center justify-center cursor-pointer ${importando ? "opacity-50 pointer-events-none" : ""}`}>
            🔄 Sostituisci con nuova scheda (esporta e ripulisci i giorni attuali)
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { if (e.target.files[0]) sostituisciConNuovaScheda(e.target.files[0]); e.target.value = ""; }} />
          </label>
        </div>
      )}

      {giorni.length === 0 && (
        <Card className="p-6 text-center text-slate-400 text-sm">Nessun giorno di allenamento creato ancora. Tocca "+ Giorno" per iniziare{isAdmin ? ", oppure importa un file CSV" : ""}.</Card>
      )}

      {giornoAttivo && (
        <GiornoAllenamento key={giornoAttivo} clientId={clientId} giorno={giorni.find((g) => g.id === giornoAttivo)} onGiornoRinominato={carica} />
      )}
    </div>
  );
}

function NotificheCliente({ client }) {
  const [notifiche, setNotifiche] = useState([]);
  const [caricando, setCaricando] = useState(true);

  const carica = async () => {
    const { data } = await supabase.from("notifiche").select("*").eq("client_id", client.id).order("created_at", { ascending: false });
    setNotifiche(data || []);
    setCaricando(false);
  };
  useEffect(() => { carica(); }, [client.id]);

  const accetta = async (n) => {
    if (n.calendar_event_id) {
      await supabase.from("calendar_events").update({ data: n.proposta_data, ora: n.proposta_ora, luogo: n.proposta_luogo, stato: "confermato" }).eq("id", n.calendar_event_id);
    }
    await supabase.from("notifiche").update({ stato: "accettata" }).eq("id", n.id);
    carica();
  };
  const rifiuta = async (n) => {
    await supabase.from("notifiche").update({ stato: "rifiutata" }).eq("id", n.id);
    carica();
  };

  if (caricando) return <Spinner />;

  return (
    <div className="px-5 pt-6 pb-24 space-y-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Notifiche</h1>
        <p className="text-slate-500 text-sm mt-1">Proposte di orario e note da Morgana.</p>
      </div>
      {notifiche.length === 0 && <Card className="p-6 text-center text-slate-400 text-sm">Nessuna notifica.</Card>}
      {notifiche.map((n) => (
        <Card key={n.id} className="p-4 space-y-2">
          {n.tipo === "proposta_lezione" ? (
            <>
              <p className="font-medium text-slate-700 text-sm">Nuova proposta di orario</p>
              <p className="text-slate-600 text-sm">{n.proposta_data?.split("-").reverse().join("/")} · {n.proposta_ora?.slice(0, 5)} — {n.proposta_luogo}</p>
              {n.messaggio && <p className="text-slate-500 text-xs">{n.messaggio}</p>}
              {n.stato === "inviata" ? (
                <div className="flex gap-2 pt-1">
                  <button onClick={() => accetta(n)} className="flex-1 bg-emerald-500 text-white text-xs font-medium rounded-lg py-2">Accetta</button>
                  <button onClick={() => rifiuta(n)} className="flex-1 bg-rose-100 text-rose-700 text-xs font-medium rounded-lg py-2">Rifiuta</button>
                </div>
              ) : (
                <Badge className={n.stato === "accettata" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>{n.stato === "accettata" ? "Accettata" : "Rifiutata"}</Badge>
              )}
            </>
          ) : (
            <>
              <p className="font-medium text-slate-700 text-sm">Nota da Morgana</p>
              <p className="text-slate-600 text-sm">{n.messaggio}</p>
            </>
          )}
          <p className="text-slate-400 text-[11px]">{new Date(n.created_at).toLocaleDateString("it-IT")}</p>
        </Card>
      ))}
    </div>
  );
}

function LeMieLezioni({ client }) {
  const [eventi, setEventi] = useState([]);
  const [caricando, setCaricando] = useState(true);

  const carica = async () => {
    const { data } = await supabase.from("calendar_events").select("*").eq("client_id", client.id).eq("tipo", "lezione").order("data", { ascending: false });
    setEventi(data || []);
    setCaricando(false);
  };
  useEffect(() => { carica(); }, [client.id]);

  const oraAttuale = new Date();
  const future = eventi.filter((e) => e.stato !== "annullata" && e.stato !== "persa" && new Date(`${e.data}T${e.ora || "00:00"}`) >= oraAttuale)
    .sort((a, b) => `${a.data}${a.ora}`.localeCompare(`${b.data}${b.ora}`));
  const storico = eventi.filter((e) => !future.includes(e));

  const annulla = async (e) => {
    const dataOra = new Date(`${e.data}T${e.ora || "00:00"}`);
    const oreAllaLezione = (dataOra - new Date()) / 3600000;
    const inTempo = oreAllaLezione >= 24;
    if (!inTempo) {
      const conferma = confirm("Mancano meno di 24 ore alla lezione: verrà comunque conteggiata come persa. Vuoi annullare comunque?");
      if (!conferma) return;
    }
    await supabase.from("calendar_events").update({ stato: inTempo ? "annullata" : "persa" }).eq("id", e.id);
    carica();
  };

  const STATO_LEZIONE = {
    richiesta: { t: "Da confermare", c: "bg-amber-100 text-amber-700" },
    confermato: { t: "Confermata", c: "bg-emerald-100 text-emerald-700" },
    annullata: { t: "Annullata", c: "bg-slate-100 text-slate-500" },
    persa: { t: "Persa", c: "bg-rose-100 text-rose-700" },
  };

  if (caricando) return <Spinner />;

  return (
    <div className="px-5 pt-6 pb-24 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Le mie lezioni</h1>
        <p className="text-slate-500 text-sm mt-1">Puoi annullare gratuitamente fino a 24 ore prima.</p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2 px-1">Prossime lezioni</p>
        <div className="space-y-2">
          {future.length === 0 && <Card className="p-4 text-center text-slate-400 text-sm">Nessuna lezione programmata.</Card>}
          {future.map((e) => (
            <Card key={e.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-700 text-sm">{e.data.split("-").reverse().join("/")} · {e.ora?.slice(0, 5)}</p>
                <p className="text-slate-500 text-xs ">{e.luogo}</p>
              </div>
              <Badge className={STATO_LEZIONE[e.stato].c}>{STATO_LEZIONE[e.stato].t}</Badge>
              <button onClick={() => annulla(e)} className="text-rose-500 text-xs font-medium flex-shrink-0">Annulla</button>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2 px-1">Storico</p>
        <div className="space-y-2">
          {storico.length === 0 && <Card className="p-4 text-center text-slate-400 text-sm">Ancora nessuna lezione passata.</Card>}
          {storico.map((e) => (
            <Card key={e.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-700 text-sm">{e.data.split("-").reverse().join("/")} · {e.ora?.slice(0, 5)}</p>
                <p className="text-slate-500 text-xs ">{e.luogo}</p>
              </div>
              <Badge className={STATO_LEZIONE[e.stato].c}>{STATO_LEZIONE[e.stato].t}</Badge>
            </Card>
          ))}
        </div>
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
  const [pianoStorico, setPianoStorico] = useState([]);
  const [caricando, setCaricando] = useState(true);
  const [nonLette, setNonLette] = useState(0);

  const carica = async () => {
    setCaricando(true);
    try {
      await conTimeout(supabase.rpc("sincronizza_stati_check"));
    } catch (e) { /* non blocca mai il caricamento anche in caso di errore */ }
    const { data: c } = await supabase.from("clients").select("*").eq("user_id", session.user.id).single();
    setClient(c);
    if (c) {
      const { data: ck } = await supabase.from("checkins").select("*").eq("client_id", c.id).order("data_check", { ascending: true });
      setCheckins(ck || []);
      const { data: nu } = await supabase.from("nutrition_plans").select("*").eq("client_id", c.id).order("data_aggiornamento", { ascending: false }).limit(1).maybeSingle();
      setPiano(nu);
      const { data: nuStorico } = await supabase.from("nutrition_plans").select("*").eq("client_id", c.id).order("data_aggiornamento", { ascending: true });
      setPianoStorico(nuStorico || []);
      const { count } = await supabase.from("notifiche").select("id", { count: "exact", head: true }).eq("client_id", c.id).eq("stato", "inviata");
      setNonLette(count || 0);
    }
    setCaricando(false);
  };

  useEffect(() => { carica(); }, [session.user.id]);

  if (caricando) return <Spinner />;
  if (!client) return <div className="px-6 pt-16 text-center text-slate-500 text-sm">Il tuo account non è ancora collegato a una scheda cliente. Contatta Morgana.</div>;

  const isBulbNav = client.tipo_servizio === "presenza" || client.tipo_servizio === "ibrido";
  const isOnlineNav = client.tipo_servizio === "online" || client.tipo_servizio === "ibrido";
  const nav = [
    { key: "home", label: "Home", icon: Home },
    ...(isOnlineNav ? [{ key: "checkin", label: "Check", icon: ClipboardList }] : []),
    ...(isBulbNav && client.pacchetto_lezioni !== "1" ? [{ key: "lezioni", label: "Lezioni", icon: Phone }] : []),
    { key: "notifiche", label: "Notifiche", icon: Bell, badge: nonLette },
    ...(client.tipo_servizio !== "presenza" || client.log_visibile_cliente ? [{ key: "log", label: "Log", icon: Dumbbell }] : []),
    { key: "progressi", label: "Progressi", icon: TrendingUp },
    ...(client.nutrizione_attiva !== false ? [{ key: "nutrizione", label: "Nutrizione", icon: Apple }] : []),
    { key: "extra", label: "Extra", icon: BookOpen },
  ];

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-50 max-w-md mx-auto">
      <div className="flex items-center justify-between px-5 pt-5 flex-shrink-0">
        <span className="text-slate-400 text-xs font-medium tracking-wide">COACHING BY MORGANA</span>
        <button onClick={() => supabase.auth.signOut()} className="text-slate-400"><LogOut size={16} /></button>
      </div>
      <PullToRefresh onRefresh={carica} ownScroll className="flex-1">
        {tab === "home" && <ClientHome client={client} onAggiornato={carica} />}
        {tab === "checkin" && <ClientCheckin client={client} onInviato={carica} />}
        {tab === "lezioni" && <LeMieLezioni client={client} />}
        {tab === "notifiche" && <NotificheCliente client={client} />}
        {tab === "log" && <DiarioAllenamento clientId={client.id} />}
        {tab === "progressi" && <ClientProgress checkins={checkins} altezza={client.altezza_cm} sesso={client.sesso} eta={calcolaEta(client.data_nascita) ?? client.eta} obiettivo={client.obiettivo_attuale} />}
        {tab === "nutrizione" && client.nutrizione_attiva !== false && <ClientNutrizione piano={piano} storico={pianoStorico} />}
        {tab === "extra" && <ClientApprofondimenti />}
      </PullToRefresh>
      <div className="flex-shrink-0 bg-white border-t border-slate-200 flex justify-around overflow-x-auto py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        {nav.map((n) => (
          <button key={n.key} onClick={() => setTab(n.key)} className={`relative flex flex-col items-center gap-1.5 px-4 py-2 text-xs min-w-[60px] flex-shrink-0 ${tab === n.key ? "text-sky-500" : "text-slate-400"}`}>
            <span className="relative">
              <n.icon size={24} />
              {!!n.badge && <span className="absolute -top-1 -right-1.5 bg-rose-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{n.badge}</span>}
            </span>
            {n.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AREA ADMIN                                                          */
/* ------------------------------------------------------------------ */
function NuovoCheckForm({ clientId, sesso, checkin, onSalvato, onAnnulla }) {
  const [f, setF] = useState(checkin ? {
    data_check: checkin.data_check || "", peso_kg: checkin.peso_kg ?? "", petto_cm: checkin.petto_cm ?? "",
    spalle_cm: checkin.spalle_cm ?? "", sopra_ombelico_cm: checkin.sopra_ombelico_cm ?? "", ombelico_cm: checkin.ombelico_cm ?? "",
    sotto_ombelico_cm: checkin.sotto_ombelico_cm ?? "", coscia_dx_cm: checkin.coscia_dx_cm ?? "", braccio_dx_cm: checkin.braccio_dx_cm ?? "",
    collo_cm: checkin.collo_cm ?? "", glutei_cm: checkin.glutei_cm ?? "", note_cliente: checkin.note_cliente || "",
    stato: checkin.stato || "revisionato", fase_mestruale: checkin.fase_mestruale || "",
  } : { data_check: "", peso_kg: "", petto_cm: "", spalle_cm: "", sopra_ombelico_cm: "", ombelico_cm: "", sotto_ombelico_cm: "", coscia_dx_cm: "", braccio_dx_cm: "", collo_cm: "", glutei_cm: "", note_cliente: "", stato: "revisionato", fase_mestruale: "" });
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
    const payload = { data_check: f.data_check || null, note_cliente: f.note_cliente || null, stato: f.stato, fase_mestruale: f.fase_mestruale || null };
    if (!checkin) { payload.client_id = clientId; payload.stato = "ricevuto"; }
    for (const k of ["peso_kg", "petto_cm", "spalle_cm", "sopra_ombelico_cm", "ombelico_cm", "sotto_ombelico_cm", "coscia_dx_cm", "braccio_dx_cm", "collo_cm", "glutei_cm"]) {
      payload[k] = f[k] === "" ? null : Number(f[k]);
    }
    try {
      if (files.frontale) payload.foto_frontale_path = await caricaFotoStorage(files.frontale, clientId, f.data_check, "frontale");
      if (files.laterale) payload.foto_laterale_path = await caricaFotoStorage(files.laterale, clientId, f.data_check, "laterale");
      if (files.posteriore) payload.foto_posteriore_path = await caricaFotoStorage(files.posteriore, clientId, f.data_check, "posteriore");
      if (files.extra) payload.foto_extra_path = await caricaFotoStorage(files.extra, clientId, f.data_check, "extra");
    } catch (e) {
      setSalvando(false);
      setErrore("Errore caricamento foto: " + e.message);
      return;
    }
    if (checkin) {
      await supabase.from("checkins").update(payload).eq("id", checkin.id);
    } else {
      await supabase.from("checkins").insert(payload);
      // Anche se il check lo inserisce la coach, lo stato/il prossimo check si aggiornano
      // esattamente come se lo avesse inviato la cliente stessa.
      try {
        await conTimeout(supabase.rpc("aggiorna_prossimo_check", { check_date: f.data_check, p_client_id: clientId }));
      } catch (e) { /* non blocca mai il salvataggio anche in caso di errore */ }
    }
    setSalvando(false);
    onSalvato();
  };
  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700">{checkin ? "Modifica check" : "Aggiungi check"}</p>
      <a href="/guida-check-misure-foto.pdf" target="_blank" rel="noopener noreferrer" download
        className="flex items-center gap-2 text-sky-600 text-xs font-medium">
        <FileText size={14} /> Guida misure e foto (PDF)
      </a>
      <div><label className="text-xs text-slate-500">Data</label>
        <InputData value={f.data_check} onChange={(e) => setF({ ...f, data_check: e.target.value })} className="mt-1" />
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
        <label className="text-xs text-slate-500 block mb-1">Foto progressi</label>
        <FotoInputs files={files} setFiles={setFiles} />
      </div>
      {errore && <p className="text-rose-500 text-xs">{errore}</p>}
      <div className="flex gap-2">
        <button onClick={salva} disabled={salvando} className="flex-1 bg-slate-800 text-white rounded-xl py-2 text-sm font-medium">{salvando ? "Salvo..." : checkin ? "Salva modifiche" : "Salva check"}</button>
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

function NutrizioneForm({ clientId, ultimo, onSalvato, modifica, onAnnullaModifica }) {
  const oggi = new Date().toISOString().slice(0, 10);
  const sorgente = modifica || ultimo;
  const [f, setF] = useState({
    kcal: sorgente?.kcal || "", proteine_g: sorgente?.proteine_g || "", carboidrati_g: sorgente?.carboidrati_g || "",
    grassi_g: sorgente?.grassi_g || "", note: modifica ? (modifica.note || "") : "",
    data_inizio: modifica ? (modifica.data_inizio || "") : oggi,
    data_fine: modifica ? (modifica.data_fine || "") : "",
  });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setF({
      kcal: sorgente?.kcal || "", proteine_g: sorgente?.proteine_g || "", carboidrati_g: sorgente?.carboidrati_g || "",
      grassi_g: sorgente?.grassi_g || "", note: modifica ? (modifica.note || "") : "",
      data_inizio: modifica ? (modifica.data_inizio || "") : oggi,
      data_fine: modifica ? (modifica.data_fine || "") : "",
    });
  }, [modifica?.id]);

  const campo = (label, key) => (
    <div><label className="text-xs text-slate-500">{label}</label>
      <input type="number" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
    </div>
  );
  const salva = async () => {
    setSalvando(true);
    const payload = {
      kcal: f.kcal || null, proteine_g: f.proteine_g || null, carboidrati_g: f.carboidrati_g || null,
      grassi_g: f.grassi_g || null, note: f.note || null,
      data_inizio: f.data_inizio || null, data_fine: f.data_fine || null,
    };
    if (modifica) {
      await supabase.from("nutrition_plans").update(payload).eq("id", modifica.id);
    } else {
      await supabase.from("nutrition_plans").insert({
        client_id: clientId, data_aggiornamento: oggi, ...payload,
      });
    }
    setSalvando(false);
    onSalvato();
    if (modifica) onAnnullaModifica?.();
  };
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">{modifica ? "Modifica ciclo alimentare" : "Nuovo ciclo alimentare"}</p>
        {modifica && <button onClick={onAnnullaModifica} className="text-xs text-slate-400 hover:text-slate-600">Annulla modifica</button>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500">Inizio ciclo</label>
          <InputData value={f.data_inizio} onChange={(e) => setF({ ...f, data_inizio: e.target.value })} className="mt-1" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Fine ciclo (facoltativa)</label>
          <InputData value={f.data_fine} onChange={(e) => setF({ ...f, data_fine: e.target.value })} className="mt-1" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {campo("Kcal", "kcal")}
        {campo("Proteine (g)", "proteine_g")}
        {campo("Carboidrati (g)", "carboidrati_g")}
        {campo("Grassi (g)", "grassi_g")}
      </div>
      <textarea placeholder="Note per la cliente" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      <button onClick={salva} disabled={salvando} className="w-full bg-slate-800 text-white rounded-xl py-2 text-sm font-medium">
        {salvando ? "Salvo..." : modifica ? "Salva modifiche" : "Salva nuovo ciclo"}
      </button>
      {!modifica && ultimo && <p className="text-slate-400 text-xs">Ultimo aggiornamento: {ultimo.data_aggiornamento}</p>}
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

const MESI_PER_TIPO_PAGAMENTO = { Mensile: 1, Trimestrale: 3, Semestrale: 6 };

// Ricalcola la data di scadenza "da zero" a partire dallo storico reale dei pagamenti a
// cadenza fissa di un cliente (in ordine di data pagamento), invece di dipendere dalla
// data reale in cui ogni pagamento e' stato salvato nell'app. Cosi' il risultato resta
// coerente anche dopo aver aggiunto o cancellato pagamenti (es. doppioni da correggere).
function ricalcolaScadenzaDaPagamenti(pagamenti) {
  const validi = (pagamenti || [])
    .filter((p) => MESI_PER_TIPO_PAGAMENTO[p.tipo_piano])
    .slice()
    .sort((a, b) => (a.data_pagamento || "").localeCompare(b.data_pagamento || ""));
  let scadenza = null;
  let ultimoTipo = null;
  for (const p of validi) {
    const base = (scadenza && scadenza > p.data_pagamento) ? scadenza : p.data_pagamento;
    scadenza = addMesi(base, MESI_PER_TIPO_PAGAMENTO[p.tipo_piano]);
    ultimoTipo = p.tipo_piano;
  }
  return { scadenza, ultimoTipo };
}

// Rilegge tutti i pagamenti del cliente dal database e riallinea la scadenza del suo
// pacchetto di conseguenza. Va richiamata sia dopo aver registrato un nuovo pagamento a
// cadenza fissa, sia dopo averne cancellato uno, cosi' un doppione eliminato non lascia
// la scadenza avanzata "a vuoto".
async function ricalcolaEAggiornaScadenza(clientId) {
  const { data: pagamenti } = await supabase.from("payments").select("data_pagamento, tipo_piano").eq("client_id", clientId);
  const { scadenza, ultimoTipo } = ricalcolaScadenzaDaPagamenti(pagamenti);
  if (!scadenza) return;
  await supabase.from("clients").update({ piano: ultimoTipo, data_scadenza: scadenza, stato_pacchetto: "attivo" }).eq("id", clientId);
}

const METODI_PAGAMENTO = [
  { value: "satispay", label: "Satispay" },
  { value: "hype", label: "Hype" },
  { value: "sella", label: "Sella" },
  { value: "contanti", label: "Contanti" },
  { value: "bonifico", label: "Bonifico" },
  { value: "altro", label: "Altro" },
];
const FREQUENZE_PAGAMENTO = [
  { value: "mensile", label: "Mensile" },
  { value: "trimestrale", label: "Trimestrale" },
  { value: "semestrale", label: "Semestrale" },
  { value: "occasionale", label: "Occasionale" },
  { value: "a_lezione", label: "A lezione" },
  { value: "variabile", label: "Variabile (cambia ogni volta)" },
];
const labelMetodo = (v) => METODI_PAGAMENTO.find((m) => m.value === v)?.label || v || "—";
const labelFrequenza = (v) => FREQUENZE_PAGAMENTO.find((f) => f.value === v)?.label || v || "—";

function FatturazioneCliente({ clientId }) {
  const [b, setB] = useState({ importo_ricorrente: "", frequenza_pagamento: "", metodo_pagamento_abituale: "" });
  const [caricato, setCaricato] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carica = async () => {
    const { data } = await supabase.from("client_billing").select("*").eq("client_id", clientId).maybeSingle();
    if (data) setB({ importo_ricorrente: data.importo_ricorrente ?? "", frequenza_pagamento: data.frequenza_pagamento || "", metodo_pagamento_abituale: data.metodo_pagamento_abituale || "" });
    setCaricato(true);
  };
  useEffect(() => { carica(); }, [clientId]);

  const salva = async (campi) => {
    const nuovo = { ...b, ...campi };
    setB(nuovo);
    setSalvando(true);
    await supabase.from("client_billing").upsert({
      client_id: clientId,
      importo_ricorrente: nuovo.importo_ricorrente === "" ? null : Number(nuovo.importo_ricorrente),
      frequenza_pagamento: nuovo.frequenza_pagamento || null,
      metodo_pagamento_abituale: nuovo.metodo_pagamento_abituale || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "client_id" });
    setSalvando(false);
  };

  if (!caricato) return <Spinner />;

  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700">Quanto paga abitualmente (visibile solo a te)</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500">Importo (€)</label>
          <input type="number" step="0.01" value={b.importo_ricorrente} onChange={(e) => setB({ ...b, importo_ricorrente: e.target.value })}
            onBlur={() => salva({})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" placeholder="es. 80" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Frequenza</label>
          <select value={b.frequenza_pagamento} onChange={(e) => salva({ frequenza_pagamento: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
            <option value="">—</option>
            {FREQUENZE_PAGAMENTO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-slate-500">Metodo di pagamento abituale</label>
          <select value={b.metodo_pagamento_abituale} onChange={(e) => salva({ metodo_pagamento_abituale: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
            <option value="">—</option>
            {METODI_PAGAMENTO.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>
      {salvando && <p className="text-slate-400 text-xs">Salvataggio...</p>}
    </Card>
  );
}

function RegistraPagamento({ client, pagamenti, onRegistrato }) {
  const [ricevutaPer, setRicevutaPer] = useState(null);
  const [tipo, setTipo] = useState("Mensile");
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10));
  const [importo, setImporto] = useState("");
  const [metodo, setMetodo] = useState("");
  const [stato, setStato] = useState("saldato");
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [fatto, setFatto] = useState(false);
  const isGratuito = tipo === "Gratuito";
  const aggiornaScadenza = ["Mensile", "Trimestrale", "Semestrale"].includes(tipo);

  const registra = async () => {
    setSalvando(true);
    setFatto(false);

    if (isGratuito) {
      await supabase.from("clients").update({ piano: "Gratuito", stato_pacchetto: "gratuito" }).eq("id", client.id);
    } else {
      await supabase.from("payments").insert({
        client_id: client.id, data_pagamento: dataPagamento, tipo_piano: tipo,
        importo: importo === "" ? null : Number(importo), metodo_pagamento: metodo || null, stato, note: nota || null,
      });
      if (aggiornaScadenza) {
        if (!client.data_inizio) {
          await supabase.from("clients").update({ data_inizio: dataPagamento }).eq("id", client.id);
        }
        // Ricalcola dallo storico reale dei pagamenti, non dalla data reale di salvataggio:
        // cosi' un pagamento inserito in ritardo o di correzione non "salta" mesi a vuoto.
        await ricalcolaEAggiornaScadenza(client.id);
      }
    }
    setSalvando(false);
    setFatto(true);
    setImporto(""); setNota("");
    onRegistrato();
  };

  const cambiaStato = async (p) => {
    await supabase.from("payments").update({ stato: p.stato === "saldato" ? "da_saldare" : "saldato" }).eq("id", p.id);
    onRegistrato();
  };
  const elimina = async (p) => {
    if (!confirm(`Eliminare il pagamento del ${p.data_pagamento}? L'operazione non è reversibile.`)) return;
    await supabase.from("payments").delete().eq("id", p.id);
    // Se il pagamento cancellato aveva fatto avanzare la scadenza, la riallinea allo storico rimasto
    if (MESI_PER_TIPO_PAGAMENTO[p.tipo_piano]) {
      await ricalcolaEAggiornaScadenza(client.id);
    }
    onRegistrato();
  };

  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700 flex items-center gap-2"><CreditCard size={16} /> Registra pagamento</p>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-500">Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
            <option value="Mensile">Mensile (+1 mese di scadenza)</option>
            <option value="Trimestrale">Trimestrale (+3 mesi di scadenza)</option>
            <option value="Semestrale">Semestrale (+6 mesi di scadenza)</option>
            <option value="Occasionale">Occasionale (non tocca la scadenza)</option>
            <option value="A lezione">A lezione (non tocca la scadenza)</option>
            <option value="Variabile">Variabile (non tocca la scadenza)</option>
            <option value="Gratuito">Gratuito</option>
          </select>
        </div>
        {!isGratuito && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Data pagamento</label>
                <InputData value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Importo (€)</label>
                <input type="number" step="0.01" value={importo} onChange={(e) => setImporto(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" placeholder="es. 80" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Metodo</label>
                <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
                  <option value="">—</option>
                  {METODI_PAGAMENTO.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Stato</label>
                <select value={stato} onChange={(e) => setStato(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
                  <option value="saldato">Saldato</option>
                  <option value="da_saldare">Da saldare</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500">Nota (facoltativa)</label>
              <input value={nota} onChange={(e) => setNota(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" placeholder="es. sconto amica, saldo pacchetto..." />
            </div>
          </>
        )}
      </div>
      <button onClick={registra} disabled={salvando} className="w-full bg-slate-800 text-white rounded-xl py-2 text-sm font-medium">
        {salvando ? "Registro..." : isGratuito ? "Imposta come gratuito" : "Registra pagamento"}
      </button>
      {fatto && <p className="text-emerald-600 text-xs">Fatto! {isGratuito ? "Pacchetto impostato su gratuito." : aggiornaScadenza ? "Pagamento registrato e scadenza aggiornata." : "Pagamento registrato."}</p>}
      {pagamenti.length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <p className="text-slate-400 text-xs mb-1">Storico pagamenti</p>
          <ul className="space-y-1.5">
            {pagamenti.map((p) => (
              <li key={p.id} className="text-xs text-slate-600 flex items-center gap-2">
                <span className="flex-1 min-w-0">
                  <span className="font-medium">{p.data_pagamento}</span> — {p.tipo_piano}
                  {p.importo != null && ` · ${Number(p.importo).toFixed(2)}€`}
                  {p.metodo_pagamento && ` · ${labelMetodo(p.metodo_pagamento)}`}
                  {p.note && <span className="text-slate-400"> — {p.note}</span>}
                </span>
                {p.stato && (
                  <button onClick={() => cambiaStato(p)} className={`flex-shrink-0 text-[10px] font-medium rounded-full px-2 py-0.5 ${p.stato === "saldato" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {p.stato === "saldato" ? "Saldato" : "Da saldare"}
                  </button>
                )}
                {p.importo != null && p.stato !== "spesa" && (
                  <button onClick={() => setRicevutaPer(p)} className="flex-shrink-0 text-slate-300 hover:text-slate-500 px-0.5"><FileText size={13} /></button>
                )}
                <button onClick={() => elimina(p)} className="flex-shrink-0 text-slate-300 hover:text-rose-500 px-0.5"><X size={13} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {ricevutaPer && <RicevutaModal pagamento={{ ...ricevutaPer, clients: client }} onClose={() => setRicevutaPer(null)} />}
    </Card>
  );
}

function InvitaClienteForm({ client, onInvitato }) {
  const [email, setEmail] = useState(client.email || "");
  const [generando, setGenerando] = useState("");
  const [errore, setErrore] = useState("");
  const [link, setLink] = useState("");
  const [copiato, setCopiato] = useState(false);

  const generaLink = async (azione) => {
    if (!email) { setErrore("Inserisci un'email."); return; }
    setGenerando(azione);
    setErrore("");
    setLink("");
    setCopiato(false);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("invite-client", {
      body: { client_id: client.id, email, azione },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    setGenerando("");
    if (error || data?.error) { setErrore(data?.error || error.message); return; }
    setLink(data.link);
    onInvitato();
  };

  const copia = async () => {
    await navigator.clipboard.writeText(link);
    setCopiato(true);
  };

  return (
    <div className="space-y-2">
      <label className="text-slate-400 text-xs">Email di accesso della cliente</label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@esempio.com"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      <div className="grid grid-cols-1 gap-2">
        <button onClick={() => generaLink("crea")} disabled={!!generando} className="bg-sky-500 text-white text-sm font-medium rounded-lg py-2">
          {generando === "crea" ? "Genero..." : "Genera link per creare account e password"}
        </button>
        <button onClick={() => generaLink("reset")} disabled={!!generando} className="bg-slate-100 text-slate-700 text-sm font-medium rounded-lg py-2">
          {generando === "reset" ? "Genero..." : "Genera link per reimpostare la password"}
        </button>
      </div>
      <p className="text-slate-400 text-xs">
        "Crea account e password" serve per un'email nuova (anche per sostituire quella vecchia). "Reimposta password" serve a chi ha già un account con questa email ma ha perso/scordato l'accesso. Nessuna email viene inviata automaticamente: il link lo mandi tu, su WhatsApp o come preferisci.
      </p>
      {errore && <p className="text-rose-500 text-xs">{errore}</p>}
      {link && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
          <p className="text-emerald-700 text-xs font-medium">Link pronto — valido per un tempo limitato, mandalo subito:</p>
          <p className="text-slate-600 text-xs break-all bg-white border border-slate-200 rounded-lg p-2">{link}</p>
          <button onClick={copia} className="w-full bg-slate-800 text-white text-xs font-medium rounded-lg py-2">
            {copiato ? "Copiato ✓" : "Copia link"}
          </button>
        </div>
      )}
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

function RigaLezione({ lezione, client, onFattaCambiata, onSalvato }) {
  const [data, setData] = useState(lezione.data || "");
  const [ora, setOra] = useState((lezione.ora || "").slice(0, 5));
  const [nota, setNota] = useState(lezione.nota || "");
  const [salvando, setSalvando] = useState(false);
  const [salvato, setSalvato] = useState(false);
  const modificato = data !== (lezione.data || "") || ora !== (lezione.ora || "").slice(0, 5) || nota !== (lezione.nota || "");

  const salva = async () => {
    setSalvando(true);
    setSalvato(false);
    const campi = { data: data || null, ora: ora || null, nota: nota || null };
    await supabase.from("lezioni_svolte").update(campi).eq("id", lezione.id);

    // Rileggiamo dal database lo stato reale del collegamento, invece di fidarci
    // di un valore potenzialmente non aggiornato, per evitare eventi duplicati o mancanti.
    const { data: rigaAttuale } = await supabase.from("lezioni_svolte").select("calendar_event_id").eq("id", lezione.id).single();
    let calendarEventId = rigaAttuale?.calendar_event_id || null;
    if (data) {
      if (calendarEventId) {
        await supabase.from("calendar_events").update({ data, ora: ora || null }).eq("id", calendarEventId);
      } else {
        const { data: nuovoEvento } = await supabase.from("calendar_events").insert({
          client_id: client.id, tipo: "lezione", data, ora: ora || null, luogo: client.sede_abituale || null, stato: "confermato",
        }).select().single();
        if (nuovoEvento) {
          calendarEventId = nuovoEvento.id;
          await supabase.from("lezioni_svolte").update({ calendar_event_id: calendarEventId }).eq("id", lezione.id);
        }
      }
    }

    setSalvando(false);
    setSalvato(true);
    onSalvato({ ...lezione, ...campi, calendar_event_id: calendarEventId });
  };

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center gap-3">
        <button onClick={() => onFattaCambiata(lezione.id, !lezione.fatta)}
          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${lezione.fatta ? "bg-emerald-500" : "border-2 border-slate-300"}`}>
          {lezione.fatta && <CheckCircle2 size={16} className="text-white" />}
        </button>
        <p className="font-medium text-slate-700 text-sm flex-shrink-0">Lezione {lezione.numero}</p>
        <InputData value={data} onChange={(e) => { setData(e.target.value); setSalvato(false); }} className="flex-1" />
        <select value={ora} onChange={(e) => { setOra(e.target.value); setSalvato(false); }} className="border border-slate-200 rounded-lg px-2 py-2 text-sm w-24 flex-shrink-0">
          <option value="">--:--</option>
          {SLOT_ORARI.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <input value={nota} onChange={(e) => { setNota(e.target.value); setSalvato(false); }} placeholder="Nota sulla lezione"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" />
      <div className="flex items-center gap-2">
        <button onClick={salva} disabled={salvando || !modificato}
          className={`flex-1 rounded-lg py-2 text-xs font-medium ${modificato ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-400"}`}>
          {salvando ? "Salvo..." : "Salva"}
        </button>
        {salvato && !modificato && <span className="text-emerald-600 text-xs font-medium flex-shrink-0">Salvato ✓</span>}
      </div>
    </Card>
  );
}

function StoricoPacchetti({ pacchetti }) {
  if (pacchetti.length === 0) return null;
  return (
    <div className="pt-2">
      <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2 px-1">Pacchetti precedenti</p>
      <div className="space-y-1">
        {pacchetti.map((p) => (
          <Card key={p.id} className="p-3 text-sm text-slate-600">
            {p.numero_lezioni} lezioni — completato il {p.completato_il ? new Date(p.completato_il).toLocaleDateString("it-IT") : "-"}
          </Card>
        ))}
      </div>
    </div>
  );
}

function LezioniPacchetto({ client, onCompletato }) {
  const [pacchetti, setPacchetti] = useState([]);
  const [lezioni, setLezioni] = useState([]);
  const [caricando, setCaricando] = useState(true);
  const [nuovoNumero, setNuovoNumero] = useState("8");

  const carica = async () => {
    const { data: pacchettiData } = await supabase.from("pacchetti_lezioni").select("*").eq("client_id", client.id).order("creato_il");
    let pacchettiAttuali = pacchettiData || [];

    // Primo utilizzo: se non esiste ancora nessun pacchetto ma il tab Dati ne ha impostato uno, lo creo ora
    if (pacchettiAttuali.length === 0 && client.pacchetto_lezioni) {
      const { data: nuovo } = await supabase.from("pacchetti_lezioni")
        .insert({ client_id: client.id, numero_lezioni: Number(client.pacchetto_lezioni), stato: "attivo" }).select().single();
      if (nuovo) pacchettiAttuali = [nuovo];
    }

    const attivo = pacchettiAttuali.find((p) => p.stato === "attivo");
    if (attivo) {
      const { data: righeEsistenti } = await supabase.from("lezioni_svolte").select("*").eq("pacchetto_id", attivo.id).order("numero");
      let righe = righeEsistenti || [];
      if (attivo.numero_lezioni > righe.length) {
        const mancanti = [];
        for (let n = righe.length + 1; n <= attivo.numero_lezioni; n++) mancanti.push({ client_id: client.id, pacchetto_id: attivo.id, numero: n, fatta: false });
        const { data: creati } = await supabase.from("lezioni_svolte").insert(mancanti).select();
        righe = [...righe, ...(creati || [])].sort((a, b) => a.numero - b.numero);
      }
      setLezioni(righe);
    } else {
      setLezioni([]);
    }
    setPacchetti(pacchettiAttuali);
    setCaricando(false);
  };
  useEffect(() => { carica(); }, [client.id, client.pacchetto_lezioni]);

  const pacchettoAttivo = pacchetti.find((p) => p.stato === "attivo");
  const pacchettiCompletati = [...pacchetti.filter((p) => p.stato === "completato")].sort((a, b) => new Date(b.completato_il) - new Date(a.completato_il));

  const cambiaFatta = async (id, fatta) => {
    setLezioni((prev) => prev.map((l) => (l.id === id ? { ...l, fatta } : l)));
    await supabase.from("lezioni_svolte").update({ fatta }).eq("id", id);
    const tutteFatte = lezioni.filter((l) => (l.id === id ? fatta : l.fatta)).length === lezioni.length;
    if (tutteFatte && lezioni.length > 0 && pacchettoAttivo) {
      await supabase.from("pacchetti_lezioni").update({ stato: "completato", completato_il: new Date().toISOString() }).eq("id", pacchettoAttivo.id);
      await supabase.from("clients").update({ stato_pacchetto: "scaduto" }).eq("id", client.id);
      onCompletato?.();
      carica();
    }
  };

  const onRigaSalvata = (lezioneAggiornata) => {
    setLezioni((prev) => prev.map((l) => (l.id === lezioneAggiornata.id ? lezioneAggiornata : l)));
  };

  const aggiungiLezioneExtra = async () => {
    if (!pacchettoAttivo) return;
    const prossimoNumero = lezioni.length + 1;
    const { data } = await supabase.from("lezioni_svolte").insert({ client_id: client.id, pacchetto_id: pacchettoAttivo.id, numero: prossimoNumero, fatta: false }).select().single();
    if (data) setLezioni((prev) => [...prev, data]);
  };

  const modificaNumeroPacchetto = async (valoreInserito) => {
    const nuovoNumero = Number(valoreInserito);
    if (!pacchettoAttivo || !nuovoNumero || nuovoNumero < 1 || nuovoNumero === pacchettoAttivo.numero_lezioni) return;
    const svolteCount = lezioni.filter((l) => l.fatta).length;
    if (nuovoNumero < svolteCount) {
      alert(`Non puoi impostare un numero inferiore alle lezioni già svolte (${svolteCount}).`);
      return;
    }
    await supabase.from("pacchetti_lezioni").update({ numero_lezioni: nuovoNumero }).eq("id", pacchettoAttivo.id);
    await supabase.from("clients").update({ pacchetto_lezioni: String(nuovoNumero) }).eq("id", client.id);

    if (nuovoNumero > lezioni.length) {
      const mancanti = [];
      for (let n = lezioni.length + 1; n <= nuovoNumero; n++) mancanti.push({ client_id: client.id, pacchetto_id: pacchettoAttivo.id, numero: n, fatta: false });
      const { data: creati } = await supabase.from("lezioni_svolte").insert(mancanti).select();
      setLezioni((prev) => [...prev, ...(creati || [])].sort((a, b) => a.numero - b.numero));
    } else if (nuovoNumero < lezioni.length) {
      // Rimuove solo le lezioni non ancora svolte, partendo dal fondo — mai quelle già fatte
      const daRimuovere = lezioni.filter((l) => !l.fatta).sort((a, b) => b.numero - a.numero).slice(0, lezioni.length - nuovoNumero);
      await supabase.from("lezioni_svolte").delete().in("id", daRimuovere.map((l) => l.id));
      setLezioni((prev) => prev.filter((l) => !daRimuovere.some((d) => d.id === l.id)));
    }
    setPacchetti((prev) => prev.map((p) => (p.id === pacchettoAttivo.id ? { ...p, numero_lezioni: nuovoNumero } : p)));
  };

  const iniziaNuovoPacchetto = async () => {
    const { data: nuovo } = await supabase.from("pacchetti_lezioni").insert({ client_id: client.id, numero_lezioni: Number(nuovoNumero), stato: "attivo" }).select().single();
    if (nuovo) {
      await supabase.from("clients").update({ pacchetto_lezioni: nuovoNumero, stato_pacchetto: "attivo" }).eq("id", client.id);
      await carica();
    }
  };

  if (caricando) return <Spinner />;

  const opzioniPacchetto = ["1", "4", "8", "10", "24", "48"];

  if (!pacchettoAttivo) {
    return (
      <div className="space-y-3">
        <Card className="p-6 space-y-3">
          <p className="text-center text-slate-400 text-sm">
            {pacchettiCompletati.length > 0 ? "Nessun pacchetto attivo — l'ultimo è stato completato." : "Imposta prima un pacchetto lezioni nel tab Dati."}
          </p>
          {pacchettiCompletati.length > 0 && (
            <div className="flex items-center gap-2">
              <select value={nuovoNumero} onChange={(e) => setNuovoNumero(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {opzioniPacchetto.map((n) => <option key={n} value={n}>{n} lezioni</option>)}
              </select>
              <button onClick={iniziaNuovoPacchetto} className="bg-slate-800 text-white text-sm font-medium rounded-lg px-4 py-2">Inizia nuovo pacchetto</button>
            </div>
          )}
        </Card>
        <StoricoPacchetti pacchetti={pacchettiCompletati} />
      </div>
    );
  }

  const svolte = lezioni.filter((l) => l.fatta).length;
  const totale = lezioni.length;

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Pacchetto attuale</p>
          <select defaultValue={pacchettoAttivo.numero_lezioni} onChange={(e) => modificaNumeroPacchetto(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1 text-xs">
            {["1", "4", "8", "10", "24", "48"].map((n) => <option key={n} value={n}>{n} lezioni</option>)}
          </select>
        </div>
        <p className="text-2xl font-semibold text-slate-800">{svolte} / {totale} <span className="text-base font-normal text-slate-400">lezioni svolte</span></p>
        {totale > pacchettoAttivo.numero_lezioni && <p className="text-slate-400 text-xs mt-1">Include {totale - pacchettoAttivo.numero_lezioni} lezione/i extra aggiunta/e manualmente</p>}
      </Card>

      <div className="space-y-2">
        {lezioni.map((l) => (
          <RigaLezione key={l.id} lezione={l} client={client} onFattaCambiata={cambiaFatta} onSalvato={onRigaSalvata} />
        ))}
      </div>
      <button onClick={aggiungiLezioneExtra} className="w-full border border-dashed border-slate-300 text-slate-500 text-sm font-medium rounded-xl py-2.5">
        + Aggiungi lezione extra (es. per recuperare una cancellazione)
      </button>
      <p className="text-slate-400 text-xs px-1">Ricordati di toccare "Salva" dopo aver scritto data e ora — solo così la lezione compare anche nel calendario coach.</p>

      <StoricoPacchetti pacchetti={pacchettiCompletati} />
    </div>
  );
}

async function collegaLezionePacchetto(clientId, evento) {
  const { data: libera } = await supabase.from("lezioni_svolte")
    .select("id").eq("client_id", clientId).is("calendar_event_id", null).order("numero").limit(1).maybeSingle();
  if (libera) {
    await supabase.from("lezioni_svolte").update({ data: evento.data, ora: evento.ora || null, calendar_event_id: evento.id }).eq("id", libera.id);
  }
}

function RigaStato({ label, valore, presente }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-slate-500 text-sm">{label}</span>
      <span className={`text-sm font-medium flex items-center gap-1.5 ${presente ? "text-slate-700" : "text-amber-600"}`}>
        {presente ? valore : "Mancante"}
        {presente ? <CheckCircle2 size={14} className="text-emerald-500" /> : <AlertCircle size={14} className="text-amber-500" />}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MODULO SCHEDA (solo coach) — libreria, tecniche, trend, segnali      */
/* ------------------------------------------------------------------ */

const PAROLE_CHIAVE_COMPOUND = ["squat", "hip hinge", "spinta", "tirata", "stacco", "accosciata", "estensione anca"];
function isCompoundPattern(pattern) {
  if (!pattern) return false;
  const p = pattern.toLowerCase();
  if (p.includes("isolamento")) return false;
  return PAROLE_CHIAVE_COMPOUND.some((k) => p.includes(k));
}
const TAG_FEEDBACK = [
  { value: "stanca", label: "Stanca" }, { value: "energica", label: "Energica" },
  { value: "troppo_lavoro", label: "Troppo lavoro" }, { value: "poco_lavoro", label: "Poco lavoro" },
  { value: "dolore", label: "Dolore/fastidio" }, { value: "vuole_aggiungere_giorno", label: "Vuole aggiungere giorno" },
  { value: "vuole_togliere_giorno", label: "Vuole togliere giorno" },
];
const PAROLE_ATTENZIONE = ["stanca", "stress", "affatic", "ciclo", "dolore", "male", "pesant", "difficile", "non dormo", "poco sonno", "gonfia", "gonfiore", "vacanz", "malat", "influenza", "ritenzione"];
const CAMPI_MISURA_CHECK = ["peso_kg", "petto_cm", "spalle_cm", "sopra_ombelico_cm", "ombelico_cm", "sotto_ombelico_cm", "coscia_dx_cm", "braccio_dx_cm", "collo_cm", "glutei_cm"];

const CONDIZIONI_SALUTE = [
  { value: "ipertensione", label: "Ipertensione", pattern_evitati: [], avviso: "Evitare isometrie prolungate e sforzi in apnea (Valsalva) su carichi vicini al massimale." },
  { value: "pavimento_pelvico", label: "Pavimento pelvico", pattern_evitati: [], avviso: "Evitare Valsalva e picchi di pressione intra-addominale; espirare nello sforzo, carichi moderati." },
  { value: "ginocchia", label: "Ginocchia doloranti / scarsa mobilità", pattern_evitati: ["Squat monopodalico", "Isometria squat"], avviso: "Evitare affondi profondi e squat a ROM completo; preferire leg press/leg extension a range controllato." },
  { value: "lombare", label: "Zona lombare / iperlordosi", pattern_evitati: [], esclusioni_nome: ["Romanian Deadlift Bilanciere"], avviso: "Evitare stacchi da terra pesanti; preferire Hip Thrust guidato/con stop e RDL con manubri a controllo del bacino." },
  { value: "spalle", label: "Spalle / cifosi / anteposizione", pattern_evitati: [], avviso: "Aumentare il volume di tirata orizzontale (rapporto tirata/spinta 2:1), privilegiare estensioni toraciche ed evitare push verticale pesante a ROM ampio." },
  { value: "anche", label: "Anche bloccate / dolorose", pattern_evitati: ["Squat", "Squat laterale"], avviso: "Evitare squat profondi e affondi laterali ampi; privilegiare hip hinge e ROM parziale controllato." },
  { value: "caviglie", label: "Caviglia rigida / scarsa mobilità", pattern_evitati: ["Isometria caviglia"], esclusioni_nome: ["Squat Corpo Libero", "Goblet Squat"], avviso: "Sostituire lo squat libero con Leg Press a piedi bassi o squat con rialzo sotto i talloni." },
  { value: "valgismo", label: "Valgismo ginocchia", pattern_evitati: [], avviso: "Curare l'allineamento ginocchio-piede in ogni esercizio di spinta per le gambe; evitare carichi che favoriscono il collasso verso l'interno." },
];

const TECNICHE_BLOCCO2 = ["Top Set (RIR 1) + 2 Back-off (-15%)", 'TUT eccentrica 3-4", RIR 1-2', "Cluster set: 2x(3+3), rec. 20\" interno"];
const TECNICHE_BLOCCO3 = ["Drop set: -30/40% carico, a cedimento tecnico", 'Rest-pause: cedimento + 15" + AMRAP', "Tensione continua, no lockout in uscita"];

// Soglie di volume settimanale per gruppo muscolare (serie a intensità reale RIR 0-2)
const VOLUME_LANDMARKS = {
  Quadricipiti: { mv: [4, 6], mev: [8, 10], mav: [12, 16], mrv: [18, 20] },
  Glutei: { mv: [4, 6], mev: [8, 10], mav: [12, 18], mrv: [20, 22] },
  Femorali: { mv: [4, 6], mev: [6, 8], mav: [10, 14], mrv: [16, 18] },
  Schiena: { mv: [6, 8], mev: [8, 10], mav: [14, 20], mrv: [22, 25] },
  Petto: { mv: [4, 6], mev: [8, 10], mav: [12, 16], mrv: [18, 20] },
  Spalle: { mv: [6, 8], mev: [8, 12], mav: [14, 22], mrv: [24, 26] }, // riferimento: deltoidi laterali
  Bicipiti: { mv: [4, 6], mev: [6, 8], mav: [10, 14], mrv: [16, 18] },
  Tricipiti: { mv: [4, 6], mev: [6, 8], mav: [10, 14], mrv: [16, 18] },
  Polpacci: { mv: [4, 6], mev: [8, 10], mav: [12, 16], mrv: [20, 20] },
  Core: { mv: [0, 0], mev: [0, 0], mav: [10, 14], mrv: [10, 14] }, // solo se aggiunto manualmente, tetto fisso 10-14 (anche in focus)
};
const SERIE_MAX_PER_SESSIONE = 10; // evita junk volume in singola seduta (regola avanzati, applicata a tutti per sicurezza)

const GRUPPI_UPPER = ["Petto", "Schiena", "Spalle", "Bicipiti", "Tricipiti"];
const GRUPPI_TONIFICAZIONE_DONNA = ["Petto", "Bicipiti", "Tricipiti"];

function serieIdealiPerGruppo(gruppo, livello, inFocus, sesso) {
  const landmark = VOLUME_LANDMARKS[gruppo];
  if (!landmark) return livello === "base" ? 8 : 12;
  // Gruppo in focus di crescita: spinge verso il volume massimo tollerabile (MRV) invece che sull'ottimale.
  if (inFocus) return landmark.mrv[0];
  // Donne, senza focus esplicito: petto/braccia restano a livello di tonificazione/mantenimento (MEV), non MAV.
  if (sesso === "F" && GRUPPI_TONIFICAZIONE_DONNA.includes(gruppo)) return landmark.mev[1];
  // Uomini: maggiore enfasi upper body anche senza focus esplicito (tra MAV alto e MRV).
  if (sesso === "M" && GRUPPI_UPPER.includes(gruppo)) return Math.round((landmark.mav[1] + landmark.mrv[0]) / 2);
  // Principiante/Intermedio: limite inferiore del volume ottimale (MAV min). Avanzato: verso l'alto (MAV max).
  return livello === "avanzata" ? landmark.mav[1] : landmark.mav[0];
}

// Bicipiti/Tricipiti ricevono già stimolo indiretto dalle tirate (Schiena) e spinte (Petto/Spalle):
// riduciamo il volume diretto in base a quante sessioni di quel tipo sono già presenti in settimana.
function aggiustaVolumeIndiretto(gruppo, serieBase, giorniGenerator) {
  if (gruppo === "Bicipiti") {
    const sessioniTirata = giorniGenerator.filter((g) => g.gruppi.includes("Schiena")).length;
    const riduzione = Math.min(0.5, sessioniTirata * 0.2);
    return Math.max(4, Math.round(serieBase * (1 - riduzione)));
  }
  if (gruppo === "Tricipiti") {
    const sessioniSpinta = giorniGenerator.filter((g) => g.gruppi.includes("Petto") || g.gruppi.includes("Spalle")).length;
    const riduzione = Math.min(0.5, sessioniSpinta * 0.15);
    return Math.max(4, Math.round(serieBase * (1 - riduzione)));
  }
  return serieBase;
}

// Frequenza settimanale ideale per gruppo (da note di programmazione del metodo)
const FREQUENZA_IDEALE = {
  Quadricipiti: 2, Glutei: 2, Femorali: 1, Schiena: 2, Petto: 2,
  Spalle: 2, Bicipiti: 1, Tricipiti: 1, Polpacci: 2,
};

// Combinazioni di giorno valide (split scientificamente sensate) — il generatore pesca solo da qui
const COMBINAZIONI_VALIDE = [
  ["Femorali", "Schiena"], ["Glutei", "Femorali"], ["Glutei"], ["Femorali"], ["Spalle"],
  ["Spalle", "Petto"], ["Spalle", "Petto", "Tricipiti"], ["Petto", "Tricipiti"], ["Schiena"],
  ["Schiena", "Bicipiti"], ["Bicipiti", "Tricipiti"], ["Bicipiti", "Tricipiti", "Spalle"], ["Petto"],
];
// Gruppi senza combinazione dedicata: si aggiungono come richiamo alla giornata più coerente
const GRUPPI_RICHIAMO = ["Quadricipiti", "Polpacci"];

// Template di split per numero di giorni a settimana (combo principale + richiami), pensati per coprire
// tutti i 10 gruppi con frequenza ragionevole in base alle note di programmazione del metodo
const TEMPLATE_SPLIT = {
  1: [{ combo: ["Glutei", "Femorali"], richiami: ["Quadricipiti", "Schiena", "Spalle", "Petto"] }],
  2: [
    { combo: ["Glutei", "Femorali"], richiami: ["Quadricipiti", "Polpacci"] },
    { combo: ["Spalle", "Petto", "Tricipiti"], richiami: ["Bicipiti", "Schiena"] },
  ],
  3: [
    { combo: ["Glutei", "Femorali"], richiami: ["Quadricipiti"] },
    { combo: ["Schiena", "Bicipiti"], richiami: [] },
    { combo: ["Spalle", "Petto", "Tricipiti"], richiami: ["Polpacci"] },
  ],
  4: [
    { combo: ["Femorali", "Schiena"], richiami: [] },
    { combo: ["Glutei"], richiami: ["Quadricipiti"] },
    { combo: ["Spalle", "Petto", "Tricipiti"], richiami: [] },
    { combo: ["Bicipiti", "Tricipiti", "Spalle"], richiami: ["Polpacci"] },
  ],
  5: [
    { combo: ["Glutei", "Femorali"], richiami: [] },
    { combo: ["Spalle", "Petto"], richiami: [] },
    { combo: ["Schiena", "Bicipiti"], richiami: [] },
    { combo: ["Petto", "Tricipiti"], richiami: [] },
    { combo: ["Glutei"], richiami: ["Quadricipiti", "Polpacci"] },
  ],
  6: [
    { combo: ["Glutei", "Femorali"], richiami: [] },
    { combo: ["Spalle", "Petto", "Tricipiti"], richiami: [] },
    { combo: ["Schiena", "Bicipiti"], richiami: [] },
    { combo: ["Femorali", "Schiena"], richiami: [] },
    { combo: ["Spalle"], richiami: ["Polpacci"] },
    { combo: ["Bicipiti", "Tricipiti"], richiami: ["Quadricipiti"] },
  ],
};

function generaSplitAutomatica(numeroGiorni, focus) {
  const n = Math.min(6, Math.max(1, Number(numeroGiorni) || 3));
  const template = TEMPLATE_SPLIT[n] || TEMPLATE_SPLIT[3];
  const giorni = template.map((t) => ({ gruppi: [...t.combo, ...t.richiami] }));

  // I gruppi in focus vogliono più frequenza: se compaiono una sola volta, li aggiungiamo
  // come richiamo su un'altra giornata che non li ha già (e non è già troppo carica)
  (focus || []).forEach((gruppoFocus) => {
    const occorrenze = giorni.filter((g) => g.gruppi.includes(gruppoFocus)).length;
    if (occorrenze < 2) {
      const candidato = giorni.find((g) => !g.gruppi.includes(gruppoFocus) && g.gruppi.length < 4);
      if (candidato) candidato.gruppi.push(gruppoFocus);
    }
  });

  return giorni.map((g) => ({ nome: g.gruppi.join(" + "), gruppi: g.gruppi, nomeManuale: false }));
}

const RISCALDAMENTO_STANDARD = [
  "Foam rolling (SMR): 30 sec per distretto target della seduta",
  "Mobilità dinamica anche (es. 90/90, affondi con rotazione)",
  "Mobilità rachide toracico (open book, cat-cow modificato)",
  "Attivazione neuromuscolare specifica sul primo esercizio (serie leggera di avvicinamento)",
];

function targetPassiGiornalieri(livelloAttivita) {
  if (livelloAttivita === "sedentario") return "8.000 - 10.000 passi/giorno";
  if (livelloAttivita === "intermedio") return "10.000 - 12.000 passi/giorno";
  return "12.000+ passi/giorno";
}

function adattoAlLivello(es, livello) {
  if (livello === "base") return !!es.solo_base && (es.attrezzo || "").toLowerCase().includes("corpo libero");
  return !es.solo_base;
}

// BLOCCO 2 = complessi fondamentali (1-2 multiarticolari primari) · BLOCCO 3 = accessori/isolamento (3-5 esercizi)
function decidiRipetizioni(es, livello, blocco) {
  if (blocco === 2) return livello === "avanzata" ? "5-7" : "6-8";
  // blocco 3: multiarticolari secondari (unilaterali/monopodalici) 8-10, isolamento puro 10-12
  if (es.unilaterale || isCompoundPattern(es.pattern)) return "8-10";
  return "10-12";
}
function decidiRecupero(blocco) {
  return blocco === 2 ? "120-180 sec" : "60-90 sec";
}

function esercizioEscluso(es, escluse) {
  if (escluse.pattern.includes(es.pattern)) return true;
  if (escluse.nomi.includes(es.nome)) return true;
  return false;
}

function scegliVariati(candidati, numero) {
  const perPattern = new Map();
  candidati.forEach((e) => {
    if (!perPattern.has(e.pattern)) perPattern.set(e.pattern, []);
    perPattern.get(e.pattern).push(e);
  });
  const patternUnici = [...perPattern.keys()];
  const scelti = [];
  let giro = 0;
  while (scelti.length < numero && scelti.length < candidati.length && giro < patternUnici.length * 5) {
    const pattern = patternUnici[giro % patternUnici.length];
    const disponibili = perPattern.get(pattern);
    if (disponibili && disponibili.length > 0) scelti.push(disponibili.shift());
    giro++;
  }
  return scelti;
}

const ESERCIZI_MARGINALI = { Spalle: ["Alzate frontali"] }; // deltoide anteriore: già stimolato dal petto, da usare solo se serve varietà

function scegliEserciziBlocco({ gruppo, serieTotali, libreria, livello, escluse, blocco, giaScelti }) {
  let candidati = libreria.filter((e) =>
    (e.gruppo === gruppo || e.gruppo_secondario === gruppo) &&
    adattoAlLivello(e, livello) &&
    !esercizioEscluso(e, escluse)
  );
  // Blocco 2: solo esercizi compound (forza meccanica); Blocco 3: tutto il resto (accessori/isolamento)
  candidati = candidati.filter((e) => (blocco === 2 ? isCompoundPattern(e.pattern) : true));
  // Esercizi marginali (es. deltoide anteriore): in coda, usati solo se servono per completare la varietà
  const marginali = ESERCIZI_MARGINALI[gruppo] || [];
  candidati = [...candidati.filter((e) => !marginali.includes(e.nome)), ...candidati.filter((e) => marginali.includes(e.nome))];
  // Preferenza morbida: primi in lista quelli non ancora usati in nessun altro giorno della settimana.
  // Se la libreria non basta a coprire tutte le sessioni senza ripetere, va bene ripetere piuttosto che lasciare vuoto.
  candidati = [...candidati.filter((e) => !giaScelti.includes(e.id)), ...candidati.filter((e) => giaScelti.includes(e.id))];
  if (serieTotali <= 0) return [];
  if (candidati.length === 0) return [{ esercizio: null, gruppoMancante: gruppo, serie: serieTotali }];

  const numeroEsercizi = blocco === 2
    ? Math.min(2, candidati.length)
    : Math.max(1, Math.min(5, candidati.length, Math.round(serieTotali / 3)));
  // Un esercizio per ogni tipo di movimento diverso quando possibile (es. schiena: tirata dall'alto, dal basso, orizzontale)
  let scelti = scegliVariati(candidati, numeroEsercizi);

  // Schiena, blocco accessori: garantisce sempre almeno un esercizio di ampiezza (tirata verticale)
  // e uno di spessore (tirata orizzontale), non lasciarlo al caso del round-robin.
  if (gruppo === "Schiena" && blocco === 3 && scelti.length >= 2) {
    const eAmpiezza = (e) => e.pattern.toLowerCase().includes("verticale");
    const eSpessore = (e) => e.pattern.toLowerCase().includes("orizzontale");
    const haAmpiezza = scelti.some(eAmpiezza);
    const haSpessore = scelti.some(eSpessore);
    if (!haAmpiezza) {
      const sostituto = candidati.find((e) => eAmpiezza(e) && !scelti.includes(e));
      if (sostituto) scelti = [sostituto, ...scelti.slice(1)];
    } else if (!haSpessore) {
      const sostituto = candidati.find((e) => eSpessore(e) && !scelti.includes(e));
      if (sostituto) scelti = [sostituto, ...scelti.slice(1)];
    }
  }

  const base = Math.floor(serieTotali / scelti.length);
  const resto = serieTotali % scelti.length;
  return scelti.map((es, i) => ({ esercizio: es, serie: base + (i < resto ? 1 : 0) }));
}

function normalizzaNomeEsercizio(testo) {
  if (!testo) return "";
  return testo.replace(/\s*\d+\s*[xX×]\s*\d+(-\d+)?\s*$/, "").trim();
}

function costruisciLookupEsercizi(libreria, aliasRows) {
  const map = new Map();
  libreria.forEach((e) => map.set(e.nome.toLowerCase(), e));
  aliasRows.forEach((a) => {
    const es = libreria.find((e) => e.id === a.esercizio_id);
    if (es) map.set(a.alias.toLowerCase(), es);
  });
  return map;
}
function risolviEsercizio(nomeGrezzo, lookup) {
  const pulito = normalizzaNomeEsercizio(nomeGrezzo).toLowerCase();
  return lookup.get(pulito) || null;
}

function assegnaTecnicheGiorno(esercizi, fase, livello) {
  if (livello !== "avanzata" || !fase || fase < 3) return esercizi.map(() => "");
  const primoCompoundIdx = esercizi.findIndex((e) => isCompoundPattern(e.pattern));
  let ultimoIsolamentoIdx = -1;
  esercizi.forEach((e, i) => { if (!isCompoundPattern(e.pattern)) ultimoIsolamentoIdx = i; });
  const tecBlocco2 = TECNICHE_BLOCCO2[(fase - 3) % TECNICHE_BLOCCO2.length];
  const tecBlocco3 = TECNICHE_BLOCCO3[(fase - 3) % TECNICHE_BLOCCO3.length];
  return esercizi.map((e, i) => {
    if (i === primoCompoundIdx) return tecBlocco2;
    if (i === ultimoIsolamentoIdx) return tecBlocco3;
    return "";
  });
}

function analizzaTrendCarico(kgValori, livello) {
  const valori = kgValori.filter((v) => v != null);
  if (valori.length < 2) return "Dati insufficienti";
  const ultimo = valori[valori.length - 1], precedente = valori[valori.length - 2];
  if (ultimo > precedente) return "Trend positivo: valutare +2.5kg o +1 rep alla prossima seduta";
  if (ultimo < precedente) return "Non progredire: verificare causa";
  let consecutivi = 1;
  for (let i = valori.length - 2; i >= 0; i--) { if (valori[i] === ultimo) consecutivi++; else break; }
  const soglie = { base: 3, intermedia: 4, avanzata: 6 };
  const soglia = soglie[livello] || 4;
  return consecutivi > soglia ? "Stallo: valutare variazione o deload" : "Stabile: tentare piccolo incremento se tecnica pulita";
}

function analizzaSegnaliCheck(ultimo, precedente) {
  if (!ultimo || !precedente) return { segnale: "Dati insufficienti (serve almeno 2 check)", avvisoDistanza: null };
  const confrontabili = CAMPI_MISURA_CHECK.filter((c) => ultimo[c] != null && precedente[c] != null);
  const aumentate = confrontabili.filter((c) => ultimo[c] > precedente[c]);
  const misureAumento = confrontabili.length > 0 && aumentate.length / confrontabili.length >= 0.6;
  const notaTesto = (ultimo.note_cliente || "").toLowerCase();
  const notaAttenzione = PAROLE_ATTENZIONE.some((p) => notaTesto.includes(p));
  let segnale = "Nessun segnale";
  if (misureAumento && notaAttenzione) segnale = "Attenzione alta: valutare deload";
  else if (misureAumento || notaAttenzione) segnale = "Attenzione media: monitorare";
  const giorni = Math.round((new Date(ultimo.data_check) - new Date(precedente.data_check)) / 86400000);
  const avvisoDistanza = giorni > 45 ? `Confronto tra check distanti ${giorni} giorni: interpretare come trend di lungo periodo, non come stallo settimanale.` : null;
  return { segnale, avvisoDistanza };
}

function calibrazioneCheck(ultimo, precedente) {
  if (!ultimo || !precedente) return [];
  const consigli = ["Riferimento proteico: 1.8-2.2 g/kg, ciclicizzando carboidrati/grassi in base all'aderenza."];
  const giorni = Math.round((new Date(ultimo.data_check) - new Date(precedente.data_check)) / 86400000);
  if (ultimo.peso_kg != null && precedente.peso_kg != null && giorni > 0) {
    const caloPercentuale = (precedente.peso_kg - ultimo.peso_kg) / precedente.peso_kg;
    if (caloPercentuale > 0.02) consigli.push("Il peso scende rapidamente: se anche i carichi stanno calando, valutare +carboidrati peri-workout.");
  }
  const confrontabili = CAMPI_MISURA_CHECK.filter((c) => c !== "peso_kg" && ultimo[c] != null && precedente[c] != null);
  const invariate = confrontabili.filter((c) => Math.abs(ultimo[c] - precedente[c]) < 0.5).length;
  if (confrontabili.length > 0 && invariate / confrontabili.length >= 0.7) {
    consigli.push("Misure quasi invariate: ricalibra il target passi (+1.500/die) oppure scala 100-150 kcal da carboidrati/grassi.");
  }
  consigli.push("Progressione scheda: mantieni l'ossatura degli esercizi fondamentali cambiando lo stimolo (da volume a intensità, o pause isometriche); ruota gli accessori nel range 8-12 reps.");
  return consigli;
}

function suggerimentiFeedback(tags, obiettivoAttuale) {
  const out = [];
  if (tags.includes("dolore")) out.push("Priorità alta: valutare in sessione, eventualmente sostituire esercizio o ridurre ROM/carico sulla zona interessata.");
  if (tags.includes("stanca") || tags.includes("troppo_lavoro")) {
    out.push("Allenamento: valutare deload leggero (-20/30% volume).");
    out.push(obiettivoAttuale !== "definizione" ? "Alimentazione: valutare +20/30g carboidrati nei prossimi 3-4 giorni." : "Alimentazione: verificare sonno/aderenza prima di intervenire sui carboidrati.");
  }
  if (tags.includes("energica") || tags.includes("poco_lavoro")) out.push("Valutare un set extra o piccolo incremento carico/intensità.");
  if (tags.includes("vuole_aggiungere_giorno")) out.push("Valutare inserimento sessione aggiuntiva, contenuto da calibrare.");
  if (tags.includes("vuole_togliere_giorno")) out.push("Valutare riduzione di un giorno, individuare quello a minor priorità da assorbire negli altri.");
  return out;
}


function RiepilogoCliente({ client, checkins, onVaiADati }) {
  const [lezioniInfo, setLezioniInfo] = useState(null);
  const isOnline = client.tipo_servizio === "online" || client.tipo_servizio === "ibrido";
  const isBulb = client.tipo_servizio === "presenza" || client.tipo_servizio === "ibrido";
  const incluse = client.pacchetto_lezioni ? Number(client.pacchetto_lezioni) : 0;

  useEffect(() => {
    if (!isBulb || !incluse) { setLezioniInfo(null); return; }
    supabase.from("lezioni_svolte").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("fatta", true)
      .then(({ count }) => setLezioniInfo(count ?? 0));
  }, [client.id, isBulb, incluse]);

  const livello = LIVELLI_ATTIVITA.find((l) => l.value === client.livello_attivita);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Anagrafica</p>
        <button onClick={onVaiADati} className="text-sky-600 text-xs font-medium">Modifica in Dati →</button>
      </div>
      <Card className="p-4">
        <RigaStato label="Email" valore={client.email} presente={!!client.email} />
        <RigaStato label="Sesso" valore={client.sesso} presente={!!client.sesso} />
        <RigaStato label="Data di nascita" valore={client.data_nascita?.split("-").reverse().join("/")} presente={!!client.data_nascita} />
        <RigaStato label="Altezza" valore={client.altezza_cm ? `${client.altezza_cm} cm` : null} presente={!!client.altezza_cm} />
        <RigaStato label="Tipo di lavoro/attività" valore={livello?.label} presente={!!livello} />
        <RigaStato label="Segni particolari" valore={client.note_particolari} presente={!!client.note_particolari} />
        <RigaStato label="Accesso app" valore={client.user_id ? "Attivo" : null} presente={!!client.user_id} />
      </Card>

      {isOnline && (
        <>
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Percorso online</p>
          <Card className="p-4">
            <RigaStato label="Piano" valore={client.piano} presente={!!client.piano} />
            <RigaStato label="Data inizio" valore={client.data_inizio?.split("-").reverse().join("/")} presente={!!client.data_inizio} />
            <RigaStato label="Data scadenza" valore={client.data_scadenza?.split("-").reverse().join("/")} presente={!!client.data_scadenza} />
            <RigaStato label="Scheda" valore={client.scheda_pdf_path ? "PDF caricato" : client.link_scheda ? "Link impostato" : null} presente={!!(client.scheda_pdf_path || client.link_scheda)} />
            <RigaStato label="Check registrati" valore={checkins.length} presente={checkins.length > 0} />
            <RigaStato label="Prossimo check" valore={client.prossimo_check?.split("-").reverse().join("/")} presente={!!client.prossimo_check} />
          </Card>
        </>
      )}

      {isBulb && (
        <>
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Percorso BULB</p>
          <Card className="p-4">
            <RigaStato label="Pacchetto lezioni" valore={incluse ? `${incluse} lezioni` : null} presente={!!incluse} />
            <RigaStato label="Sede abituale" valore={client.sede_abituale} presente={!!client.sede_abituale} />
            <RigaStato label="Lezioni svolte" valore={incluse ? `${lezioniInfo ?? 0} / ${incluse}` : null} presente={!!incluse} />
          </Card>
        </>
      )}
    </div>
  );
}

function SelettoreEsercizio({ libreria, onScegli, onAnnulla }) {
  const [ricerca, setRicerca] = useState("");
  const [gruppoFiltro, setGruppoFiltro] = useState("");
  const gruppi = [...new Set(libreria.map((e) => e.gruppo).filter(Boolean))].sort();
  const filtrati = libreria.filter((e) => {
    const matchRicerca = !ricerca || e.nome.toLowerCase().includes(ricerca.toLowerCase());
    const matchGruppo = !gruppoFiltro || e.gruppo === gruppoFiltro;
    return matchRicerca && matchGruppo;
  });

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">Scegli esercizio dalla libreria</p>
        <button onClick={onAnnulla} className="text-slate-400 text-xs">Annulla</button>
      </div>
      <input value={ricerca} onChange={(e) => setRicerca(e.target.value)} placeholder="Cerca per nome..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      <select value={gruppoFiltro} onChange={(e) => setGruppoFiltro(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
        <option value="">Tutti i gruppi muscolari</option>
        {gruppi.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
      <div className="max-h-64 overflow-y-auto space-y-1">
        {filtrati.map((e) => (
          <button key={e.id} onClick={() => onScegli(e)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm border border-slate-100">
            <span className="font-medium text-slate-700">{e.nome}</span>
            <span className="text-slate-400 text-xs block">{e.gruppo}{e.pattern ? ` · ${e.pattern}` : ""}{e.unilaterale ? " · unilaterale" : ""}</span>
          </button>
        ))}
        {filtrati.length === 0 && <p className="text-slate-400 text-sm text-center py-4">Nessun esercizio trovato.</p>}
      </div>
      <button onClick={() => onScegli(null)} className="w-full text-sky-600 text-xs font-medium py-2">Usa testo libero (esercizio non in libreria)</button>
    </Card>
  );
}

function EsercizioSchedaRiga({ es, onCambia, onElimina, onMuovi }) {
  const [mostraLibreria, setMostraLibreria] = useState(false);
  const [libreria, setLibreria] = useState([]);
  const nomeVisibile = es.esercizi_libreria?.nome || es.nome_libero || "(scegli esercizio)";

  const apriLibreria = async () => {
    const { data } = await supabase.from("esercizi_libreria").select("*").order("nome");
    setLibreria(data || []);
    setMostraLibreria(true);
  };

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button onClick={apriLibreria} className="flex-1 text-left font-medium text-slate-700 text-sm">{nomeVisibile}</button>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => onMuovi(-1)} className="text-slate-300 hover:text-slate-600 px-1">▲</button>
          <button onClick={() => onMuovi(1)} className="text-slate-300 hover:text-slate-600 px-1">▼</button>
          <button onClick={onElimina} className="text-slate-300 hover:text-rose-500 px-1"><X size={16} /></button>
        </div>
      </div>
      {mostraLibreria && (
        <SelettoreEsercizio libreria={libreria} onAnnulla={() => setMostraLibreria(false)}
          onScegli={(scelto) => {
            if (scelto) onCambia({ esercizio_id: scelto.id, nome_libero: null });
            else { const nome = prompt("Nome esercizio (testo libero):"); if (nome) onCambia({ esercizio_id: null, nome_libero: nome }); }
            setMostraLibreria(false);
          }} />
      )}
      <div className="grid grid-cols-2 gap-2">
        <input defaultValue={es.serie || ""} onBlur={(e) => onCambia({ serie: e.target.value })} placeholder="Serie" className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
        <input defaultValue={es.ripetizioni || ""} onBlur={(e) => onCambia({ ripetizioni: e.target.value })} placeholder="Ripetizioni" className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
        <input defaultValue={es.carico || ""} onBlur={(e) => onCambia({ carico: e.target.value })} placeholder="Carico" className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
        <input defaultValue={es.recupero || ""} onBlur={(e) => onCambia({ recupero: e.target.value })} placeholder="Recupero" className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
      </div>
      <input key={"tec-" + es.id + es.tecnica} defaultValue={es.tecnica || ""} onBlur={(e) => onCambia({ tecnica: e.target.value, tecnica_auto: false })} placeholder="Tecnica"
        className={`w-full border rounded-lg px-2 py-1.5 text-xs ${es.tecnica_auto ? "border-sky-200 bg-sky-50" : "border-slate-200"}`} />
      <input defaultValue={es.note || ""} onBlur={(e) => onCambia({ note: e.target.value })} placeholder="Note" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
    </Card>
  );
}


function apriStampaScheda(client, scheda, trend, feedback) {
  const tuttiEsercizi = scheda.giorni.flatMap((g) => g.esercizi);
  const esc = (s) => (s == null ? "" : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
  const trendConProblemi = tuttiEsercizi
    .map((es) => ({ nome: es.esercizi_libreria?.nome || es.nome_libero, msg: trend[es.id] }))
    .filter((t) => t.msg && t.msg !== "Dati insufficienti");
  const nessunDatoCarico = tuttiEsercizi.length > 0 && tuttiEsercizi.every((es) => !trend[es.id] || trend[es.id] === "Dati insufficienti");
  const ultimoFeedback = feedback[0];
  const suggerimentiUltimo = ultimoFeedback ? suggerimentiFeedback(ultimoFeedback.tags || [], client.obiettivo_attuale).join(" ") : "";

  const rigaEsercizio = (es) => `
    <tr>
      <td>${esc(es.esercizi_libreria?.nome || es.nome_libero)}</td>
      <td>${esc(es.serie)}${es.ripetizioni ? " x " + esc(es.ripetizioni) : ""}</td>
      <td>${esc(es.carico) || "—"}</td>
      <td>${esc(es.recupero)}</td>
      <td>${esc(es.tecnica) || "—"}</td>
    </tr>`;

  const righeGiorni = scheda.giorni.map((g, idx) => {
    const bloccoForza = g.esercizi.filter((es) => es.note === "Blocco forza (complesso fondamentale)");
    const bloccoAccessorio = g.esercizi.filter((es) => es.note === "Blocco accessorio");
    const altri = g.esercizi.filter((es) => es.note !== "Blocco forza (complesso fondamentale)" && es.note !== "Blocco accessorio");
    const tabellaBlocco = (titolo, righe) => righe.length === 0 ? "" : `
      <p class="blocco-label">${titolo}</p>
      <table>
        <thead><tr><th>Esercizio</th><th>Serie x Rip</th><th>Carico</th><th>Recupero</th><th>Tecnica</th></tr></thead>
        <tbody>${righe.map(rigaEsercizio).join("")}</tbody>
      </table>`;
    return `
    <div class="giorno" style="${idx > 0 ? "page-break-before: always;" : ""}">
      <div class="giorno-header">${esc(g.nome)}</div>
      <p class="riscaldamento"><strong>Riscaldamento (5-10 min):</strong> ${RISCALDAMENTO_STANDARD.join(" · ")}</p>
      ${tabellaBlocco("Blocco forza — complessi fondamentali", bloccoForza)}
      ${tabellaBlocco("Blocco accessori — ipertrofia mirata", bloccoAccessorio)}
      ${tabellaBlocco("Esercizi", altri)}
    </div>`;
  }).join("");

  const noteCoach = `
    <div class="note-coach">
      <h3>Note del Coach</h3>
      ${nessunDatoCarico ? '<p>Nessun dato di carico disponibile: valutare una progressione per VOLUME (+1 serie), DENSITÀ (-10% recupero) o TEMPO SOTTO TENSIONE (fermo di 2") invece che sul carico.</p>' : ""}
      ${trendConProblemi.map((t) => `<p>${esc(t.nome)}: ${esc(t.msg)}</p>`).join("")}
      ${ultimoFeedback ? `<p>Ultimo feedback (${esc(ultimoFeedback.data?.split("-").reverse().join("/"))}): ${esc(suggerimentiUltimo || "nessuna azione suggerita")}</p>` : ""}
      <p><strong>NEAT — target giornaliero:</strong> ${esc(targetPassiGiornalieri(client.livello_attivita))}</p>
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>Scheda ${esc(client.nome)} ${esc(client.cognome)}</title>
<style>
  body { font-family: -apple-system, Arial, sans-serif; color: #1e293b; max-width: 700px; margin: 0 auto; padding: 32px; }
  h1 { font-size: 22px; margin: 0; }
  .sottotitolo { color: #64748b; font-size: 13px; margin-top: 4px; }
  .intestazione { border-bottom: 2px solid #334155; padding-bottom: 16px; margin-bottom: 24px; }
  .giorno { margin-bottom: 32px; }
  .giorno-header { background: #334155; color: white; font-size: 16px; font-weight: 600; padding: 10px 14px; border-radius: 6px; margin-bottom: 10px; }
  .riscaldamento { font-size: 11px; color: #64748b; margin: 0 0 14px; font-style: italic; }
  .blocco-label { font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.03em; margin: 14px 0 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 4px; }
  th { text-align: left; border-bottom: 2px solid #cbd5e1; padding: 4px 6px 4px 0; color: #475569; }
  td { border-bottom: 1px solid #e2e8f0; padding: 6px 6px 6px 0; }
  .note-coach { margin-top: 24px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; background: #f8fafc; page-break-before: always; }
  .note-coach h3 { margin-top: 0; font-size: 14px; }
  .note-coach p { font-size: 13px; margin: 4px 0; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="intestazione">
    <h1>${esc(client.nome)} ${esc(client.cognome)}</h1>
    <p class="sottotitolo">Fase ${esc(client.fase_allenamento || "—")} · Livello ${esc(client.livello_allenamento || "—")} · Obiettivo: ${esc(client.obiettivo_attuale || "—")}</p>
  </div>
  ${righeGiorni}
  ${noteCoach}
</body>
</html>`;

  const finestra = window.open("", "_blank");
  if (!finestra) { alert("Il browser ha bloccato l'apertura della finestra. Consenti i popup per questo sito e riprova."); return; }
  finestra.document.open();
  finestra.document.write(html);
  finestra.document.close();
  finestra.focus();
  setTimeout(() => finestra.print(), 300);
}

function GiornoScheda({ giorno, client, onEliminaGiorno, onRinominaGiorno, onMuoviGiorno, onEsercizioCambiato }) {
  const [esercizi, setEsercizi] = useState(giorno.esercizi);
  useEffect(() => { setEsercizi(giorno.esercizi); }, [giorno.esercizi]);

  const cambiaEsercizio = async (esId, campi) => {
    setEsercizi((prev) => prev.map((e) => (e.id === esId ? { ...e, ...campi } : e)));
    const { esercizi_libreria, ...daSalvare } = campi;
    await supabase.from("scheda_esercizi").update(daSalvare).eq("id", esId);
    onEsercizioCambiato();
  };
  const eliminaEsercizio = async (esId) => {
    setEsercizi((prev) => prev.filter((e) => e.id !== esId));
    await supabase.from("scheda_esercizi").delete().eq("id", esId);
    onEsercizioCambiato();
  };
  const muoviEsercizio = async (esId, direzione) => {
    const idx = esercizi.findIndex((e) => e.id === esId);
    const altroIdx = idx + direzione;
    if (altroIdx < 0 || altroIdx >= esercizi.length) return;
    const nuovo = [...esercizi];
    [nuovo[idx], nuovo[altroIdx]] = [nuovo[altroIdx], nuovo[idx]];
    setEsercizi(nuovo);
    await Promise.all(nuovo.map((e, i) => supabase.from("scheda_esercizi").update({ ordine: i }).eq("id", e.id)));
  };
  const aggiungiEsercizio = async () => {
    const { data } = await supabase.from("scheda_esercizi").insert({ giorno_id: giorno.id, ordine: esercizi.length, tecnica_auto: true }).select().single();
    if (data) setEsercizi((prev) => [...prev, data]);
  };
  const suggerisciTecniche = async () => {
    const tecniche = assegnaTecnicheGiorno(esercizi.map((e) => ({ pattern: e.esercizi_libreria?.pattern })), client.fase_allenamento, client.livello_allenamento);
    for (let i = 0; i < esercizi.length; i++) {
      if (esercizi[i].tecnica_auto !== false) await cambiaEsercizio(esercizi[i].id, { tecnica: tecniche[i], tecnica_auto: true });
    }
  };

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <input defaultValue={giorno.nome} onBlur={(e) => onRinominaGiorno(giorno.id, e.target.value)} className="flex-1 font-semibold text-slate-800 border-0 bg-transparent focus:outline-none focus:bg-slate-50 rounded px-1 -mx-1" />
        <button onClick={() => onMuoviGiorno(giorno.id, -1)} className="text-slate-300 hover:text-slate-600 px-1">▲</button>
        <button onClick={() => onMuoviGiorno(giorno.id, 1)} className="text-slate-300 hover:text-slate-600 px-1">▼</button>
        <button onClick={() => onEliminaGiorno(giorno.id)} className="text-slate-300 hover:text-rose-500 px-1"><X size={16} /></button>
      </div>
      <div className="space-y-2">
        {esercizi.map((es) => (
          <EsercizioSchedaRiga key={es.id} es={es} onCambia={(c) => cambiaEsercizio(es.id, c)} onElimina={() => eliminaEsercizio(es.id)} onMuovi={(d) => muoviEsercizio(es.id, d)} />
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={aggiungiEsercizio} className="flex-1 border border-dashed border-slate-300 text-slate-500 text-xs font-medium rounded-lg py-2">+ Esercizio</button>
        <button onClick={suggerisciTecniche} className="flex-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg py-2">Suggerisci tecniche</button>
      </div>
    </Card>
  );
}

function SchedaCoach({ client, checkins, salvaCliente }) {
  const [libreria, setLibreria] = useState([]);
  const [aliasRows, setAliasRows] = useState([]);
  const [schede, setSchede] = useState([]);
  const [schedaCorrente, setSchedaCorrente] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [trend, setTrend] = useState({});
  const [caricando, setCaricando] = useState(true);
  const [vistaStampa, setVistaStampa] = useState(false);
  const [tagSelezionati, setTagSelezionati] = useState([]);
  const [notaFeedback, setNotaFeedback] = useState("");
  const [mostraGeneratore, setMostraGeneratore] = useState(false);
  const [giorniGenerator, setGiorniGenerator] = useState([{ nome: "Giorno A", gruppi: [] }]);
  const [numeroGiorniSettimana, setNumeroGiorniSettimana] = useState(3);
  const [serieGruppi, setSerieGruppi] = useState({});
  const [generando, setGenerando] = useState(false);
  const [condizioniAltroTesto, setCondizioniAltroTesto] = useState(client.problematiche_salute_note || "");

  const caricaGiorni = async (schedaId) => {
    const { data: giorniData } = await supabase.from("scheda_giorni").select("*").eq("scheda_id", schedaId).order("ordine");
    const giorni = [];
    for (const g of giorniData || []) {
      const { data: es } = await supabase.from("scheda_esercizi").select("*, esercizi_libreria(nome, pattern, gruppo)").eq("giorno_id", g.id).order("ordine");
      giorni.push({ ...g, esercizi: es || [] });
    }
    return giorni;
  };

  const calcolaTrend = async (lib, al, giorni) => {
    const lookup = costruisciLookupEsercizi(lib, al);
    const { data: trainingEx } = await supabase.from("training_exercises").select("id, nome").eq("client_id", client.id);
    const { data: trainingEntries } = await supabase.from("training_entries").select("exercise_id, data, kg").eq("client_id", client.id).order("data");
    const risultati = {};
    for (const se of giorni.flatMap((g) => g.esercizi)) {
      const nomeCanonico = (se.esercizi_libreria?.nome || normalizzaNomeEsercizio(se.nome_libero) || "").toLowerCase();
      if (!nomeCanonico) continue;
      const idsCorrispondenti = (trainingEx || []).filter((te) => {
        const risolto = risolviEsercizio(te.nome, lookup);
        return (risolto ? risolto.nome : normalizzaNomeEsercizio(te.nome)).toLowerCase() === nomeCanonico;
      }).map((te) => te.id);
      const kgValori = (trainingEntries || []).filter((e) => idsCorrispondenti.includes(e.exercise_id) && e.kg != null).map((e) => e.kg);
      risultati[se.id] = kgValori.length ? analizzaTrendCarico(kgValori, client.livello_allenamento) : "Dati insufficienti";
    }
    setTrend(risultati);
  };

  const carica = async () => {
    setCaricando(true);
    const { data: lib } = await supabase.from("esercizi_libreria").select("*").order("nome");
    const { data: al } = await supabase.from("esercizi_alias").select("*");
    setLibreria(lib || []); setAliasRows(al || []);

    const { data: sc } = await supabase.from("schede").select("*").eq("client_id", client.id).order("creata_il", { ascending: false });
    setSchede(sc || []);
    const attiva = (sc || []).find((s) => s.stato === "bozza") || (sc || [])[0] || null;
    let giorni = [];
    if (attiva) { giorni = await caricaGiorni(attiva.id); setSchedaCorrente({ ...attiva, giorni }); }
    else setSchedaCorrente(null);

    const { data: fb } = await supabase.from("feedback_soggettivo").select("*").eq("client_id", client.id).order("data", { ascending: false }).limit(10);
    setFeedback(fb || []);

    if (attiva) await calcolaTrend(lib || [], al || [], giorni);
    setCaricando(false);
  };
  useEffect(() => { carica(); }, [client.id]);

  const aggiornaGiornoLocale = (giornoId, campi) => {
    setSchedaCorrente((prev) => ({ ...prev, giorni: prev.giorni.map((g) => (g.id === giornoId ? { ...g, ...campi } : g)) }));
  };
  const aggiungiGiorno = async () => {
    const { data } = await supabase.from("scheda_giorni").insert({ scheda_id: schedaCorrente.id, nome: `Giorno ${schedaCorrente.giorni.length + 1}`, ordine: schedaCorrente.giorni.length }).select().single();
    if (data) setSchedaCorrente((prev) => ({ ...prev, giorni: [...prev.giorni, { ...data, esercizi: [] }] }));
  };
  const rinominaGiorno = async (giornoId, nome) => { aggiornaGiornoLocale(giornoId, { nome }); await supabase.from("scheda_giorni").update({ nome }).eq("id", giornoId); };
  const eliminaGiorno = async (giornoId) => {
    if (!confirm("Eliminare questo giorno e tutti i suoi esercizi?")) return;
    setSchedaCorrente((prev) => ({ ...prev, giorni: prev.giorni.filter((g) => g.id !== giornoId) }));
    await supabase.from("scheda_giorni").delete().eq("id", giornoId);
  };
  const muoviGiorno = async (giornoId, direzione) => {
    const idx = schedaCorrente.giorni.findIndex((g) => g.id === giornoId);
    const altroIdx = idx + direzione;
    if (altroIdx < 0 || altroIdx >= schedaCorrente.giorni.length) return;
    const nuovo = [...schedaCorrente.giorni];
    [nuovo[idx], nuovo[altroIdx]] = [nuovo[altroIdx], nuovo[idx]];
    setSchedaCorrente((prev) => ({ ...prev, giorni: nuovo }));
    await Promise.all(nuovo.map((g, i) => supabase.from("scheda_giorni").update({ ordine: i }).eq("id", g.id)));
  };

  const creaNuovaBozza = async (daDuplicare) => {
    const { data: nuova } = await supabase.from("schede").insert({ client_id: client.id, stato: "bozza" }).select().single();
    if (!nuova) return;
    if (daDuplicare) {
      for (const g of daDuplicare.giorni) {
        const { data: nuovoGiorno } = await supabase.from("scheda_giorni").insert({ scheda_id: nuova.id, nome: g.nome, ordine: g.ordine }).select().single();
        if (!nuovoGiorno) continue;
        for (const es of g.esercizi) {
          await supabase.from("scheda_esercizi").insert({
            giorno_id: nuovoGiorno.id, esercizio_id: es.esercizio_id, nome_libero: es.nome_libero, ordine: es.ordine,
            serie: es.serie, ripetizioni: es.ripetizioni, carico: es.carico, recupero: es.recupero, tecnica: es.tecnica, tecnica_auto: es.tecnica_auto, note: es.note,
          });
        }
      }
    }
    await carica();
  };
  const finalizzaScheda = async () => {
    await supabase.from("schede").update({ stato: "finale", finalizzata_il: new Date().toISOString() }).eq("id", schedaCorrente.id);
    await carica();
  };

  const salvaFeedback = async () => {
    if (tagSelezionati.length === 0 && !notaFeedback.trim()) return;
    await supabase.from("feedback_soggettivo").insert({ client_id: client.id, tags: tagSelezionati, nota_libera: notaFeedback || null });
    setTagSelezionati([]); setNotaFeedback("");
    carica();
  };

  const toggleCondizione = (value) => {
    const attuali = client.problematiche_salute || [];
    const nuove = attuali.includes(value) ? attuali.filter((v) => v !== value) : [...attuali, value];
    salvaCliente({ problematiche_salute: nuove });
  };
  const salvaCondizioniAltro = () => salvaCliente({ problematiche_salute_note: condizioniAltroTesto || null });

  const gruppiDisponibili = [...new Set(libreria.map((e) => e.gruppo).filter(Boolean))].sort();

  const aggiungiGiornoGenerator = () => setGiorniGenerator((prev) => [...prev, { nome: `Giorno ${String.fromCharCode(65 + prev.length)}`, gruppi: [], nomeManuale: false }]);
  const rimuoviGiornoGenerator = (idx) => setGiorniGenerator((prev) => prev.filter((_, i) => i !== idx));
  const rinominaGiornoGenerator = (idx, nome) => setGiorniGenerator((prev) => prev.map((g, i) => (i === idx ? { ...g, nome, nomeManuale: true } : g)));
  const toggleGruppoGiorno = (idx, gruppo) => setGiorniGenerator((prev) => prev.map((g, i) => {
    if (i !== idx) return g;
    const gruppi = g.gruppi.includes(gruppo) ? g.gruppi.filter((x) => x !== gruppo) : [...g.gruppi, gruppo];
    const nome = g.nomeManuale ? g.nome : (gruppi.length ? gruppi.join(" + ") : `Giorno ${String.fromCharCode(65 + idx)}`);
    return { ...g, gruppi, nome };
  }));
  const gruppiUsatiNelGeneratore = [...new Set(giorniGenerator.flatMap((g) => g.gruppi))];

  const opzioniSerie = Array.from({ length: 17 }, (_, i) => 4 + i * 2); // 4, 6, 8 ... 36
  useEffect(() => {
    setSerieGruppi((prev) => {
      const next = { ...prev };
      let cambiato = false;
      gruppiUsatiNelGeneratore.forEach((gr) => {
        if (!(gr in next)) {
          const base = serieIdealiPerGruppo(gr, client.livello_allenamento, (client.focus_crescita || []).includes(gr), client.sesso);
          next[gr] = aggiustaVolumeIndiretto(gr, base, giorniGenerator);
          cambiato = true;
        }
      });
      return cambiato ? next : prev;
    });
  }, [JSON.stringify(gruppiUsatiNelGeneratore), client.livello_allenamento, JSON.stringify(client.focus_crescita), client.sesso]);

  const generaSchedaAutomatica = async () => {
    setGenerando(true);
    const condizioniAttive = CONDIZIONI_SALUTE.filter((c) => (client.problematiche_salute || []).includes(c.value));
    const escluse = { pattern: condizioniAttive.flatMap((c) => c.pattern_evitati), nomi: condizioniAttive.flatMap((c) => c.esclusioni_nome || []) };

    // Il volume settimanale per gruppo va diviso tra tutte le sessioni in cui quel gruppo compare
    const occorrenzeGruppo = {};
    giorniGenerator.forEach((g) => g.gruppi.forEach((gr) => { occorrenzeGruppo[gr] = (occorrenzeGruppo[gr] || 0) + 1; }));

    let schedaIdTarget;
    if (schedaCorrente && schedaCorrente.stato === "bozza") {
      schedaIdTarget = schedaCorrente.id;
      if (schedaCorrente.giorni.length > 0) await supabase.from("scheda_giorni").delete().eq("scheda_id", schedaIdTarget);
    } else {
      const { data: nuova } = await supabase.from("schede").insert({ client_id: client.id, stato: "bozza" }).select().single();
      if (!nuova) { setGenerando(false); return; }
      schedaIdTarget = nuova.id;
    }

    const livello = client.livello_allenamento;
    const fase = client.fase_allenamento;
    const isAvanzataFaseAlta = livello === "avanzata" && fase >= 3;
    const tecBlocco2 = isAvanzataFaseAlta ? TECNICHE_BLOCCO2[(fase - 3) % TECNICHE_BLOCCO2.length] : "";
    const tecBlocco3 = isAvanzataFaseAlta ? TECNICHE_BLOCCO3[(fase - 3) % TECNICHE_BLOCCO3.length] : "";
    const GRUPPI_SENZA_COMPOUND = ["Bicipiti", "Tricipiti"];
    const giaScelti = []; // condiviso su tutta la settimana: evita di ripetere lo stesso esercizio nei giorni diversi quando possibile

    for (let gi = 0; gi < giorniGenerator.length; gi++) {
      const giornoDef = giorniGenerator[gi];
      const { data: nuovoGiorno } = await supabase.from("scheda_giorni").insert({ scheda_id: schedaIdTarget, nome: giornoDef.nome, ordine: gi }).select().single();
      if (!nuovoGiorno) continue;

      let righeBlocco2 = [];
      let righeBlocco3 = [];
      for (const gruppo of giornoDef.gruppi) {
        const totale = Number(serieGruppi[gruppo] || 0);
        const perSessione = Math.min(SERIE_MAX_PER_SESSIONE, Math.max(1, Math.round(totale / (occorrenzeGruppo[gruppo] || 1))));
        // Bicipiti/Tricipiti non hanno esercizi multiarticolari: tutto il volume va al blocco accessori
        const senzaCompound = GRUPPI_SENZA_COMPOUND.includes(gruppo);
        const serieB2 = senzaCompound ? 0 : Math.round(perSessione * 0.4);
        const serieB3 = perSessione - serieB2;

        const sceltiB2 = senzaCompound ? [] : scegliEserciziBlocco({ gruppo, serieTotali: serieB2, libreria, livello, escluse, blocco: 2, giaScelti });
        sceltiB2.forEach((r) => { if (r.esercizio) giaScelti.push(r.esercizio.id); });
        righeBlocco2.push(...sceltiB2);

        const sceltiB3 = scegliEserciziBlocco({ gruppo, serieTotali: serieB3, libreria, livello, escluse, blocco: 3, giaScelti });
        sceltiB3.forEach((r) => { if (r.esercizio) giaScelti.push(r.esercizio.id); });
        righeBlocco3.push(...sceltiB3);
      }
      righeBlocco2 = righeBlocco2.slice(0, 2); // il metodo prevede max 1-2 complessi fondamentali per sessione
      righeBlocco3 = righeBlocco3.slice(0, 5); // max 3-5 accessori per sessione

      let ordine = 0;
      for (let i = 0; i < righeBlocco2.length; i++) {
        const { esercizio, serie, gruppoMancante } = righeBlocco2[i];
        if (!esercizio) {
          await supabase.from("scheda_esercizi").insert({ giorno_id: nuovoGiorno.id, nome_libero: `⚠️ Nessun compound trovato per "${gruppoMancante}" — aggiungi a mano`, ordine: ordine++, serie: String(serie), tecnica_auto: false });
          continue;
        }
        await supabase.from("scheda_esercizi").insert({
          giorno_id: nuovoGiorno.id, esercizio_id: esercizio.id, ordine: ordine++,
          serie: String(serie), ripetizioni: decidiRipetizioni(esercizio, livello, 2), recupero: decidiRecupero(2),
          tecnica: i === 0 ? tecBlocco2 : "", tecnica_auto: true, note: "Blocco forza (complesso fondamentale)",
        });
      }
      for (let i = 0; i < righeBlocco3.length; i++) {
        const { esercizio, serie, gruppoMancante } = righeBlocco3[i];
        if (!esercizio) {
          await supabase.from("scheda_esercizi").insert({ giorno_id: nuovoGiorno.id, nome_libero: `⚠️ Nessun accessorio trovato per "${gruppoMancante}" — aggiungi a mano`, ordine: ordine++, serie: String(serie), tecnica_auto: false });
          continue;
        }
        const isUltimo = i === righeBlocco3.length - 1;
        await supabase.from("scheda_esercizi").insert({
          giorno_id: nuovoGiorno.id, esercizio_id: esercizio.id, ordine: ordine++,
          serie: String(serie), ripetizioni: decidiRipetizioni(esercizio, livello, 3), recupero: decidiRecupero(3),
          tecnica: isUltimo ? tecBlocco3 : "", tecnica_auto: true, note: "Blocco accessorio",
        });
      }
    }
    setGenerando(false);
    setMostraGeneratore(false);
    await carica();
  };

  if (caricando) return <Spinner />;

  const checkOrdinati = [...checkins].sort((a, b) => b.data_check.localeCompare(a.data_check));
  const segnaliCheck = analizzaSegnaliCheck(checkOrdinati[0], checkOrdinati[1]);
  const isBozza = schedaCorrente?.stato === "bozza";


  return (
    <div className="space-y-5">
      <Card className="p-4 space-y-3">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Livello e fase</p>
        <div className="grid grid-cols-2 gap-3">
          <select defaultValue={client.livello_allenamento || ""} onBlur={(e) => salvaCliente({ livello_allenamento: e.target.value || null })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Livello...</option><option value="base">Base</option><option value="intermedia">Intermedia</option><option value="avanzata">Avanzata</option>
          </select>
          <input type="number" defaultValue={client.fase_allenamento || ""} onBlur={(e) => salvaCliente({ fase_allenamento: e.target.value ? Number(e.target.value) : null })} placeholder="Fase (numero)" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <select defaultValue={client.obiettivo_attuale || ""} onBlur={(e) => salvaCliente({ obiettivo_attuale: e.target.value || null })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Obiettivo attuale...</option><option value="definizione">Definizione</option><option value="mantenimento">Mantenimento</option><option value="massa">Massa</option>
        </select>
      </Card>

      <Card className="p-4 space-y-1.5 bg-slate-50">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Ricorda ad ogni sessione (fisso, non modificabile qui)</p>
        <p className="text-slate-600 text-xs"><strong>Riscaldamento 5-10':</strong> {RISCALDAMENTO_STANDARD.join(" · ")}</p>
        <p className="text-slate-600 text-xs"><strong>NEAT giornaliero:</strong> {targetPassiGiornalieri(client.livello_attivita)}</p>
      </Card>

      <Card className="p-4 space-y-3">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Problematiche articolari/salute da tenere conto</p>
        <div className="flex flex-wrap gap-2">
          {CONDIZIONI_SALUTE.map((c) => (
            <button key={c.value} onClick={() => toggleCondizione(c.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${(client.problematiche_salute || []).includes(c.value) ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600"}`}>
              {c.label}
            </button>
          ))}
        </div>
        <textarea value={condizioniAltroTesto} onChange={(e) => setCondizioniAltroTesto(e.target.value)} onBlur={salvaCondizioniAltro}
          placeholder="Altro (testo libero)..." rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        {(client.problematiche_salute || []).length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
            {CONDIZIONI_SALUTE.filter((c) => (client.problematiche_salute || []).includes(c.value)).map((c) => (
              <p key={c.value} className="text-amber-700 text-xs"><strong>{c.label}:</strong> {c.avviso}</p>
            ))}
          </div>
        )}
      </Card>

      {(!schedaCorrente || isBozza) && !mostraGeneratore && (
        <div className="flex gap-2">
          {!schedaCorrente && <button onClick={() => creaNuovaBozza(null)} className="flex-1 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl py-3">+ Scheda vuota (manuale)</button>}
          <button onClick={() => setMostraGeneratore(true)} className="flex-1 bg-slate-800 text-white text-sm font-medium rounded-xl py-3">✨ {isBozza ? "Rigenera con il generatore" : "Genera automaticamente"}</button>
        </div>
      )}

      {mostraGeneratore && (
        <Card className="p-4 space-y-4">
          <p className="text-sm font-medium text-slate-700">Genera scheda automatica</p>
          <p className="text-slate-500 text-xs">Livello: {client.livello_allenamento || "non impostato"} · Fase: {client.fase_allenamento || "—"} · Obiettivo: {client.obiettivo_attuale || "—"}</p>

          <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50">
            <div>
              <label className="text-xs text-slate-500">Focus di crescita (facoltativo — non significa allenare <em>solo</em> questi gruppi, ma dargli maggiore enfasi/volume rispetto agli altri)</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {Object.keys(VOLUME_LANDMARKS).map((gr) => (
                  <button key={gr} onClick={() => salvaCliente({ focus_crescita: (client.focus_crescita || []).includes(gr) ? (client.focus_crescita || []).filter((x) => x !== gr) : [...(client.focus_crescita || []), gr] })}
                    className={`px-2.5 py-1 rounded-full text-xs ${(client.focus_crescita || []).includes(gr) ? "bg-emerald-500 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
                    {gr}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 flex-1">Giorni di allenamento a settimana</label>
              <select value={numeroGiorniSettimana} onChange={(e) => setNumeroGiorniSettimana(Number(e.target.value))} className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center">
                {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button onClick={() => setGiorniGenerator(generaSplitAutomatica(numeroGiorniSettimana, client.focus_crescita))}
              className="w-full bg-slate-800 text-white text-xs font-medium rounded-lg py-2">
              🧠 Elabora la split migliore per questa cliente
            </button>
            <p className="text-slate-400 text-[11px]">Genera una proposta di split scientificamente sensata; puoi comunque modificarla liberamente qui sotto prima di generare la scheda.</p>
          </div>

          <div className="space-y-3">
            {giorniGenerator.map((g, idx) => (
              <div key={idx} className="border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input value={g.nome} onChange={(e) => rinominaGiornoGenerator(idx, e.target.value)} className="flex-1 border-0 bg-transparent font-medium text-sm focus:outline-none focus:bg-slate-50 rounded px-1 -mx-1" />
                  {giorniGenerator.length > 1 && <button onClick={() => rimuoviGiornoGenerator(idx)} className="text-slate-300 hover:text-rose-500"><X size={16} /></button>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {gruppiDisponibili.map((gr) => (
                    <button key={gr} onClick={() => toggleGruppoGiorno(idx, gr)}
                      className={`px-2.5 py-1 rounded-full text-xs ${g.gruppi.includes(gr) ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}>
                      {gr}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button onClick={aggiungiGiornoGenerator} className="w-full border border-dashed border-slate-300 text-slate-500 text-xs font-medium rounded-lg py-2">+ Giorno</button>

          {gruppiUsatiNelGeneratore.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Serie settimanali totali per gruppo</p>
              <p className="text-slate-400 text-xs">Precompilate in automatico da livello ({client.livello_allenamento || "non impostato"}) e soglie di volume; il totale viene diviso tra le sessioni in cui compare quel gruppo (max {SERIE_MAX_PER_SESSIONE}/seduta).</p>
              {gruppiUsatiNelGeneratore.map((gr) => {
                const occorrenze = giorniGenerator.filter((g) => g.gruppi.includes(gr)).length;
                const perSessione = Math.max(1, Math.round(Number(serieGruppi[gr] || 0) / occorrenze));
                const lm = VOLUME_LANDMARKS[gr];
                return (
                  <div key={gr} className="flex items-center gap-2">
                    <div className="flex-1">
                      <span className="text-sm text-slate-600 block">{gr}</span>
                      {lm && <span className="text-slate-400 text-[11px] block">MEV {lm.mev[0]}-{lm.mev[1]} · MAV {lm.mav[0]}-{lm.mav[1]} · MRV {lm.mrv[0]}-{lm.mrv[1]}</span>}
                      {occorrenze > 1 && <span className="text-slate-400 text-[11px]">≈ {perSessione} per sessione × {occorrenze} sessioni</span>}
                    </div>
                    <select value={serieGruppi[gr] || ""} onChange={(e) => setSerieGruppi((prev) => ({ ...prev, [gr]: e.target.value }))}
                      className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center">
                      {opzioniSerie.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={generaSchedaAutomatica} disabled={generando || gruppiUsatiNelGeneratore.length === 0} className="flex-1 bg-emerald-500 text-white text-sm font-medium rounded-xl py-2 disabled:opacity-50">
              {generando ? "Genero..." : "Genera bozza"}
            </button>
            <button onClick={() => setMostraGeneratore(false)} className="px-4 rounded-xl border border-slate-200 text-sm text-slate-500">Annulla</button>
          </div>
        </Card>
      )}

      {schedaCorrente && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">{isBozza ? "Bozza in corso" : "Scheda attuale (finale)"}</p>
            {!isBozza && (
              <div className="flex gap-3">
                <button onClick={() => setMostraGeneratore(true)} className="text-emerald-600 text-xs font-medium">✨ Genera fase successiva</button>
                <button onClick={() => creaNuovaBozza(schedaCorrente)} className="text-sky-600 text-xs font-medium">Duplica e modifica →</button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {schedaCorrente.giorni.map((g) => (
              isBozza ? (
                <GiornoScheda key={g.id} giorno={g} client={client} onEliminaGiorno={eliminaGiorno} onRinominaGiorno={rinominaGiorno} onMuoviGiorno={muoviGiorno} onEsercizioCambiato={() => calcolaTrend(libreria, aliasRows, schedaCorrente.giorni)} />
              ) : (
                <Card key={g.id} className="p-3">
                  <p className="font-semibold text-slate-800 mb-2">{g.nome}</p>
                  <div className="space-y-1 text-sm">
                    {g.esercizi.map((es) => (
                      <p key={es.id} className="text-slate-600">{es.esercizi_libreria?.nome || es.nome_libero} — {es.serie}x{es.ripetizioni} {es.carico ? `· ${es.carico}` : ""} {es.tecnica ? `· ${es.tecnica}` : ""}</p>
                    ))}
                  </div>
                </Card>
              )
            ))}
          </div>

          {isBozza && (
            <div className="flex gap-2">
              <button onClick={aggiungiGiorno} className="flex-1 border border-dashed border-slate-300 text-slate-500 text-sm font-medium rounded-xl py-2">+ Giorno</button>
              <button onClick={finalizzaScheda} className="flex-1 bg-emerald-500 text-white text-sm font-medium rounded-xl py-2">Finalizza scheda</button>
            </div>
          )}
          <button onClick={() => apriStampaScheda(client, schedaCorrente, trend, feedback)} className="w-full border border-slate-200 text-slate-600 text-sm font-medium rounded-xl py-2">Stampa / Salva PDF</button>
        </>
      )}

      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2 px-1">Segnali dai check</p>
        <Card className="p-4 space-y-2">
          <p className="text-sm text-slate-700">{segnaliCheck.segnale}</p>
          {segnaliCheck.avvisoDistanza && <p className="text-amber-600 text-xs">{segnaliCheck.avvisoDistanza}</p>}
          {calibrazioneCheck(checkOrdinati[0], checkOrdinati[1]).map((c, i) => (
            <p key={i} className="text-slate-600 text-xs border-t border-slate-100 pt-2 first:border-0 first:pt-0">{c}</p>
          ))}
        </Card>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2 px-1">Feedback soggettivo</p>
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {TAG_FEEDBACK.map((t) => (
              <button key={t.value} onClick={() => setTagSelezionati((prev) => prev.includes(t.value) ? prev.filter((x) => x !== t.value) : [...prev, t.value])}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${tagSelezionati.includes(t.value) ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <textarea value={notaFeedback} onChange={(e) => setNotaFeedback(e.target.value)} placeholder="Nota libera (facoltativa)" rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <button onClick={salvaFeedback} className="w-full bg-slate-800 text-white text-sm font-medium rounded-lg py-2">Salva feedback</button>
          {feedback.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              {feedback.map((f) => (
                <div key={f.id} className="text-xs text-slate-600">
                  <p className="font-medium">{f.data?.split("-").reverse().join("/")} — {(f.tags || []).map((t) => TAG_FEEDBACK.find((x) => x.value === t)?.label).join(", ")}</p>
                  {f.nota_libera && <p className="text-slate-500">{f.nota_libera}</p>}
                  {suggerimentiFeedback(f.tags || [], client.obiettivo_attuale).map((s, i) => <p key={i} className="text-sky-700">→ {s}</p>)}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {schede.filter((s) => s.stato === "finale").length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2 px-1">Storico schede finalizzate</p>
          <div className="space-y-1">
            {schede.filter((s) => s.stato === "finale").map((s) => (
              <Card key={s.id} className="p-3 text-sm text-slate-600">Finalizzata il {new Date(s.finalizzata_il).toLocaleDateString("it-IT")}</Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

async function esportaDatiCliente(client, setInCorso) {
  setInCorso(true);
  const cid = client.id;
  const [
    { data: checkins }, { data: notes }, { data: nutrizione }, { data: giorniLog }, { data: eserciziLog },
    { data: entriesLog }, { data: lezioni }, { data: pagamenti }, { data: schede }, { data: feedback },
  ] = await Promise.all([
    supabase.from("checkins").select("*").eq("client_id", cid).order("data_check"),
    supabase.from("notes").select("*").eq("client_id", cid).order("data"),
    supabase.from("nutrition_plans").select("*").eq("client_id", cid).order("data_aggiornamento"),
    supabase.from("training_days").select("*").eq("client_id", cid).order("ordine"),
    supabase.from("training_exercises").select("*").eq("client_id", cid).order("ordine"),
    supabase.from("training_entries").select("*").eq("client_id", cid).order("data"),
    supabase.from("lezioni_svolte").select("*").eq("client_id", cid).order("numero"),
    supabase.from("payments").select("*").eq("client_id", cid).order("data_pagamento"),
    supabase.from("schede").select("*").eq("client_id", cid).order("creata_il", { ascending: false }),
    supabase.from("feedback_soggettivo").select("*").eq("client_id", cid).order("data"),
  ]);

  const schedeComplete = [];
  for (const s of schede || []) {
    const { data: giorni } = await supabase.from("scheda_giorni").select("*").eq("scheda_id", s.id).order("ordine");
    const giorniConEs = [];
    for (const g of giorni || []) {
      const { data: es } = await supabase.from("scheda_esercizi").select("*, esercizi_libreria(nome)").eq("giorno_id", g.id).order("ordine");
      giorniConEs.push({ ...g, esercizi: es || [] });
    }
    schedeComplete.push({ ...s, giorni: giorniConEs });
  }

  const r = [];
  r.push(`# Dati completi — ${client.nome} ${client.cognome}`);
  r.push(`Esportato il ${new Date().toLocaleDateString("it-IT")}`);
  r.push("");
  r.push("## Anagrafica");
  r.push(`- Codice: ${client.codice || "-"}`);
  r.push(`- Email: ${client.email || "-"} · Telefono: ${client.telefono || "-"}`);
  r.push(`- Sesso: ${client.sesso || "-"} · Età: ${client.eta || "-"} · Data nascita: ${client.data_nascita || "-"} · Altezza: ${client.altezza_cm || "-"} cm`);
  r.push(`- Tipo servizio: ${client.tipo_servizio || "-"} · Piano: ${client.piano || "-"}`);
  r.push(`- Livello attività: ${client.livello_attivita || "-"}`);
  r.push(`- Livello allenamento: ${client.livello_allenamento || "-"} · Fase: ${client.fase_allenamento || "-"} · Obiettivo: ${client.obiettivo_attuale || "-"}`);
  r.push(`- Focus di crescita: ${(client.focus_crescita || []).join(", ") || "-"}`);
  r.push(`- Problematiche di salute: ${(client.problematiche_salute || []).join(", ") || "-"}${client.problematiche_salute_note ? " — " + client.problematiche_salute_note : ""}`);
  r.push(`- Note particolari: ${client.note_particolari || "-"}`);
  r.push("");

  r.push("## Check nel tempo");
  (checkins || []).forEach((c) => {
    r.push(`### ${c.data_check}`);
    r.push(`Peso: ${c.peso_kg ?? "-"} kg · Petto: ${c.petto_cm ?? "-"} · Vita: ${c.ombelico_cm ?? "-"} · Glutei: ${c.glutei_cm ?? "-"} · Coscia: ${c.coscia_dx_cm ?? "-"} · Braccio: ${c.braccio_dx_cm ?? "-"}`);
    if (c.note_cliente) r.push(`Nota cliente: ${c.note_cliente}`);
  });
  r.push("");

  r.push("## Note");
  (notes || []).forEach((n) => r.push(`- [${n.data}] (${n.tipo}) ${n.testo}`));
  r.push("");

  r.push("## Nutrizione");
  (nutrizione || []).forEach((n) => r.push(`- [${n.data_aggiornamento}] ${n.kcal ?? "-"} kcal · P ${n.proteine_g ?? "-"}g · C ${n.carboidrati_g ?? "-"}g · G ${n.grassi_g ?? "-"}g${n.note ? " — " + n.note : ""}`));
  r.push("");

  r.push("## Diario allenamento (log carichi)");
  (giorniLog || []).forEach((g) => {
    r.push(`### ${g.nome}`);
    (eserciziLog || []).filter((e) => e.training_day_id === g.id).forEach((e) => {
      r.push(`- ${e.nome}: ${e.serie ?? "-"}x${e.ripetizioni ?? "-"}`);
      (entriesLog || []).filter((en) => en.exercise_id === e.id).forEach((en) => r.push(`  - ${en.data}: ${en.kg ?? "-"}kg`));
    });
  });
  r.push("");

  if ((lezioni || []).length) {
    r.push("## Lezioni (pacchetto)");
    lezioni.forEach((l) => r.push(`- #${l.numero}: ${l.fatta ? "fatta" : "da fare"}${l.data ? ` il ${l.data} ${l.ora || ""}` : ""}`));
    r.push("");
  }

  r.push("## Schede di allenamento (attuale e storico)");
  schedeComplete.forEach((s) => {
    r.push(`### Scheda ${s.stato} (creata il ${(s.creata_il || "").slice(0, 10)})`);
    s.giorni.forEach((g) => {
      r.push(`**${g.nome}**`);
      g.esercizi.forEach((es) => r.push(`- ${es.esercizi_libreria?.nome || es.nome_libero}: ${es.serie ?? "-"}x${es.ripetizioni ?? "-"}${es.tecnica ? " · " + es.tecnica : ""}`));
    });
  });
  r.push("");

  if ((feedback || []).length) {
    r.push("## Feedback soggettivo");
    feedback.forEach((f) => r.push(`- [${f.data}] ${(f.tags || []).join(", ")}${f.nota_libera ? " — " + f.nota_libera : ""}`));
    r.push("");
  }

  if ((pagamenti || []).length) {
    r.push("## Pagamenti");
    pagamenti.forEach((p) => r.push(`- ${p.data_pagamento}: ${p.tipo_piano}${p.importo != null ? ` — ${p.importo}€` : ""}${p.metodo_pagamento ? ` (${p.metodo_pagamento})` : ""}${p.stato ? ` [${p.stato}]` : ""}`));
  }

  scaricaFile(`dati-${client.cognome || ""}-${client.nome || ""}-${new Date().toISOString().slice(0, 10)}.md`, r.join("\n"), "text/markdown");
  setInCorso(false);
}

function AdminClientDetail({ clientId, onBack, onChanged }) {
  const [client, setClient] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [notes, setNotes] = useState([]);
  const [nutrizione, setNutrizione] = useState(null);
  const [nutrizioneStorico, setNutrizioneStorico] = useState([]);
  const [pagamenti, setPagamenti] = useState([]);
  const [tab, setTab] = useState("riepilogo");
  const [esportazioneInCorso, setEsportazioneInCorso] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mostraCheckForm, setMostraCheckForm] = useState(false);
  const [checkInModifica, setCheckInModifica] = useState(null);
  const [mostraNotaForm, setMostraNotaForm] = useState(false);
  const [nutrizioneModifica, setNutrizioneModifica] = useState(null);

  const carica = async () => {
    const { data: c } = await supabase.from("clients").select("*").eq("id", clientId).single();
    setClient(c);
    const { data: ck } = await supabase.from("checkins").select("*").eq("client_id", clientId).order("data_check", { ascending: false });
    setCheckins(ck || []);
    const { data: nt } = await supabase.from("notes").select("*").eq("client_id", clientId).order("data", { ascending: false });
    setNotes(nt || []);
    const { data: nu } = await supabase.from("nutrition_plans").select("*").eq("client_id", clientId).order("data_aggiornamento", { ascending: false }).limit(1).maybeSingle();
    setNutrizione(nu);
    const { data: nuStorico } = await supabase.from("nutrition_plans").select("*").eq("client_id", clientId).order("data_aggiornamento", { ascending: true });
    setNutrizioneStorico(nuStorico || []);
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
  const isBulb = client.tipo_servizio === "presenza" || client.tipo_servizio === "ibrido";
  const isOnline = client.tipo_servizio === "online" || client.tipo_servizio === "ibrido";
  const tabs = [
    { key: "riepilogo", label: "Riepilogo" },
    { key: "dati", label: "Dati" },
    ...(isOnline ? [{ key: "check", label: "Check" }] : []), // tab "Scheda" congelato temporaneamente (workflow spostato su CSV esterno)
    ...(isBulb && client.pacchetto_lezioni !== "1" ? [{ key: "lezioni", label: "Lezioni" }] : []),
    { key: "progressi", label: "Progressi" },
    { key: "allenamento", label: "Allenamento" },
    { key: "nutrizione", label: "Nutrizione" },
    { key: "note", label: "Note" },
  ];

  return (
    <div className="px-6 pt-6 pb-16 max-w-3xl mx-auto space-y-5 overflow-x-hidden">
      <button onClick={onBack} className="flex items-center gap-1 text-slate-500 text-sm"><ArrowLeft size={16} /> Tutti i clienti</button>
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold text-slate-800">{client.nome} {client.cognome}</h1><p className="text-slate-500 text-sm">{client.codice}</p></div>
        <div className="flex items-center gap-2">
          <button onClick={() => esportaDatiCliente(client, setEsportazioneInCorso)} disabled={esportazioneInCorso} className="text-slate-400 text-xs disabled:opacity-50">
            {esportazioneInCorso ? "Esporto..." : "📄 Esporta dati"}
          </button>
          <StatoBadge stato={client.stato_check} />
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-6 px-6">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex-shrink-0 ${tab === t.key ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>{t.label}</button>
        ))}
      </div>

      {tab === "riepilogo" && <RiepilogoCliente client={client} checkins={checkins} onVaiADati={() => setTab("dati")} />}

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
              <option value="Variabile">Variabile</option>
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
            <label className="text-slate-400 text-xs">Tipo di servizio</label>
            <select defaultValue={client.tipo_servizio || "online"} onBlur={(e) => salvaCliente({ tipo_servizio: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
              <option value="online">ONLINE (coaching a distanza)</option>
              <option value="presenza">BULB (lezioni 1:1 in presenza)</option>
              <option value="ibrido">IBRIDO (online + BULB)</option>
            </select>
          </div>
          {(client.tipo_servizio === "presenza" || client.tipo_servizio === "ibrido") && (
            <div className="col-span-2">
              <label className="text-slate-400 text-xs">Pacchetto lezioni</label>
              <select defaultValue={client.pacchetto_lezioni || ""} onBlur={(e) => salvaCliente({ pacchetto_lezioni: e.target.value || null })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
                <option value="">—</option>
                <option value="1">1 lezione</option>
                <option value="4">4 lezioni (1 al mese)</option>
                <option value="8">8 lezioni (2 al mese)</option>
                <option value="10">10 lezioni</option>
                <option value="24">24 lezioni (6 mesi, 1 a settimana)</option>
                <option value="48">48 lezioni (6 mesi, 2 a settimana)</option>
              </select>
              <p className="text-slate-400 text-[11px] mt-1">Vale solo per impostare il primo pacchetto. Per aggiungere lezioni a un pacchetto già avviato o iniziarne uno nuovo dopo il completamento, usa il tab "Lezioni".</p>
            </div>
          )}
          {(client.tipo_servizio === "presenza" || client.tipo_servizio === "ibrido") && (
            <div className="col-span-2">
              <label className="text-slate-400 text-xs">Sede abituale</label>
              <select defaultValue={client.sede_abituale || ""} onBlur={(e) => salvaCliente({ sede_abituale: e.target.value || null })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
                <option value="">—</option>
                {LUOGHI.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          )}
          {client.tipo_servizio === "presenza" && (
            <div className="col-span-2 flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
              <span className="text-sm text-slate-700">Diario allenamento visibile alla cliente</span>
              <button onClick={() => salvaCliente({ log_visibile_cliente: !client.log_visibile_cliente })}
                className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors ${client.log_visibile_cliente ? "bg-emerald-500 justify-end" : "bg-slate-300 justify-start"}`}>
                <span className="w-5 h-5 bg-white rounded-full block" />
              </button>
            </div>
          )}
          <div className="col-span-2 flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
            <span className="text-sm text-slate-700">Sezione nutrizione visibile alla cliente</span>
            <button onClick={() => salvaCliente({ nutrizione_attiva: client.nutrizione_attiva === false })}
              className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors ${client.nutrizione_attiva !== false ? "bg-emerald-500 justify-end" : "bg-slate-300 justify-start"}`}>
              <span className="w-5 h-5 bg-white rounded-full block" />
            </button>
          </div>
          <div className="col-span-2">
            <label className="text-slate-400 text-xs">Data inizio</label>
            <InputData defaultValue={client.data_inizio || ""} onBlur={(e) => salvaCliente({ data_inizio: e.target.value || null })}
              className="mt-1" />
          </div>
          <div className="col-span-2">
            <label className="text-slate-400 text-xs">Data scadenza</label>
            <InputData defaultValue={client.data_scadenza || ""} onBlur={(e) => salvaCliente({ data_scadenza: e.target.value || null })}
              className="mt-1" />
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
            <label className="text-slate-400 text-xs">Età {client.data_nascita && `(calcolata: ${calcolaEta(client.data_nascita)})`}</label>
            <input type="number" defaultValue={client.eta || ""} onBlur={(e) => salvaCliente({ eta: e.target.value ? Number(e.target.value) : null })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" placeholder={client.data_nascita ? "sovrascrive il calcolo" : ""} />
          </div>
          <div className="col-span-2">
            <label className="text-slate-400 text-xs">Data di nascita (compilabile anche dalla cliente)</label>
            <InputData defaultValue={client.data_nascita || ""} onBlur={(e) => salvaCliente({ data_nascita: e.target.value || null })}
              className="mt-1" />
          </div>
          <div className="col-span-2">
            <label className="text-slate-400 text-xs">Tipo di lavoro / attività quotidiana</label>
            <select defaultValue={client.livello_attivita || ""} onBlur={(e) => salvaCliente({ livello_attivita: e.target.value || null })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">—</option>
              <option value="sedentario">Sedentario (meno di 5.000 passi/giorno)</option>
              <option value="intermedio">Intermedio (circa 8.000 passi/giorno)</option>
              <option value="attivo">Attivo (oltre 10.000 passi/giorno)</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-slate-400 text-xs">Segni particolari</label>
            <textarea defaultValue={client.note_particolari || ""} onBlur={(e) => salvaCliente({ note_particolari: e.target.value || null })} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div className="col-span-2">
            <label className="text-slate-400 text-xs">Prossimo check</label>
            <InputData defaultValue={client.prossimo_check || ""} onBlur={(e) => salvaCliente({ prossimo_check: e.target.value || null })}
              className="mt-1" />
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
            <FatturazioneCliente clientId={clientId} />
          </div>
          <div className="col-span-2">
            <RegistraPagamento client={client} pagamenti={pagamenti} onRegistrato={carica} />
          </div>
          {salvando && <p className="text-slate-400 text-xs col-span-2">Salvataggio...</p>}
          <div className="col-span-2 border-t border-slate-100 pt-4 space-y-3">
            {client.user_id && (
              <p className="text-emerald-600 text-sm flex items-center gap-1"><CheckCircle2 size={16} /> Accesso attivo ({client.email})</p>
            )}
            <InvitaClienteForm client={client} onInvitato={carica} />
          </div>
          <div className="col-span-2 border-t border-slate-100 pt-4">
            <EliminaClienteBottone client={client} onEliminato={() => { onBack(); onChanged?.(); }} />
          </div>
        </Card>
      )}

      {tab === "lezioni" && <LezioniPacchetto client={client} onCompletato={carica} />}

      {tab === "scheda" && <SchedaCoach client={client} checkins={checkins} salvaCliente={salvaCliente} />}

      {tab === "check" && (
        <div className="space-y-3">
          {!mostraCheckForm && !checkInModifica && (
            <button onClick={() => setMostraCheckForm(true)} className="w-full bg-slate-800 text-white text-sm font-medium rounded-xl py-2">+ Aggiungi check</button>
          )}
          {mostraCheckForm && (
            <NuovoCheckForm clientId={clientId} sesso={client.sesso} onAnnulla={() => setMostraCheckForm(false)} onSalvato={() => { setMostraCheckForm(false); carica(); }} />
          )}
          {checkInModifica && (
            <NuovoCheckForm clientId={clientId} sesso={client.sesso} checkin={checkInModifica}
              onAnnulla={() => setCheckInModifica(null)} onSalvato={() => { setCheckInModifica(null); carica(); }} />
          )}
          {!mostraCheckForm && !checkInModifica && (
            <Card className="p-4">
              <ul className="space-y-2">
                {checkins.map((r) => (
                  <li key={r.id} className="border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCheckInModifica(r)} className="flex-1 min-w-0 flex justify-between items-center text-sm text-left">
                        <span className="text-slate-600">{r.data_check}</span>
                        <span className="text-slate-700">{r.peso_kg ? `${r.peso_kg} kg` : "—"}</span>
                        <StatoBadge stato={r.stato} />
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Eliminare il check del ${r.data_check}? L'operazione non è reversibile.`)) return;
                          await supabase.from("checkins").delete().eq("id", r.id);
                          carica();
                        }}
                        className="flex-shrink-0 text-slate-300 hover:text-rose-500 p-1"
                        title="Elimina check"
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <FotoCheck checkin={r} />
                  </li>
                ))}
                {checkins.length === 0 && <p className="text-slate-400 text-sm">Nessun check ancora.</p>}
              </ul>
            </Card>
          )}
        </div>
      )}

      {tab === "progressi" && <ClientProgress checkins={checkins} altezza={client.altezza_cm} sesso={client.sesso} eta={calcolaEta(client.data_nascita) ?? client.eta} obiettivo={client.obiettivo_attuale} titolo="Progressi e storico check" />}

      {tab === "allenamento" && <DiarioAllenamento clientId={clientId} isAdmin />}

      {tab === "nutrizione" && (
        <div className="space-y-3">
          <NutrizioneForm clientId={clientId} ultimo={nutrizione} onSalvato={carica}
            modifica={nutrizioneModifica} onAnnullaModifica={() => setNutrizioneModifica(null)} />
          <StoricoNutrizione storico={nutrizioneStorico} isAdmin onModifica={setNutrizioneModifica} />
        </div>
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
  const [f, setF] = useState({ codice: "", nome: "", cognome: "", tipo_servizio: "online", pacchetto_lezioni: "", piano: "", data_inizio: "", data_scadenza: "", stato_pacchetto: "attivo", link_scheda: "", altezza_cm: "" });
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
    payload.pacchetto_lezioni = payload.pacchetto_lezioni || null;
    for (const k of ["data_inizio", "data_scadenza"]) if (!payload[k]) payload[k] = null;
    const { error } = await supabase.from("clients").insert(payload);
    setSalvando(false);
    if (error) { setErrore("Errore: " + error.message); return; }
    onCreato();
  };

  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700">Nuovo cliente</p>
      <div>
        <label className="text-xs text-slate-500">Tipo di servizio</label>
        <select value={f.tipo_servizio} onChange={(e) => setF({ ...f, tipo_servizio: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
          <option value="online">ONLINE (coaching a distanza)</option>
          <option value="presenza">BULB (lezioni 1:1 in presenza)</option>
          <option value="ibrido">IBRIDO (online + BULB)</option>
        </select>
      </div>
      {(f.tipo_servizio === "presenza" || f.tipo_servizio === "ibrido") && (
        <div>
          <label className="text-xs text-slate-500">Pacchetto lezioni</label>
          <select value={f.pacchetto_lezioni} onChange={(e) => setF({ ...f, pacchetto_lezioni: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
            <option value="">— (lo imposti dopo)</option>
            <option value="1">1 lezione</option>
            <option value="4">4 lezioni (1 al mese)</option>
            <option value="8">8 lezioni (2 al mese)</option>
            <option value="10">10 lezioni</option>
            <option value="24">24 lezioni (6 mesi, 1 a settimana)</option>
            <option value="48">48 lezioni (6 mesi, 2 a settimana)</option>
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {campo("Codice (es. c10)", "codice")}
        {campo("Nome", "nome")}
        {campo("Cognome", "cognome")}
        {(f.tipo_servizio === "online" || f.tipo_servizio === "ibrido") && campo("Piano", "piano")}
        {campo("Data inizio", "data_inizio", "date")}
        {campo("Data scadenza", "data_scadenza", "date")}
        {campo("Altezza (cm)", "altezza_cm", "number")}
      </div>
      {(f.tipo_servizio === "online" || f.tipo_servizio === "ibrido") && campo("Link scheda", "link_scheda")}
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

const MESI = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const COLORE_TIPO = { check: "bg-sky-500", scadenza: "bg-amber-500", lezione: "bg-violet-500", call: "bg-teal-500", personale: "bg-fuchsia-500", messaggi: "bg-cyan-400", promemoria: "bg-orange-500" };
const ORDINE_TIPO_DOT = { check: 0, scadenza: 1, lezione: 2, call: 3, personale: 4, promemoria: 5, messaggi: 6 };
const SUGGERIMENTI_PERSONALE = ["Allenamento", "Impegno personale", "Amministrazione", "Contenuti social"];

function NuovoEventoForm({ clients, onSalvato, onAnnulla }) {
  const [f, setF] = useState({
    client_id: clients[0]?.id || "", tipo: "lezione", data: new Date().toISOString().slice(0, 10),
    ora: SLOT_ORARI[6], luogo: LUOGHI[0], nota: "", titolo: "",
  });
  const [salvando, setSalvando] = useState(false);

  const salva = async () => {
    if (f.tipo === "personale" ? !f.titolo.trim() : !f.client_id) return;
    setSalvando(true);
    const payload = f.tipo === "personale"
      ? { tipo: "personale", data: f.data, ora: f.ora || null, titolo: f.titolo.trim(), nota: f.nota || null, stato: "confermato" }
      : { client_id: f.client_id, tipo: f.tipo, data: f.data, ora: f.ora || null, nota: f.nota || null, luogo: f.tipo === "lezione" ? f.luogo : null, stato: "confermato" };
    const { data: creato } = await supabase.from("calendar_events").insert(payload).select().single();
    if (creato && f.tipo === "lezione") await collegaLezionePacchetto(f.client_id, creato);
    setSalvando(false);
    onSalvato();
  };

  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700">Nuovo evento</p>
      <div className="flex gap-2">
        <button onClick={() => setF({ ...f, tipo: "lezione" })} className={`flex-1 py-2 rounded-lg text-sm ${f.tipo === "lezione" ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600"}`}>Lezione 1:1</button>
        <button onClick={() => setF({ ...f, tipo: "call" })} className={`flex-1 py-2 rounded-lg text-sm ${f.tipo === "call" ? "bg-teal-500 text-white" : "bg-slate-100 text-slate-600"}`}>Call</button>
        <button onClick={() => setF({ ...f, tipo: "personale" })} className={`flex-1 py-2 rounded-lg text-sm ${f.tipo === "personale" ? "bg-fuchsia-500 text-white" : "bg-slate-100 text-slate-600"}`}>Personale/extra</button>
      </div>
      {f.tipo === "personale" ? (
        <div>
          <label className="text-xs text-slate-500">Titolo attività</label>
          <input value={f.titolo} onChange={(e) => setF({ ...f, titolo: e.target.value })} placeholder="Es. Allenamento"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {SUGGERIMENTI_PERSONALE.map((s) => (
              <button key={s} onClick={() => setF({ ...f, titolo: s })} className="text-[11px] bg-slate-100 text-slate-600 rounded-full px-2.5 py-1">{s}</button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <label className="text-xs text-slate-500">Cliente</label>
          <select value={f.client_id} onChange={(e) => setF({ ...f, client_id: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
            {clients.map((c) => <option key={c.id} value={c.id}>{c.nome} {c.cognome}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <InputData value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
        <select value={f.ora} onChange={(e) => setF({ ...f, ora: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
          {SLOT_ORARI.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {f.tipo === "lezione" && (
        <div>
          <label className="text-xs text-slate-500">Sede</label>
          <select value={f.luogo} onChange={(e) => setF({ ...f, luogo: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
            {LUOGHI.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      )}
      <textarea placeholder="Nota (facoltativa)" value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      <div className="flex gap-2">
        <button onClick={salva} disabled={salvando} className="flex-1 bg-slate-800 text-white rounded-xl py-2 text-sm font-medium">{salvando ? "Salvo..." : "Salva evento"}</button>
        <button onClick={onAnnulla} className="px-4 rounded-xl border border-slate-200 text-sm text-slate-500">Annulla</button>
      </div>
    </Card>
  );
}

function EditEventoForm({ evento, onSalvato, onAnnulla }) {
  const [f, setF] = useState({
    data: evento.data, ora: evento.ora ? evento.ora.slice(0, 5) : "", luogo: evento.luogo || "",
    stato: evento.stato, titolo: evento.titolo || "", nota: evento.nota || "",
  });
  const [salvando, setSalvando] = useState(false);
  const isPersonale = evento.tipo === "personale";

  const salva = async () => {
    setSalvando(true);
    const payload = isPersonale
      ? { data: f.data, ora: f.ora || null, titolo: f.titolo.trim() || evento.titolo, nota: f.nota || null }
      : { data: f.data, ora: f.ora || null, luogo: f.luogo || null, stato: f.stato };
    await supabase.from("calendar_events").update(payload).eq("id", evento.id);
    setSalvando(false);
    onSalvato();
  };
  const elimina = async () => {
    if (!confirm("Eliminare definitivamente questo evento?")) return;
    setSalvando(true);
    await supabase.from("calendar_events").delete().eq("id", evento.id);
    setSalvando(false);
    onSalvato();
  };

  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700">
        Modifica evento ({evento.tipo === "lezione" ? "Lezione 1:1" : evento.tipo === "call" ? "Call" : "Personale/extra"})
      </p>
      {isPersonale && (
        <input value={f.titolo} onChange={(e) => setF({ ...f, titolo: e.target.value })} placeholder="Titolo attività"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      )}
      <div className="grid grid-cols-2 gap-3">
        <InputData value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
        <select value={f.ora} onChange={(e) => setF({ ...f, ora: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <option value="">--:--</option>
          {SLOT_ORARI.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {evento.tipo === "lezione" && (
        <select value={f.luogo} onChange={(e) => setF({ ...f, luogo: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <option value="">— sede —</option>
          {LUOGHI.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      )}
      {isPersonale ? (
        <textarea placeholder="Nota (facoltativa)" value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      ) : (
        <select value={f.stato} onChange={(e) => setF({ ...f, stato: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <option value="richiesta">Da confermare</option>
          <option value="confermato">Confermato</option>
          <option value="annullata">Annullato</option>
          <option value="persa">Persa</option>
        </select>
      )}
      <div className="flex gap-2">
        <button onClick={salva} disabled={salvando} className="flex-1 bg-slate-800 text-white rounded-xl py-2 text-sm font-medium">{salvando ? "Salvo..." : "Salva modifiche"}</button>
        <button onClick={onAnnulla} className="px-4 rounded-xl border border-slate-200 text-sm text-slate-500">Chiudi</button>
      </div>
      <button onClick={elimina} className="w-full text-rose-500 text-xs font-medium">Elimina evento</button>
    </Card>
  );
}

function CalendarioAgenda({ clients, onSelect }) {
  const oggi = new Date();
  const [mese, setMese] = useState(oggi.getMonth());
  const [anno, setAnno] = useState(oggi.getFullYear());
  const [giornoFiltro, setGiornoFiltro] = useState(null);
  const [eventiCalendario, setEventiCalendario] = useState([]);
  const [promemoriaRighe, setPromemoriaRighe] = useState([]);
  const [mostraForm, setMostraForm] = useState(false);
  const [eventoInModifica, setEventoInModifica] = useState(null);

  const caricaEventi = async () => {
    const { data } = await supabase.from("calendar_events").select("*, clients(nome, cognome)").order("data");
    setEventiCalendario(data || []);
    const { data: pr } = await supabase.from("promemoria_messaggi").select("client_id, settimana, inviato");
    setPromemoriaRighe(pr || []);
  };
  useEffect(() => { caricaEventi(); }, []);

  const primoDelMese = new Date(anno, mese, 1);
  const giorniNelMese = new Date(anno, mese + 1, 0).getDate();
  const offset = (primoDelMese.getDay() + 6) % 7;

  const dataStr = (g) => `${anno}-${String(mese + 1).padStart(2, "0")}-${String(g).padStart(2, "0")}`;

  const domenicaDi = (ds) => {
    // La settimana del promemoria messaggi inizia (e si azzera) la domenica.
    const d = new Date(ds + "T00:00:00");
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().slice(0, 10);
  };

  const eventi = [];
  clients.forEach((c) => {
    if (c.tipo_servizio !== "presenza" && c.prossimo_check) eventi.push({ data: c.prossimo_check, ora: null, tipo: "check", nome: `${c.nome} ${c.cognome}`, label: "Check da fare", clientId: c.id });
    if (c.data_scadenza && c.stato_pacchetto !== "scaduto") eventi.push({ data: c.data_scadenza, ora: null, tipo: "scadenza", nome: `${c.nome} ${c.cognome}`, label: "Pacchetto in scadenza", clientId: c.id });
  });
  eventiCalendario.forEach((e) => {
    if (e.tipo === "personale") {
      const pezzi = [];
      if (e.stato === "annullata") pezzi.push("annullata");
      if (e.nota) pezzi.push(e.nota);
      eventi.push({ id: e.id, raw: e, data: e.data, ora: e.ora ? e.ora.slice(0, 5) : null, tipo: "personale", nome: e.titolo || "Attività personale", label: pezzi.join(" — "), clientId: null });
      return;
    }
    const nomeCliente = e.clients ? `${e.clients.nome} ${e.clients.cognome}` : "Cliente";
    const pezzi = [e.tipo === "lezione" ? "Lezione 1:1" : "Call"];
    if (e.luogo) pezzi.push(e.luogo);
    if (e.stato === "richiesta") pezzi.push("da confermare");
    if (e.stato === "annullata") pezzi.push("annullata");
    if (e.stato === "persa") pezzi.push("persa");
    if (e.fuori_disponibilita) pezzi.push("eccezione (fuori orario standard)");
    if (e.extra_euro) pezzi.push(`+${e.extra_euro}€ da riscuotere`);
    if (e.nota) pezzi.push(e.nota);
    eventi.push({ id: e.id, raw: e, data: e.data, ora: e.ora ? e.ora.slice(0, 5) : null, tipo: e.tipo, nome: nomeCliente, label: pezzi.join(" — "), clientId: e.client_id });

    // Promemoria automatico 48h prima di una lezione in presenza: ricordati di scrivere alla cliente
    if (e.tipo === "lezione" && e.stato !== "annullata" && e.stato !== "persa") {
      const dataPromemoria = addGiorni(e.data, -2);
      eventi.push({
        data: dataPromemoria, ora: null, tipo: "promemoria", nome: `Scrivi a ${nomeCliente}`,
        label: `Ricorda la lezione del ${e.data.split("-").reverse().join("/")}${e.ora ? " alle " + e.ora.slice(0, 5) : ""}`,
        clientId: e.client_id,
      });
    }
  });

  // Fasce fisse dedicate ai messaggi clienti, dal lunedì al venerdì (no weekend)
  for (let g = 1; g <= giorniNelMese; g++) {
    const ds = dataStr(g);
    const giornoSettimana = new Date(ds + "T00:00:00").getDay(); // 0 = domenica ... 6 = sabato
    const feriale = giornoSettimana >= 1 && giornoSettimana <= 5;
    if (feriale) {
      eventi.push({ data: ds, ora: "08:00", tipo: "messaggi", nome: "Messaggi clienti", label: "Finestra dedicata ai messaggi (08:00–09:00)", clientId: null });
      eventi.push({ data: ds, ora: "18:00", tipo: "messaggi", nome: "Messaggi clienti", label: "Finestra dedicata ai messaggi (18:00–19:00)", clientId: null });
    }
    if (giornoSettimana === 5) {
      const settimana = domenicaDi(ds);
      const inviateSettimana = new Set(promemoriaRighe.filter((r) => r.settimana === settimana && r.inviato).map((r) => r.client_id));
      const mancanti = clients.filter((c) => !inviateSettimana.has(c.id));
      eventi.push({
        data: ds, ora: null, tipo: "promemoria", nome: "Promemoria di fine settimana",
        label: mancanti.length === 0 ? "Tutte le clienti contattate questa settimana" : `${mancanti.length} client${mancanti.length === 1 ? "e" : "i"} ancora da contattare: ${mancanti.map((c) => `${c.nome} ${c.cognome}`).join(", ")}`,
        clientId: null,
      });
    }
  }

  const eventiDelGiorno = (g) => eventi.filter((e) => e.data === dataStr(g));

  const cambiaMese = (delta) => {
    let m = mese + delta, a = anno;
    if (m < 0) { m = 11; a--; } else if (m > 11) { m = 0; a++; }
    setMese(m); setAnno(a);
    setGiornoFiltro(null);
  };

  const ordinaGiornoSingolo = (lista) => {
    const senzaOrario = lista.filter((e) => !e.ora);
    const conOrario = lista.filter((e) => e.ora).sort((a, b) => a.ora.localeCompare(b.ora));
    return [...senzaOrario, ...conOrario];
  };

  const eventiVisibili = giornoFiltro
    ? ordinaGiornoSingolo(eventiDelGiorno(giornoFiltro))
    : eventi.filter((e) => e.tipo !== "messaggi" && e.data >= oggi.toISOString().slice(0, 10)).sort((a, b) => a.data.localeCompare(b.data) || (a.ora || "").localeCompare(b.ora || "")).slice(0, 15);

  return (
    <div className="space-y-3">
      {!mostraForm && (
        <button onClick={() => setMostraForm(true)} className="w-full bg-slate-800 text-white text-sm font-medium rounded-xl py-2">+ Aggiungi evento (lezione, call o personale)</button>
      )}
      {mostraForm && <NuovoEventoForm clients={clients} onAnnulla={() => setMostraForm(false)} onSalvato={() => { setMostraForm(false); caricaEventi(); }} />}

      <div className="flex items-center justify-between">
        <button onClick={() => cambiaMese(-1)} className="text-slate-400 px-2">‹</button>
        <p className="text-sm font-medium text-slate-700">{MESI[mese]} {anno}</p>
        <button onClick={() => cambiaMese(1)} className="text-slate-400 px-2">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {["L", "M", "M", "G", "V", "S", "D"].map((d, i) => <div key={i} className="text-center text-[10px] text-slate-400">{d}</div>)}
        {Array.from({ length: offset }).map((_, i) => <div key={"pad" + i} />)}
        {Array.from({ length: giorniNelMese }).map((_, i) => {
          const g = i + 1;
          const evs = eventiDelGiorno(g);
          const isOggi = dataStr(g) === oggi.toISOString().slice(0, 10);
          const attivo = giornoFiltro === g;
          return (
            <button key={g} onClick={() => setGiornoFiltro(attivo ? null : g)}
              className={`aspect-square rounded-lg text-xs flex flex-col items-center justify-center gap-0.5 ${attivo ? "bg-slate-800 text-white" : isOggi ? "border border-sky-400 text-slate-700" : "text-slate-700"}`}>
              <span>{g}</span>
              {evs.length > 0 && (
                <span className="flex gap-0.5">
                  {[...evs].sort((a, b) => ORDINE_TIPO_DOT[a.tipo] - ORDINE_TIPO_DOT[b.tipo]).slice(0, 3).map((e, idx) => <span key={idx} className={`w-1.5 h-1.5 rounded-full ${COLORE_TIPO[e.tipo]}`} />)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 px-1 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500" /> Check</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Scadenza</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" /> Lezione 1:1</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-500" /> Call</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-fuchsia-500" /> Personale/extra</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Promemoria</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400" /> Messaggi clienti</span>
      </div>

      <div className="space-y-2 pt-2">
        {giornoFiltro && (
          <button onClick={() => setGiornoFiltro(null)} className="text-sky-600 text-xs font-medium">← Vedi tutte le prossime scadenze</button>
        )}
        {eventoInModifica && (
          <EditEventoForm evento={eventoInModifica} onAnnulla={() => setEventoInModifica(null)}
            onSalvato={() => { setEventoInModifica(null); caricaEventi(); }} />
        )}
        {eventiVisibili.length === 0 && <p className="text-slate-400 text-sm px-1">Nessun evento {giornoFiltro ? "in questo giorno" : "in programma"}.</p>}
        {eventiVisibili.map((e, i) => (
          <Card key={i} className="p-3 flex items-center gap-3">
            {e.clientId ? (
              <button onClick={() => onSelect(e.clientId)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${COLORE_TIPO[e.tipo]}`} />
                {e.ora && <span className="text-slate-500 text-xs font-medium w-10 flex-shrink-0">{e.ora}</span>}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-700 ">{e.nome}</p>
                  <p className="text-slate-500 text-xs ">{!giornoFiltro && e.data.split("-").reverse().join("/") + " — "}{e.label}</p>
                </div>
              </button>
            ) : (
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${COLORE_TIPO[e.tipo]}`} />
                {e.ora && <span className="text-slate-500 text-xs font-medium w-10 flex-shrink-0">{e.ora}</span>}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-700 ">{e.nome}</p>
                  <p className="text-slate-500 text-xs ">{!giornoFiltro && e.data.split("-").reverse().join("/") + " — "}{e.label}</p>
                </div>
              </div>
            )}
            {e.id && (
              <button onClick={() => setEventoInModifica(e.raw)} className="text-slate-300 hover:text-slate-600 flex-shrink-0 px-1">✎</button>
            )}
            {e.clientId && <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />}
          </Card>
        ))}
      </div>
    </div>
  );
}

function ProponiOrarioForm({ evento, onFatto, onAnnulla }) {
  const [data, setData] = useState(evento.data);
  const [ora, setOra] = useState(SLOT_ORARI[6]);
  const [luogo, setLuogo] = useState(evento.luogo || LUOGHI[0]);
  const [messaggio, setMessaggio] = useState("");
  const [salvando, setSalvando] = useState(false);

  const invia = async () => {
    setSalvando(true);
    await supabase.from("notifiche").insert({
      client_id: evento.client_id, tipo: "proposta_lezione", calendar_event_id: evento.id,
      proposta_data: data, proposta_ora: ora, proposta_luogo: luogo, messaggio: messaggio || null, stato: "inviata",
    });
    setSalvando(false);
    onFatto();
  };

  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700">Proponi un altro orario</p>
      <div className="grid grid-cols-2 gap-3">
        <InputData value={data} onChange={(e) => setData(e.target.value)} />
        <select value={ora} onChange={(e) => setOra(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
          {SLOT_ORARI.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <select value={luogo} onChange={(e) => setLuogo(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
        {LUOGHI.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>
      <textarea placeholder="Messaggio (facoltativo)" value={messaggio} onChange={(e) => setMessaggio(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      <div className="flex gap-2">
        <button onClick={invia} disabled={salvando} className="flex-1 bg-slate-800 text-white rounded-xl py-2 text-sm font-medium">{salvando ? "Invio..." : "Invia proposta"}</button>
        <button onClick={onAnnulla} className="px-4 rounded-xl border border-slate-200 text-sm text-slate-500">Annulla</button>
      </div>
    </Card>
  );
}

function InviaNotaForm({ clients, onFatto }) {
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [messaggio, setMessaggio] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [fatto, setFatto] = useState(false);

  const invia = async () => {
    if (!clientId || !messaggio.trim()) return;
    setSalvando(true);
    await supabase.from("notifiche").insert({ client_id: clientId, tipo: "nota", messaggio, stato: "inviata" });
    setSalvando(false);
    setMessaggio("");
    setFatto(true);
    onFatto();
  };

  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700">Invia una nota a una cliente</p>
      <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
        {clients.map((c) => <option key={c.id} value={c.id}>{c.nome} {c.cognome}</option>)}
      </select>
      <textarea placeholder="Scrivi la nota..." value={messaggio} onChange={(e) => { setMessaggio(e.target.value); setFatto(false); }} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      <button onClick={invia} disabled={salvando} className="w-full bg-slate-800 text-white rounded-xl py-2 text-sm font-medium">{salvando ? "Invio..." : "Invia nota"}</button>
      {fatto && <p className="text-emerald-600 text-xs">Nota inviata!</p>}
    </Card>
  );
}

function domenicaSettimanaCorrente() {
  // Restituisce la domenica di inizio della settimana corrente: il promemoria messaggi
  // si azzera esattamente alla domenica (non al lunedì).
  const oggi = new Date();
  const diff = -oggi.getDay(); // getDay(): 0 = domenica ... 6 = sabato
  const domenica = new Date(oggi);
  domenica.setDate(oggi.getDate() + diff);
  return domenica.toISOString().slice(0, 10);
}

function PromemoriaMessaggi({ clients }) {
  const settimana = useMemo(() => domenicaSettimanaCorrente(), []);
  const [stato, setStato] = useState({});
  const [caricando, setCaricando] = useState(true);

  const carica = async () => {
    const { data } = await supabase.from("promemoria_messaggi").select("client_id, inviato").eq("settimana", settimana);
    const map = {};
    (data || []).forEach((r) => { map[r.client_id] = r.inviato; });
    setStato(map);
    setCaricando(false);
  };
  useEffect(() => { carica(); }, [settimana]);

  const toggle = async (clientId, attuale) => {
    const nuovo = !attuale;
    setStato((s) => ({ ...s, [clientId]: nuovo }));
    await supabase.from("promemoria_messaggi").upsert(
      { client_id: clientId, settimana, inviato: nuovo, data_invio: nuovo ? new Date().toISOString() : null },
      { onConflict: "client_id,settimana" }
    );
  };

  if (caricando) return <Spinner />;

  const bulb = clients.filter((c) => c.tipo_servizio === "presenza" || c.tipo_servizio === "ibrido");
  const online = clients.filter((c) => c.tipo_servizio === "online" || c.tipo_servizio === "ibrido");

  const Gruppo = ({ titolo, sottotitolo, elenco }) => {
    const mancanti = elenco.filter((c) => !stato[c.id]).length;
    return (
      <div>
        <div className="flex items-baseline justify-between px-1 mb-2">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">{titolo}</p>
          <span className="text-[11px] text-slate-400">{sottotitolo}</span>
        </div>
        <Card className="p-1 divide-y divide-slate-100">
          {elenco.length === 0 && <p className="text-center text-slate-400 text-sm py-3">Nessuna cliente in questo gruppo.</p>}
          {elenco.map((c) => {
            const fatto = !!stato[c.id];
            return (
              <button key={c.id} onClick={() => toggle(c.id, fatto)} className="w-full flex items-center gap-3 px-2 py-2.5 text-left">
                <span className={`flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center ${fatto ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`}>
                  {fatto && <Check size={13} className="text-white" />}
                </span>
                <span className={`flex-1 text-sm ${fatto ? "text-slate-400 line-through" : "text-slate-700 font-medium"}`}>{c.nome} {c.cognome}</span>
                {!fatto && <span className="text-[10px] font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 flex-shrink-0">da scrivere</span>}
              </button>
            );
          })}
        </Card>
        {mancanti > 0 && <p className="text-[11px] text-amber-600 mt-1 px-1">{mancanti} da contattare questa settimana</p>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-xs uppercase tracking-wide text-slate-500 font-medium px-1">Promemoria messaggio settimanale</p>
      <Gruppo titolo="Bulb / in presenza" sottotitolo="domenica sera" elenco={bulb} />
      <Gruppo titolo="Coaching online" sottotitolo="durante la settimana" elenco={online} />
    </div>
  );
}

function CentroNotificheCoach({ clients, onSelect }) {
  const [richieste, setRichieste] = useState([]);
  const [checkDaRivedere, setCheckDaRivedere] = useState([]);
  const [proponiPer, setProponiPer] = useState(null);
  const [caricando, setCaricando] = useState(true);

  const carica = async () => {
    const { data: r } = await supabase.from("calendar_events").select("*, clients(nome, cognome)").eq("stato", "richiesta").order("data");
    setRichieste(r || []);
    const { data: c } = await supabase.from("checkins").select("*, clients(nome, cognome)").eq("stato", "ricevuto").order("data_check", { ascending: false });
    setCheckDaRivedere(c || []);
    setCaricando(false);
  };
  useEffect(() => { carica(); }, []);

  const approva = async (id) => { await supabase.from("calendar_events").update({ stato: "confermato" }).eq("id", id); carica(); };
  const rifiuta = async (id) => { await supabase.from("calendar_events").update({ stato: "annullata" }).eq("id", id); carica(); };
  const segnaRevisionato = async (id) => {
    await supabase.from("checkins").update({ stato: "revisionato" }).eq("id", id);
    try {
      await conTimeout(supabase.rpc("sincronizza_stati_check"));
    } catch (e) { /* non blocca mai il caricamento anche in caso di errore */ }
    carica();
  };

  if (caricando) return <Spinner />;

  return (
    <div className="space-y-5">
      <PromemoriaMessaggi clients={clients} />

      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2 px-1">Richieste lezione/call ({richieste.length})</p>
        <div className="space-y-2">
          {richieste.length === 0 && <Card className="p-4 text-center text-slate-400 text-sm">Nessuna richiesta in sospeso.</Card>}
          {richieste.map((r) => (
            <Card key={r.id} className="p-3 space-y-2">
              <button onClick={() => onSelect(r.client_id)} className="w-full text-left">
                <p className="font-medium text-slate-700 text-sm">{r.clients?.nome} {r.clients?.cognome}</p>
                <p className="text-slate-500 text-xs">{r.data?.split("-").reverse().join("/")} {r.ora?.slice(0, 5)} — {r.tipo === "lezione" ? "Lezione 1:1" : "Call"}{r.luogo ? ` — ${r.luogo}` : ""}{r.extra_euro ? ` — +${r.extra_euro}€` : ""}</p>
              </button>
              {proponiPer === r.id ? (
                <ProponiOrarioForm evento={r} onAnnulla={() => setProponiPer(null)} onFatto={() => { setProponiPer(null); carica(); }} />
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => approva(r.id)} className="flex-1 bg-emerald-500 text-white text-xs font-medium rounded-lg py-2">Approva</button>
                  <button onClick={() => setProponiPer(r.id)} className="flex-1 bg-amber-500 text-white text-xs font-medium rounded-lg py-2">Proponi altro</button>
                  <button onClick={() => rifiuta(r.id)} className="flex-1 bg-rose-100 text-rose-700 text-xs font-medium rounded-lg py-2">Rifiuta</button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2 px-1">Check da rivedere ({checkDaRivedere.length})</p>
        <div className="space-y-2">
          {checkDaRivedere.length === 0 && <Card className="p-4 text-center text-slate-400 text-sm">Nessun check da rivedere.</Card>}
          {checkDaRivedere.map((c) => (
            <Card key={c.id} className="p-3 flex items-center gap-3">
              <button onClick={() => onSelect(c.client_id)} className="flex-1 min-w-0 text-left">
                <p className="font-medium text-slate-700 text-sm">{c.clients?.nome} {c.clients?.cognome}</p>
                <p className="text-slate-500 text-xs">{c.data_check?.split("-").reverse().join("/")} — {c.peso_kg ? `${c.peso_kg} kg` : "check inviato"}</p>
              </button>
              <button onClick={() => segnaRevisionato(c.id)} className="bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg px-3 py-2 flex-shrink-0">Segna rivisto</button>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2 px-1">Invia una nota</p>
        <InviaNotaForm clients={clients} onFatto={() => {}} />
      </div>
    </div>
  );
}

function scaricaCsv(nomeFile, righe) {
  const escapeCsv = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = righe.map((riga) => riga.map(escapeCsv).join(";")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeFile;
  a.click();
  URL.revokeObjectURL(url);
}

async function esportaClientiCsv(clients) {
  const intestazione = ["Codice", "Nome", "Cognome", "Email", "Tipo servizio", "Piano", "Pacchetto lezioni", "Stato pacchetto", "Data inizio", "Data scadenza"];
  const righe = clients.map((c) => [c.codice, c.nome, c.cognome, c.email, c.tipo_servizio, c.piano, c.pacchetto_lezioni, c.stato_pacchetto, c.data_inizio, c.data_scadenza]);
  scaricaCsv(`clienti_${new Date().toISOString().slice(0, 10)}.csv`, [intestazione, ...righe]);
}

async function esportaCheckCsv() {
  const { data } = await supabase.from("checkins").select("*, clients(nome, cognome, codice)").order("data_check");
  const intestazione = ["Cliente", "Codice", "Data check", "Peso", "Petto", "Spalle", "Sopra ombelico", "Ombelico", "Sotto ombelico", "Coscia dx", "Braccio dx", "Collo", "Glutei", "Stato", "Note cliente"];
  const righe = (data || []).map((c) => [
    c.clients ? `${c.clients.nome} ${c.clients.cognome}` : "", c.clients?.codice, c.data_check, c.peso_kg, c.petto_cm, c.spalle_cm,
    c.sopra_ombelico_cm, c.ombelico_cm, c.sotto_ombelico_cm, c.coscia_dx_cm, c.braccio_dx_cm, c.collo_cm, c.glutei_cm, c.stato, c.note_cliente,
  ]);
  scaricaCsv(`storico_check_${new Date().toISOString().slice(0, 10)}.csv`, [intestazione, ...righe]);
}

async function esportaCarichiCsv() {
  const { data } = await supabase.from("training_entries")
    .select("*, training_exercises(nome, training_days(nome)), clients(nome, cognome, codice)")
    .order("data");
  const intestazione = ["Cliente", "Codice", "Giorno", "Esercizio", "Data", "N. serie", "Kg", "Ripetizioni", "Note"];
  const righe = (data || []).map((r) => [
    r.clients ? `${r.clients.nome} ${r.clients.cognome}` : "", r.clients?.codice,
    r.training_exercises?.training_days?.nome, r.training_exercises?.nome, r.data, r.numero_serie, r.kg, r.ripetizioni, r.note,
  ]);
  scaricaCsv(`carichi_allenamento_${new Date().toISOString().slice(0, 10)}.csv`, [intestazione, ...righe]);
}

function NuovoPagamentoGuadagni({ clients, onSalvato, onClientiCambiati }) {
  const [aperto, setAperto] = useState(false);
  const [clientId, setClientId] = useState("");
  const [tipoPiano, setTipoPiano] = useState("Mensile");
  const [tipoLibero, setTipoLibero] = useState("");
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10));
  const [importo, setImporto] = useState("");
  const [metodo, setMetodo] = useState("");
  const [stato, setStato] = useState("saldato");
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState("");

  const clientiOrdinati = [...clients].sort((a, b) => `${a.nome}${a.cognome || ""}`.localeCompare(`${b.nome}${b.cognome || ""}`));
  const aggiornaScadenza = ["Mensile", "Trimestrale", "Semestrale"].includes(tipoPiano);

  const reset = () => {
    setClientId(""); setTipoPiano("Mensile"); setTipoLibero(""); setImporto(""); setMetodo(""); setStato("saldato"); setNota("");
    setDataPagamento(new Date().toISOString().slice(0, 10));
  };

  const salva = async () => {
    setErrore("");
    if (!clientId) { setErrore("Seleziona un cliente."); return; }
    if (importo === "" || isNaN(Number(importo))) { setErrore("Inserisci un importo valido."); return; }
    setSalvando(true);
    const cliente = clients.find((c) => c.id === clientId);
    const etichettaTipo = tipoPiano === "Altro" ? (tipoLibero || "Pagamento") : tipoPiano;
    const { error } = await supabase.from("payments").insert({
      client_id: clientId,
      data_pagamento: dataPagamento,
      tipo_piano: etichettaTipo,
      importo: Number(importo),
      metodo_pagamento: metodo || null,
      stato,
      note: nota || null,
    });
    if (error) { setSalvando(false); setErrore("Errore nel salvataggio, riprova."); return; }
    // Mensile/Trimestrale/Semestrale: la scadenza del pacchetto si aggiorna in automatico, coerente col tipo — mai una data "a caso"
    if (aggiornaScadenza && cliente) {
      if (!cliente.data_inizio) {
        await supabase.from("clients").update({ data_inizio: dataPagamento }).eq("id", clientId);
      }
      // Ricalcola dallo storico reale dei pagamenti, non dalla data reale di salvataggio:
      // cosi' un pagamento inserito in ritardo o di correzione non "salta" mesi a vuoto.
      await ricalcolaEAggiornaScadenza(clientId);
    }
    setSalvando(false);
    reset();
    setAperto(false);
    onSalvato();
    onClientiCambiati?.();
  };

  if (!aperto) {
    return (
      <button onClick={() => setAperto(true)} className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white rounded-xl py-2.5 text-sm font-medium">
        <Plus size={16} /> Nuovo pagamento
      </button>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700 flex items-center gap-2"><CreditCard size={16} /> Nuovo pagamento</p>
      <div>
        <label className="text-xs text-slate-500">Cliente</label>
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
          <option value="">Seleziona cliente…</option>
          {clientiOrdinati.map((c) => <option key={c.id} value={c.id}>{c.nome} {c.cognome}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500">Data pagamento</label>
          <InputData value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} className="mt-1" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Importo (€)</label>
          <input type="number" step="0.01" value={importo} onChange={(e) => setImporto(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" placeholder="es. 35" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Metodo</label>
          <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
            <option value="">—</option>
            {METODI_PAGAMENTO.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Stato</label>
          <select value={stato} onChange={(e) => setStato(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
            <option value="saldato">Saldato</option>
            <option value="da_saldare">Da saldare</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-slate-500">Tipo</label>
        <select value={tipoPiano} onChange={(e) => setTipoPiano(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
          <option value="Mensile">Mensile (+1 mese di scadenza)</option>
          <option value="Trimestrale">Trimestrale (+3 mesi di scadenza)</option>
          <option value="Semestrale">Semestrale (+6 mesi di scadenza)</option>
          <option value="Occasionale">Occasionale (non tocca la scadenza)</option>
          <option value="A lezione">A lezione (non tocca la scadenza)</option>
          <option value="Variabile">Variabile (non tocca la scadenza)</option>
          <option value="Altro">Altro (non tocca la scadenza)</option>
        </select>
        {aggiornaScadenza && <p className="text-[11px] text-emerald-600 mt-1">La scadenza del pacchetto si aggiorna in automatico di conseguenza.</p>}
      </div>
      {tipoPiano === "Altro" && (
        <div>
          <label className="text-xs text-slate-500">Specifica tipo</label>
          <input value={tipoLibero} onChange={(e) => setTipoLibero(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" placeholder="es. Coaching online, saldo pacchetto..." />
        </div>
      )}
      <div>
        <label className="text-xs text-slate-500">Nota (facoltativa)</label>
        <input value={nota} onChange={(e) => setNota(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" placeholder="es. saldo pacchetto..." />
      </div>
      {errore && <p className="text-rose-500 text-xs">{errore}</p>}
      <div className="flex gap-2">
        <button onClick={() => { setAperto(false); setErrore(""); }} className="flex-1 bg-slate-100 text-slate-600 rounded-xl py-2 text-sm font-medium">Annulla</button>
        <button onClick={salva} disabled={salvando} className="flex-1 bg-slate-800 text-white rounded-xl py-2 text-sm font-medium">{salvando ? "Salvo..." : "Salva"}</button>
      </div>
    </Card>
  );
}

function RicevutaModal({ pagamento, onClose }) {
  const numero = pagamento.id.slice(0, 8).toUpperCase();
  const dataFmt = pagamento.data_pagamento ? pagamento.data_pagamento.split("-").reverse().join("/") : "—";
  const nomeCliente = pagamento.clients ? `${pagamento.clients.nome} ${pagamento.clients.cognome || ""}`.trim() : "—";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:bg-white print:p-0">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .ricevuta-stampa, .ricevuta-stampa * { visibility: visible; }
          .ricevuta-stampa { position: fixed; top: 0; left: 0; width: 100%; box-shadow: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="ricevuta-stampa bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex justify-between items-start mb-5">
          <div>
            <p className="text-slate-800 font-semibold text-lg">Coaching by Morgana</p>
            <p className="text-slate-400 text-xs">Morgana Tarquino — Personal Trainer</p>
          </div>
          <button onClick={onClose} className="no-print text-slate-300 hover:text-slate-500"><X size={18} /></button>
        </div>
        <p className="text-center text-slate-500 text-xs uppercase tracking-wide mb-1">Ricevuta di pagamento</p>
        <p className="text-center text-slate-400 text-xs mb-5">N. {numero} · {dataFmt}</p>
        <div className="space-y-2 border-t border-b border-slate-100 py-4 mb-4">
          <div className="flex justify-between text-sm"><span className="text-slate-400">Cliente</span><span className="text-slate-700 font-medium">{nomeCliente}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-400">Descrizione</span><span className="text-slate-700 font-medium text-right">{pagamento.tipo_piano || "—"}</span></div>
          {pagamento.note && <div className="flex justify-between text-sm"><span className="text-slate-400">Nota</span><span className="text-slate-700 text-right">{pagamento.note}</span></div>}
          {pagamento.metodo_pagamento && <div className="flex justify-between text-sm"><span className="text-slate-400">Metodo</span><span className="text-slate-700 font-medium">{labelMetodo(pagamento.metodo_pagamento)}</span></div>}
        </div>
        <div className="flex justify-between items-center mb-5">
          <span className="text-slate-500 text-sm font-medium">Importo pagato</span>
          <span className="text-slate-800 text-2xl font-semibold">{Number(pagamento.importo).toFixed(2)}€</span>
        </div>
        <p className="text-center text-slate-300 text-[10px] mb-5">Documento riepilogativo non fiscale — dati base, senza P.IVA</p>
        <button onClick={() => window.print()} className="no-print w-full bg-slate-800 text-white rounded-xl py-2.5 text-sm font-medium">Stampa / Salva PDF</button>
      </div>
    </div>
  );
}

function PagamentoDettaglio({ pagamento, onClose, onSelectCliente }) {
  const [ricevutaAperta, setRicevutaAperta] = useState(false);
  const nomeCliente = pagamento.clients ? `${pagamento.clients.nome} ${pagamento.clients.cognome || ""}`.trim() : "—";

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-5 space-y-3">
        <div className="flex justify-between items-start">
          <p className="text-sm font-medium text-slate-700 flex items-center gap-2"><CreditCard size={16} /> Dettaglio pagamento</p>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500"><X size={18} /></button>
        </div>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">Cliente</span><span className="text-slate-700 font-medium">{nomeCliente}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Data</span><span className="text-slate-700">{pagamento.data_pagamento}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Tipo</span><span className="text-slate-700">{pagamento.tipo_piano || "—"}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Importo</span><span className="text-slate-800 font-semibold">{pagamento.importo != null ? `${Number(pagamento.importo).toFixed(2)}€` : "—"}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Metodo</span><span className="text-slate-700">{pagamento.metodo_pagamento ? labelMetodo(pagamento.metodo_pagamento) : "—"}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Stato</span><span className="text-slate-700 capitalize">{pagamento.stato === "spesa" ? "Spesa" : pagamento.stato === "saldato" ? "Saldato" : "Da saldare"}</span></div>
          {pagamento.note && <div className="flex justify-between gap-3"><span className="text-slate-400 flex-shrink-0">Nota</span><span className="text-slate-700 text-right">{pagamento.note}</span></div>}
        </div>
        <div className="flex gap-2 pt-2">
          {pagamento.client_id && (
            <button onClick={() => { onClose(); onSelectCliente(pagamento.client_id); }} className="flex-1 bg-slate-100 text-slate-600 rounded-xl py-2 text-sm font-medium">Vai al cliente</button>
          )}
          {pagamento.importo != null && pagamento.stato !== "spesa" && (
            <button onClick={() => setRicevutaAperta(true)} className="flex-1 bg-slate-800 text-white rounded-xl py-2 text-sm font-medium flex items-center justify-center gap-1.5"><FileText size={14} /> Genera ricevuta</button>
          )}
        </div>
      </div>
      {ricevutaAperta && <RicevutaModal pagamento={pagamento} onClose={() => setRicevutaAperta(false)} />}
    </div>
  );
}

function ImportoMancante({ p, onSalvato }) {
  const [valore, setValore] = useState("");
  const [salvando, setSalvando] = useState(false);

  const salva = async () => {
    if (valore === "" || isNaN(Number(valore))) return;
    setSalvando(true);
    await supabase.from("payments").update({ importo: Number(valore) }).eq("id", p.id);
    setSalvando(false);
    onSalvato();
  };

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <input type="number" step="0.01" value={valore} onChange={(e) => setValore(e.target.value)} placeholder="€"
        className="w-16 border border-amber-300 rounded-lg px-1.5 py-1 text-xs" />
      <button onClick={salva} disabled={salvando} className="text-emerald-600 flex-shrink-0"><Check size={16} /></button>
    </div>
  );
}

function GuadagniCoach({ clients, onSelect, onClientiCambiati }) {
  const [pagamenti, setPagamenti] = useState([]);
  const [billing, setBilling] = useState([]);
  const [caricando, setCaricando] = useState(true);
  const [filtro, setFiltro] = useState("tutti");
  const [pagamentoAperto, setPagamentoAperto] = useState(null);

  const carica = async () => {
    const { data: pg } = await supabase.from("payments").select("*, clients(nome, cognome)").order("data_pagamento", { ascending: false });
    setPagamenti(pg || []);
    const { data: bl } = await supabase.from("client_billing").select("*");
    setBilling(bl || []);
    setCaricando(false);
  };
  useEffect(() => { carica(); }, []);

  if (caricando) return <Spinner />;

  const oggi = new Date();
  const meseChiave = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // usa la data locale, non toISOString (che converte in UTC e sfasa il mese)
  const meseCorrente = meseChiave(oggi);
  const conImporto = pagamenti.filter((p) => p.importo != null);
  const incassi = conImporto.filter((p) => p.stato === "saldato");
  const spese = conImporto.filter((p) => p.stato === "spesa");
  const daSaldare = conImporto.filter((p) => p.stato === "da_saldare");
  const nettoRows = conImporto.filter((p) => p.stato === "saldato" || p.stato === "spesa");
  const totaleIncassato = incassi.reduce((s, p) => s + Number(p.importo), 0);
  const totaleSpese = spese.reduce((s, p) => s + Number(p.importo), 0);
  const totaleNetto = totaleIncassato + totaleSpese;
  const totaleDaSaldare = daSaldare.reduce((s, p) => s + Number(p.importo), 0);
  const guadagnoMese = nettoRows.filter((p) => (p.data_pagamento || "").slice(0, 7) === meseCorrente).reduce((s, p) => s + Number(p.importo), 0);

  // Guadagni mensili — dal primo mese con dati ad oggi (incassi al netto delle spese)
  const primaChiaveDati = nettoRows.reduce((min, p) => {
    const c = (p.data_pagamento || "").slice(0, 7);
    return c && (!min || c < min) ? c : min;
  }, null);
  const meseInizio = primaChiaveDati && primaChiaveDati < `${oggi.getFullYear()}-01` ? primaChiaveDati : `${oggi.getFullYear()}-01`;
  const [annoInizio, mInizio] = meseInizio.split("-").map(Number);
  const mesi = [];
  {
    let d = new Date(annoInizio, mInizio - 1, 1);
    const fine = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
    while (d <= fine) {
      mesi.push({ chiave: meseChiave(d), label: d.toLocaleDateString("it-IT", { month: "short", year: annoInizio !== oggi.getFullYear() ? "2-digit" : undefined }), totale: 0 });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
  }
  nettoRows.forEach((p) => {
    const chiave = (p.data_pagamento || "").slice(0, 7);
    const m = mesi.find((x) => x.chiave === chiave);
    if (m) m.totale += Number(p.importo);
  });

  // Per metodo di pagamento (solo incassi saldati, le spese non hanno un metodo)
  const perMetodo = {};
  incassi.forEach((p) => {
    const k = p.metodo_pagamento || "non specificato";
    perMetodo[k] = (perMetodo[k] || 0) + Number(p.importo);
  });
  const metodiOrdinati = Object.entries(perMetodo).sort((a, b) => b[1] - a[1]);

  // Rinnovi imminenti — clienti con pacchetto attivo/in scadenza ordinati per data_scadenza
  const billingByClient = {};
  billing.forEach((b) => { billingByClient[b.client_id] = b; });
  // Solo pacchetti a cadenza fissa hanno una data di rinnovo coerente da mostrare — Occasionale/A lezione/Altro non hanno una scadenza prevedibile
  const rinnovi = clients
    .filter((c) => c.data_scadenza && c.stato_pacchetto !== "scaduto" && c.stato_pacchetto !== "gratuito" && ["Mensile", "Trimestrale", "Semestrale"].includes(c.piano))
    .sort((a, b) => (a.data_scadenza || "").localeCompare(b.data_scadenza || ""))
    .slice(0, 8);

  const pagamentiVisibili = filtro === "tutti" ? pagamenti : pagamenti.filter((p) => p.stato === filtro);

  const cambiaStato = async (p) => {
    if (p.stato === "spesa") return; // le spese non si alternano tra saldato/da saldare
    await supabase.from("payments").update({ stato: p.stato === "saldato" ? "da_saldare" : "saldato" }).eq("id", p.id);
    carica();
  };
  const elimina = async (p) => {
    if (!confirm(`Eliminare il pagamento del ${p.data_pagamento}? L'operazione non è reversibile.`)) return;
    await supabase.from("payments").delete().eq("id", p.id);
    // Se il pagamento cancellato aveva fatto avanzare la scadenza, la riallinea allo storico rimasto
    if (MESI_PER_TIPO_PAGAMENTO[p.tipo_piano]) {
      await ricalcolaEAggiornaScadenza(p.client_id);
      onClientiCambiati?.();
    }
    carica();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <p className="text-[11px] text-slate-400">Guadagno del mese (netto)</p>
          <p className="text-lg font-semibold text-slate-800 mt-0.5">{guadagnoMese.toFixed(2)}€</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] text-slate-400">Totale netto da inizio anno</p>
          <p className="text-lg font-semibold text-emerald-600 mt-0.5">{totaleNetto.toFixed(2)}€</p>
        </Card>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3">
          <p className="text-[11px] text-slate-400">Incassato</p>
          <p className="text-base font-semibold text-slate-700 mt-0.5">{totaleIncassato.toFixed(2)}€</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] text-slate-400">Spese (affitto ecc.)</p>
          <p className="text-base font-semibold text-rose-600 mt-0.5">{totaleSpese.toFixed(2)}€</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] text-slate-400">Da saldare</p>
          <p className="text-base font-semibold text-amber-600 mt-0.5">{totaleDaSaldare.toFixed(2)}€</p>
        </Card>
      </div>

      <NuovoPagamentoGuadagni clients={clients} onSalvato={carica} onClientiCambiati={onClientiCambiati} />

      <Card className="p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">Guadagni mensili {oggi.getFullYear()} (netto: incassi − spese)</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={mesi}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} width={35} />
            <Tooltip formatter={(v) => `${v.toFixed(2)}€`} />
            <Bar dataKey="totale" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
          {mesi.map((m) => (
            <div key={m.chiave} className="flex justify-between text-xs">
              <span className="text-slate-500 capitalize">{new Date(m.chiave + "-01").toLocaleDateString("it-IT", { month: "long", year: "numeric" })}</span>
              <span className={`font-medium ${m.totale < 0 ? "text-rose-600" : "text-slate-700"}`}>{m.totale.toFixed(2)}€</span>
            </div>
          ))}
        </div>
      </Card>

      {metodiOrdinati.length > 0 && (
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">Per metodo di pagamento (saldato)</p>
          <div className="space-y-1.5">
            {metodiOrdinati.map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-slate-600 capitalize">{labelMetodo(k) === k ? k : labelMetodo(k)}</span>
                <span className="text-slate-700 font-medium">{v.toFixed(2)}€</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {rinnovi.length > 0 && (
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">Prossimi rinnovi (pagamenti programmati)</p>
          <div className="divide-y divide-slate-100">
            {rinnovi.map((c) => {
              const b = billingByClient[c.id];
              return (
                <button key={c.id} onClick={() => onSelect(c.id)} className="w-full flex items-center justify-between py-2 text-left">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700 font-medium truncate">{c.nome} {c.cognome}</p>
                    <p className="text-xs text-slate-400">
                      {b?.importo_ricorrente != null ? `${Number(b.importo_ricorrente).toFixed(2)}€` : "Importo non impostato"}
                      {b?.frequenza_pagamento ? ` · ${labelFrequenza(b.frequenza_pagamento)}` : ""}
                      {b?.metodo_pagamento_abituale ? ` · ${labelMetodo(b.metodo_pagamento_abituale)}` : ""}
                    </p>
                  </div>
                  <span className={`text-xs font-medium flex-shrink-0 ${c.stato_pacchetto === "in scadenza" ? "text-amber-600" : "text-slate-400"}`}>{c.data_scadenza?.split("-").reverse().join("/")}</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <div>
        <div className="flex gap-2 mb-2 px-1">
          {[["tutti", "Tutti"], ["saldato", "Saldati"], ["da_saldare", "Da saldare"], ["spesa", "Spese"]].map(([k, l]) => (
            <button key={k} onClick={() => setFiltro(k)} className={`px-3 py-1 rounded-full text-xs font-medium ${filtro === k ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}>{l}</button>
          ))}
        </div>
        <Card className="p-1 divide-y divide-slate-100">
          {pagamentiVisibili.length === 0 && <p className="text-center text-slate-400 text-sm py-4">Nessun pagamento.</p>}
          {pagamentiVisibili.map((p) => (
            <div key={p.id} className="flex items-center gap-2 px-3 py-2.5">
              <button onClick={() => setPagamentoAperto(p)} className="flex-1 min-w-0 text-left">
                <p className="text-sm text-slate-700 font-medium truncate">{p.stato === "spesa" ? (p.note || "Spesa") : p.clients ? `${p.clients.nome} ${p.clients.cognome}` : "—"}</p>
                <p className="text-xs text-slate-400">{p.data_pagamento} · {p.tipo_piano}{p.metodo_pagamento ? ` · ${labelMetodo(p.metodo_pagamento)}` : ""}{p.stato !== "spesa" && p.note ? ` · ${p.note}` : ""}</p>
              </button>
              {p.importo != null ? (
                <span className={`text-sm font-medium flex-shrink-0 ${p.stato === "spesa" ? "text-rose-600" : "text-slate-700"}`}>{Number(p.importo).toFixed(2)}€</span>
              ) : (
                <ImportoMancante p={p} onSalvato={carica} />
              )}
              {p.stato && (
                p.stato === "spesa" ? (
                  <span className="flex-shrink-0 text-[10px] font-medium rounded-full px-2 py-0.5 bg-rose-100 text-rose-700">Spesa</span>
                ) : (
                  <button onClick={() => cambiaStato(p)} className={`flex-shrink-0 text-[10px] font-medium rounded-full px-2 py-0.5 ${p.stato === "saldato" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {p.stato === "saldato" ? "Saldato" : "Da saldare"}
                  </button>
                )
              )}
              <button onClick={() => elimina(p)} className="flex-shrink-0 text-slate-300 hover:text-rose-500 px-0.5"><X size={13} /></button>
            </div>
          ))}
        </Card>
      </div>

      {pagamentoAperto && (
        <PagamentoDettaglio pagamento={pagamentoAperto} onClose={() => setPagamentoAperto(null)} onSelectCliente={onSelect} />
      )}
    </div>
  );
}

function AdminList({ clients, onSelect, onChanged, vista, setVista }) {
  const [mostraForm, setMostraForm] = useState(false);
  const [ricerca, setRicerca] = useState("");
  const [filtro, setFiltro] = useState("tutti");
  const [nonLetteCoach, setNonLetteCoach] = useState(0);

  const caricaNonLetteCoach = async () => {
    const { count: r } = await supabase.from("calendar_events").select("id", { count: "exact", head: true }).eq("stato", "richiesta");
    const { count: c } = await supabase.from("checkins").select("id", { count: "exact", head: true }).eq("stato", "ricevuto");
    setNonLetteCoach((r || 0) + (c || 0));
  };
  useEffect(() => { caricaNonLetteCoach(); }, [vista]);

  const inScadenza = clients.filter((c) => c.stato_pacchetto === "in scadenza");
  const daFare = clients.filter((c) => c.stato_check === "da_compilare");
  const scaduti = clients.filter((c) => c.stato_pacchetto === "scaduto");

  const spostaOrdine = async (clienteId, direzione) => {
    const ordinati = [...clients].sort((a, b) => (a.ordine ?? 9999) - (b.ordine ?? 9999));
    const idx = ordinati.findIndex((c) => c.id === clienteId);
    const altroIdx = idx + direzione;
    if (altroIdx < 0 || altroIdx >= ordinati.length) return;
    const a = ordinati[idx], b = ordinati[altroIdx];
    await supabase.from("clients").update({ ordine: b.ordine ?? altroIdx }).eq("id", a.id);
    await supabase.from("clients").update({ ordine: a.ordine ?? idx }).eq("id", b.id);
    onChanged();
  };

  let visibili = [...clients].sort((a, b) => (a.ordine ?? 9999) - (b.ordine ?? 9999));
  if (ricerca.trim()) {
    const q = ricerca.trim().toLowerCase();
    visibili = visibili.filter((c) => `${c.nome} ${c.cognome} ${c.codice}`.toLowerCase().includes(q));
  }
  if (filtro === "da_fare") visibili = visibili.filter((c) => c.stato_check === "da_compilare");
  if (filtro === "in_scadenza") visibili = visibili.filter((c) => c.stato_pacchetto === "in scadenza");
  if (filtro === "scaduti") visibili = visibili.filter((c) => c.stato_pacchetto === "scaduto");
  if (filtro === "online") visibili = visibili.filter((c) => c.tipo_servizio === "online" || c.tipo_servizio === "ibrido");
  if (filtro === "presenza") visibili = visibili.filter((c) => c.tipo_servizio === "presenza" || c.tipo_servizio === "ibrido");

  const riordinabile = !ricerca.trim() && filtro === "tutti";

  const filtriBtn = (key, label, count, colore) => (
    <button onClick={() => setFiltro(filtro === key ? "tutti" : key)}
      className={`p-4 rounded-2xl border-2 text-left transition-colors ${filtro === key ? `${colore} border-current` : "border-transparent bg-white shadow-sm"}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${filtro === key ? "" : colore.replace("bg-", "text-").replace("-50", "-600")}`}>{count}</p>
    </button>
  );

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

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => esportaClientiCsv(clients)} className="border border-slate-200 bg-white text-slate-600 text-xs font-medium rounded-lg py-2">⬇ Esporta clienti (CSV)</button>
        <button onClick={() => esportaCheckCsv()} className="border border-slate-200 bg-white text-slate-600 text-xs font-medium rounded-lg py-2">⬇ Esporta check (CSV)</button>
        <button onClick={() => esportaCarichiCsv()} className="col-span-2 border border-slate-200 bg-white text-slate-600 text-xs font-medium rounded-lg py-2">⬇ Esporta carichi allenamento (CSV)</button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button onClick={() => setVista("lista")} className={`py-2 rounded-xl text-xs font-medium ${vista === "lista" ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>Lista</button>
        <button onClick={() => setVista("calendario")} className={`py-2 rounded-xl text-xs font-medium ${vista === "calendario" ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>Calendario</button>
        <button onClick={() => setVista("notifiche")} className={`relative py-2 rounded-xl text-xs font-medium ${vista === "notifiche" ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
          Notifiche
          {nonLetteCoach > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{nonLetteCoach}</span>
          )}
        </button>
        <button onClick={() => setVista("guadagni")} className={`py-2 rounded-xl text-xs font-medium ${vista === "guadagni" ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>Guadagni</button>
      </div>

      {vista === "calendario" && <CalendarioAgenda clients={clients} onSelect={onSelect} />}
      {vista === "notifiche" && <CentroNotificheCoach clients={clients} onSelect={onSelect} />}
      {vista === "guadagni" && <GuadagniCoach clients={clients} onSelect={onSelect} onClientiCambiati={onChanged} />}
      {vista === "lista" && (
        <>
      <input value={ricerca} onChange={(e) => setRicerca(e.target.value)} placeholder="Cerca cliente per nome o codice..."
        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white" />

      <div className="grid grid-cols-3 gap-3">
        {filtriBtn("da_fare", "Check da fare", daFare.length, "bg-amber-50 text-amber-700")}
        {filtriBtn("in_scadenza", "In scadenza", inScadenza.length, "bg-rose-50 text-rose-700")}
        {filtriBtn("scaduti", "Scaduti", scaduti.length, "bg-slate-100 text-slate-600")}
      </div>
      <div className="flex gap-2">
        <button onClick={() => setFiltro(filtro === "online" ? "tutti" : "online")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium ${filtro === "online" ? "bg-sky-500 text-white" : "bg-sky-50 text-sky-700"}`}>
          ONLINE ({clients.filter((c) => c.tipo_servizio === "online" || c.tipo_servizio === "ibrido").length})
        </button>
        <button onClick={() => setFiltro(filtro === "presenza" ? "tutti" : "presenza")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium ${filtro === "presenza" ? "bg-violet-500 text-white" : "bg-violet-50 text-violet-700"}`}>
          BULB ({clients.filter((c) => c.tipo_servizio === "presenza" || c.tipo_servizio === "ibrido").length})
        </button>
      </div>
      {filtro !== "tutti" && (
        <button onClick={() => setFiltro("tutti")} className="text-sky-600 text-sm font-medium">← Mostra tutti i clienti</button>
      )}

      <div>
        <p className="text-sm font-medium text-slate-700 px-1 mb-2">Clienti ({visibili.length})</p>
        <div className="space-y-2">
          {visibili.map((c) => (
            <Card key={c.id} className={`p-3 flex items-center gap-2 ${c.stato_pacchetto === "in scadenza" ? "bg-rose-50/50 border-rose-100" : ""}`}>
              {riordinabile && (
                <div className="flex flex-col flex-shrink-0">
                  <button onClick={() => spostaOrdine(c.id, -1)} className="text-slate-300 hover:text-slate-600 text-xs leading-none py-0.5">▲</button>
                  <button onClick={() => spostaOrdine(c.id, 1)} className="text-slate-300 hover:text-slate-600 text-xs leading-none py-0.5">▼</button>
                </div>
              )}
              <button onClick={() => onSelect(c.id)} className="flex-1 min-w-0 flex items-center justify-between gap-2 text-left">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-slate-700 ">{c.nome} {c.cognome}</p>
                    <Badge className={`flex-shrink-0 ${c.tipo_servizio === "presenza" ? "bg-violet-100 text-violet-700" : c.tipo_servizio === "ibrido" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>
                      {c.tipo_servizio === "presenza" ? "BULB" : c.tipo_servizio === "ibrido" ? "IBRIDO" : "ONLINE"}
                    </Badge>
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5 ">
                    {c.tipo_servizio === "presenza"
                      ? `${c.piano || "—"} · ${c.pacchetto_lezioni ? c.pacchetto_lezioni + " lezioni" : "pacchetto non impostato"}`
                      : `${c.piano || "—"} · Prossimo check: ${c.prossimo_check || "—"}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatoBadge stato={c.stato_check} />
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              </button>
            </Card>
          ))}
          {visibili.length === 0 && (
            <Card className="p-8 text-center text-slate-400">Nessun cliente corrisponde alla ricerca/filtro.</Card>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}

function conTimeout(promise, ms = 4000) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms))]);
}

function scaricaFile(nomeFile, contenuto, tipo) {
  const blob = new Blob([contenuto], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeFile;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function esportaBackupCompleto(setInCorso) {
  setInCorso(true);
  const tabelle = [
    "clients", "checkins", "notes", "nutrition_plans", "training_days", "training_exercises", "training_entries",
    "lezioni_svolte", "calendar_events", "notifiche", "payments", "client_billing", "esercizi_libreria", "esercizi_alias",
    "schede", "scheda_giorni", "scheda_esercizi", "feedback_soggettivo", "promemoria_messaggi",
  ];
  const risultato = { esportato_il: new Date().toISOString() };
  for (const t of tabelle) {
    const { data, error } = await supabase.from(t).select("*");
    risultato[t] = error ? { errore: error.message } : data;
  }
  scaricaFile(`backup-completo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(risultato, null, 2), "application/json");
  setInCorso(false);
}

function AdminApp() {
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [caricando, setCaricando] = useState(true);
  const [backupInCorso, setBackupInCorso] = useState(false);
  const [vista, setVista] = useState("calendario"); // sollevato qui per non perdere la scheda aperta tornando da un cliente

  const carica = async () => {
    try {
      await conTimeout(supabase.rpc("sincronizza_stati_check"));
    } catch (e) { /* non blocca mai il caricamento anche in caso di errore */ }
    const { data } = await supabase.from("clients").select("*").order("ordine", { ascending: true, nullsFirst: false });
    setClients(data || []);
    setCaricando(false);
  };
  useEffect(() => { carica(); }, []);

  if (caricando) return <Spinner />;

  return (
    <PullToRefresh onRefresh={carica}>
    <div className="min-h-screen bg-slate-50">
      <div className="flex items-center justify-between px-6 pt-5 max-w-3xl mx-auto">
        <span className="text-slate-400 text-xs font-medium tracking-wide">PANNELLO COACH</span>
        <div className="flex items-center gap-3">
          <button onClick={() => esportaBackupCompleto(setBackupInCorso)} disabled={backupInCorso} className="text-slate-400 flex items-center gap-1 text-xs disabled:opacity-50">
            {backupInCorso ? "Esporto..." : "📦 Backup completo"}
          </button>
          <button onClick={() => supabase.auth.signOut()} className="text-slate-400 flex items-center gap-1 text-xs"><LogOut size={14} /> Esci</button>
        </div>
      </div>
      {selectedId ? (
        <AdminClientDetail clientId={selectedId} onBack={() => setSelectedId(null)} onChanged={carica} />
      ) : (
        <AdminList clients={clients} onSelect={setSelectedId} onChanged={carica} vista={vista} setVista={setVista} />
      )}
    </div>
    </PullToRefresh>
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
  const [devImpostarePassword, setDevImpostarePassword] = useState(false);
  const [erroreLink, setErroreLink] = useState("");

  // Gestiamo noi stessi il link ricevuto via email (invito o reset password),
  // senza affidarci al rilevamento automatico della libreria (che può perdere il segnale).
  useEffect(() => {
    (async () => {
      const hash = window.location.hash;
      if (hash.includes("access_token")) {
        const params = new URLSearchParams(hash.replace(/^#/, ""));
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        const type = params.get("type");
        const error_description = params.get("error_description");

        window.history.replaceState(null, "", window.location.pathname);

        if (error_description) {
          setErroreLink(decodeURIComponent(error_description.replace(/\+/g, " ")));
          setSession(null);
          return;
        }

        if (access_token && refresh_token) {
          const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) { setErroreLink(error.message); setSession(null); return; }
          if (type === "invite" || type === "recovery") setDevImpostarePassword(true);
          setSession(data.session);
          return;
        }
      }
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    })();

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
  if (!session) return <Login erroreLink={erroreLink} />;
  if (devImpostarePassword) return <ImpostaPassword onFatto={() => setDevImpostarePassword(false)} />;
  if (ruolo === null) return <Spinner />;

  return ruolo === "admin" ? <AdminApp /> : <ClientApp session={session} />;
}
