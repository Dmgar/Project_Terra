import React, { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "terra_lang";

export const TRANSLATIONS = {
  es: {
    navHome: "Inicio",
    navRecommend: "Recomendar",
    navPlan: "Planear",
    navAnalysis: "Análisis",
    navAccount: "Mis parcelas",
    navOverview: "Resumen",
    navModel: "Modelo",
    navRegions: "Regiones",
    analysisPanel: "Panel de análisis",
    menuOpen: "Menú",
    menuClose: "Cerrar",
    connecting: "Conectando…",
    available: "Terra disponible",
    offline: "No se pudo conectar",
    disclaimer:
      "Estimaciones basadas en datos de referencia. No son una garantía de cosecha ni de ganancia.",
    notFoundTitle1: "La ruta no existe",
    notFoundTitle2: "¿te has desviado?",
    notFoundDesc:
      "La página que buscas no está disponible. Usa el menú superior para volver al inicio.",
    backHome: "Volver al inicio",
    loading: "Cargando…",
    recTitle1: "Una segunda lectura",
    recTitle2: "para la parcela.",
    recDesc:
      "Introduce las condiciones del terreno. Terra las compara con la ecorregión funcional observada más cercana y devuelve un perfil de cultivos basado en evidencia.",
    recFormTitle: "Describe las condiciones",
    recFormCaption:
      "¿No tienes análisis de laboratorio para N, P, K? Selecciona arriba un escenario de ejemplo como punto de partida.",
    recReadyHint: "Siete señales listas para comparar",
    recSearching: "Buscando…",
    recSubmit: "Ver mi recomendación",
    saveParcelBtn: "Guardar esta parcela",
    saveParcelNamePlaceholder: "Nombre de la parcela (ej. Lote Alto Boyacá)",
    saveParcelDeptPlaceholder: "Departamento (opcional)",
    saveParcelSaved: "Parcela guardada en tu cuenta.",
    saveParcelSignIn: "Inicia sesión para guardar parcelas",
    presets: ["Equilibrado", "Trópico húmedo", "Secano", "Tierra alta"],
    presetCustom: "Personalizado",
    accountTitle1: "Tu cuenta y",
    accountTitle2: "parcelas guardadas.",
    accountDesc:
      "Inicia sesión para guardar perfiles de suelo y clima y volver a evaluarlos cuando quieras.",
    tabLogin: "Iniciar sesión",
    tabRegister: "Crear cuenta",
    emailLabel: "Correo electrónico",
    nameLabel: "Nombre",
    passwordLabel: "Contraseña",
    passwordHint: "Mínimo 8 caracteres",
    loginBtn: "Entrar",
    registerBtn: "Crear cuenta",
    logoutBtn: "Cerrar sesión",
    signedInAs: "Sesión activa como",
    savedParcelsTitle: "Parcelas guardadas",
    noParcelsYet: "Aún no has guardado ninguna parcela. Evalúa una en Recomendar y guárdala aquí.",
    loadInRecommend: "Abrir en Recomendar",
    deleteParcel: "Eliminar",
    ecoregion: "Ecorregión",
  },
  en: {
    navHome: "Home",
    navRecommend: "Recommend",
    navPlan: "Plan",
    navAnalysis: "Analysis",
    navAccount: "My plots",
    navOverview: "Overview",
    navModel: "Model",
    navRegions: "Regions",
    analysisPanel: "Analysis panel",
    menuOpen: "Menu",
    menuClose: "Close",
    connecting: "Connecting…",
    available: "Terra online",
    offline: "Connection unavailable",
    disclaimer:
      "Estimates based on reference data. Not a guarantee of harvest or profit.",
    notFoundTitle1: "Route not found",
    notFoundTitle2: "off the trail?",
    notFoundDesc:
      "The page you are looking for is not available. Use the top menu to return home.",
    backHome: "Back to home",
    loading: "Loading…",
    recTitle1: "A second reading",
    recTitle2: "for your plot.",
    recDesc:
      "Enter your field conditions. Terra compares them against the nearest observed functional ecoregion and returns an evidence-based crop profile.",
    recFormTitle: "Describe field conditions",
    recFormCaption:
      "No lab analysis for N, P, K yet? Pick a sample scenario above as a starting point.",
    recReadyHint: "Seven environmental signals ready",
    recSearching: "Analyzing…",
    recSubmit: "Get recommendation",
    saveParcelBtn: "Save this plot",
    saveParcelNamePlaceholder: "Plot name (e.g. Highland Lot Boyacá)",
    saveParcelDeptPlaceholder: "Department / Region (optional)",
    saveParcelSaved: "Plot saved to your account.",
    saveParcelSignIn: "Sign in to save plots",
    presets: ["Balanced", "Wet tropical", "Dryland", "Cool highland"],
    presetCustom: "Custom",
    accountTitle1: "Your account and",
    accountTitle2: "saved plots.",
    accountDesc:
      "Sign in to store soil and climate profiles and revisit them anytime.",
    tabLogin: "Sign in",
    tabRegister: "Create account",
    emailLabel: "Email address",
    nameLabel: "Name",
    passwordLabel: "Password",
    passwordHint: "At least 8 characters",
    loginBtn: "Sign in",
    registerBtn: "Create account",
    logoutBtn: "Sign out",
    signedInAs: "Signed in as",
    savedParcelsTitle: "Saved plots",
    noParcelsYet: "No saved plots yet. Run a reading in Recommend and save it here.",
    loadInRecommend: "Open in Recommend",
    deleteParcel: "Delete",
    ecoregion: "Ecoregion",
  },
};

export const FEATURE_LABELS_I18N = {
  es: {
    Nitrogen: "Nitrógeno",
    Phosphorus: "Fósforo",
    Potassium: "Potasio",
    Temperature: "Temperatura",
    Humidity: "Humedad",
    pH_Value: "pH del suelo",
    Rainfall: "Precipitación",
  },
  en: {
    Nitrogen: "Nitrogen",
    Phosphorus: "Phosphorus",
    Potassium: "Potassium",
    Temperature: "Temperature",
    Humidity: "Humidity",
    pH_Value: "Soil pH",
    Rainfall: "Rainfall",
  },
};

const LanguageContext = createContext({
  lang: "es",
  setLang: () => {},
  toggleLang: () => {},
  t: (key) => TRANSLATIONS.es[key] || key,
  featureLabel: (f) => FEATURE_LABELS_I18N.es[f] || f,
});

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored === "en" ? "en" : "es";
    } catch {
      return "es";
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore storage errors in restricted browsing contexts.
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const toggleLang = () => setLang((prev) => (prev === "es" ? "en" : "es"));
  const t = (key) => TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.es[key] ?? key;
  const featureLabel = (f) =>
    FEATURE_LABELS_I18N[lang]?.[f] ?? FEATURE_LABELS_I18N.es[f] ?? f;

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t, featureLabel }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n() {
  return useContext(LanguageContext);
}
