import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // If route includes an anchor, try to scroll to it
    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ block: "start", behavior: "auto" });
        return;
      }
    }
    // Otherwise reset scroll to top (works well with AnimatePresence)
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    // Also clear any scroll on the root element (mobile quirks)
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname, hash]);

  return null;
}
