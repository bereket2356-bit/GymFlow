import { useEffect, useRef } from "react";

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus inside `ref` while open: focuses the panel on mount,
 * cycles Tab / Shift+Tab inside it, closes on Escape and returns focus to the
 * element that opened it when the panel unmounts.
 */
export default function useFocusTrap(ref, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const panel = ref.current;
    const previous = document.activeElement;
    const focusTarget = panel && (panel.querySelector("[data-autofocus]") || panel);
    if (focusTarget && typeof focusTarget.focus === "function") focusTarget.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = panel ? Array.from(panel.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null) : [];
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      if (previous && document.contains(previous) && typeof previous.focus === "function") previous.focus();
    };
  }, [ref]);
}