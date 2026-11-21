/* Collega il nome scritto nel programma al video giusto della libreria.
   Regola: video solo se l'esercizio è QUELLO (esatto) oppure lo stesso esercizio con attrezzo diverso
   (cavi / manubri / bilanciere / macchinario ...) -> "simile". Se c'è una differenza di movimento
   (monopodalico, inclinata, presa diversa, superset...) nessun video, così non se ne mostra uno sbagliato. */

const togliAccenti = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
// refusi e varianti di scrittura che indicano la stessa parola
const VARIANTI = [[/\bextention\b/g, "extension"], [/\btrust\b/g, "thrust"], [/\bgladietor\b/g, "gladiator"], [/\bfacepull(ey)?\b/g, "face pull"], [/\bface pulley\b/g, "face pull"],
  [/\bsingola\b/g, "singolo"], [/\bmonopodale\b/g, "monopodalico"], [/\bunilaterali?\b/g, "monopodalico"], [/\bbulgari\b/g, "bulgaro"], [/\bbulgarian\b/g, "bulgaro"], [/\bhyperextension\b/g, "iperestensione"], [/\bdeadlift\b/g, "stacco"], [/\bpushdown\b/g, "push down"], [/\bkick back\b/g, "kickback"], [/\bpolpaccio\b/g, "polpacci"],
  [/\bmachine\b/g, "macchina"], [/\bmacchinario\b/g, "macchina"], [/\bcavi\b/g, "cavo"], [/\bcable\b/g, "cavo"], [/\bmanubri\b/g, "manubrio"], [/\bdumbbell\b/g, "manubrio"], [/\bkb\b/g, "kettlebell"], [/\bmp\b/g, "multipower"], [/\bdb\b/g, "manubrio"], [/\bbarbell\b/g, "bilanciere"], [/\bprone\b/g, ""], [/\bbulgari\b/g, "bulgaro"]];
