import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

import "./legacy.css";
import "./index.css";
import Layout from "./Layout";
import { Header, ErrorBoundary } from "./ui";
import Home from "./product/Home";
import Recommend from "./product/Recommend";
import Overview from "./analysis/Overview";
import Analysis from "./analysis/Analysis";
import Regions from "./analysis/Regions";

const Optimize = lazy(() => import("./Optimize"));

function LoadingFallback() {
  return <div className="panel loading">Cargando…</div>;
}

function NotFound() {
  return (
    <>
      <Header
        title={
          <>
            La ruta no existe<br />
            <em>¿te has desviado?</em>
          </>
        }
        description="La página que buscas no está disponible. Usa el menú superior para volver al inicio."
      />
      <div className="callout" style={{ textAlign: "center", maxWidth: 400, margin: "40px auto" }}>
        <a className="button" href="/">
          Volver al inicio →
        </a>
      </div>
    </>
  );
}

// El enlace viejo /optimize?mode=garden se conserva apuntando a la ruta nueva.
function LegacyOptimizeRedirect() {
  const mode = new URLSearchParams(useLocation().search).get("mode");
  const target = mode === "garden" ? "huerta" : mode === "commercial" ? "comercial" : "";
  return <Navigate to={`/producto/plan${target ? `/${target}` : ""}`} replace />;
}

const plan = (mode) => (
  <Suspense fallback={<LoadingFallback />}>
    <ErrorBoundary>
      <Optimize mode={mode} />
    </ErrorBoundary>
  </Suspense>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />

          <Route path="producto/recomendar" element={<Recommend />} />
          <Route path="producto/plan" element={plan(undefined)} />
          <Route path="producto/plan/huerta" element={plan("garden")} />
          <Route path="producto/plan/comercial" element={plan("commercial")} />

          <Route path="analisis" element={<Navigate to="/analisis/resumen" replace />} />
          <Route path="analisis/resumen" element={<Overview />} />
          <Route path="analisis/modelo" element={<Analysis />} />
          <Route path="analisis/regiones" element={<Regions />} />

          {/* Rutas de la versión anterior */}
          <Route path="analysis" element={<Navigate to="/analisis/modelo" replace />} />
          <Route path="regions" element={<Navigate to="/analisis/regiones" replace />} />
          <Route path="recommend" element={<Navigate to="/producto/recomendar" replace />} />
          <Route path="optimize" element={<LegacyOptimizeRedirect />} />

          <Route path="404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
