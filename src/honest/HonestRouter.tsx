import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import HonestyLayout from "./components/HonestyLayout";
import { LoadingPlaceholder } from "./components/ui";
import Dashboard from "./pages/Dashboard";

const MapaRoda = lazy(() => import("./pages/MapaRoda"));
const Analise = lazy(() => import("./pages/Analise"));
const GestaoBanca = lazy(() => import("./pages/GestaoBanca"));
const RedeNeural = lazy(() => import("./pages/RedeNeural"));
const Diario = lazy(() => import("./pages/Diario"));
const Jogar = lazy(() => import("./pages/Jogar"));
const Padroes = lazy(() => import("./pages/Padroes"));
const Sinais = lazy(() => import("./pages/Sinais"));
const Captura = lazy(() => import("./pages/Captura"));
const Backtester = lazy(() => import("./pages/Backtester"));
const PadroesCustom = lazy(() => import("./pages/PadroesCustom"));
const MultiMesa = lazy(() => import("./pages/MultiMesa"));
const Filtros = lazy(() => import("./pages/Filtros"));
const Config = lazy(() => import("./pages/Config"));
const Estrategia = lazy(() => import("./pages/Estrategia"));
const Correlations = lazy(() => import("./pages/Correlations"));
const Replay = lazy(() => import("./pages/Replay"));
const Insights = lazy(() => import("./pages/Insights"));
const Comparacao = lazy(() => import("./pages/Comparacao"));
const Cobertura = lazy(() => import("./pages/Cobertura"));
const Duzias = lazy(() => import("./pages/Duzias"));

const lazyWrap = (el: React.ReactNode) => (
  <Suspense fallback={<LoadingPlaceholder height="h-96" />}>{el}</Suspense>
);

export default function HonestRouter() {
  return (
    <Routes>
      <Route element={<HonestyLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="roda" element={lazyWrap(<MapaRoda />)} />
        <Route path="analise" element={lazyWrap(<Analise />)} />
        <Route path="banca" element={lazyWrap(<GestaoBanca />)} />
        <Route path="rede" element={lazyWrap(<RedeNeural />)} />
        <Route path="diario" element={lazyWrap(<Diario />)} />
        <Route path="jogar" element={lazyWrap(<Jogar />)} />
        <Route path="padroes" element={lazyWrap(<Padroes />)} />
        <Route path="sinais" element={lazyWrap(<Sinais />)} />
        <Route path="captura" element={lazyWrap(<Captura />)} />
        <Route path="backtest" element={lazyWrap(<Backtester />)} />
        <Route path="regras" element={lazyWrap(<PadroesCustom />)} />
        <Route path="multi" element={lazyWrap(<MultiMesa />)} />
        <Route path="filtros" element={lazyWrap(<Filtros />)} />
        <Route path="config" element={lazyWrap(<Config />)} />
        <Route path="estrategia" element={lazyWrap(<Estrategia />)} />
        <Route path="correlacoes" element={lazyWrap(<Correlations />)} />
        <Route path="replay" element={lazyWrap(<Replay />)} />
        <Route path="insights" element={lazyWrap(<Insights />)} />
        <Route path="comparacao" element={lazyWrap(<Comparacao />)} />
        <Route path="cobertura" element={lazyWrap(<Cobertura />)} />
        <Route path="duzias" element={lazyWrap(<Duzias />)} />
      </Route>
    </Routes>
  );
}
