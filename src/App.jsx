import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import {
  Home, ClipboardList, TrendingUp, Dumbbell, Phone, BookOpen,
  LogOut, ChevronRight, CheckCircle2, Clock, ArrowLeft, Camera,
  ChefHat, Flame, Droplets, ExternalLink, FileText, Apple, AlertCircle,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

/* ------------------------------------------------------------------ */
/* Approfondimenti — link ai tuoi PDF ospitati su GitHub Pages         */
/* ------------------------------------------------------------------ */
const APPROFONDIMENTI_LINKS = [
  { titolo: "Come leggere la tua scheda di allenamento", descrizione: "Terminologia, RIR/RPE e tecniche speciali.", link: "https://morgana-workout.github.io/morgana-tarquino/leggere_una_scheda.pdf", icon: Dumbbell },
  { titolo: "Guida alle tecniche di intensità", descrizione: "Top set, back-off, drop set, rest-pause, myo-reps.", link: "https://morgana-workout.github.io/morgana-tarquino/Guida.Tecniche.Bodybuilding.pdf", icon: Flame },
  { titolo: "Manuale progressioni", descrizione: "Come e quando aumentare carico, ripetizioni o serie.", link: "https://morgana-workout.github.io/morgana-tarquino/Manuale_Progressione_Allenamento.pdf", icon: Flame },
  { titolo: "Respirazione in palestra", descrizione: "Come respirare correttamente durante le serie.", link: "https://morgana-workout.github.io/morgana-tarquino/guida.respirazione.palestra.pdf", icon: Flame },
  { titolo: "Ricettario fit", descrizione: "14 ricette con macro indicativi e sostituzioni.", link: "https://morgana-workout.github.io/morgana-tarquino/Ricettario.pdf", icon: ChefHat },
  { titolo: "Manuale di nutrizione consapevole", descrizione: "Un rapporto più equilibrato con il cibo.", link: "https://morgana-workout.github.io/morgana-tarquino/Manuale_Nutrizione_Consapevole_Clienti.pdf", icon: Droplets },
  { titolo: "Se fai così resti uguale", descrizione: "Progressioni, alimentazione, sgarri, ciclo mestruale.", link: "https://morgana-workout.github.io/morgana-tarquino/SE.FAI.COSI%CC%80.RESTI.UGUALE.pdf", icon: Droplets },
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
        {client.link_scheda && (
          <a href={client.link_scheda} target="_blank" rel="noreferrer" className="bg-slate-800 text-white rounded-2xl p-4 flex flex-col items-start gap-2">
            <Dumbbell size={20} /><span className="font-medium text-sm">Scheda</span>
          </a>
        )}
        <a href={CALENDLY_URL} target="_blank" rel="noreferrer" className="bg-sky-500 text-white rounded-2xl p-4 flex flex-col items-start gap-2">
          <Phone size={20} /><span className="font-medium text-sm">Prenota call</span>
        </a>
      </div>
    </div>
  );
}

