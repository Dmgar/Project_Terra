import React from "react";
import { artworkFor } from "./cropArt";

export default function CropIllustration({ crop, className = "" }) {
  const art = artworkFor(crop);
  return <svg className={`crop-illustration ${className}`} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    {art.shapes.map(([type, ...values], index) => type === "ellipse"
      ? <ellipse key={index} cx={values[0]} cy={values[1]} rx={values[2]} ry={values[3]} fill={values[4]} />
      : <polygon key={index} points={values[0].reduce((acc, coordinate, position) => acc + (position % 2 ? `${coordinate} ` : `${coordinate},`), "")} fill={values[1]} />)}
  </svg>;
}