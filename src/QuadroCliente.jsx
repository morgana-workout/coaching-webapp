import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

/* Solo coach: quadro generale della cliente, note rapide, traguardi e ultime notifiche, elenco laterale. */

const dmy = (d) => (d ? d.split("-").reverse().join("/") : "");
function durata(dataInizio) {
  if (!dataInizio) return null;
  const p = dataInizio.split("-");
  const ini = new Date(+p[0], +p[1] - 1, +p[2]);
  const giorni = Math.max(0, Math.floor((Date.now() - ini.getTime()) / 86400000));
  if (giorni < 14) return giorni + (giorni === 1 ? " giorno" : " giorni");
  if (giorni < 60) return Math.floor(giorni / 7) + " settimane";
  const mesi = Math.round(giorni / 30.4);
  if (mesi < 12) return mesi + " mesi";
  const anni = Math.floor(mesi / 12), r = mesi % 12;
  return anni + (anni === 1 ? " anno" : " anni") + (r ? " e " + r + " mesi" : "");
}
function giorniA(data) {
  if (!data) return null;
  const p = data.split("-");
  return Math.round((new Date(+p[0], +p[1] - 1, +p[2], 12) - new Date()) / 86400000);
}

function Voce({ label, valore, sotto }) {
  return (
    <div className="text-center min-w-0">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-[15px] font-semibold text-slate-800 truncate">{valore || "—"}</p>
      {sotto && <p className="text-[11px] text-slate-500 truncate">{sotto}</p>}
    </div>
  );
}

export function QuadroGenerale({ client, checkins }) {
  const [lezioni, setLezioni] = useState(null);
  const [inizioReale, setInizioReale] = useState(null);
  const isBulb = client.tipo_servizio === "presenza" || client.tipo_servizio === "ibrido";
  const incluse = client.pacchetto_lezioni ? Number(client.pacchetto_lezioni) : 0;
  useEffect(() => {
    if (isBulb && incluse) {
      supabase.from("lezioni_svolte").select("fatta, data").eq("client_id", client.id).then(({ data }) => {
        const oggi = new Date(); const o = oggi.getFullYear() + "-" + String(oggi.getMonth() + 1).padStart(2, "0") + "-" + String(oggi.getDate()).padStart(2, "0");
        // conta come svolta anche una lezione con data già passata (se viene annullata la data si toglie)
        setLezioni((data || []).filter((l) => l.fatta || (l.data && l.data < o)).length);
      });
    } else setLezioni(null);
    setInizioReale(null);
    if (!client.data_inizio) {
      const ultimo = (checkins || []).map((c) => c.data_check).filter(Boolean).sort()[0];
      setInizioReale(ultimo || (client.created_at ? client.created_at.slice(0, 10) : null));
    }
  }, [client.id, client.data_inizio]);
  const inizio = client.data_inizio || inizioReale;
  const ck = (checkins || [])[0];
  const gCheck = ck?.data_check ? -giorniA(ck.data_check) : null;
  const gScad = giorniA(client.data_scadenza);
  const tipo = client.tipo_servizio === "ibrido" ? "Online + lezioni" : client.tipo_servizio === "presenza" ? "In presenza" : "Online";
  const pacchetto = [client.piano, incluse ? incluse + " lezioni" : null].filter(Boolean).join(" · ") || tipo;
  return (
    <div className="bg-white border border-sky-200 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <Voce label="Con me da" valore={durata(inizio)} sotto={inizio ? "dal " + dmy(inizio) : null} />
      <Voce label="Pacchetto" valore={pacchetto} sotto={tipo} />
      <Voce label="Scadenza" valore={client.data_scadenza ? dmy(client.data_scadenza).slice(0, 5) : null} sotto={gScad === null ? null : gScad < 0 ? "scaduto da " + (-gScad) + " gg" : gScad === 0 ? "oggi" : "tra " + gScad + " giorni"} />
      <Voce label="Lezioni" valore={incluse ? (lezioni ?? 0) + " / " + incluse : null} sotto={incluse ? "fatte" : "non previste"} />
      <Voce label="Ultimo check" valore={gCheck === null ? "mai" : gCheck <= 0 ? "oggi" : gCheck + " gg fa"} sotto={ck?.peso_kg ? ck.peso_kg + " kg" : null} />
      <Voce label="Telefono" valore={client.telefono || null} sotto={client.email || null} />
    </div>
  );
}

export function NoteRapide({ client }) {
  const [testo, setTesto] = useState("");
  const [stato, setStato] = useState("");
  const pronto = useRef(false);
  const timer = useRef(null);
  useEffect(() => {
    pronto.current = false; setTesto(""); setStato("");
    supabase.from("note_rapide_coach").select("testo").eq("client_id", client.id).maybeSingle().then(({ data }) => {
      setTesto(data?.testo || ""); pronto.current = true;
    });
  }, [client.id]);
  const cambia = (v) => {
    setTesto(v); setStato("");
    if (!pronto.current) return;
    clearTimeout(timer.current);
    const id = client.id;
    timer.current = setTimeout(async () => {
      const { error } = await supabase.from("note_rapide_coach").upsert({ client_id: id, testo: v, updated_at: new Date().toISOString() });
      setStato(error ? "Non salvato, riprova" : "Salvato ✓");
    }, 800);
  };
  return (
    <div>
      <textarea value={testo} onChange={(e) => cambia(e.target.value)} rows={5} placeholder={"Le tue note su " + client.nome + "… (si salvano da sole)"} className="w-full text-[13px] leading-relaxed text-slate-800 bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2" />
      {stato && <p className="text-[11px] text-slate-500 mt-1">{stato}</p>}
    </div>
  );
}

