/** Tab strip used on the customer detail page. */
export default function Tabs({ items, value, onChange, ariaLabel }) {
  return (
    <nav className="tabs" aria-label={ariaLabel}>
      {items.map((t) => {
        const on = value === t.key;
        return (
          <button
            key={t.key}
            className={"tab" + (on ? " is-active" : "")}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
          >
            {t.label}
            {t.count != null && <span className="tab-count">{t.count}</span>}
          </button>
        );
      })}
    </nav>
  );
}