import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

export const EASE = "expo.out";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

let lenis = null;

// Scroll suave de toda la app, sincronizado con el reloj de GSAP para que ScrollTrigger
// (y con él el tractor) lea exactamente la misma posición que se pinta.
export function useSmoothScroll(pathname) {
  useEffect(() => {
    // La app ya lleva cada página arriba; la restauración automática del navegador al recargar
    // compite con Lenis y deja el recorrido 3D a medio camino.
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    if (prefersReducedMotion()) return undefined;
    lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(2, -10 * t) });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenis = null;
    };
  }, []);

  // Cada página nueva empieza arriba; si no, se hereda el scroll de la anterior.
  useLayoutEffect(() => {
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    else window.scrollTo(0, 0);
  }, [pathname]);
}

export function scrollToTop() {
  if (lenis) lenis.scrollTo(0);
  else window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

export function scrollToElement(element) {
  if (!element) return;
  if (lenis) lenis.scrollTo(element, { offset: -96 });
  else element.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

// Revelado de entrada dentro de `scope`: los elementos [data-reveal] suben y aparecen al entrar
// en pantalla, escalonados. El contenido es visible por defecto; sin JS o con movimiento
// reducido no se oculta nada.
export function useReveal(scopeRef, deps = []) {
  useLayoutEffect(() => {
    const scope = scopeRef.current;
    if (!scope || prefersReducedMotion()) return undefined;
    const context = gsap.context(() => {
      gsap.utils.toArray(scope.querySelectorAll("[data-reveal]")).forEach((element) => {
        // Solo transform y opacidad: se componen en GPU. El desenfoque animado costaba fotogramas.
        gsap.from(element, {
          y: 28,
          opacity: 0,
          duration: 1.1,
          ease: EASE,
          delay: Number(element.dataset.reveal) || 0,
          scrollTrigger: { trigger: element, start: "top 88%", once: true },
        });
      });
    }, scope);
    return () => context.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
