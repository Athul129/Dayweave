import { createRoot } from "react-dom/client";
import App from "./App";
import { isSupabaseConfigured } from "./lib/supabase";
import "./index.css";

if (import.meta.env.DEV && !isSupabaseConfigured) {
  console.warn("[Dayweave] Supabase is not configured in this environment; the local-first app remains available.");
}

createRoot(document.getElementById("root")!).render(<App />);
