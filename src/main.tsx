import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startPerfTracking } from "./honest/lib/perf";
import { runAutoBootstrap } from "./honest/lib/autoBootstrap";

startPerfTracking();
runAutoBootstrap();

createRoot(document.getElementById("root")!).render(<App />);
