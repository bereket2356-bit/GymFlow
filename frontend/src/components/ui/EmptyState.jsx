import Button from "./Button.jsx";

/** Empty state used whenever a list or table has nothing to show. */
export default function EmptyState({ children, actions }) {
  return (
    <div className="empty-state">
      <p>{children}</p>
      {actions && <div className="hstack">{actions}</div>}
    </div>
  );
}

export function EmptyActionButton({ onClick, children, variant }) {
  return (
    <Button size="sm" variant={variant} onClick={onClick}>
      {children}
    </Button>
  );
}