export const normNome = (s) => { let t = togliAccenti(s).toLowerCase().replace(/[-_/,.;:()+*"'’]/g, " ").replace(/\s+/g, " ").trim(); VARIANTI.forEach(([a, b]) => { t = t.replace(a, b); }); return t; };

const STOP = new Set(["di", "del", "della", "dello", "dei", "delle", "da", "a", "al", "alla", "alle", "ai", "agli", "allo", "con", "in", "il", "lo", "la", "le", "i", "gli", "un", "una", "e", "o", "su", "per", "sul", "sulla", "senza", "the", "of", "ed"]);
// attrezzi: cambiarli non cambia l'esercizio (-> "simile")
const EQ = new Set(["cavo", "manubrio", "bilanciere", "macchina", "multipower", "kettlebell", "elastico", "elastici", "smith", "trx", "disco", "corpo", "libero"]);
// accessori e supporti: non cambiano l'esercizio e non contano come attrezzo
const ACC = new Set(["corda", "barra", "ez", "asta", "dritta", "triangolo", "panca", "box", "rialzi", "rialzo", "stairmaster", "quadrupedia", "gomiti", "gomito"]);
// stessa famiglia di esercizio con presa/posizione diversa: il video è "simile"
const VAR = new Set(["presa", "larga", "larghi", "largo", "stretta", "stretti", "stretto", "neutra", "neutro", "media", "medio", "supina", "supino", "prona", "alti", "alte", "alto", "alta", "inclinata", "inclinato", "rialzati", "rialzata", "avanti"]);
// note di carico/esecuzione che non cambiano l'esercizio
const NOTE = new Set(["leggero", "leggera", "leggeri", "pesante", "pesanti", "moderato", "moderata", "carico", "carichi", "top", "set", "back", "off", "kg", "sfinimento", "richiamo", "finisher", "controllato", "controllata", "lento", "lenti", "lenta", "pausa", "progressivo", "serie", "obbligatorio", "obbligatoria", "statico", "statica", "classico", "classica", "classiche", "classici", "standard", "completo", "completa", "alternato", "alternati", "alternata", "seduto", "seduta", "seduti", "sedute", "sdraiato", "sdraiata", "piedi", "terra", "successione", "profondita", "busto", "appoggiato", "aggiuntivo", "basso", "bassa", "bassi", "basse", "gradi", "45", "braccia", "semi", "tese", "braccio"]);

const tokens = (s) => normNome(s).split(" ").filter(Boolean);
const util = (t) => !STOP.has(t) && !/^\d+([.,]\d+)?(kg)?$/.test(t);
// token del nome "copre" token della parola chiave (tollera plurali / refusi di coda)
const radice = (t) => (t.length >= 5 ? t.replace(/[aeio]$/, "") : t);
const uguali = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (radice(a) === radice(b) || a.startsWith(b) || b.startsWith(a)));

function eqDi(testo) { return new Set(tokens(testo).filter((t) => EQ.has(t))); }

/* Valuta se la parola chiave k descrive il nome n. Ritorna null se non corrisponde, altrimenti {copre, residuo} */
function valuta(nTok, k, sinonimi = new Set()) {
  const kTok = tokens(k).filter((t) => !STOP.has(t));
  if (!kTok.length) return null;
  const usati = new Set();
  for (const kt of kTok) {
    const i = nTok.findIndex((t, idx) => !usati.has(idx) && uguali(t, kt));
    if (i < 0) return null;
    usati.add(i);
  }
  const coperto = (t) => [...sinonimi].some((q) => uguali(q, t));
  const resto = nTok.filter((t, idx) => !usati.has(idx) && util(t) && !EQ.has(t) && !ACC.has(t) && !NOTE.has(t));
  const residuo = resto.filter((t) => !VAR.has(t) && !coperto(t));
  const varFuori = resto.filter((t) => VAR.has(t) && !coperto(t));
  return { copre: kTok.length, residuo, varFuori };
}

export function trovaVideoPreciso(nome, libreria, scelte = {}) {
  const grezzo = String(nome || "");
  const n = normNome(grezzo.trim().split("\n")[0]) === normNome(grezzo) ? normNome(grezzo) : normNome(grezzo);
  if (!n) return null;
  const sc = scelte[n] || scelte[grezzo.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim()];
  if (sc) { if (sc.nessuno || !sc.video_id) return null; return (libreria || []).find((e) => e.id === sc.video_id) || null; }
  const primaRiga = grezzo.trim().split("\n")[0]; // se ci sono appunti su più righe, conta la prima
  if (/\+/.test(primaRiga)) return null; // superserie o più esercizi insieme: nessun video
  const nTok = tokens(primaRiga);
  const nEq = new Set(nTok.filter((t) => EQ.has(t)));
  let migliore = null;
  (libreria || []).forEach((e) => {
    if (!(e.video_url || e.posizionamento || e.movimento || e.errori || e.senza_video)) return;
    const eEq = eqDi(`${e.nome} ${e.attrezzo || ""} ${e.parole_chiave || ""}`);
    const nomePulito = String(e.nome || "").replace(/\([^)]*\)/g, " ");
    const chiavi = [e.nome, nomePulito, ...String(e.nome || "").split(/[\/()]/), ...String(e.parole_chiave || "").split(",")];
    const sinonimi = new Set(chiavi.flatMap((k) => tokens(k)));
    chiavi.forEach((k) => {
      const v = valuta(nTok, k, sinonimi);
      if (!v || v.residuo.length) return; // c'è una differenza di movimento: non è lo stesso esercizio
      if (tokens(k).every((t) => STOP.has(t) || EQ.has(t) || ACC.has(t))) return; // chiave fatta solo di attrezzi
      const punti = v.copre * 10 + (k === e.nome ? 1 : 0) - v.varFuori.length;
      if (!migliore || punti > migliore.punti) migliore = { e, punti, varFuori: v.varFuori.length };
    });
  });
  if (!migliore) return null;
  const e = migliore.e;
  const eEq = eqDi(`${e.nome} ${e.attrezzo || ""} ${e.parole_chiave || ""}`);
  let simile = migliore.varFuori > 0;
  if (nEq.size && !simile) { simile = ![...nEq].some((t) => eEq.has(t) || [...eEq].some((q) => uguali(q, t))); }
  return simile ? { ...e, simile: true } : e;
}
