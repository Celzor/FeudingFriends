import React from "react";
import { createRoot } from "react-dom/client";
import "./scss/App.scss";
import "./scss/polish.scss";
import "./scss/viewport.scss";
import "@fontsource/acme/400.css";
import "@fontsource/poppins/900-italic.css";
// Pages hosts a Refract activity. A direct visit must not start the web game's socket.
const { default: App } =
  import.meta.env.MODE === "pages" && window.parent === window
    ? await import("./screens/ActivityStart")
    : await import("./App");

const rootElement = document.getElementById("root");
const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
