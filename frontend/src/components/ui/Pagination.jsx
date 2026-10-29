/** Pagination for the customer register. */
export default function Pagination({ page, pages, onPage, label = "Pagination" }) {
  const btn = (target, text, key) => (
    <button
      key={key}
      className={"page-btn" + (target === page ? " is-current" : "")}
      type="button"
      disabled={target < 1 || target > pages}
      aria-label={typeof text === "string" && text.length > 2 ? text : "Page " + target}
      aria-current={target === page ? "page" : undefined}
      onClick={() => onPage(target)}
    >
      {text}
    </button>
  );
  const numbers = [];
  for (let i = 1; i <= pages; i += 1) numbers.push(btn(i, String(i), "n" + i));
  return (
    <div className="pager" aria-label={label}>
      {btn(page - 1, "‹", "prev")}
      {numbers}
      {btn(page + 1, "›", "next")}
    </div>
  );
}