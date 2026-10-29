import { money } from "../../lib/money.js";

/** Ledger bar: paid segment in accent, part-payment in info, owed as a hatched outline. */
export default function LedgerBar({ price, paid, className = "" }) {
  const safePrice = price > 0 ? price : 1;
  const safePaid = Math.max(0, paid);
  const balance = Math.max(0, price - safePaid);
  const pct = Math.min(100, Math.round((safePaid / safePrice) * 100));
  const seg = balance <= 0 ? "paid" : "partial";
  const segLabel = balance <= 0 ? "Paid in full" : "Part-payment";
  const aria =
    segLabel + ": " + money(safePaid) + " of " + money(price) + (balance > 0 ? ", " + money(balance) + " still owed" : "");
  return (
    <div className={"ledger " + className} role="img" aria-label={aria}>
      <div className="ledger-track">
        {safePaid > 0 && (
          <span className={"ledger-seg " + seg} style={{ width: Math.max(1, pct) + "%" }} title={segLabel + " " + money(safePaid)} />
        )}
        {balance > 0 && <span className="ledger-seg outline" title={"Still owed " + money(balance)} />}
      </div>
    </div>
  );
}