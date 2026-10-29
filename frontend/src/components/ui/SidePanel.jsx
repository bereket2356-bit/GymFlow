import { useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon.jsx";
import useFocusTrap from "./useFocusTrap.js";

/**
 * Side panel: right drawer on desktop, full-height sheet on mobile.
 * Focus-trapped, Escape closes, backdrop click closes, focus returns to trigger.
 */
export default function SidePanel({ title, sub, onClose, children, footer, panelId = "side-panel-title" }) {
  const panelRef = useRef(null);
  useFocusTrap(panelRef, onClose);

  return createPortal(
    <>
      <div
        className="pkg-panel-backdrop"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      />
      <aside className="pkg-panel" role="dialog" aria-modal="true" aria-labelledby={panelId} ref={panelRef}>
        <div className="pkg-panel-head">
          <div>
            <h2 className="pkg-panel-title" id={panelId}>
              {title}
            </h2>
            {sub && <p className="pkg-panel-sub">{sub}</p>}
          </div>
          <button className="modal-close" type="button" aria-label="Close panel" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="pkg-panel-body">{children}</div>
        {footer}
      </aside>
    </>,
    document.body,
  );
}