/**
 * Mobile scrim behind the navigation drawer. The drawer itself is the shared
 * Sidebar; this closes it when tapped.
 */
export default function MobileDrawer({ open, onClose }) {
  if (!open) return null;
  return (
    <div
      className="sidebar-scrim"
      role="presentation"
      style={{ display: "block", position: "fixed", inset: 0, zIndex: 45, background: "var(--overlay)" }}
      onClick={onClose}
    />
  );
}