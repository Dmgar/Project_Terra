import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";

import "./legacy.css";
import "./agrizen.css";
import "./world.css";
import Layout from "./Layout";
import { Header, ErrorBoundary, Icon } from "./ui";
import { LanguageProvider, useI18n } from "./i18n";
import { AuthProvider } from "./auth";
import Home from "./product/Home";

// Solo la portada va en el paquete inicial: el resto de pantallas se descarga al navegar a ellas,
// así el primer arranque parsea menos JavaScript y la escena empieza antes.
const Recommend = lazy(() => import("./product/Recommend"));
const Account = lazy(() => import("./product/Account"));
const Overview = lazy(() => import("./analysis/Overview"));
const Analysis = lazy(() => import("./analysis/Analysis"));
const Regions = lazy(() => import("./analysis/Regions"));
const Optimize = lazy(() => import("./Optimize"));

function LoadingFallback() {
  const { t } = useI18n();
  return <div className="panel loading">{t("loading")}</div>;
}

function NotFound() {
  const { t } = useI18n();
  return (
    <>
      <Header
        title={
          <>
            {t("notFoundTitle1")}<br />
            <em>{t("notFoundTitle2")}</em>
          </>
        }
        description={t("notFoundDesc")}
      />
      <div className="callout" style={{ textAlign: "center", maxWidth: 400, margin: "40px auto" }}>
        <Link className="button" to="/">
          {t("backHome")} <Icon />
        </Link>
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
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />

              <Route path="producto/recomendar" element={<Recommend />} />
              <Route path="producto/plan" element={plan(undefined)} />
              <Route path="producto/plan/huerta" element={plan("garden")} />
              <Route path="producto/plan/comercial" element={plan("commercial")} />
              <Route path="cuenta" element={<Account />} />

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
      </AuthProvider>
    </LanguageProvider>
  );
}
