import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

/* Solo coach: propone un messaggio da copiare/mandare su WhatsApp, costruito sui dati reali della cliente (allenamenti, progressi, cosa manca). */

function pad(n) { return n < 10 ? "0" + n : "" + n; }
function fmt(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function addG(s, n) { const p = s.split("-"); const d = new Date(+p[0], +p[1] - 1, +p[2]); d.setDate(d.getDate() + n); return fmt(d); }
function giorniTra(a, b) { const pa = a.split("-"), pb = b.split("-"); return Math.round((new Date(+pa[0], +pa[1] - 1, +pa[2], 12) - new Date(+pb[0], +pb[1] - 1, +pb[2], 12)) / 86400000); }
const scegli = (arr, seme) => arr[Math.abs(seme) % arr.length];
const dec = (n) => String(Math.round(Math.abs(n) * 10) / 10).replace(".", ",");

async function raccogli(client) {
  const oggi = fmt(new Date());
  const da14 = addG(oggi, -14);
  const [{ data: tr }, { data: ck }, { data: kv }, { data: ms }, { data: rec }, { data: ev }, { data: ci }] = await Promise.all([
    supabase.from("training_entries").select("data").eq("client_id", client.id).gte("data", addG(oggi, -60)),
    supabase.from("checkins").select("data_check, peso_kg, ombelico_cm").eq("client_id", client.id).order("data_check", { ascending: false }).limit(3),
    client.kcal_attivo === false ? Promise.resolve({ data: [] }) : supabase.from("kcal_voci").select("data").eq("client_id", client.id).gte("data", da14),
    supabase.from("messaggi").select("mittente, created_at").eq("client_id", client.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("carichi_calo_log").select("esercizio, kg_prima, kg_oggi, data").eq("client_id", client.id).gte("data", da14).order("data", { ascending: false }).limit(20),
    supabase.from("calendar_events").select("data, ora, tipo, stato").eq("client_id", client.id).in("stato", ["confermato"]).gte("data", oggi).lte("data", addG(oggi, 3)).order("data").limit(1),
    client.sesso !== "M" ? supabase.from("ciclo_mestruale").select("data_inizio").eq("client_id", client.id).limit(1) : Promise.resolve({ data: [] }),
  ]);
  const giorniAll = new Set((tr || []).filter((r) => r.data >= da14).map((r) => r.data));
  const ultimoAll = (tr || []).reduce((m, r) => (r.data > m ? r.data : m), "");
  const giorniCibo = new Set((kv || []).map((r) => r.data));
  const ultimoMsg = ms && ms[0] ? ms[0].created_at.slice(0, 10) : "";
  const record = (rec || []).filter((r) => Number(r.kg_oggi) > Number(r.kg_prima))[0] || null;
  let peso = null, vita = null;
  if (ck && ck.length >= 2) {
    if (ck[0].peso_kg != null && ck[1].peso_kg != null) peso = Number(ck[0].peso_kg) - Number(ck[1].peso_kg);
    if (ck[0].ombelico_cm != null && ck[1].ombelico_cm != null) vita = Number(ck[0].ombelico_cm) - Number(ck[1].ombelico_cm);
  }
  return {
    oggi, allenamenti: giorniAll.size, ultimoAll, mai_allenato: !ultimoAll,
    giorniCibo: giorniCibo.size, usaCibo: giorniCibo.size > 0,
    giorniSenzaMsg: ultimoMsg ? giorniTra(oggi, ultimoMsg) : null,
    record, peso, vita, nCheck: (ck || []).length,
    ultimoCheck: ck && ck[0] ? ck[0].data_check : null,
    prossimoEv: ev && ev[0] ? ev[0] : null,
    ciclo: client.sesso !== "M" ? (ci || []).length > 0 : null,
    mai_check: !(ck && ck.length),
  };
}

function costruisci(client, d, seme) {
  const nome = (client.nome || "").trim().split(" ")[0];
  const online = client.tipo_servizio === "online" || client.tipo_servizio === "ibrido";
  const fermaDa = d.ultimoAll ? giorniTra(d.oggi, d.ultimoAll) : null;
  const fermo = d.mai_allenato || fermaDa >= 8;
  const bene = !fermo && d.allenamenti >= 3;
  const righe = [];
  let motivo = "";

  // 1. apertura
  if (bene) {
    motivo = "va bene, falle un complimento";
    righe.push(scegli([
      `Ciao ${nome}! 🔥 Ti scrivo per dirti che sto vedendo la tua costanza: ${d.allenamenti} allenamenti segnati nelle ultime due settimane. Complimenti davvero!`,
      `Ciao ${nome}! 💪🏻 Ho dato un'occhiata all'app e sto notando quanto ti stai impegnando: ${d.allenamenti} allenamenti in due settimane, brava!`,
      `Ciao ${nome}! ✨ Volevo dirti che il tuo impegno si vede: ${d.allenamenti} allenamenti registrati ultimamente. Continua così!`,
    ], seme));
  } else if (fermo) {
    motivo = d.mai_allenato ? "non ha ancora usato il log allenamento" : `allenamenti fermi da ${fermaDa} giorni`;
    righe.push(scegli([
      `Ciao ${nome}! 🫶🏻 Ti penso: come stai andando in questi giorni? Fammi sapere come ti senti e come procede la settimana.`,
      `Ciao ${nome}! 🫶🏻 Ti scrivo per sapere come stai: va tutto bene? Se c'è stato qualche imprevisto o ti serve una mano a ripartire, ci sono io.`,
      `Ciao ${nome}! ✨ Mi sono ricordata di te: come va con gli allenamenti? Dimmi pure come stai, anche se è stata una settimana storta.`,
    ], seme));
  } else {
    motivo = "tienila presente";
    righe.push(scegli([
      `Ciao ${nome}! 🫶🏻 Ti scrivo per sapere come stai andando con il programma: come ti senti? Mi racconti com'è andata la settimana?`,
      `Ciao ${nome}! ✨ Volevo sapere come sta andando: come ti trovi con gli allenamenti e come ti senti in generale?`,
    ], seme));
  }

  // 2. progressi veri
  if (d.record) righe.push(`Ho visto anche che nel ${d.record.esercizio} sei salita da ${d.record.kg_prima} a ${d.record.kg_oggi} kg: bellissimo progresso! 🔥`);

  if (!fermo && d.allenamenti > 0) righe.push(scegli([
    `Brava anche per come stai compilando il log: segnare carichi e ripetizioni mi permette di seguirti davvero 💪🏻`,
    `Mi piace molto come stai usando il Log allenamento: è un grande aiuto per costruire i tuoi progressi ✨`,
  ], seme + 3));
  if (d.ciclo === true) righe.push(`E grazie per segnare il ciclo nell'app: mi aiuta a darti consigli su misura per ogni fase 🌸`);

  // 3. cosa manca (mai l'alimentazione se non la usa)
  const nuove = [];
  if (d.mai_allenato) nuove.push(`il Log allenamento 💪🏻 Apri "Log allenamento", scegli il giorno e segna carichi e ripetizioni mentre ti alleni: così vediamo insieme come progredisci`);
  if (d.ciclo === false && client.sesso !== "M") nuove.push(`il calendario del ciclo 🌸 Apri "Il mio ciclo" e tocca il giorno in cui arrivano le mestruazioni: ti do consigli per allenarti in base alla fase`);
  if (nuove.length) righe.push(`L'app ha ${nuove.length > 1 ? "delle funzioni" : "una funzione"} che non hai ancora provato:\n${nuove.map((x) => "• " + x).join("\n")}\nSfruttale per darmi più dati possibili: io riesco a seguirti meglio e tu hai tutto sotto controllo ✨`);
  else if (fermo && !d.mai_allenato) righe.push(`Quando riesci, segna gli allenamenti nel Log: più dati mi dai e più riesco a seguirti su misura 💪🏻`);

  // 4. alimentazione: solo consigli generali o domande, senza dire "non segni"
  const consigli = d.usaCibo
    ? [
      `Un consiglio: continua a controllare i macros giorno per giorno, anche i condimenti e i fuori pasto fanno la differenza 🥗`,
    ]
    : [
      `Come stai andando con l'alimentazione? Ti trovi bene con le porzioni e i pasti di questi giorni? 🍽️`,
      `Se ti va, raccontami come mangi in una giornata tipo: così posso darti qualche spunto su misura per te 🥗`,
      `Occhio a tenere sotto controllo i macros, soprattutto le proteine ad ogni pasto, fanno una grande differenza 💪🏻`,
    ];
  const tuttoPerfetto = bene && nuove.length === 0;
  const pioggia = (Number(d.oggi.slice(8)) + seme + (client.nome || "").length) % 3 === 0; // solo ogni tanto
  if (tuttoPerfetto && pioggia) righe.push(`E ricordati di bere tanta acqua, almeno 2 litri al giorno: aiuta energia, fame e recupero 💧`);
  else righe.push(scegli(consigli, seme + 1));

  // 5. evento vicino + chiusura
  if (d.prossimoEv) righe.push(`Ci vediamo ${d.prossimoEv.data === d.oggi ? "oggi" : d.prossimoEv.data === addG(d.oggi, 1) ? "domani" : "a breve"}${d.prossimoEv.ora ? ` alle ${d.prossimoEv.ora.slice(0, 5)}` : ""}, non vedo l'ora! 🫶🏻`);
  righe.push(scegli([
    `Sono sempre a disposizione per chiarimenti o per qualsiasi altra cosa, scrivimi pure 🫶🏻`,
    `Se hai dubbi, domande o hai bisogno di altro, io ci sono sempre: scrivimi quando vuoi ✨`,
    `Per qualsiasi chiarimento o altro sono a tua disposizione, ci sono io 🫶🏻`,
  ], seme + 2));

  if (d.giorniSenzaMsg != null && d.giorniSenzaMsg > 12 && motivo === "tienila presente") motivo = `non vi scrivete da ${d.giorniSenzaMsg} giorni`;
  return { testo: righe.join("\n\n"), motivo };
}

function numeroWhatsApp(tel) {
  let n = (tel || "").replace(/[^\d+]/g, "");
  if (!n) return "";
  if (n.startsWith("+")) return n.slice(1);
  if (n.startsWith("00")) return n.slice(2);
  if (n.length === 10 && n.startsWith("3")) return "39" + n;
  return n;
}

export default function MessaggioPronto({ client, chiuso = true }) {
  const [aperto, setAperto] = useState(!chiuso);
  const [dati, setDati] = useState(null);
  const [seme, setSeme] = useState(0);
  const [testo, setTesto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [copiato, setCopiato] = useState(false);
  const [carico, setCarico] = useState(false);

  const apri = async () => {
    setAperto(true);
    if (dati) return;
    setCarico(true);
    try {
      const d = await raccogli(client);
      setDati(d);
      const r = costruisci(client, d, 0);
      setTesto(r.testo); setMotivo(r.motivo);
    } catch (e) { setTesto(""); setMotivo("non riesco a leggere i dati"); }
    setCarico(false);
  };
  const rigenera = () => {
    if (!dati) return;
    const s = seme + 1; setSeme(s);
    const r = costruisci(client, dati, s);
    setTesto(r.testo); setMotivo(r.motivo); setCopiato(false);
  };
  const copia = async () => {
    try { await navigator.clipboard.writeText(testo); }
    catch (e) {
      const ta = document.createElement("textarea"); ta.value = testo; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (er) { /* ignora */ }
      document.body.removeChild(ta);
    }
    setCopiato(true); setTimeout(() => setCopiato(false), 2000);
  };
  useEffect(() => { if (!chiuso) apri(); }, [client.id]);
  const num = numeroWhatsApp(client.telefono);

  if (!aperto) {
    return <button onClick={apri} className="mt-2 text-sky-700 text-[13px] font-medium">💬 Messaggio pronto →</button>;
  }
  return (
    <div className="mt-2 bg-sky-50 border border-sky-200 rounded-2xl p-3 space-y-2">
      {carico && <p className="text-xs text-slate-500">Preparo il messaggio...</p>}
      {!carico && (
        <>
          {motivo && <p className="text-[11px] uppercase tracking-wide text-sky-700 font-semibold">Perché scriverle: {motivo}</p>}
          <textarea value={testo} onChange={(e) => setTesto(e.target.value)} rows={9} className="w-full text-[13px] leading-relaxed text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2" />
          <div className="flex gap-2">
            <button onClick={copia} className="flex-1 bg-slate-800 text-white rounded-xl py-2 text-[13px] font-medium">{copiato ? "Copiato ✓" : "Copia"}</button>
            {num
              ? <a href={`https://wa.me/${num}?text=${encodeURIComponent(testo)}`} target="_blank" rel="noreferrer" className="flex-1 text-center bg-emerald-600 text-white rounded-xl py-2 text-[13px] font-medium">Apri WhatsApp</a>
              : <span className="flex-1 text-center bg-slate-100 text-slate-400 rounded-xl py-2 text-[12px]">Numero non salvato</span>}
            <button onClick={rigenera} className="border border-slate-300 text-slate-600 rounded-xl px-3 py-2 text-[13px]" aria-label="Altra versione">↻</button>
          </div>
          <button onClick={() => setAperto(false)} className="text-[11px] text-slate-400">Chiudi</button>
        </>
      )}
    </div>
  );
}
