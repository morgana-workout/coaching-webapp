import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import {
  Home, ClipboardList, TrendingUp, Dumbbell, Phone, BookOpen,
  LogOut, ChevronRight, CheckCircle2, Clock, ArrowLeft, Camera,
  ChefHat, Flame, Droplets, ExternalLink, FileText, Apple, AlertCircle, X, CreditCard, Bell,
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

function CellaAllenamento({ exerciseId, data, clientId, entry, onSaved }) {
  const [kg, setKg] = useState(entry?.kg ?? "");
  const [serie, setSerie] = useState(entry?.serie ?? "");
  const [rip, setRip] = useState(entry?.ripetizioni ?? "");
  const [nota, setNota] = useState(entry?.note ?? "");
  const [id, setId] = useState(entry?.id ?? null);
  const [salvando, setSalvando] = useState(false);

  const salva = async () => {
    setSalvando(true);
    const payload = {
      kg: kg === "" ? null : Number(kg),
      serie: serie === "" ? null : Number(serie),
      ripetizioni: rip || null,
      note: nota || null,
    };
    if (id) {
      await supabase.from("training_entries").update(payload).eq("id", id);
    } else {
      const { data: inserito } = await supabase.from("training_entries")
        .insert({ client_id: clientId, exercise_id: exerciseId, data, ...payload }).select().single();
      if (inserito) setId(inserito.id);
    }
    setSalvando(false);
    onSaved();
  };

  return (
    <div className="flex flex-col gap-1 w-24">
      <input type="number" step="0.5" value={kg} onChange={(e) => setKg(e.target.value)} onBlur={salva} disabled={salvando}
        placeholder="kg" className="w-full text-center border border-slate-200 rounded-lg px-1 py-1.5 text-sm" />
      <div className="flex gap-1">
        <input type="number" value={serie} onChange={(e) => setSerie(e.target.value)} onBlur={salva} disabled={salvando}
          placeholder="serie" className="w-1/2 text-center border border-slate-200 rounded px-1 py-1 text-xs" />
        <input value={rip} onChange={(e) => setRip(e.target.value)} onBlur={salva} disabled={salvando}
          placeholder="rip" className="w-1/2 text-center border border-slate-200 rounded px-1 py-1 text-xs" />
      </div>
      <input value={nota} onChange={(e) => setNota(e.target.value)} onBlur={salva} disabled={salvando}
        placeholder="note" className="w-full border border-slate-200 rounded px-1 py-1 text-xs" />
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
    <input value={val} onChange={(e) => setVal(e.target.value)} onBlur={salva}
      className="w-full border-0 bg-transparent font-medium text-slate-800 text-sm focus:outline-none focus:bg-slate-50 rounded px-1 -mx-1" />
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
                <th className="text-left px-3 py-2 sticky left-0 bg-slate-50 min-w-[190px]">Esercizio</th>
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
                  <td className="px-3 py-2 sticky left-0 bg-white min-w-[140px]">
                    <EsercizioNome id={es.id} nome={es.nome} onSaved={carica} />
                  </td>
                  {date.map((d) => {
                    const entry = entries.find((en) => en.exercise_id === es.id && en.data === d);
                    return (
                      <td key={d} className="px-2 py-2 text-center">
                        <CellaAllenamento exerciseId={es.id} data={d} clientId={clientId} entry={entry} onSaved={carica} />
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

function DiarioAllenamento({ clientId }) {
  const [giorni, setGiorni] = useState([]);
  const [giornoAttivo, setGiornoAttivo] = useState(null);
  const [caricando, setCaricando] = useState(true);

  const carica = async () => {
    const { data } = await supabase.from("training_days").select("*").eq("client_id", clientId).order("ordine");
    setGiorni(data || []);
    if (data && data.length > 0 && !giornoAttivo) setGiornoAttivo(data[0].id);
    setCaricando(false);
  };
  useEffect(() => { carica(); }, [clientId]);

  const creaGiorno = async () => {
    if (giorni.length >= 6) return;
    const { data } = await supabase.from("training_days").insert({
      client_id: clientId, nome: `Giorno ${giorni.length + 1}`, ordine: giorni.length + 1,
    }).select().single();
    await carica();
    if (data) setGiornoAttivo(data.id);
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
          <button key={g.id} onClick={() => setGiornoAttivo(g.id)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex-shrink-0 ${giornoAttivo === g.id ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>
            {g.nome}
          </button>
        ))}
        {giorni.length < 6 && (
          <button onClick={creaGiorno} className="px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex-shrink-0 border border-dashed border-slate-300 text-slate-500">+ Giorno</button>
        )}
      </div>

      {giorni.length === 0 && (
        <Card className="p-6 text-center text-slate-400 text-sm">Nessun giorno di allenamento creato ancora. Tocca "+ Giorno" per iniziare.</Card>
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
                <p className="text-slate-500 text-xs truncate">{e.luogo}</p>
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
                <p className="text-slate-500 text-xs truncate">{e.luogo}</p>
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
  const [caricando, setCaricando] = useState(true);
  const [nonLette, setNonLette] = useState(0);

  const carica = async () => {
    setCaricando(true);
    const { data: c } = await supabase.from("clients").select("*").eq("user_id", session.user.id).single();
    setClient(c);
    if (c) {
      const { data: ck } = await supabase.from("checkins").select("*").eq("client_id", c.id).order("data_check", { ascending: true });
      setCheckins(ck || []);
      const { data: nu } = await supabase.from("nutrition_plans").select("*").eq("client_id", c.id).order("data_aggiornamento", { ascending: false }).limit(1).maybeSingle();
      setPiano(nu);
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
    { key: "nutrizione", label: "Nutrizione", icon: Apple },
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
        {tab === "progressi" && <ClientProgress checkins={checkins} altezza={client.altezza_cm} sesso={client.sesso} eta={calcolaEta(client.data_nascita) ?? client.eta} />}
        {tab === "nutrizione" && <ClientNutrizione piano={piano} />}
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
    if (!checkin) payload.client_id = clientId;
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
    }
    setSalvando(false);
    onSalvato();
  };
  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700">{checkin ? "Modifica check" : "Aggiungi check"}</p>
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
        <label className="text-xs text-slate-500 block mb-1">Foto progressi (facoltative)</label>
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
      <div className="space-y-3">
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
            <InputData value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} className="mt-1" />
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

function LezioniPacchetto({ client, onCompletato }) {
  const [lezioni, setLezioni] = useState([]);
  const [caricando, setCaricando] = useState(true);
  const incluse = client.pacchetto_lezioni ? Number(client.pacchetto_lezioni) : 0;

  const carica = async () => {
    const { data: rows } = await supabase.from("lezioni_svolte").select("*").eq("client_id", client.id).order("numero");
    let attuali = rows || [];
    // Crea gli slot numerati mancanti in base alla dimensione del pacchetto
    if (incluse > attuali.length) {
      const mancanti = [];
      for (let n = attuali.length + 1; n <= incluse; n++) mancanti.push({ client_id: client.id, numero: n, fatta: false });
      const { data: creati } = await supabase.from("lezioni_svolte").insert(mancanti).select();
      attuali = [...attuali, ...(creati || [])].sort((a, b) => a.numero - b.numero);
    }
    setLezioni(attuali);
    setCaricando(false);
  };
  useEffect(() => { carica(); }, [client.id, incluse]);

  const aggiorna = async (id, campi) => {
    let lezioneAggiornata;
    setLezioni((prev) => prev.map((l) => {
      if (l.id !== id) return l;
      lezioneAggiornata = { ...l, ...campi };
      return lezioneAggiornata;
    }));
    await supabase.from("lezioni_svolte").update(campi).eq("id", id);

    if ("fatta" in campi && incluse > 0) {
      setLezioni((prev) => {
        const tutteFatte = prev.filter((l) => l.fatta).length === incluse;
        if (tutteFatte && client.stato_pacchetto !== "scaduto") {
          supabase.from("clients").update({ stato_pacchetto: "scaduto" }).eq("id", client.id).then(() => onCompletato?.());
        }
        return prev;
      });
    }
    return lezioneAggiornata;
  };

  const cambiaData = async (id, nuovaData) => {
    const l = await aggiorna(id, { data: nuovaData || null });
    if (!nuovaData) return;
    if (l.calendar_event_id) {
      await supabase.from("calendar_events").update({ data: nuovaData }).eq("id", l.calendar_event_id);
    } else {
      const { data: nuovoEvento } = await supabase.from("calendar_events").insert({
        client_id: client.id, tipo: "lezione", data: nuovaData, ora: l.ora || null, luogo: client.sede_abituale || null, stato: "confermato",
      }).select().single();
      if (nuovoEvento) await aggiorna(id, { calendar_event_id: nuovoEvento.id });
    }
  };

  const cambiaOra = async (id, nuovaOra) => {
    const l = await aggiorna(id, { ora: nuovaOra || null });
    if (l.calendar_event_id) await supabase.from("calendar_events").update({ ora: nuovaOra || null }).eq("id", l.calendar_event_id);
  };

  const svolte = lezioni.filter((l) => l.fatta).length;

  if (caricando) return <Spinner />;
  if (!incluse) return <Card className="p-6 text-center text-slate-400 text-sm">Imposta prima un pacchetto lezioni nel tab Dati.</Card>;

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">Pacchetto</p>
        <p className="text-2xl font-semibold text-slate-800">{svolte} / {incluse} <span className="text-base font-normal text-slate-400">lezioni svolte</span></p>
        {svolte === incluse && <p className="text-amber-600 text-xs mt-1">Pacchetto completo — stato impostato automaticamente su "scaduto".</p>}
      </Card>

      <div className="space-y-2">
        {lezioni.map((l) => (
          <Card key={l.id} className="p-3 space-y-2">
            <div className="flex items-center gap-3">
              <button onClick={() => aggiorna(l.id, { fatta: !l.fatta })}
                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${l.fatta ? "bg-emerald-500" : "border-2 border-slate-300"}`}>
                {l.fatta && <CheckCircle2 size={16} className="text-white" />}
              </button>
              <p className="font-medium text-slate-700 text-sm flex-shrink-0">Lezione {l.numero}</p>
              <InputData defaultValue={l.data || ""} onBlur={(e) => cambiaData(l.id, e.target.value)} className="flex-1" />
              <select defaultValue={l.ora || ""} onBlur={(e) => cambiaOra(l.id, e.target.value)} className="border border-slate-200 rounded-lg px-2 py-2 text-sm w-24 flex-shrink-0">
                <option value="">--:--</option>
                {SLOT_ORARI.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <input defaultValue={l.nota || ""} onBlur={(e) => aggiorna(l.id, { nota: e.target.value || null })} placeholder="Nota sulla lezione"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" />
          </Card>
        ))}
      </div>
      <p className="text-slate-400 text-xs px-1">Impostando una data qui, la lezione compare in automatico anche nel calendario coach.</p>
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

function AdminClientDetail({ clientId, onBack, onChanged }) {
  const [client, setClient] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [notes, setNotes] = useState([]);
  const [nutrizione, setNutrizione] = useState(null);
  const [pagamenti, setPagamenti] = useState([]);
  const [tab, setTab] = useState("riepilogo");
  const [salvando, setSalvando] = useState(false);
  const [mostraCheckForm, setMostraCheckForm] = useState(false);
  const [checkInModifica, setCheckInModifica] = useState(null);
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
  const isBulb = client.tipo_servizio === "presenza" || client.tipo_servizio === "ibrido";
  const isOnline = client.tipo_servizio === "online" || client.tipo_servizio === "ibrido";
  const tabs = [
    { key: "riepilogo", label: "Riepilogo" },
    { key: "dati", label: "Dati" },
    ...(isOnline ? [{ key: "check", label: "Check" }] : []),
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
        <StatoBadge stato={client.stato_check} />
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
                <option value="24">24 lezioni (6 mesi, 1 a settimana)</option>
                <option value="48">48 lezioni (6 mesi, 2 a settimana)</option>
              </select>
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
                    <button onClick={() => setCheckInModifica(r)} className="flex justify-between items-center text-sm w-full text-left">
                      <span className="text-slate-600">{r.data_check}</span>
                      <span className="text-slate-700">{r.peso_kg ? `${r.peso_kg} kg` : "—"}</span>
                      <StatoBadge stato={r.stato} />
                    </button>
                    <FotoCheck checkin={r} />
                  </li>
                ))}
                {checkins.length === 0 && <p className="text-slate-400 text-sm">Nessun check ancora.</p>}
              </ul>
            </Card>
          )}
        </div>
      )}

      {tab === "progressi" && <ClientProgress checkins={checkins} altezza={client.altezza_cm} sesso={client.sesso} eta={calcolaEta(client.data_nascita) ?? client.eta} titolo="Progressi e storico check" />}

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
const COLORE_TIPO = { check: "bg-sky-500", scadenza: "bg-amber-500", lezione: "bg-violet-500", call: "bg-teal-500" };

function NuovoEventoForm({ clients, onSalvato, onAnnulla }) {
  const [f, setF] = useState({ client_id: clients[0]?.id || "", tipo: "lezione", data: new Date().toISOString().slice(0, 10), ora: SLOT_ORARI[6], luogo: LUOGHI[0], nota: "" });
  const [salvando, setSalvando] = useState(false);

  const salva = async () => {
    if (!f.client_id) return;
    setSalvando(true);
    const payload = { ...f, luogo: f.tipo === "lezione" ? f.luogo : null, stato: "confermato" };
    const { data: creato } = await supabase.from("calendar_events").insert(payload).select().single();
    if (creato && f.tipo === "lezione") await collegaLezionePacchetto(f.client_id, creato);
    setSalvando(false);
    onSalvato();
  };

  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700">Nuovo evento</p>
      <div>
        <label className="text-xs text-slate-500">Cliente</label>
        <select value={f.client_id} onChange={(e) => setF({ ...f, client_id: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1">
          {clients.map((c) => <option key={c.id} value={c.id}>{c.nome} {c.cognome}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setF({ ...f, tipo: "lezione" })} className={`flex-1 py-2 rounded-lg text-sm ${f.tipo === "lezione" ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600"}`}>Lezione 1:1</button>
        <button onClick={() => setF({ ...f, tipo: "call" })} className={`flex-1 py-2 rounded-lg text-sm ${f.tipo === "call" ? "bg-teal-500 text-white" : "bg-slate-100 text-slate-600"}`}>Call</button>
      </div>
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
  const [f, setF] = useState({ data: evento.data, ora: evento.ora ? evento.ora.slice(0, 5) : "", luogo: evento.luogo || "", stato: evento.stato });
  const [salvando, setSalvando] = useState(false);

  const salva = async () => {
    setSalvando(true);
    await supabase.from("calendar_events").update({ data: f.data, ora: f.ora || null, luogo: f.luogo || null, stato: f.stato }).eq("id", evento.id);
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
      <p className="text-sm font-medium text-slate-700">Modifica evento ({evento.tipo === "lezione" ? "Lezione 1:1" : "Call"})</p>
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
      <select value={f.stato} onChange={(e) => setF({ ...f, stato: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
        <option value="richiesta">Da confermare</option>
        <option value="confermato">Confermato</option>
        <option value="annullata">Annullato</option>
        <option value="persa">Persa</option>
      </select>
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
  const [mostraForm, setMostraForm] = useState(false);
  const [eventoInModifica, setEventoInModifica] = useState(null);

  const caricaEventi = async () => {
    const { data } = await supabase.from("calendar_events").select("*, clients(nome, cognome)").order("data");
    setEventiCalendario(data || []);
  };
  useEffect(() => { caricaEventi(); }, []);

  const eventi = [];
  clients.forEach((c) => {
    if (c.tipo_servizio !== "presenza" && c.prossimo_check) eventi.push({ data: c.prossimo_check, ora: null, tipo: "check", nome: `${c.nome} ${c.cognome}`, label: "Check da fare", clientId: c.id });
    if (c.data_scadenza && c.stato_pacchetto !== "scaduto") eventi.push({ data: c.data_scadenza, ora: null, tipo: "scadenza", nome: `${c.nome} ${c.cognome}`, label: "Pacchetto in scadenza", clientId: c.id });
  });
  eventiCalendario.forEach((e) => {
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
  });

  const primoDelMese = new Date(anno, mese, 1);
  const giorniNelMese = new Date(anno, mese + 1, 0).getDate();
  const offset = (primoDelMese.getDay() + 6) % 7;

  const dataStr = (g) => `${anno}-${String(mese + 1).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
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
    : eventi.filter((e) => e.data >= oggi.toISOString().slice(0, 10)).sort((a, b) => a.data.localeCompare(b.data) || (a.ora || "").localeCompare(b.ora || "")).slice(0, 15);

  return (
    <div className="space-y-3">
      {!mostraForm && (
        <button onClick={() => setMostraForm(true)} className="w-full bg-slate-800 text-white text-sm font-medium rounded-xl py-2">+ Aggiungi lezione o call</button>
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
                  {evs.slice(0, 3).map((e, idx) => <span key={idx} className={`w-1.5 h-1.5 rounded-full ${COLORE_TIPO[e.tipo]}`} />)}
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
            <button onClick={() => onSelect(e.clientId)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${COLORE_TIPO[e.tipo]}`} />
              {e.ora && <span className="text-slate-500 text-xs font-medium w-10 flex-shrink-0">{e.ora}</span>}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-700 truncate">{e.nome}</p>
                <p className="text-slate-500 text-xs truncate">{!giornoFiltro && e.data.split("-").reverse().join("/") + " — "}{e.label}</p>
              </div>
            </button>
            {e.id && (
              <button onClick={() => setEventoInModifica(e.raw)} className="text-slate-300 hover:text-slate-600 flex-shrink-0 px-1">✎</button>
            )}
            <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
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
  const segnaRevisionato = async (id) => { await supabase.from("checkins").update({ stato: "revisionato" }).eq("id", id); carica(); };

  if (caricando) return <Spinner />;

  return (
    <div className="space-y-5">
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
  const intestazione = ["Cliente", "Codice", "Giorno", "Esercizio", "Data", "Kg", "Serie", "Ripetizioni", "Note"];
  const righe = (data || []).map((r) => [
    r.clients ? `${r.clients.nome} ${r.clients.cognome}` : "", r.clients?.codice,
    r.training_exercises?.training_days?.nome, r.training_exercises?.nome, r.data, r.kg, r.serie, r.ripetizioni, r.note,
  ]);
  scaricaCsv(`carichi_allenamento_${new Date().toISOString().slice(0, 10)}.csv`, [intestazione, ...righe]);
}

function AdminList({ clients, onSelect, onChanged }) {
  const [mostraForm, setMostraForm] = useState(false);
  const [ricerca, setRicerca] = useState("");
  const [filtro, setFiltro] = useState("tutti");
  const [vista, setVista] = useState("lista");
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

      <div className="flex gap-2">
        <button onClick={() => setVista("lista")} className={`flex-1 py-2 rounded-xl text-sm font-medium ${vista === "lista" ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>Lista</button>
        <button onClick={() => setVista("calendario")} className={`flex-1 py-2 rounded-xl text-sm font-medium ${vista === "calendario" ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>Calendario</button>
        <button onClick={() => setVista("notifiche")} className={`relative flex-1 py-2 rounded-xl text-sm font-medium ${vista === "notifiche" ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
          Notifiche
          {nonLetteCoach > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{nonLetteCoach}</span>
          )}
        </button>
      </div>

      {vista === "calendario" && <CalendarioAgenda clients={clients} onSelect={onSelect} />}
      {vista === "notifiche" && <CentroNotificheCoach clients={clients} onSelect={onSelect} />}
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
                    <p className="font-medium text-slate-700 truncate">{c.nome} {c.cognome}</p>
                    <Badge className={`flex-shrink-0 ${c.tipo_servizio === "presenza" ? "bg-violet-100 text-violet-700" : c.tipo_servizio === "ibrido" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>
                      {c.tipo_servizio === "presenza" ? "BULB" : c.tipo_servizio === "ibrido" ? "IBRIDO" : "ONLINE"}
                    </Badge>
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5 truncate">
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

function AdminApp() {
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [caricando, setCaricando] = useState(true);

  const carica = async () => {
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
        <button onClick={() => supabase.auth.signOut()} className="text-slate-400 flex items-center gap-1 text-xs"><LogOut size={14} /> Esci</button>
      </div>
      {selectedId ? (
        <AdminClientDetail clientId={selectedId} onBack={() => setSelectedId(null)} onChanged={carica} />
      ) : (
        <AdminList clients={clients} onSelect={setSelectedId} onChanged={carica} />
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
