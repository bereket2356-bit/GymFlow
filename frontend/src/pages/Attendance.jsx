import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Segmented from "../components/ui/Segmented.jsx";
import Pill from "../components/ui/Pill.jsx";
import Modal from "../components/ui/Modal.jsx";
import Button from "../components/ui/Button.jsx";
import AttendanceFlow from "../components/diagrams/AttendanceFlow.jsx";
import { useData } from "../context/DataContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { TODAY, fmtLong, fmtShort, plural } from "../lib/dates.js";
import { planOf, memType, currentMembership } from "../lib/status.js";
import { MARK_OPTIONS, ROSTERS } from "../data/sessions.js";
import { TZ_LABEL } from "../data/config.js";

const MARKS = MARK_OPTIONS;

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();
}

/** Attendance: pick a session, mark the roster, save with one deduction per session. */
export default function Attendance() {
  const { sessions, marks, savedMarks, toggleMark, saveAttendance, customerById } = useData();
  const { push } = useToast();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(sessions[0] ? sessions[0].id : null);
  const [confirming, setConfirming] = useState(false);

  const session = useMemo(
    () => sessions.find((s) => s.id === selected) || sessions[0],
    [sessions, selected],
  );

  if (!session) return null;

  const roster = ROSTERS[session.id] || [];
  const sessionMarks = marks[session.id] || {};
  const editable = session.status === "Planned";

  const counts = { P: 0, L: 0, A: 0, E: 0, U: 0 };
  roster.forEach((cid) => {
    const v = sessionMarks[cid] || "";
    if (v && counts[v] != null) counts[v] += 1;
    else counts.U += 1;
  });

  const dirty = roster.some((cid) => (sessionMarks[cid] || "") !== ((savedMarks[session.id] || {})[cid] || ""));

  const deductions = roster
    .map((cid) => {
      const c = customerById(cid);
      if (!c) return null;
      const m = currentMembership(c);
      if (!m || memType(m) !== "session") return null;
      const now = sessionMarks[cid] === "P" || sessionMarks[cid] === "L";
      const was = (savedMarks[session.id] || {})[cid] === "P" || (savedMarks[session.id] || {})[cid] === "L";
      if (now && !was && (m.sessionsLeft || 0) > 0) return { c, m };
      return null;
    })
    .filter(Boolean);

  const zeroWarn = roster
    .filter((cid) => {
      const c = customerById(cid);
      const m = c ? currentMembership(c) : null;
      const mk = sessionMarks[cid];
      return m && memType(m) === "session" && (m.sessionsLeft || 0) === 0 && (mk === "P" || mk === "L");
    })
    .map((cid) => customerById(cid).name);

  const onSave = () => {
    if (!editable) {
      push("This session is locked.", "danger");
      return;
    }
    if (!dirty) {
      push("No attendance changes to save.", "info");
      return;
    }
    setConfirming(true);
  };

  const commit = () => {
    const result = saveAttendance(session.id);
    setConfirming(false);
    const bits = [];
    if (result.deducted) bits.push(result.deducted + " " + plural(result.deducted, "session") + " deducted");
    if (result.restored) bits.push(result.restored + " " + plural(result.restored, "session") + " restored");
    push("Attendance saved for " + session.title + ". " + (bits.length ? bits.join(", ") : "No session changes") + ".");
  };

  const deductNames = deductions.slice(0, 3).map((d) => d.c.name).join(", ");
  const deductMore = deductions.length > 3 ? " and " + (deductions.length - 3) + " more" : "";

  return (
    <>
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">Attendance</h1>
          <p className="page-meta">
            <span>{fmtLong(TODAY)}</span>
            <span className="dot-sep" />
            <span>{sessions.length} sessions</span>
            <span className="dot-sep" />
            <span>{TZ_LABEL}</span>
          </p>
          <p className="hero-sentence" style={{ fontSize: 16 }}>
            Mark who turned up. A present or late mark on a session pack deducts one session, once.
          </p>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 16 }} aria-labelledby="flow-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="flow-title">Attendance to session</h2>
            <p className="card-sub">What happens after the owner marks the roster.</p>
          </div>
          <span className="tag">Internal only</span>
        </div>
        <div className="card-body">
          <AttendanceFlow />
        </div>
      </section>

      <section className="card" aria-labelledby="roster-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="roster-title">{session.title}</h2>
            <p className="card-sub">
              {session.time} – {session.end} · {session.coach} · capacity {session.cap}
            </p>
          </div>
          <div className="hstack">
            <label className="sr-only" htmlFor="session-select">Choose session</label>
            <select
              className="select"
              id="session-select"
              style={{ maxWidth: 290, minHeight: 40, paddingBlock: 6 }}
              value={session.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.time} · {s.title} · {s.status}
                </option>
              ))}
            </select>
            <Pill label={session.status === "Planned" ? "Scheduled" : session.status} />
          </div>
        </div>

        {roster.length ? (
          <ul className="roster">
            {roster.map((cid) => {
              const c = customerById(cid);
              if (!c) return null;
              const m = currentMembership(c);
              const plan = m ? planOf(m.plan) : null;
              const left = m && memType(m) === "session" ? m.sessionsLeft || 0 : null;
              const sub = m
                ? memType(m) === "session"
                  ? plan.name + " · " + left + " of " + m.sessionsTotal + " left"
                  : plan.name + " · expires " + fmtShort(m.end)
                : "No membership";
              const mark = sessionMarks[cid] || "";
              const warn = left === 0 && (mark === "P" || mark === "L") ? (
                <span className="zero-warn" style={{ color: "var(--warning)" }}>0 left — no deduction</span>
              ) : null;
              return (
                <li className="roster-item" key={cid}>
                  <div className="roster-person">
                    <span className="avatar" aria-hidden="true">{initials(c.name)}</span>
                    <div>
                      <p className="roster-name">{c.name}</p>
                      <p className="roster-sub">
                        <span className="mono">{c.id}</span>
                        <span>{sub}</span>
                        {warn}
                      </p>
                    </div>
                  </div>
                  <Segmented
                    options={MARKS}
                    value={mark}
                    disabled={!editable}
                    ariaLabel={"Attendance for " + c.name}
                    onChange={(key) => toggleMark(session.id, cid, key)}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="card-body">
            <div className="empty-state">
              <p>
                {session.status === "Cancelled"
                  ? "This session was cancelled. There is no roster to mark."
                  : "No one is booked into this session yet."}
              </p>
              <div className="hstack">
                <button className="btn btn-sm" type="button" onClick={() => navigate("/")}>Back to dashboard</button>
              </div>
            </div>
          </div>
        )}

        {roster.length > 0 && (
          <div className="count-bar" aria-live="polite">
            <span>Present <b>{counts.P}</b></span>
            <span>Late <b>{counts.L}</b></span>
            <span>Absent <b>{counts.A}</b></span>
            <span>Excused <b>{counts.E}</b></span>
            <span>Unmarked <b>{counts.U}</b></span>
            <span style={{ marginLeft: "auto" }} className="muted">P present · L late · A absent · E excused</span>
          </div>
        )}

        {roster.length > 0 && (
          <div className="save-bar">
            {session.status === "Cancelled" ? (
              <p className="save-note">
                This session was cancelled. No roster is expected and nothing will be deducted.
              </p>
            ) : session.status !== "Planned" ? (
              <>
                <p className="save-note">
                  This session is {session.status.toLowerCase()}. Attendance is locked so past deductions can’t change.
                </p>
                <span className="pill pill--reviewed">Locked</span>
              </>
            ) : (
              <>
                <p className="save-note">
                  {deductions.length ? (
                    <>
                      Saving will deduct <strong className="mono">{deductions.length}</strong>{" "}
                      {plural(deductions.length, "session")} from session-based memberships ({deductNames}
                      {deductMore}).
                    </>
                  ) : (
                    "No session-based memberships will be deducted. Marks are still saved to the roster."
                  )}
                </p>
                <div className="hstack">
                  <button className="btn" type="button" onClick={() => navigate("/reports")}>Session report</button>
                  <button className="btn btn-primary" type="button" disabled={!dirty} onClick={onSave}>
                    Save attendance
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <p className="fine-print" style={{ marginTop: 14 }}>
        Attendance is stored against the customer. A session pack never goes below zero: a member with no sessions left
        can be marked, but no deduction is made and a zero-session reminder appears on the dashboard.
      </p>

      {confirming && (
        <Modal
          title={"Save attendance for " + session.title + "?"}
          sub="Check the roster before the session deductions are written."
          onClose={() => setConfirming(false)}
          footer={
            <>
              <Button onClick={() => setConfirming(false)}>Cancel</Button>
              <Button variant="primary" onClick={commit}>Save attendance</Button>
            </>
          }
        >
          <div className="modal-body">
            <dl className="confirm-list">
              <div className="confirm-row"><dt>Present</dt><dd>{counts.P}</dd></div>
              <div className="confirm-row"><dt>Late</dt><dd>{counts.L}</dd></div>
              <div className="confirm-row"><dt>Absent</dt><dd>{counts.A}</dd></div>
              <div className="confirm-row"><dt>Excused</dt><dd>{counts.E}</dd></div>
              <div className="confirm-row"><dt>Unmarked</dt><dd>{counts.U}</dd></div>
              <div className="confirm-row confirm-total"><dt>Sessions to deduct</dt><dd>{deductions.length}</dd></div>
            </dl>
            {deductions.length ? (
              <ul className="visit-list" style={{ marginTop: 10 }}>
                {deductions.map((d) => (
                  <li key={d.c.id}>
                    <span>{d.c.name}</span>
                    <span className="mono">{d.m.sessionsLeft} → {d.m.sessionsLeft - 1} left</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="note-line" style={{ marginTop: 10 }}>No session packs will change.</p>
            )}
            {zeroWarn.length > 0 && (
              <div className="callout callout--warning" style={{ marginTop: 12 }}>
                <span>
                  {zeroWarn.join(", ")} has 0 sessions left. The mark is saved, but no deduction is made and a
                  zero-session reminder stays on the dashboard.
                </span>
              </div>
            )}
            <div className="callout callout--muted" style={{ marginTop: 12 }}>
              <span>
                Deductions are written once for this session. Changing a mark later reverses the deduction instead of
                adding another.
              </span>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}