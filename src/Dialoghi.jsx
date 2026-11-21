import React, { useEffect, useState } from "react";

/* Finestre di dialogo dell'app: sostituiscono i pop-up del browser (alert / confirm).
   Si usano così:  await confermaApp("Testo?")  ->  true/false     avvisoApp("Testo")  */

let ascoltatore = null;
const coda = [];

function accoda(voce) {
  return new Promise((risolvi) => {
    coda.push({ ...voce, risolvi });
    if (ascoltatore) ascoltatore();
  });
}

export function confermaApp(testo, opzioni = {}) {
  return accoda({ tipo: "conferma", testo: String(testo ?? ""), ...opzioni });
}

export function avvisoApp(testo) {
  return accoda({ tipo: "avviso", testo: String(testo ?? "") });
}

const DISTRUTTIVA = /elimin|cancell|rimuov|svuot|\btolgo\b|\bTUTT/i;

export default function DialoghiApp() {
  const [corrente, setCorrente] = useState(null);

  useEffect(() => {
    const prossimo = () => { setCorrente((att) => att || coda.shift() || null); };
    ascoltatore = prossimo;
    prossimo();
    return () => { ascoltatore = null; };
  }, []);

  const chiudi = (esito) => {
    const v = corrente;
    setCorrente(null);
    if (v) v.risolvi(esito);
    setTimeout(() => { if (coda.length) setCorrente(coda.shift()); }, 120);
  };

  useEffect(() => {
    if (!corrente) return undefined;
    const tasto = (e) => { if (e.key === "Escape") chiudi(corrente.tipo === "avviso"); };
    window.addEventListener("keydown", tasto);
    return () => window.removeEventListener("keydown", tasto);
  });

  if (!corrente) return null;
  const conferma = corrente.tipo === "conferma";
  const righe = corrente.testo.split("\n");
  const titolo = corrente.titolo || (conferma ? (DISTRUTTIVA.test(corrente.testo) ? "Vuoi procedere?" : "Conferma") : "Un attimo");
  const etichettaSi = corrente.si || (conferma ? (DISTRUTTIVA.test(corrente.testo) ? "Procedi" : "Conferma") : "Ok");
  const etichettaNo = corrente.no || "Annulla";

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => chiudi(!conferma)}
      style={{ position: "fixed", inset: 0, zIndex: 100000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(39,70,109,0.45)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", animation: "dlgFade .16s ease-out" }}
    >
      <style>{`@keyframes dlgFade{from{opacity:0}to{opacity:1}}@keyframes dlgPop{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}`}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 380, padding: 20, boxShadow: "0 16px 48px rgba(39,70,109,0.28)", animation: "dlgPop .2s ease-out", fontFamily: "inherit" }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: "50%", background: "#fff", border: "1.5px solid #C9E0F7", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <img src="/logo.png" alt="" style={{ width: "84%", height: "84%", objectFit: "contain" }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#27466D", letterSpacing: "-0.01em" }}>{titolo}</div>
        </div>
        <div style={{ marginTop: 10, maxHeight: "50vh", overflowY: "auto", fontSize: 13.5, lineHeight: 1.5, color: "#475569", whiteSpace: "pre-line", wordBreak: "break-word" }}>
          {righe.join("\n")}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          {conferma && (
            <button onClick={() => chiudi(false)} style={{ flex: 1, padding: "10px 12px", borderRadius: 12, fontSize: 14, fontWeight: 600, background: "#fff", color: "#3F78B3", border: "1.5px solid #C9E0F7", cursor: "pointer", outline: "none" }}>{etichettaNo}</button>
          )}
          <button autoFocus onClick={() => chiudi(true)} style={{ flex: 1, padding: "10px 12px", borderRadius: 12, fontSize: 14, fontWeight: 600, background: "#27466D", color: "#fff", border: "none", cursor: "pointer", outline: "none" }}>{etichettaSi}</button>
        </div>
      </div>
    </div>
  );
}
