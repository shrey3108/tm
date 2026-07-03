/**
 * Application entry point.
 * Initializes React root, Redux store, and renders the main App component.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./store";
import { ThemeProvider } from "@/components/shared/theme-provider"
import "@/styles/index.css";
import App from "@/App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeProvider defaultTheme="light">
        <App />
      </ThemeProvider>
    </Provider>
  </StrictMode>,
);