export function TraguardiENotifiche({ client }) {
  const [tr, setTr] = useState(null);
  const [nt, setNt] = useState(null);
  useEffect(() => {
    setTr(null); setNt(null);
    (async () => {
      const { data } = await supabase.from("notifiche").select("tipo, proposta_luogo, messaggio, stato, created_at").eq("client_id", client.id).order("created_at", { ascending: false }).limit(60);
      const righe = data || [];
      setTr(righe.filter((n) => (n.proposta_luogo || "").startsWith("auto_traguardo")).slice(0, 6));
      setNt(righe.slice(0, 6));
    })();
  }, [client.id]);
  const titolo = (n) => {
    const m = n.proposta_luogo || "";
    if (n.tipo === "proposta_lezione") return "Proposta di orario";
    if (m.startsWith("promemoria_pacchetto")) return "Pacchetto in scadenza";
    if (m.startsWith("promemoria_check")) return "Check in arrivo";
    if (m.startsWith("auto_check")) return "Check ricevuto";
    if (m.startsWith("auto_pacchetto")) return "Pacchetto quasi finito";
    if (m.startsWith("auto_traguardo_record")) return "Nuovo record";
    if (m.startsWith("auto_traguardo_streak")) return "Costanza";
    if (m.startsWith("lez_")) return "Lezione";
    return "Nota";
  };
  const data = (s) => new Date(s).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
  const Box = ({ titolo: t, righe, vuoto, cosa }) => (
    <div className="bg-white border border-sky-200 rounded-2xl p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">{t}</p>
      {righe === null ? <p className="text-xs text-slate-400">Carico…</p> : righe.length === 0 ? <p className="text-sm text-slate-400">{vuoto}</p> : (
        <ul className="space-y-1.5">{righe.map((n, i) => (
          <li key={i} className="text-[13px] text-slate-700"><span className="text-slate-400 text-[11px] mr-2">{data(n.created_at)}</span><span className="font-medium">{titolo(n)}</span>{cosa && n.messaggio ? <span className="text-slate-500"> — {n.messaggio.length > 70 ? n.messaggio.slice(0, 70) + "…" : n.messaggio}</span> : null}</li>
        ))}</ul>
      )}
    </div>
  );
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Box titolo="Traguardi log allenamento" righe={tr} vuoto="Ancora nessun traguardo registrato" cosa />
      <Box titolo="Ultime notifiche inviate alla cliente" righe={nt} vuoto="Nessuna notifica inviata" />
    </div>
  );
}

export function ElencoLaterale({ clients, attivoId, onSelect }) {
  const [q, setQ] = useState("");
  const [nuovi, setNuovi] = useState({});
  useEffect(() => {
    const carica = async () => {
      try {
        const { data } = await supabase.from("messaggi").select("client_id").eq("mittente", "cliente").eq("letto", false).eq("nascosto_coach", false);
        const m = {}; (data || []).forEach((r) => { m[r.client_id] = (m[r.client_id] || 0) + 1; }); setNuovi(m);
      } catch (e) { /* ignora */ }
    };
    carica(); const t = setInterval(carica, 20000); return () => clearInterval(t);
  }, []);
  const lista = clients.filter((c) => !c.archiviato && (!q || (c.nome + " " + (c.cognome || "")).toLowerCase().includes(q.toLowerCase())));
  return (
    <aside className="hidden lg:block w-56 flex-shrink-0 bg-white border-r border-sky-100 sticky top-0 h-screen overflow-y-auto p-3">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca cliente" className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] mb-2" />
      {lista.map((c) => (
        <button key={c.id} onClick={() => onSelect(c.id)} className={`w-full flex items-center justify-between text-left px-3 py-1.5 rounded-lg text-[13px] mb-0.5 ${c.id === attivoId ? "bg-sky-100 text-sky-700 font-semibold" : "text-slate-700 hover:bg-slate-50"}`}>
          <span className="truncate">{c.nome} {c.cognome ? c.cognome[0] + "." : ""}</span>
          {nuovi[c.id] ? <span className="bg-slate-800 text-white rounded-full px-1.5 text-[10px]">{nuovi[c.id]}</span> : null}
        </button>
      ))}
    </aside>
  );
}

