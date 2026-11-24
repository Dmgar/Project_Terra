// Datos de la finca renderizada que comparten la entrada de la portada y las cabeceras.
// La geometría (camino, parcelas, relieve) vive en scene-src/build_farm.py; si cambias estas
// paradas o los colores, vuelve a renderizar para que coincidan.

// Dónde queda cada parcela a lo largo del camino (0 = entrada, 1 = fondo).
export const PARCEL_STATIONS = [0.2, 0.36, 0.52, 0.68, 0.84];

// Un color por ecorregión, compartido entre el render (banderines), la UI (leyenda, resultados)
// y la gráfica UMAP. Cada uno sale de un material de la finca, no de una paleta de gráfico.
export const REGION_COLORS = ["#d9a62e", "#c8452f", "#2f7d8f", "#7a5aa8", "#3f8a3c"];

import { tr } from "../i18n";

// Imágenes fijas sacadas del mismo render (public/field/stills): una por módulo y una por parcela.
export const stillFor = (name) => `/field/stills/${name}.webp`;
export const parcelStill = (id) => stillFor(`parcel-${id}`);

// Imagen y pie de cabecera por ruta: cada módulo es un punto distinto del recorrido del tractor.
const ROUTE_STILLS = [
  ["/producto/recomendar", "recomendar", "Entrada de la finca: aquí se describe la parcela", "The farm entrance: describe your plot here"],
  ["/producto/plan", "plan", "Entre las parcelas: aquí se organiza la siembra", "Between the plots: plan your planting here"],
  ["/analisis/resumen", "resumen", "Mirador de la finca: el conjunto de los datos", "The farm lookout: the data as a whole"],
  ["/analisis/modelo", "modelo", "Junto a las ecorregiones: cómo se agrupan", "Beside the ecoregions: how they group"],
  ["/analisis/regiones", "regiones", "Al fondo: cada ecorregión por dentro", "At the back: each ecoregion up close"],
];

export function routeStill(pathname) {
  const match = ROUTE_STILLS.find(([prefix]) => pathname.startsWith(prefix));
  if (match) return { src: stillFor(match[1]), caption: tr(match[2], match[3]) };
  return { src: stillFor("entrada"), caption: tr("La entrada de la finca", "The farm entrance") };
}
