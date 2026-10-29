const STATUS_CLASS = {
  Active: "active",
  "Expiring soon": "soon",
  Expired: "expired",
  Exhausted: "exhausted",
  Scheduled: "scheduled",
  Paid: "paid",
  Partial: "partial",
  Unpaid: "unpaid",
  Overdue: "overdue",
  Inactive: "neutral",
  Reviewed: "reviewed",
  Locked: "reviewed",
  Correction: "neutral",
  None: "neutral",
};

/** Status pill. Membership status and payment status are separate labels. */
export default function Pill({ label, tone, plain = false, className = "", style }) {
  const mod = tone || STATUS_CLASS[label] || "neutral";
  return (
    <span className={["pill", "pill--" + mod, plain ? "pill--plain" : "", className].filter(Boolean).join(" ")} style={style}>
      {label}
    </span>
  );
}