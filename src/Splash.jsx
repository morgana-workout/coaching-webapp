import React, { useEffect, useState } from "react";

/* Schermata di apertura: logo + barra di caricamento, visibile almeno ~1,9 secondi
   alla prima apertura dell'app (poi sfuma). Una volta per sessione del browser. */
const DURATA_MIN = 1900;
const DISSOLVENZA = 500;

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
  return (
    <div
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, zIndex: 200000, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, opacity: fase === "out" ? 0 : 1, transition: `opacity ${DISSOLVENZA}ms ease`, pointerEvents: fase === "out" ? "none" : "auto" }}
    >
      <style>{`@keyframes splLogo{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}@keyframes splBarra{from{transform:scaleX(0)}to{transform:scaleX(1)}}`}</style>
      <img src="/logo.png" alt="" style={{ width: 170, height: "auto" }} />
      <div style={{ width: 120, height: 3, borderRadius: 3, background: "#E6EFF8", overflow: "hidden" }}>
        <div style={{ height: "100%", background: "#3F78B3", borderRadius: 3, transformOrigin: "left", animation: `splBarra ${DURATA_MIN}ms cubic-bezier(.4,0,.2,1) both` }} />
      </div>
    </div>
  );
}