export function PrimoEUltimoCheck({ checkins, onApriConfronto }) {
  const ANGOLI = [["foto_frontale_path", "Frontale"], ["foto_laterale_path", "Laterale"], ["foto_posteriore_path", "Dietro"]];
  const [angolo, setAngolo] = useState("foto_frontale_path");
  const [urls, setUrls] = useState({});
  const ordinati = [...(checkins || [])].filter((c) => c.data_check).sort((a, b) => a.data_check.localeCompare(b.data_check));
  const primo = ordinati[0], ultimo = ordinati.length > 1 ? ordinati[ordinati.length - 1] : null;
  const idKey = (primo?.id || "") + "|" + (ultimo?.id || "") + "|" + angolo;
  useEffect(() => {
    let vivo = true; setUrls({});
    (async () => {
      const u = {};
      for (const c of [primo, ultimo]) {
        if (c && c[angolo]) {
          const { data } = await supabase.storage.from("progress-photos").createSignedUrl(c[angolo], 3600);
          if (data?.signedUrl) u[c.id] = data.signedUrl;
        }
      }
      if (vivo) setUrls(u);
    })();
    return () => { vivo = false; };
  }, [idKey]);
  if (!primo) return <p className="text-sm text-slate-400">Nessun check ancora ricevuto.</p>;
  const Lato = ({ c, titolo }) => (
    <div className="flex-1 min-w-0">
      <div className="h-48 rounded-xl bg-sky-50 border border-sky-100 overflow-hidden flex items-center justify-center">
        {urls[c.id] ? <ImmagineZoom src={urls[c.id]} alt={titolo} /> : <span className="text-[11px] text-sky-700 px-2 text-center">{c[angolo] ? "Carico…" : "Nessuna foto"}</span>}
      </div>
      <p className="text-[11px] text-slate-500 mt-1">{titolo} · {dmy(c.data_check)}</p>
      <p className="text-[12px] text-slate-700">{c.peso_kg ? c.peso_kg + " kg" : "—"}{c.ombelico_cm ? " · ombelico " + c.ombelico_cm + " cm" : ""}</p>
    </div>
  );
  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <Lato c={primo} titolo="Primo" />
        {ultimo ? <Lato c={ultimo} titolo="Ultimo" /> : <div className="flex-1 flex items-center justify-center text-[12px] text-slate-400 border border-dashed border-sky-200 rounded-xl">Un solo check finora</div>}
      </div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {ANGOLI.map(([k, l]) => <button key={k} onClick={() => setAngolo(k)} className={`px-2.5 py-1 rounded-full text-[11px] ${angolo === k ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>{l}</button>)}
        <button onClick={onApriConfronto} className="text-sky-700 text-[12px] font-medium ml-auto">Confronto completo →</button>
      </div>
    </div>
  );
}

// Immagine con zoom a due dita (touch), trackpad/ctrl+rotella e trascinamento; doppio tocco/click per ripristinare.
export function ImmagineZoom({ src, alt }) {
  const [v, setV] = useState({ z: 1, x: 0, y: 0 });
  const box = useRef(null);
  const punti = useRef(new Map());
  const base = useRef(null);
  const limita = (z, x, y) => {
    const r = box.current?.getBoundingClientRect();
    const mx = r ? ((z - 1) * r.width) / 2 : 0, my = r ? ((z - 1) * r.height) / 2 : 0;
    return { z, x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
  };
  useEffect(() => {
    const el = box.current; if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setV((o) => { const z = Math.max(1, Math.min(6, o.z * Math.exp(-e.deltaY * 0.01))); return z === 1 ? { z: 1, x: 0, y: 0 } : limita(z, o.x, o.y); });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  useEffect(() => { setV({ z: 1, x: 0, y: 0 }); }, [src]);
  const dist = () => { const a = [...punti.current.values()]; return a.length >= 2 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0; };
  const giu = (e) => { e.currentTarget.setPointerCapture?.(e.pointerId); punti.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); base.current = { d: dist(), v, px: e.clientX, py: e.clientY }; };
  const muovi = (e) => {
    if (!punti.current.has(e.pointerId)) return;
    punti.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const b = base.current; if (!b) return;
    if (punti.current.size >= 2 && b.d > 0) {
      const z = Math.max(1, Math.min(6, b.v.z * (dist() / b.d)));
      setV(z === 1 ? { z: 1, x: 0, y: 0 } : limita(z, b.v.x, b.v.y));
    } else if (punti.current.size === 1 && b.v.z > 1) {
      setV(limita(b.v.z, b.v.x + (e.clientX - b.px), b.v.y + (e.clientY - b.py)));
    }
  };
  const su = (e) => { punti.current.delete(e.pointerId); base.current = { d: dist(), v: { ...v }, px: e.clientX, py: e.clientY }; };
  return (
    <div ref={box} onPointerDown={giu} onPointerMove={muovi} onPointerUp={su} onPointerCancel={su} onDoubleClick={() => setV({ z: 1, x: 0, y: 0 })}
      style={{ touchAction: "none", overflow: "hidden", cursor: v.z > 1 ? "grab" : "zoom-in" }} className="w-full h-full">
      <img src={src} alt={alt} draggable={false} className="w-full h-full object-cover select-none" style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.z})`, transformOrigin: "center" }} />
    </div>
  );
}
