import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { Trophy, Gift, Copy, Check, Plus, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Sfide e Codice amica                                                */
/* (Card e Spinner duplicati qui perché App.jsx non li esporta)        */
/* ------------------------------------------------------------------ */
function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>{children}</div>;
}
function Spinner() {
  return <div className="flex justify-center pt-12"><div className="w-8 h-8 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" /></div>;
}

function pad(n) { return n < 10 ? "0" + n : "" + n; }
function oggiStr() { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function fmtData(s) { return s ? s.split("-").reverse().join("/") : ""; }
function nomeCompleto(c) { return c ? `${c.nome || ""} ${c.cognome || ""}`.trim() : "Cliente"; }
function fmtNum(n) { return String(Math.round(Number(n) * 100) / 100).replace(".", ","); }

// Chiede al server di mandare una notifica sul telefono. Non blocca mai l'app se qualcosa va storto.
function inviaPushLocale(body) {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) return;
    supabase.functions.invoke("invia-push", { body, headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => {});
  }).catch(() => {});
}

async function copiaTesto(testo) {
  try {
    await navigator.clipboard.writeText(testo);
    return true;
  } catch (e) {
    return false;
  }
}

/* ---------- Calcolo avanzamento di una sfida ---------- */
function tappeDi(s) {
  return String(s?.tappe || "").split(/[,;\s]+/).map((x) => Number(x.replace(",", "."))).filter((n) => !isNaN(n) && n > 0);
}
function targetGiorno(s, k) {
  const t = tappeDi(s);
  if (t.length) return t[Math.min(k, t.length - 1)];
  return Number(s?.traguardo) || 0;
}
function totaleGiorni(s) {
  return Number(s?.giorni) || tappeDi(s).length || 7;
}
function vociDi(s) {
  return String(s?.voci || "").split(/\n/).map((r) => r.trim()).filter(Boolean).map((r) => {
    const p = r.split("|").map((x) => x.trim());
    return { nome: p[0], kg: Number(String(p[1] || "").replace(",", ".")) || 0, rip: p[2] || "" };
  }).filter((v) => v.nome);
}
function avanzamento(s, regs) {
  if (s.tipo === "scheda") {
    const voci = vociDi(s).map((v) => {
      const migliore = regs.filter((r) => r.voce === v.nome).reduce((m, r) => Math.max(m, Number(r.valore)), 0);
      return { ...v, migliore, ok: v.kg > 0 && migliore >= v.kg };
    });
    const fatti = voci.filter((v) => v.ok).length;
    return { tipo: "scheda", voci, fatti, totale: voci.length, completa: voci.length > 0 && fatti === voci.length };
  }
  if (s.tipo === "obiettivo") {
    const migliore = regs.reduce((m, r) => Math.max(m, Number(r.valore)), 0);
    const trg = Number(s.traguardo) || 0;
    return { tipo: "obiettivo", migliore, traguardo: trg, completa: trg > 0 && migliore >= trg, fatti: migliore >= trg ? 1 : 0, totale: 1 };
  }
  // Giorni: per ogni giorno conta il valore migliore; il giorno è valido se raggiunge il traguardo del suo turno
  const perGiorno = {};
  regs.forEach((r) => { perGiorno[r.giorno] = Math.max(perGiorno[r.giorno] || 0, Number(r.valore)); });
  const giorni = Object.keys(perGiorno).sort();
  let k = 0;
  giorni.forEach((g) => { if (perGiorno[g] >= targetGiorno(s, k)) k += 1; });
  const totale = totaleGiorni(s);
  return { tipo: "giorni", fatti: Math.min(k, totale), totale, prossimo: targetGiorno(s, Math.min(k, totale - 1)), completa: k >= totale };
}
function descriviSfida(s) {
  if (s.tipo === "scheda") return `${vociDi(s).length} esercizi · raggiungi tutti i carichi`;
  if (s.tipo === "obiettivo") return `Raggiungi ${fmtNum(s.traguardo)} ${s.unita || ""}`.trim();
  const t = tappeDi(s);
  const n = totaleGiorni(s);
  if (t.length) return `${n} giorni · da ${fmtNum(t[0])} a ${fmtNum(t[t.length - 1])} ${s.unita || ""}`.trim();
  return `${n} giorni · almeno ${fmtNum(s.traguardo)} ${s.unita || ""}`.trim();
}