function ClientCheckin({ client, onInviato }) {
  const [form, setForm] = useState({
    peso_kg: "", petto_cm: "", sopra_ombelico_cm: "", ombelico_cm: "", sotto_ombelico_cm: "",
    coscia_dx_cm: "", braccio_dx_cm: "", energia: 3, sonno: 3, aderenza_cibo: 3, aderenza_allenamento: 3,
    note_cliente: "",
  });
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
    const payload = { client_id: client.id, data_check: new Date().toISOString().slice(0, 10), stato: "ricevuto" };
    for (const k of ["peso_kg", "petto_cm", "sopra_ombelico_cm", "ombelico_cm", "sotto_ombelico_cm", "coscia_dx_cm", "braccio_dx_cm"]) {
      payload[k] = form[k] === "" ? null : Number(form[k]);
    }
    payload.energia = form.energia;
    payload.sonno = form.sonno;
    payload.aderenza_cibo = form.aderenza_cibo;
    payload.aderenza_allenamento = form.aderenza_allenamento;
    payload.note_cliente = form.note_cliente || null;

    const { error } = await supabase.from("checkins").insert(payload);
    setInviando(false);
    if (error) { setErrore("Non sono riuscita a inviare il check: " + error.message); return; }
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
          {campo("Sopra ombelico", "sopra_ombelico_cm", "cm")}
          {campo("Ombelico", "ombelico_cm", "cm")}
          {campo("Sotto ombelico", "sotto_ombelico_cm", "cm")}
          {campo("Coscia dx", "coscia_dx_cm", "cm")}
          {campo("Braccio dx", "braccio_dx_cm", "cm")}
        </div>
      </Card>
      <Card className="p-4 space-y-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Come stai andando</p>
        {slider("Livello di energia", "energia")}
        {slider("Qualità del sonno", "sonno")}
        {slider("Aderenza all'alimentazione", "aderenza_cibo")}
        {slider("Aderenza all'allenamento", "aderenza_allenamento")}
        <textarea placeholder="Difficoltà, feedback, note per Morgana..." value={form.note_cliente}
          onChange={(e) => setForm({ ...form, note_cliente: e.target.value })}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" rows={3} />
      </Card>
      {errore && <p className="text-rose-500 text-sm">{errore}</p>}
      <button onClick={invia} disabled={inviando} className="w-full bg-slate-800 text-white font-medium rounded-xl py-3">
        {inviando ? "Invio in corso..." : "Invia check"}
      </button>
      <p className="text-slate-400 text-xs text-center">Le foto progressi si potranno caricare in un prossimo aggiornamento.</p>
    </div>
  );
}

