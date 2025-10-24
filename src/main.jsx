import React from "react";
import { createRoot } from "react-dom/client";
import GhostCatch from "./App.jsx"; // 또는 ./App (Vite는 확장자 생략 지원)

const css = document.createElement("style");
css.textContent = `
  html,body,#root { height: 100%; }
  body { margin: 0; background:#0b1220; color:#fff; }
`;
document.head.appendChild(css);

createRoot(document.getElementById("root")).render(<GhostCatch />);