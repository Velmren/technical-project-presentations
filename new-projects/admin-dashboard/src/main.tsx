// Global styles load first so feature stylesheets, imported by the screens, can refine them.
import "@fontsource-variable/inter/opsz.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/ui.css";
import "./styles/shell.css";
import "./styles/lists.css";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { StoreProvider } from "./data/store";
import { I18nProvider } from "./i18n";

createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <StoreProvider>
      <App />
    </StoreProvider>
  </I18nProvider>,
);
