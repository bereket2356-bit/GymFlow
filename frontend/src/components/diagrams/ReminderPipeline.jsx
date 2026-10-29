const STEPS = [
  {
    k: "01 · Input",
    t: "Business events",
    s: "Expiry dates, session counts, balances and visit history change as the owner works.",
  },
  {
    k: "02 · Rules",
    t: "Reminder rules",
    s: "7/3/1-day expiry windows, expired memberships, zero sessions, overdue balances, no visit in 14 days.",
  },
  {
    k: "03 · Output",
    t: "Dashboard reminders",
    s: "Internal notes for the owner only. They sit on the dashboard until reviewed.",
  },
  {
    k: "04 · Close",
    t: "Owner marks reviewed",
    s: "Marks the reminder as seen. The customer record is never changed.",
  },
];

/** Reminder pipeline: business events → rules → dashboard notes → reviewed. */
export default function ReminderPipeline() {
  return (
    <div
      className="pipeline"
      role="list"
      aria-label="Reminder pipeline: business events feed rules, which create dashboard reminders that the owner marks reviewed. No message is sent to the customer."
    >
      {STEPS.map((st, i) => (
        <div className="pipe-step" role="listitem" key={st.k}>
          {i > 0 && <span className="pipe-arrow" aria-hidden="true" />}
          <p className="label">{st.k}</p>
          <p className="pipe-title">{st.t}</p>
          <p className="pipe-sub">{st.s}</p>
        </div>
      ))}
    </div>
  );
}