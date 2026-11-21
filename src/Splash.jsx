import React, { useEffect, useState } from "react";

/* Schermata di apertura: logo fermo per ~1,5 secondi alla prima apertura dell'app,
   poi si ingrandisce e svanisce mostrando l'app. Una volta per sessione del browser. */
const DURATA_MIN = 1500;
const DISSOLVENZA = 1100;

function giaMostrata() {
  try { return sessionStorage.getItem("splash_vista") === "1"; } catch (e) { return false; }
}
function segnaMostrata() {
  try { sessionStorage.setItem("splash_vista", "1"); } catch (e) { /* nessun problema */ }
}

export default function Splash() {
  const [fase, setFase] = useState(() => (giaMostrata() ? "off" : "on"));

  useEffect(() => {
    if (fase !== "on") return undefined;
    segnaMostrata();
    const resto = Math.max(0, DURATA_MIN - (typeof performance !== "undefined" ? performance.now() : 0));
    const t1 = setTimeout(() => setFase("out"), resto);
    const t2 = setTimeout(() => setFase("off"), resto + DISSOLVENZA);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (fase === "off") return null;
  const esce = fase === "out";
  return (
    <div
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, zIndex: 200000, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", opacity: esce ? 0 : 1, transition: `opacity ${DISSOLVENZA}ms cubic-bezier(.4,0,.2,1)`, pointerEvents: esce ? "none" : "auto" }}
    >
      <img src="/logo.png" alt="" style={{ width: 170, height: "auto", transform: esce ? "scale(8)" : "scale(1)", opacity: esce ? 0 : 1, transition: `transform ${DISSOLVENZA}ms cubic-bezier(.3,0,.2,1), opacity ${DISSOLVENZA * 0.8}ms ease-out` }} />
    </div>
  );
}
