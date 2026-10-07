import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { api, ErrorBoundary, useSlidingIndicator } from "./ui";
import logo from "./assets/logo-terra-claro.png";

// Enlaces del menú principal: el producto va primero y el análisis queda
// detrás de "Cómo funciona", para que el agricultor llegue a lo útil sin rodeos.
const MAIN_LINKS = [
  { to: "/", label: "Inicio", end: true },
  { to: "/producto/recomendar", label: "Recomendar" },
  { to: "/producto/plan", label: "Planear" },
  { to: "/analisis", label: "Análisis" },
];

const ANALYSIS_LINKS = [
  { to: "/analisis/resumen", label: "Resumen" },
  { to: "/analisis/modelo", label: "Modelo" },
  { to: "/analisis/regiones", label: "Regiones" },
];

// Posición de la página en el menú: sirve para saber hacia qué lado "viaja" el contenido.
function tabPosition(pathname) {
  const main = MAIN_LINKS.findIndex(({ to }) => to !== "/" && pathname.startsWith(to));
  const base = pathname === "/" ? 0 : main;
  const sub = ANALYSIS_LINKS.findIndex(({ to }) => pathname.startsWith(to));
  return base + (sub > -1 ? sub / 10 : 0);
}

export default function Layout() {
  const { pathname } = useLocation();
  const inAnalysis = pathname.startsWith("/analisis");
  const [menuOpen, setMenuOpen] = useState(false);
  const [healthy, setHealthy] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const topnavRef = useRef(null);
  const subnavRef = useRef(null);
  const previousPosition = useRef(tabPosition(pathname));
  const position = tabPosition(pathname);
  const direction = position >= previousPosition.current ? "forward" : "back";
  useEffect(() => {
    previousPosition.current = position;
  }, [position]);
  useSlidingIndicator(topnavRef, pathname);
  useSlidingIndicator(subnavRef, pathname);

  useEffect(() => {
    api("/api/health")
      .then(() => setHealthy(true))
      .catch(() => setHealthy(false));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Al navegar en móvil el menú debe cerrarse solo; si no, tapa la página nueva.
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className={`shell ${inAnalysis ? "section-analysis" : "section-product"}`}>
      <header className={`topbar ${scrolled ? "scrolled" : ""}`}>
        <div className="topbar-inner">
          <Link className="brand" to="/">
            <img className="brand-logo" src={logo} alt="" />
            <strong>TERRA</strong>
          </Link>

          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="main-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? "Cerrar" : "Menú"}
          </button>

          <nav
            ref={topnavRef}
            id="main-nav"
            className={`topnav ${menuOpen ? "open" : ""}`}
            aria-label="Navegación principal"
          >
            {MAIN_LINKS.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end}>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        {inAnalysis && (
          <nav ref={subnavRef} className="subnav" aria-label="Panel de análisis">
            <span className="subnav-title">Panel de análisis</span>
            {ANALYSIS_LINKS.map(({ to, label }) => (
              <NavLink key={to} to={to}>
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="main">
        {/* La clave reinicia la animación de entrada en cada cambio de pestaña. La portada no la lleva. */}
        <div
          key={pathname}
          className={`page ${pathname === "/" ? "" : `page-${direction}`}`}
        >
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      <footer className="site-foot">
        <span className="health">
          <i className={`dot ${healthy === false ? "offline" : ""}`} />
          {healthy === null
            ? "Conectando…"
            : healthy
            ? "Terra disponible"
            : "No se pudo conectar"}
        </span>
        <span>
          Estimaciones basadas en datos de referencia. No son una garantía de
          cosecha ni de ganancia.
        </span>
      </footer>
    </div>
  );
}
