import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ISO_CSS } from "./lib/iso-kit";
import "./index.css";

// Inject isometric CAD stylesheet from iso-kit
const isoStyleEl = document.createElement("style");
isoStyleEl.id = "iso-kit-styles";
isoStyleEl.textContent = ISO_CSS;
document.head.appendChild(isoStyleEl);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
