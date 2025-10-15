import { useEffect, useRef } from "react";

/**
 * Warns the user when navigating away (browser refresh/close and hash-based route changes)
 * while there are unsaved changes.
 *
 * Works with HashRouter by intercepting `hashchange` and `beforeunload`.
 *
 * Usage:
 *   const [isDirty, setIsDirty] = useState(false);
 *   useConfirmLeave(isDirty);
 */
export default function useConfirmLeave(isDirty: boolean) {
  const dirtyRef = useRef(isDirty);
  const prevHashRef = useRef<string>(typeof window !== "undefined" ? window.location.hash : "");
  const revertingRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  // Browser tab close / refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      // Modern browsers ignore custom messages but showing returnValue triggers the prompt
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // HashRouter navigation (intra-app route changes)
  useEffect(() => {
    const onHashChange = () => {
      if (revertingRef.current) {
        // We initiated a revert; clear the flag and accept current hash
        revertingRef.current = false;
        prevHashRef.current = window.location.hash;
        return;
      }

      if (dirtyRef.current) {
        const ok = window.confirm("You have unsaved changes. Leave this page?");
        if (!ok) {
          // revert to previous hash without re-triggering confirm
          revertingRef.current = true;
          window.location.hash = prevHashRef.current || "#/";
          return;
        }
      }
      // accept navigation
      prevHashRef.current = window.location.hash;
    };

    // Initialize stored hash
    prevHashRef.current = window.location.hash;

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
}