function ClientProgress({ checkins }) {
  const [metrica, setMetrica] = useState("peso_kg");
  const opzioni = [
    { key: "peso_kg", label: "Peso" }, { key: "petto_cm", label: "Petto" },
    { key: "sopra_ombelico_cm", label: "Sopra ombelico" }, { key: "ombelico_cm", label: "Ombelico" },
    { key: "sotto_ombelico_cm", label: "Sotto ombelico" }, { key: "coscia_dx_cm", label: "Coscia dx" },
    { key: "braccio_dx_cm", label: "Braccio dx" },
  ];
  const dati = checkins.map((c) => ({ ...c, dataLabel: c.data_check?.slice(5).split("-").reverse().join("/") }));

  if (checkins.length === 0) {
    return <div className="px-5 pt-16 text-center text-slate-400 text-sm">Non ci sono ancora check registrati.</div>;
  }

  return (
    <div className="px-5 pt-6 pb-24 space-y-5">
      <h1 className="text-xl font-semibold text-slate-800">I tuoi progressi</h1>
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
      <Card className="p-5 bg-slate-800 border-slate-800">
        <div className="flex items-center gap-2 text-slate-300 text-xs uppercase tracking-wide font-medium mb-1"><Apple size={14} /> Kcal indicative giornaliere</div>
        <p className="text-4xl font-semibold text-white">{piano.kcal} <span className="text-lg font-normal text-slate-400">kcal</span></p>
      </Card>
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
      {tab === "progressi" && <ClientProgress checkins={checkins} />}
      {tab === "nutrizione" && <ClientNutrizione piano={piano} />}
      {tab === "extra" && <ClientApprofondimenti />}
      <div className="fixed bottom-0 max-w-md w-full bg-white border-t border-slate-200 flex justify-around py-2">
        {nav.map((n) => (
          <button key={n.key} onClick={() => setTab(n.key)} className={`flex flex-col items-center gap-1 px-3 py-1 text-xs ${tab === n.key ? "text-sky-500" : "text-slate-400"}`}>
            <n.icon size={20} />{n.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AREA ADMIN                                                          */
/* ------------------------------------------------------------------ */
function AdminClientDetail({ clientId, onBack, onChanged }) {
  const [client, setClient] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [notes, setNotes] = useState([]);
  const [tab, setTab] = useState("dati");
  const [salvando, setSalvando] = useState(false);

  const carica = async () => {
    const { data: c } = await supabase.from("clients").select("*").eq("id", clientId).single();
    setClient(c);
    const { data: ck } = await supabase.from("checkins").select("*").eq("client_id", clientId).order("data_check", { ascending: false });
    setCheckins(ck || []);
    const { data: nt } = await supabase.from("notes").select("*").eq("client_id", clientId).order("data", { ascending: false });
    setNotes(nt || []);
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
  const tabs = [{ key: "dati", label: "Dati" }, { key: "check", label: "Check" }, { key: "note", label: "Note" }];

  return (
    <div className="px-6 pt-6 pb-16 max-w-3xl mx-auto space-y-5">
      <button onClick={onBack} className="flex items-center gap-1 text-slate-500 text-sm"><ArrowLeft size={16} /> Tutti i clienti</button>
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold text-slate-800">{client.nome} {client.cognome}</h1><p className="text-slate-500 text-sm">{client.codice}</p></div>
        <StatoBadge stato={client.stato_check} />
      </div>
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded-full text-sm ${tab === t.key ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>{t.label}</button>
        ))}
      </div>

      {tab === "dati" && (
        <Card className="p-4 grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-slate-400 text-xs">Piano</p><p className="text-slate-700">{client.piano || "—"}</p></div>
          <div><p className="text-slate-400 text-xs">Stato pacchetto</p><p className="text-slate-700 capitalize">{client.stato_pacchetto || "—"}</p></div>
          <div><p className="text-slate-400 text-xs">Data inizio</p><p className="text-slate-700">{client.data_inizio || "—"}</p></div>
          <div><p className="text-slate-400 text-xs">Data scadenza</p><p className="text-slate-700">{client.data_scadenza || "—"}</p></div>
          <div className="col-span-2">
            <p className="text-slate-400 text-xs">Prossimo check</p>
            <input type="date" defaultValue={client.prossimo_check || ""} onBlur={(e) => salvaCliente({ prossimo_check: e.target.value || null })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div className="col-span-2">
            <p className="text-slate-400 text-xs">Link scheda</p>
            <input defaultValue={client.link_scheda || ""} onBlur={(e) => salvaCliente({ link_scheda: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          {salvando && <p className="text-slate-400 text-xs col-span-2">Salvataggio...</p>}
        </Card>
      )}

      {tab === "check" && (
        <Card className="p-4">
          <ul className="space-y-2">
            {checkins.map((r) => (
              <li key={r.id} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                <span className="text-slate-600">{r.data_check}</span>
                <span className="text-slate-700">{r.peso_kg ? `${r.peso_kg} kg` : "—"}</span>
                <StatoBadge stato={r.stato} />
              </li>
            ))}
            {checkins.length === 0 && <p className="text-slate-400 text-sm">Nessun check ancora.</p>}
          </ul>
        </Card>
      )}

      {tab === "note" && (
        <div className="space-y-3">
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

function AdminList({ clients, onSelect }) {
  const inScadenza = clients.filter((c) => c.stato_pacchetto === "in scadenza");
  const daFare = clients.filter((c) => c.stato_check === "da_compilare");

  return (
    <div className="px-6 pt-6 pb-16 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-800">Dashboard coach</h1>
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
        <AdminList clients={clients} onSelect={setSelectedId} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ROOT — decide se sei admin o cliente in base al database            */
/* ------------------------------------------------------------------ */
export default function App() {
  const [session, setSession] = useState(undefined);
  const [ruolo, setRuolo] = useState(null); // "admin" | "client" | null

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
  if (ruolo === null) return <Spinner />;

  return ruolo === "admin" ? <AdminApp /> : <ClientApp session={session} />;
}
