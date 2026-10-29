/** Segmented control (used for the P / L / A / E attendance marks). */
export default function Segmented({ options, value, onChange, ariaLabel, disabled = false, className = "" }) {
  return (
    <div className={"seg " + className} role="group" aria-label={ariaLabel}>
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          data-mark={key}
          title={label}
          aria-label={label}
          aria-pressed={value === key}
          disabled={disabled}
          onClick={() => onChange(key)}
        >
          {key}
        </button>
      ))}
    </div>
  );
}