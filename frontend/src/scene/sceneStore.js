import { useSyncExternalStore } from "react";

// Estado compartido de la finca entre pantallas: las ecorregiones de la API y cuál está enfocada
// (por la leyenda, un gráfico o un resultado). Un objeto mutable + suscriptores basta aquí: no
// hace falta una librería de estado para tres campos.
export const sceneState = {
  // Regiones de /api/regions (id, share, count, topCrop, crops…).
  regions: null,
  // Ecorregión enfocada (id) o null. Las cabeceras muestran la imagen de su parcela.
  highlight: null,
  // Pie de la imagen de cabecera cuando una página enfoca una ecorregión.
  caption: null,
};

const listeners = new Set();

export function setScene(patch) {
  let changed = false;
  for (const key of Object.keys(patch)) {
    if (sceneState[key] !== patch[key]) {
      sceneState[key] = patch[key];
      changed = true;
    }
  }
  if (changed) listeners.forEach((listener) => listener());
}

export function subscribeScene(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Enfoca una ecorregión: la cabecera cambia a la imagen de su parcela en el render.
export function focusRegion(id, caption) {
  if (id == null) return;
  setScene({ highlight: id, caption: caption ?? `Parcela de la Ecorregión ${id}` });
}

export function useSceneValue(select) {
  return useSyncExternalStore(subscribeScene, () => select(sceneState));
}