/* ================================================================== */
/* CLIENTE: tab Sfide                                                  */
/* ================================================================== */
function SchedaSfidaCliente({ sfida, adesione, regs, client, onCambiato, onAbbandonata }) {
  const av = adesione ? avanzamento(sfida, regs) : null;
  const oggiS = oggiStr();
  const oggiReg = sfida.tipo === "giorni" ? regs.find((r) => r.giorno === oggiS) : null;
  const [valore, setValore] = useState(oggiReg ? String(oggiReg.valore) : "");
  const [nota, setNota] = useState("");
  const [video, setVideo] = useState("");
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState("");
  const [mostraRegs, setMostraRegs] = useState(false);
  const [valoriVoci, setValoriVoci] = useState({});
  const [videoVoci, setVideoVoci] = useState({});
  const [confermaAbb, setConfermaAbb] = useState(false);

  const abbandona = async () => {
    setLavoro(true);
    await supabase.from("sfide_adesioni").delete().eq("id", adesione.id);
    setLavoro(false);
    setConfermaAbb(false);
    onCambiato();
    onAbbandonata?.();
  };

  const salvaVoce = async (voce) => {
    const n = Number(String(valoriVoci[voce.nome] || "").replace(",", "."));
    if (!(n > 0)) { setErrore("Inserisci il carico in kg 🙂"); return; }
    if (!String(videoVoci[voce.nome] || "").trim()) { setErrore("Per ogni esercizio serve il link al video: aggiungilo sotto «" + voce.nome + "» 🎥"); return; }
    setErrore("");
    setLavoro(true);
    await supabase.from("sfide_registrazioni").insert({ adesione_id: adesione.id, client_id: client.id, giorno: oggiS, voce: voce.nome, valore: n, nota: nota.trim() || null, video_url: String(videoVoci[voce.nome]).trim() });
    const { data: tutte } = await supabase.from("sfide_registrazioni").select("*").eq("adesione_id", adesione.id);
    const nuovo = avanzamento(sfida, tutte || []);
    if (nuovo.completa && adesione.stato === "in_corso") {
      await supabase.from("sfide_adesioni").update({ stato: "da_approvare", completata_il: new Date().toISOString() }).eq("id", adesione.id);
      inviaPushLocale({ evento: "sfida", adesione_id: adesione.id });
    }
    setLavoro(false);
    setNota("");
    setValoriVoci((x) => ({ ...x, [voce.nome]: "" }));
    setVideoVoci((x) => ({ ...x, [voce.nome]: "" }));
    onCambiato();
  };

  const inizia = async () => {
    setLavoro(true);
    await supabase.from("sfide_adesioni").insert({ sfida_id: sfida.id, client_id: client.id });
    setLavoro(false);
    onCambiato();
  };

  const salva = async () => {
    const v = Number(String(valore).replace(",", "."));
    if (!(v > 0)) { setErrore("Inserisci un numero maggiore di zero 🙂"); return; }
    if (!video.trim()) { setErrore("Aggiungi il link al video della prova: è obbligatorio 🎥"); return; }
    setErrore("");
    setLavoro(true);
    const payload = { valore: v, nota: nota.trim() || null, video_url: video.trim() || null };
    if (oggiReg) {
      await supabase.from("sfide_registrazioni").update(payload).eq("id", oggiReg.id);
    } else {
      await supabase.from("sfide_registrazioni").insert({ adesione_id: adesione.id, client_id: client.id, giorno: oggiS, ...payload });
    }
    const { data: tutte } = await supabase.from("sfide_registrazioni").select("*").eq("adesione_id", adesione.id);
    const nuovo = avanzamento(sfida, tutte || []);
    if (nuovo.completa && adesione.stato === "in_corso") {
      await supabase.from("sfide_adesioni").update({ stato: "da_approvare", completata_il: new Date().toISOString() }).eq("id", adesione.id);
      inviaPushLocale({ evento: "sfida", adesione_id: adesione.id });
    }
    setLavoro(false);
    setNota("");
    setVideo("");
    onCambiato();
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0"><Trophy size={20} /></div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm">{sfida.titolo}</p>
          <p className="text-xs text-slate-500 mt-0.5">{descriviSfida(sfida)}</p>
        </div>
      </div>
      {sfida.descrizione && <p className="text-sm text-slate-600 whitespace-pre-wrap">{sfida.descrizione}</p>}
      {sfida.premio && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-sm text-amber-800">
          <Gift size={16} className="flex-shrink-0" /> <span>Premio: {sfida.premio}</span>
        </div>
      )}

      {sfida.tipo === "scheda" && !(adesione && adesione.stato === "in_corso") && (
        <div className="space-y-1">
          {vociDi(sfida).map((v) => (
            <p key={v.nome} className="text-sm text-slate-700 flex justify-between gap-2"><span>{v.nome}</span><span className="font-semibold">{fmtNum(v.kg)} kg{v.rip ? ` × ${v.rip}` : ""}</span></p>
          ))}
        </div>
      )}

      {!adesione && (
        <button onClick={inizia} disabled={lavoro} className="w-full bg-sky-500 text-white rounded-xl py-2.5 text-sm font-medium">
          {lavoro ? "Un attimo..." : "Accetto la sfida 💪🏻"}
        </button>
      )}

      {adesione && adesione.stato === "completata" && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl px-3 py-3 text-sm">
          Sfida completata, che brava! 🏆🔥
          {sfida.premio && <p className="mt-1">{adesione.premio_consegnato ? "Il tuo premio è già stato consegnato ✨" : "Il tuo premio ti aspetta: Morgana ti scrive presto 🫶🏻"}</p>}
        </div>
      )}

      {adesione && adesione.stato === "da_approvare" && (
        <div className="bg-sky-50 border border-sky-100 text-sky-700 rounded-xl px-3 py-3 text-sm">
          Sfida completata! 🏆 Morgana deve solo dare un'occhiata e confermare: ti scrive presto ✨
        </div>
      )}

      {adesione && adesione.stato === "in_corso" && av && av.tipo === "scheda" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Carichi raggiunti: <span className="font-semibold">{av.fatti}</span> su {av.totale}. Quando li hai tutti, vinci! 🏆</p>
          <div className="space-y-2">
            {av.voci.map((v) => (
              <div key={v.nome} className={`rounded-xl border px-3 py-2 ${v.ok ? "bg-emerald-50 border-emerald-100" : "bg-white border-slate-200"}`}>
                <div className="flex justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-800">{v.ok ? "✅ " : ""}{v.nome}</span>
                  <span className="text-slate-600">{fmtNum(v.kg)} kg{v.rip ? ` × ${v.rip}` : ""}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Il tuo migliore: {v.migliore ? `${fmtNum(v.migliore)} kg` : "—"}</p>
                {!v.ok && (
                  <div className="space-y-2 mt-2">
                    <div className="flex gap-2">
                      <input type="text" inputMode="decimal" value={valoriVoci[v.nome] || ""} onChange={(e) => setValoriVoci((x) => ({ ...x, [v.nome]: e.target.value }))}
                        placeholder="kg" className="w-24 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
                      <button onClick={() => salvaVoce(v)} disabled={lavoro} className="flex-1 bg-slate-800 text-white rounded-lg py-1.5 text-xs font-medium">{lavoro ? "Salvo..." : "Salva"}</button>
                    </div>
                    <input type="text" value={videoVoci[v.nome] || ""} onChange={(e) => setVideoVoci((x) => ({ ...x, [v.nome]: e.target.value }))}
                      placeholder="Link al video di questo esercizio (obbligatorio) 🎥" className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Una nota per Morgana (facoltativa)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          {errore && <p className="text-rose-500 text-sm">{errore}</p>}
        </div>
      )}

      {adesione && adesione.stato === "in_corso" && av && av.tipo !== "scheda" && (
        <div className="space-y-3">
          {av.tipo === "giorni" ? (
            <>
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: av.totale }).map((_, i) => (
                  <span key={i} className={`w-7 h-7 rounded-lg text-[11px] font-semibold flex items-center justify-center ${i < av.fatti ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"}`}>{i + 1}</span>
                ))}
              </div>
              <p className="text-sm text-slate-600">
                Giorno <span className="font-semibold">{Math.min(av.fatti + 1, av.totale)}</span> di {av.totale} · traguardo di oggi: <span className="font-semibold">{fmtNum(av.prossimo)} {sfida.unita || ""}</span>
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-600">
              Il tuo migliore finora: <span className="font-semibold">{av.migliore ? `${fmtNum(av.migliore)} ${sfida.unita || ""}` : "—"}</span> · obiettivo: <span className="font-semibold">{fmtNum(av.traguardo)} {sfida.unita || ""}</span>
            </p>
          )}

          <div className="space-y-2">
            <label className="text-xs text-slate-500">
              {sfida.tipo === "giorni" ? `Il tuo risultato di oggi${sfida.unita ? " (" + sfida.unita + ")" : ""}` : `Il tuo nuovo risultato${sfida.unita ? " (" + sfida.unita + ")" : ""}`}
            </label>
            <input type="text" inputMode="decimal" value={valore} onChange={(e) => setValore(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Una nota per Morgana (facoltativa)"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input type="text" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="Link al video della prova (obbligatorio) 🎥"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            {errore && <p className="text-rose-500 text-sm">{errore}</p>}
            <button onClick={salva} disabled={lavoro} className="w-full bg-slate-800 text-white rounded-xl py-2.5 text-sm font-medium">
              {lavoro ? "Salvo..." : oggiReg ? "Aggiorna il risultato di oggi" : "Salva il risultato"}
            </button>
          </div>
        </div>
      )}

      {adesione && regs.length > 0 && (
        <div>
          <button onClick={() => setMostraRegs(!mostraRegs)} className="text-sky-600 text-xs font-medium">{mostraRegs ? "Nascondi i miei risultati" : `Vedi i miei risultati (${regs.length})`}</button>
          {mostraRegs && (
            <div className="mt-2 space-y-1">
              {[...regs].sort((a, b) => b.giorno.localeCompare(a.giorno)).map((r) => (
                <p key={r.id} className="text-xs text-slate-600">{fmtData(r.giorno)} · {r.voce ? r.voce + " · " : ""}<span className="font-semibold">{fmtNum(r.valore)} {sfida.unita || ""}</span>{r.nota ? ` · ${r.nota}` : ""}</p>
              ))}
            </div>
          )}
        </div>
      )}
      {adesione && adesione.stato === "in_corso" && (
        <div className="pt-1 border-t border-slate-100">
          {!confermaAbb ? (
            <button onClick={() => setConfermaAbb(true)} className="text-xs text-slate-400 underline">Abbandona la sfida</button>
          ) : (
            <div className="space-y-2 pt-2">
              <p className="text-sm text-slate-600">Vuoi davvero lasciare questa sfida? 🫶🏻 I risultati che hai salvato verranno cancellati, ma potrai ricominciare quando vorrai.</p>
              <div className="flex gap-2">
                <button onClick={abbandona} disabled={lavoro} className="flex-1 bg-rose-500 text-white rounded-xl py-2 text-sm font-medium">{lavoro ? "Un attimo..." : "Sì, abbandono"}</button>
                <button onClick={() => setConfermaAbb(false)} className="px-4 rounded-xl border border-slate-200 text-sm text-slate-600">Continuo</button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function SfideCliente({ client }) {
  const [aperta, setAperta] = useState(null);
  const [sfide, setSfide] = useState(null);
  const [adesioni, setAdesioni] = useState([]);
  const [regs, setRegs] = useState([]);

  const carica = async () => {
    const { data: s } = await supabase.from("sfide").select("*").eq("attiva", true).order("created_at", { ascending: false });
    const { data: a } = await supabase.from("sfide_adesioni").select("*").eq("client_id", client.id);
    const ids = (a || []).map((x) => x.id);
    let r = [];
    if (ids.length) {
      const { data } = await supabase.from("sfide_registrazioni").select("*").in("adesione_id", ids).order("giorno").order("created_at");
      r = data || [];
    }
    setSfide(s || []);
    setAdesioni(a || []);
    setRegs(r);
  };
  useEffect(() => { carica(); }, [client.id]);

  if (sfide === null) return <Spinner />;
  const ordinate = [...sfide].sort((a, b) => {
    const pa = adesioni.find((x) => x.sfida_id === a.id);
    const pb = adesioni.find((x) => x.sfida_id === b.id);
    const rango = (p) => (!p ? 0 : p.stato === "in_corso" ? 1 : p.stato === "da_approvare" ? 2 : 3);
    return rango(pa) - rango(pb);
  });

  const sAperta = aperta ? sfide.find((x) => x.id === aperta) : null;
  if (sAperta) {
    const adA = adesioni.find((x) => x.sfida_id === sAperta.id) || null;
    return (
      <div className="px-5 pt-6 pb-24 space-y-4">
        <button onClick={() => { setAperta(null); window.scrollTo(0, 0); }} className="text-sky-600 text-sm font-medium">← Tutte le sfide</button>
        <SchedaSfidaCliente key={sAperta.id} sfida={sAperta} adesione={adA} regs={adA ? regs.filter((r) => r.adesione_id === adA.id) : []} client={client} onCambiato={carica} onAbbandonata={() => { setAperta(null); window.scrollTo(0, 0); }} />
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-24 space-y-4">
      <div>
        <p className="text-lg font-semibold text-slate-800">Le tue sfide 🏆</p>
        <p className="text-sm text-slate-500 mt-1">Mettiti alla prova, un passo alla volta: al traguardo ti aspetta un premio ✨</p>
      </div>
      {ordinate.length === 0 && (
        <Card className="p-5 text-center text-slate-500 text-sm">Per ora non ci sono sfide attive 🫶🏻 Presto ne arriveranno di nuove!</Card>
      )}
      {ordinate.map((s) => {
        const ad = adesioni.find((x) => x.sfida_id === s.id) || null;
        const av = ad ? avanzamento(s, regs.filter((r) => r.adesione_id === ad.id)) : null;
        let etichetta = "Nuova ✨";
        let colore = "bg-sky-100 text-sky-700";
        if (ad && ad.stato === "completata") { etichetta = "Completata 🏆"; colore = "bg-emerald-100 text-emerald-700"; }
        else if (ad && ad.stato === "da_approvare") { etichetta = "In verifica"; colore = "bg-amber-100 text-amber-700"; }
        else if (ad) { etichetta = av && av.tipo !== "obiettivo" ? `In corso · ${av.fatti}/${av.totale}` : "In corso"; colore = "bg-slate-100 text-slate-600"; }
        return (
          <Card key={s.id} className="p-4 space-y-2">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0"><Trophy size={20} /></div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm">{s.titolo}</p>
                <p className="text-xs text-slate-500 mt-0.5">{descriviSfida(s)}</p>
              </div>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${colore}`}>{etichetta}</span>
            </div>
            {s.premio && <p className="text-xs text-amber-700">🎁 Premio: {s.premio}</p>}
            <button onClick={() => { setAperta(s.id); window.scrollTo(0, 0); }} className={`w-full rounded-xl py-2 text-sm font-medium ${!ad ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-700"}`}>
              {!ad ? "Scopri la sfida" : ad.stato === "in_corso" ? "Apri la sfida" : "Apri"}
            </button>
          </Card>
        );
      })}
    </div>
  );
}

/* ================================================================== */
/* CLIENTE: card Codice amica (Home)                                   */
/* ================================================================== */
export function CodiceAmicaCliente({ client, onAggiornato }) {
  const [sconti, setSconti] = useState([]);
  const [codice, setCodice] = useState("");
  const [esito, setEsito] = useState("");
  const [lavoro, setLavoro] = useState(false);
  const [copiato, setCopiato] = useState(false);

  const carica = async () => {
    const { data } = await supabase.from("sconti_amica").select("*").eq("client_id", client.id).order("created_at", { ascending: false });
    setSconti(data || []);
  };
  useEffect(() => { carica(); }, [client.id]);

  const giorniDallaCreazione = client.created_at ? (Date.now() - new Date(client.created_at).getTime()) / 86400000 : 999;
  const puoUsare = !client.codice_usato && giorniDallaCreazione <= 30;

  const applica = async () => {
    if (!codice.trim()) { setEsito("Scrivi il codice della tua amica 🙂"); return; }
    setLavoro(true);
    setEsito("");
    const { data, error } = await supabase.rpc("usa_codice_amica", { p_codice: codice });
    setLavoro(false);
    if (error) { setEsito("Qualcosa non ha funzionato, riprova tra poco 🫶🏻"); return; }
    const msg = {
      ok: "Codice applicato! 🎉 Hai uno sconto di 10 € e anche la tua amica ✨",
      gia_usato: "Hai già usato un codice amica 🫶🏻",
      scaduto: "Il codice amica si può inserire solo nei primi 30 giorni dall'iscrizione 🫶🏻",
      non_trovato: "Non trovo questo codice: controlla di averlo scritto bene 🙂",
      tuo: "Questo è il tuo codice! Daglielo a una tua amica 😉",
      nessun_profilo: "Non trovo il tuo profilo, scrivi a Morgana 🫶🏻",
    }[data] || "Qualcosa non ha funzionato, riprova tra poco 🫶🏻";
    setEsito(msg);
    if (data === "ok") { setCodice(""); await carica(); onAggiornato?.(); }
  };

  const testoCondivisione = `Ciao! 🫶🏻 Con il mio codice ${client.codice_amica} hai 10 € di sconto sul percorso con Morgana ✨ Scrivi il codice quando ti iscrivi!`;
  const copia = async () => {
    const ok = await copiaTesto(client.codice_amica || "");
    if (ok) { setCopiato(true); setTimeout(() => setCopiato(false), 2000); }
  };
  const condividi = async () => {
    if (navigator.share) {
      try { await navigator.share({ text: testoCondivisione }); return; } catch (e) { /* annullato */ }
    }
    const ok = await copiaTesto(testoCondivisione);
    if (ok) { setCopiato(true); setTimeout(() => setCopiato(false), 2000); }
  };

  const daUsare = sconti.filter((s) => !s.usato);
  const usati = sconti.filter((s) => s.usato);

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Gift size={15} className="text-sky-500" />
        <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">Il tuo codice amica</p>
      </div>
      {client.codice_amica && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-50 border border-dashed border-slate-300 rounded-lg px-3 py-1.5 text-center">
              <span className="text-base font-bold tracking-widest text-slate-800">{client.codice_amica}</span>
            </div>
            <button onClick={copia} className="p-2 rounded-lg border border-slate-200 text-slate-600" aria-label="Copia il codice">
              {copiato ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
            </button>
          </div>
          <p className="text-xs text-slate-600">Regalalo a una tua amica: quando si iscrive con il tuo codice, <span className="font-semibold">10 € di sconto per lei e 10 € di sconto per te</span> 🫶🏻</p>
          <button onClick={condividi} className="w-full bg-sky-500 text-white rounded-lg py-1.5 text-xs font-medium">Condividi il codice ✨</button>
        </>
      )}

      {sconti.length > 0 && (
        <div className="space-y-2 pt-1">
          {daUsare.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-sm text-emerald-800">
              <span>🎁 Sconto di {fmtNum(s.importo)} € {s.motivo === "invito" ? "perché un'amica ha usato il tuo codice" : "per aver usato un codice amica"}</span>
              <span className="text-[11px] font-medium">da usare</span>
            </div>
          ))}
          {usati.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 text-sm text-slate-500">
              <span>Sconto di {fmtNum(s.importo)} € {s.motivo === "invito" ? "(invito)" : "(benvenuta)"}</span>
              <span className="text-[11px]">usato</span>
            </div>
          ))}
          {daUsare.length > 0 && <p className="text-xs text-slate-500">Lo sconto lo applica Morgana al prossimo pagamento: scrivile in chat quando vuoi usarlo 🫶🏻</p>}
        </div>
      )}

      {puoUsare && (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <p className="text-sm font-medium text-slate-700">Hai un codice amica?</p>
          <div className="flex gap-2">
            <input type="text" value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="Scrivilo qui"
              autoCapitalize="characters" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm uppercase" />
            <button onClick={applica} disabled={lavoro} className="px-4 rounded-xl bg-slate-800 text-white text-sm font-medium">{lavoro ? "..." : "Applica"}</button>
          </div>
          {esito && <p className="text-sm text-slate-600">{esito}</p>}
        </div>
      )}
      {!puoUsare && esito && <p className="text-sm text-slate-600">{esito}</p>}
    </Card>
  );
}

/* ================================================================== */
/* COACH                                                               */
/* ================================================================== */
export async function contaSfideCoach() {
  const { count: a } = await supabase.from("sfide_adesioni").select("id", { count: "exact", head: true }).eq("stato", "da_approvare");
  const { count: s } = await supabase.from("sconti_amica").select("id", { count: "exact", head: true }).eq("usato", false);
  return (a || 0) + (s || 0);
}

const SCHEDA_BASE = "Squat con bilanciere|60|5\nStacco da terra|70|5\nHip thrust|80|8\nPanca piana|40|5\nMilitary press|30|5\nRematore con bilanciere|45|8\nLat machine|50|8\nLeg press|150|10";
const PRESET = [
  { etichetta: "Scheda dei carichi", titolo: "La scheda dei carichi 🏋🏻‍♀️", descrizione: "Raggiungi o supera il carico indicato su tutti gli esercizi base, con le ripetizioni richieste e tecnica pulita. Quando li hai tutti, vinci!", tipo: "scheda", unita: "kg", giorni: "", tappe: "", traguardo: "", voci: SCHEDA_BASE },
  { etichetta: "Prima trazione", titolo: "La tua prima trazione", descrizione: "Una trazione completa alla sbarra, senza aiuti: mento sopra la sbarra e discesa controllata.", tipo: "obiettivo", unita: "trazioni", giorni: "", tappe: "", traguardo: "1", voci: "" },
  { etichetta: "Dead hang", titolo: "Appesa alla sbarra", descrizione: "Resta appesa alla sbarra con le spalle attive, senza toccare terra. Segna il tuo tempo migliore.", tipo: "obiettivo", unita: "secondi", giorni: "", tappe: "", traguardo: "40", voci: "" },
  { etichetta: "Squat 10 giorni", titolo: "Squat 10 giorni", descrizione: "Ogni giorno più squat a corpo libero, in una sola serie e con buona tecnica (anca sotto il ginocchio).", tipo: "giorni", unita: "ripetizioni", giorni: "10", tappe: "20,25,30,35,40,45,50,55,60,65", traguardo: "", voci: "" },
  { etichetta: "Sedia al muro", titolo: "Sedia al muro 7 giorni", descrizione: "Ogni giorno resta in posizione di sedia al muro (cosce parallele al pavimento) un po' più a lungo.", tipo: "giorni", unita: "secondi", giorni: "7", tappe: "30,45,60,75,90,105,120", traguardo: "", voci: "" },
  { etichetta: "10.000 passi", titolo: "10.000 passi per 7 giorni", descrizione: "Sette giorni di fila con almeno 10.000 passi. Segna ogni sera il numero che vedi sul telefono.", tipo: "giorni", unita: "passi", giorni: "7", tappe: "", traguardo: "10000", voci: "" },
  { etichetta: "Acqua 14 giorni", titolo: "Acqua: 2 litri per 14 giorni", descrizione: "Per 14 giorni bevi almeno 2 litri d'acqua al giorno. Segna ogni sera quanti litri hai bevuto.", tipo: "giorni", unita: "litri", giorni: "14", tappe: "", traguardo: "2", voci: "" },
  { etichetta: "Plank 7 giorni", titolo: "Plank 7 giorni", descrizione: "Ogni giorno tieni il plank un po' più a lungo. Registra il tuo tempo e arriva fino in fondo!", tipo: "giorni", unita: "secondi", giorni: "7", tappe: "40,50,60,70,80,90,100", traguardo: "", voci: "" },
  { etichetta: "Flessioni", titolo: "Sfida flessioni", descrizione: "Arriva a completare le flessioni di fila, a petto basso e con buona tecnica.", tipo: "obiettivo", unita: "ripetizioni", giorni: "", tappe: "", traguardo: "10", voci: "" },
];
const FORM_VUOTO = { voci: "", titolo: "", descrizione: "", tipo: "giorni", unita: "", giorni: "7", tappe: "", traguardo: "", premio: "", tutte: true, client_ids: [] };

function FormSfida({ iniziale, clienti, onSalvato, onAnnulla }) {
  const [f, setF] = useState(iniziale);
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState("");
  const imposta = (patch) => setF((x) => ({ ...x, ...patch }));

  const salva = async () => {
    if (!f.titolo.trim()) { setErrore("Dai un titolo alla sfida."); return; }
    if (f.tipo === "scheda" && vociDi({ voci: f.voci }).length === 0) { setErrore("Scrivi almeno un esercizio, uno per riga: Nome|kg|ripetizioni"); return; }
    if (f.tipo === "obiettivo" && !(Number(String(f.traguardo).replace(",", ".")) > 0)) { setErrore("Indica l'obiettivo da raggiungere (un numero)."); return; }
    if (f.tipo === "giorni" && !(Number(f.giorni) > 0) && !f.tappe.trim()) { setErrore("Indica per quanti giorni dura la sfida."); return; }
    if (f.tipo === "giorni" && !f.tappe.trim() && !(Number(String(f.traguardo).replace(",", ".")) > 0)) { setErrore("Indica il traguardo giornaliero oppure le tappe, giorno per giorno."); return; }
    if (!f.tutte && f.client_ids.length === 0) { setErrore("Scegli almeno una cliente, oppure seleziona \"Tutte le clienti\"."); return; }
    setLavoro(true);
    setErrore("");
    const payload = {
      titolo: f.titolo.trim(),
      descrizione: f.descrizione.trim() || null,
      tipo: f.tipo,
      unita: f.tipo === "scheda" ? "kg" : (f.unita.trim() || null),
      voci: f.tipo === "scheda" ? (f.voci || "").trim() || null : null,
      giorni: f.tipo === "giorni" && f.giorni ? Number(f.giorni) : null,
      tappe: f.tipo === "giorni" && f.tappe.trim() ? f.tappe.trim() : null,
      traguardo: f.traguardo !== "" && f.traguardo != null ? Number(String(f.traguardo).replace(",", ".")) : null,
      premio: f.premio.trim() || null,
      client_ids: f.tutte ? null : f.client_ids,
    };
    const q = f.id ? supabase.from("sfide").update(payload).eq("id", f.id) : supabase.from("sfide").insert(payload);
    const { error } = await q;
    setLavoro(false);
    if (error) { setErrore("Non sono riuscita a salvare: " + error.message); return; }
    onSalvato();
  };

  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-slate-700">{f.id ? "Modifica sfida" : "Nuova sfida"}</p>
      {!f.id && (
        <div className="flex gap-1.5 flex-wrap">
          {PRESET.map((p) => (
            <button key={p.etichetta} onClick={() => setF((x) => ({ ...x, ...p }))} className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 text-xs font-medium">{p.etichetta}</button>
          ))}
        </div>
      )}
      <div>
        <label className="text-xs text-slate-500">Titolo</label>
        <input type="text" value={f.titolo} onChange={(e) => imposta({ titolo: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
      </div>
      <div>
        <label className="text-xs text-slate-500">Descrizione per la cliente</label>
        <textarea rows={3} value={f.descrizione} onChange={(e) => imposta({ descrizione: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
      </div>
      <div>
        <label className="text-xs text-slate-500">Tipo di sfida</label>
        <select value={f.tipo} onChange={(e) => imposta({ tipo: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1 bg-white">
          <option value="giorni">Ogni giorno per più giorni (es. plank per 7 giorni)</option>
          <option value="obiettivo">Raggiungi un obiettivo (es. flessioni, trazione)</option>
          <option value="scheda">Scheda di esercizi con i carichi da raggiungere</option>
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-500">Unità di misura (secondi, ripetizioni, kg...)</label>
        <input type="text" value={f.unita} onChange={(e) => imposta({ unita: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
      </div>
      {f.tipo === "giorni" ? (
        <>
          <div>
            <label className="text-xs text-slate-500">Numero di giorni</label>
            <input type="number" value={f.giorni} onChange={(e) => imposta({ giorni: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Traguardi giorno per giorno, separati da virgola (facoltativo)</label>
            <input type="text" value={f.tappe} onChange={(e) => imposta({ tappe: e.target.value })} placeholder="es. 30,35,40,45,50,55,60" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          {!f.tappe.trim() && (
            <div>
              <label className="text-xs text-slate-500">Oppure un traguardo uguale ogni giorno</label>
              <input type="text" inputMode="decimal" value={f.traguardo} onChange={(e) => imposta({ traguardo: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
          )}
        </>
      ) : f.tipo === "scheda" ? (
        <div>
          <label className="text-xs text-slate-500">Esercizi, uno per riga: Nome|kg|ripetizioni</label>
          <textarea rows={9} value={f.voci || ""} onChange={(e) => imposta({ voci: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1 font-mono" />
          <p className="text-[11px] text-slate-400 mt-1">Vince quando raggiunge o supera il carico su tutti gli esercizi.</p>
        </div>
      ) : (
        <div>
          <label className="text-xs text-slate-500">Obiettivo da raggiungere</label>
          <input type="text" inputMode="decimal" value={f.traguardo} onChange={(e) => imposta({ traguardo: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
        </div>
      )}
      <div>
        <label className="text-xs text-slate-500">Premio (es. sconto, lezione in presenza...)</label>
        <input type="text" value={f.premio} onChange={(e) => imposta({ premio: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
      </div>
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={f.tutte} onChange={(e) => imposta({ tutte: e.target.checked })} /> Tutte le clienti</label>
        {!f.tutte && (
          <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-lg p-2 space-y-1">
            {clienti.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={f.client_ids.includes(c.id)} onChange={(e) => imposta({ client_ids: e.target.checked ? [...f.client_ids, c.id] : f.client_ids.filter((x) => x !== c.id) })} />
                {nomeCompleto(c)}
              </label>
            ))}
          </div>
        )}
      </div>
      {errore && <p className="text-rose-500 text-sm">{errore}</p>}
      <div className="flex gap-2">
        <button onClick={salva} disabled={lavoro} className="flex-1 bg-slate-800 text-white rounded-xl py-2 text-sm font-medium">{lavoro ? "Salvo..." : "Salva sfida"}</button>
        <button onClick={onAnnulla} className="px-4 rounded-xl border border-slate-200 text-sm text-slate-500">Annulla</button>
      </div>
    </Card>
  );
}

function SfideCoachTab({ clienti, onCambiato }) {
  const [sfide, setSfide] = useState(null);
  const [adesioni, setAdesioni] = useState([]);
  const [regs, setRegs] = useState([]);
  const [form, setForm] = useState(null);
  const [messaggi, setMessaggi] = useState({});
  const [lavoro, setLavoro] = useState("");

  const carica = async () => {
    const { data: s } = await supabase.from("sfide").select("*").order("created_at", { ascending: false });
    const { data: a } = await supabase.from("sfide_adesioni").select("*, clients(nome, cognome)").order("created_at", { ascending: false });
    const ids = (a || []).filter((x) => x.stato === "da_approvare").map((x) => x.id);
    let r = [];
    if (ids.length) {
      const { data } = await supabase.from("sfide_registrazioni").select("*").in("adesione_id", ids).order("giorno");
      r = data || [];
    }
    setSfide(s || []);
    setAdesioni(a || []);
    setRegs(r);
  };
  useEffect(() => { carica(); }, []);

  const notificaCliente = async (clientId, testo, marker) => {
    const { data: nuova } = await supabase.from("notifiche").insert({ client_id: clientId, tipo: "nota", messaggio: testo, proposta_luogo: marker, stato: "inviata" }).select("id").single();
    if (nuova?.id) inviaPushLocale({ evento: "nota", notifica_id: nuova.id });
  };

  const conferma = async (ad) => {
    const s = sfide.find((x) => x.id === ad.sfida_id);
    setLavoro(ad.id);
    await supabase.from("sfide_adesioni").update({ stato: "completata" }).eq("id", ad.id);
    const extra = (messaggi[ad.id] || "").trim();
    const testo = `Sfida completata! 🏆🔥 Sei stata bravissima con «${s?.titolo || "la sfida"}» 🫶🏻 ${s?.premio ? `Il tuo premio: ${s.premio} ✨` : "Ti scrivo presto per il premio ✨"}${extra ? " " + extra : ""}`;
    await notificaCliente(ad.client_id, testo, `sfida_ok_${ad.id}`);
    setLavoro("");
    await carica();
    onCambiato?.();
  };
  const nonAncora = async (ad) => {
    const s = sfide.find((x) => x.id === ad.sfida_id);
    setLavoro(ad.id);
    await supabase.from("sfide_adesioni").update({ stato: "in_corso", completata_il: null }).eq("id", ad.id);
    const extra = (messaggi[ad.id] || "").trim();
    const testo = `Ci sei quasi con «${s?.titolo || "la sfida"}» 💪🏻 ${extra || "Riprova con calma e registra di nuovo il tuo risultato: ce la fai! ✨"}`;
    await notificaCliente(ad.client_id, testo, `sfida_no_${ad.id}_${Date.now()}`);
    setLavoro("");
    await carica();
    onCambiato?.();
  };
  const consegnato = async (ad) => {
    await supabase.from("sfide_adesioni").update({ premio_consegnato: true }).eq("id", ad.id);
    await carica();
  };
  const cambiaAttiva = async (s) => {
    await supabase.from("sfide").update({ attiva: !s.attiva }).eq("id", s.id);
    await carica();
  };
  const elimina = async (s) => {
    if (!window.confirm(`Eliminare la sfida «${s.titolo}»? Spariranno anche i risultati delle clienti.`)) return;
    await supabase.from("sfide").delete().eq("id", s.id);
    await carica();
  };

  if (sfide === null) return <Spinner />;
  const daApprovare = adesioni.filter((a) => a.stato === "da_approvare");
  const premi = adesioni.filter((a) => a.stato === "completata" && !a.premio_consegnato);
  const titoloDi = (id) => sfide.find((x) => x.id === id);

  return (
    <div className="space-y-5">
      {daApprovare.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium px-1">Da confermare ({daApprovare.length})</p>
          {daApprovare.map((ad) => {
            const s = titoloDi(ad.sfida_id);
            const mie = regs.filter((r) => r.adesione_id === ad.id);
            return (
              <Card key={ad.id} className="p-4 space-y-2">
                <p className="text-sm font-semibold text-slate-800">{nomeCompleto(ad.clients)} · {s?.titolo}</p>
                {s?.premio && <p className="text-xs text-amber-700">Premio: {s.premio}</p>}
                <div className="space-y-0.5">
                  {mie.map((r) => (
                    <p key={r.id} className="text-xs text-slate-600">
                      {fmtData(r.giorno)} · {r.voce ? r.voce + " · " : ""}<span className="font-semibold">{fmtNum(r.valore)} {s?.unita || ""}</span>{r.nota ? ` · ${r.nota}` : ""}
                      {r.video_url && <> · <a href={r.video_url} target="_blank" rel="noreferrer" className="text-sky-600 underline">video</a></>}
                    </p>
                  ))}
                </div>
                <input type="text" value={messaggi[ad.id] || ""} onChange={(e) => setMessaggi((m) => ({ ...m, [ad.id]: e.target.value }))}
                  placeholder="Un pensiero per lei (facoltativo)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  <button onClick={() => conferma(ad)} disabled={lavoro === ad.id} className="flex-1 bg-emerald-500 text-white rounded-xl py-2 text-sm font-medium">Conferma e assegna il premio ✨</button>
                  <button onClick={() => nonAncora(ad)} disabled={lavoro === ad.id} className="px-3 rounded-xl border border-slate-200 text-sm text-slate-600">Non ancora</button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {premi.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium px-1">Premi da consegnare ({premi.length})</p>
          {premi.map((ad) => {
            const s = titoloDi(ad.sfida_id);
            return (
              <Card key={ad.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{nomeCompleto(ad.clients)}</p>
                  <p className="text-xs text-slate-500">{s?.titolo}{s?.premio ? ` · ${s.premio}` : ""}</p>
                </div>
                <button onClick={() => consegnato(ad)} className="text-xs font-medium bg-slate-800 text-white rounded-lg px-3 py-2 flex-shrink-0">Consegnato ✓</button>
              </Card>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">Le tue sfide</p>
          {!form && <button onClick={() => setForm(FORM_VUOTO)} className="flex items-center gap-1 text-sky-600 text-xs font-medium"><Plus size={14} /> Nuova sfida</button>}
        </div>
        {form && <FormSfida iniziale={form} clienti={clienti} onAnnulla={() => setForm(null)} onSalvato={async () => { setForm(null); await carica(); }} />}
        {sfide.length === 0 && !form && <Card className="p-4 text-sm text-slate-500 text-center">Nessuna sfida ancora: creane una con "Nuova sfida" ✨</Card>}
        {sfide.map((s) => {
          const mie = adesioni.filter((a) => a.sfida_id === s.id);
          const fatte = mie.filter((a) => a.stato === "completata").length;
          return (
            <Card key={s.id} className={`p-4 space-y-2 ${s.attiva ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{s.titolo}</p>
                  <p className="text-xs text-slate-500">{descriviSfida(s)}</p>
                  {s.premio && <p className="text-xs text-amber-700 mt-0.5">Premio: {s.premio}</p>}
                  <p className="text-xs text-slate-400 mt-0.5">{s.client_ids ? `${s.client_ids.length} clienti scelte` : "Per tutte le clienti"} · {mie.length} partecipanti · {fatte} completate</p>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full flex-shrink-0 ${s.attiva ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{s.attiva ? "attiva" : "in pausa"}</span>
              </div>
              <div className="flex gap-3 text-xs font-medium">
                <button onClick={() => setForm({ id: s.id, titolo: s.titolo, descrizione: s.descrizione || "", tipo: s.tipo, unita: s.unita || "", giorni: s.giorni != null ? String(s.giorni) : "", tappe: s.tappe || "", voci: s.voci || "", traguardo: s.traguardo != null ? String(s.traguardo) : "", premio: s.premio || "", tutte: !s.client_ids, client_ids: s.client_ids || [] })} className="text-sky-600">Modifica</button>
                <button onClick={() => cambiaAttiva(s)} className="text-slate-600">{s.attiva ? "Metti in pausa" : "Riattiva"}</button>
                <button onClick={() => elimina(s)} className="text-rose-500">Elimina</button>
              </div>
              {mie.length > 0 && (
                <div className="pt-1 space-y-0.5">
                  {mie.map((a) => (
                    <p key={a.id} className="text-xs text-slate-500">{nomeCompleto(a.clients)} · {a.stato === "completata" ? "completata ✓" : a.stato === "da_approvare" ? "da confermare" : "in corso"}</p>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function CodiciAmicaCoachTab({ onCambiato }) {
  const [clienti, setClienti] = useState(null);
  const [sconti, setSconti] = useState([]);
  const [copiato, setCopiato] = useState("");
  const [mostraUsati, setMostraUsati] = useState(false);

  const carica = async () => {
    const { data: c } = await supabase.from("clients").select("id, nome, cognome, codice_amica, codice_usato, invitata_da, archiviato").order("nome");
    const { data: s } = await supabase.from("sconti_amica").select("*").order("created_at", { ascending: false });
    setClienti(c || []);
    setSconti(s || []);
  };
  useEffect(() => { carica(); }, []);

  const segnaUsato = async (s) => {
    await supabase.from("sconti_amica").update({ usato: true, usato_il: new Date().toISOString() }).eq("id", s.id);
    await carica();
    onCambiato?.();
  };
  const annullaUsato = async (s) => {
    await supabase.from("sconti_amica").update({ usato: false, usato_il: null }).eq("id", s.id);
    await carica();
    onCambiato?.();
  };

  if (clienti === null) return <Spinner />;
  const per = (id) => clienti.find((c) => c.id === id);
  const daUsare = sconti.filter((s) => !s.usato);
  const usati = sconti.filter((s) => s.usato);
  const attive = clienti.filter((c) => !c.archiviato && c.codice_amica);

  const descrizione = (s) => {
    const altra = per(s.da_client_id);
    return s.motivo === "invito"
      ? `ha invitato ${altra ? nomeCompleto(altra) : "un'amica"}`
      : `ha usato il codice di ${altra ? nomeCompleto(altra) : "un'amica"}`;
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium px-1">Sconti da applicare ({daUsare.length})</p>
        {daUsare.length === 0 && <Card className="p-4 text-sm text-slate-500 text-center">Nessuno sconto in attesa 🫶🏻</Card>}
        {daUsare.map((s) => (
          <Card key={s.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">🎁 {nomeCompleto(per(s.client_id))} · {fmtNum(s.importo)} €</p>
              <p className="text-xs text-slate-500">{descrizione(s)} · {fmtData(String(s.created_at).slice(0, 10))}</p>
            </div>
            <button onClick={() => segnaUsato(s)} className="text-xs font-medium bg-slate-800 text-white rounded-lg px-3 py-2 flex-shrink-0">Segna applicato ✓</button>
          </Card>
        ))}
        {usati.length > 0 && (
          <div>
            <button onClick={() => setMostraUsati(!mostraUsati)} className="text-sky-600 text-xs font-medium px-1">{mostraUsati ? "Nascondi gli sconti già applicati" : `Vedi gli sconti già applicati (${usati.length})`}</button>
            {mostraUsati && (
              <div className="mt-2 space-y-1.5">
                {usati.map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-3 py-2">
                    <p className="text-xs text-slate-500">{nomeCompleto(per(s.client_id))} · {fmtNum(s.importo)} € · {descrizione(s)}</p>
                    <button onClick={() => annullaUsato(s)} className="text-[11px] text-slate-400 underline flex-shrink-0">annulla</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium px-1">Codici amica delle clienti</p>
        <Card className="divide-y divide-slate-100">
          {attive.map((c) => {
            const invitate = clienti.filter((x) => x.invitata_da === c.id);
            return (
              <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-slate-800">{nomeCompleto(c)}</p>
                  {invitate.length > 0 && <p className="text-xs text-emerald-700">Ha invitato: {invitate.map(nomeCompleto).join(", ")}</p>}
                  {c.codice_usato && <p className="text-xs text-slate-400">È arrivata con il codice {c.codice_usato}</p>}
                </div>
                <button onClick={async () => { if (await copiaTesto(c.codice_amica)) { setCopiato(c.id); setTimeout(() => setCopiato(""), 1500); } }}
                  className="flex items-center gap-1.5 text-xs font-semibold tracking-wider bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 flex-shrink-0">
                  {c.codice_amica} {copiato === c.id ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} className="text-slate-400" />}
                </button>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

export function SfideCoach({ clients = [], onCambiato }) {
  const [sotto, setSotto] = useState("sfide");
  const attive = clients.filter((c) => !c.archiviato);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={() => setSotto("sfide")} className={`py-2 rounded-xl text-xs font-medium ${sotto === "sfide" ? "bg-sky-500 text-white" : "bg-sky-50 text-sky-700"}`}>🏆 Sfide</button>
        <button onClick={() => setSotto("codici")} className={`py-2 rounded-xl text-xs font-medium ${sotto === "codici" ? "bg-sky-500 text-white" : "bg-sky-50 text-sky-700"}`}>🎁 Codici amica</button>
      </div>
      {sotto === "sfide" ? <SfideCoachTab clienti={attive} onCambiato={onCambiato} /> : <CodiciAmicaCoachTab onCambiato={onCambiato} />}
    </div>
  );
}
