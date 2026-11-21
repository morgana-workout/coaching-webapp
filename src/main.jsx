import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import DialoghiApp, { avvisoApp } from "./Dialoghi";

// I messaggi di avviso usano le finestre dell'app invece dei pop-up del browser
window.alert = (testo) => { avvisoApp(testo); };

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <DialoghiApp />
  </React.StrictMode>
);
