import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./scss/polish.scss";
import "@fontsource/acme/400.css";
import "@fontsource/poppins/900-italic.css";


const rootElement = document.getElementById("root");
const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
