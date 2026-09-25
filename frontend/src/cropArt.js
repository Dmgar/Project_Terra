// Shared vector silhouettes in a 100 × 100 coordinate space, used by the app and its PDF.
const leaf = "#668b5f";
const deep = "#345d4c";
const lime = "#a9c58b";
const cream = "#e8ead6";
const clay = "#be7051";

export const cropArt = {
  lechuga: {
    backdrop: "#e5eddb",
    shapes: [
      ["ellipse", 50, 72, 35, 13, deep],
      ["ellipse", 30, 50, 17, 28, leaf],
      ["ellipse", 70, 50, 17, 28, leaf],
      ["ellipse", 44, 42, 19, 33, lime],
      ["ellipse", 59, 39, 18, 33, leaf],
      ["ellipse", 50, 49, 21, 30, "#84aa72"],
      ["poly", [50, 74, 51, 35, 47, 18, 55, 39, 53, 74], cream],
    ],
  },
  tomate: {
    backdrop: "#f2e7db",
    shapes: [
      ["poly", [49, 37, 52, 18, 68, 13, 69, 18, 56, 22, 53, 41], deep],
      ["ellipse", 39, 55, 24, 24, clay],
      ["ellipse", 67, 63, 17, 18, "#d18a59"],
      ["poly", [18, 39, 31, 42, 36, 30, 43, 41, 51, 36, 47, 47, 35, 50], deep],
      ["poly", [51, 49, 63, 52, 68, 42, 72, 52, 80, 53, 68, 57], deep],
      ["ellipse", 31, 54, 5, 9, "#e7aa7b"],
    ],
  },
  cilantro: {
    backdrop: "#e5efdf",
    shapes: [
      ["poly", [49, 82, 45, 23, 49, 22, 52, 83], deep],
      ["poly", [50, 72, 22, 43, 24, 40, 52, 65], deep],
      ["poly", [48, 63, 76, 31, 79, 35, 52, 70], deep],
      ["ellipse", 34, 34, 12, 13, leaf], ["ellipse", 50, 25, 12, 14, lime],
      ["ellipse", 64, 32, 12, 13, leaf], ["ellipse", 24, 46, 10, 11, lime],
      ["ellipse", 75, 40, 10, 11, lime], ["ellipse", 37, 56, 10, 11, leaf],
      ["ellipse", 64, 54, 10, 11, leaf],
    ],
  },
  cebolla: {
    backdrop: "#e8eee0",
    shapes: [
      ["poly", [28, 67, 26, 11, 31, 11, 36, 65], leaf],
      ["poly", [44, 65, 42, 15, 47, 11, 51, 65], deep],
      ["poly", [60, 66, 65, 11, 70, 13, 66, 67], leaf],
      ["ellipse", 34, 75, 13, 14, cream],
      ["ellipse", 51, 75, 13, 14, "#d8d3aa"],
      ["ellipse", 68, 75, 13, 14, cream],
      ["poly", [30, 82, 34, 97, 37, 82, 48, 82, 52, 96, 55, 82, 65, 82, 68, 96, 72, 82], deep],
    ],
  },
  zanahoria: {
    backdrop: "#f3e9db",
    shapes: [
      ["poly", [48, 36, 21, 24, 20, 17, 45, 29, 39, 8, 45, 7, 50, 28, 62, 11, 67, 15, 55, 37], leaf],
      ["poly", [35, 41, 66, 41, 53, 84, 47, 94, 43, 77], "#cf8151"],
      ["poly", [43, 55, 60, 53, 59, 58, 44, 60], "#e8aa69"],
      ["poly", [46, 68, 56, 66, 54, 71, 47, 73], "#e8aa69"],
    ],
  },
  frijol: {
    backdrop: "#e5eadd",
    shapes: [
      ["poly", [14, 44, 26, 33, 46, 47, 68, 62, 83, 56, 89, 62, 77, 78, 57, 75, 39, 60, 22, 54], leaf],
      ["poly", [18, 43, 41, 51, 60, 68, 81, 69, 76, 73, 59, 71, 40, 55], lime],
      ["ellipse", 27, 28, 15, 9, deep],
      ["poly", [18, 43, 23, 23, 28, 25, 23, 49], deep],
    ],
  },
  acelga: {
    backdrop: "#e3eee3",
    shapes: [
      ["poly", [49, 90, 47, 54, 32, 71, 16, 63, 19, 44, 29, 28, 47, 17, 65, 29, 82, 47, 76, 66, 57, 73, 50, 55], leaf],
      ["poly", [49, 84, 48, 35, 53, 33, 54, 89], cream],
      ["poly", [50, 57, 28, 43, 29, 39, 52, 52], lime],
      ["poly", [52, 50, 69, 37, 72, 40, 53, 56], lime],
    ],
  },
  aromaticas: {
    backdrop: "#e7eadf",
    shapes: [
      ["poly", [49, 85, 48, 25, 52, 25, 53, 85], deep],
      ["poly", [49, 68, 24, 40, 27, 38, 52, 62], deep],
      ["poly", [50, 57, 74, 33, 77, 35, 53, 63], deep],
      ["ellipse", 36, 33, 15, 7, leaf], ["ellipse", 63, 27, 14, 7, leaf],
      ["ellipse", 27, 48, 12, 6, lime], ["ellipse", 71, 46, 13, 7, lime],
      ["ellipse", 38, 60, 13, 6, leaf], ["ellipse", 61, 60, 13, 6, leaf],
      ["poly", [31, 79, 70, 79, 66, 94, 36, 94], clay],
    ],
  },
};

const aliases = {
  "tomate cherry": "tomate",
  "cebolla larga": "cebolla",
  "fríjol arbustivo": "frijol",
  "frijol arbustivo": "frijol",
  "aromáticas": "aromaticas",
};

export function artworkFor(crop) {
  const key = crop.id || aliases[crop.name?.toLowerCase()] || crop.name?.toLowerCase();
  return cropArt[key] || cropArt.lechuga;
}