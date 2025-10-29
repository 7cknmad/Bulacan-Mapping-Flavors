import { useEffect } from "react";

export default function useRevealOnScroll(selector = "[data-reveal]") {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll(selector));
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.remove("opacity-0", "translate-y-6");
            (entry.target as HTMLElement).classList.add("opacity-100", "translate-y-0");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    nodes.forEach((n) => {
      observer.observe(n);
    });

    return () => observer.disconnect();
  }, [selector]);
}
