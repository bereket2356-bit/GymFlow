import { useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon.jsx";
import useFocusTrap from "./useFocusTrap.js";

/**
 * Modal dialog: focus-trapped, Escape to close, backdrop click closes and
 * focus returns to the trigger on unmount.
 */
export default function Modal({ title, sub, onClose, children, footer, wide = false }) {
  const panelRef = useRef(null);
  useFocusTrap(panelRef, onClose);

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={"modal" + (wide ? " modal--wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        ref={panelRef}
      >
        <div className="modal-head">
          <div>
            <h2 className="modal-title" id="modal-title">
              {title}
            </h2>
            {sub && <p className="modal-sub">{sub}</p>}
          </div>
          <button className="modal-close" type="button" aria-label="Close dialog" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {children}
        {footer}
      </div>
    </div>,
    document.body,
  );
}