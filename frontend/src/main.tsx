import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAnalytics } from "./analytics";

// Google Analytics（VITE_GA_ID が設定されている場合のみ有効）
initAnalytics();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
