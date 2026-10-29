import { useMemo, useState } from "react";
import PackageTable from "../components/packages/PackageTable.jsx";
import PackageForm from "../components/packages/PackageForm.jsx";
import PackageAnatomy from "../components/diagrams/PackageAnatomy.jsx";
import Modal from "../components/ui/Modal.jsx";
import Button from "../components/ui/Button.jsx";
import Icon from "../components/ui/Icon.jsx";
import { useData } from "../context/DataContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

const CHIPS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];

/**
 * Package catalogue. Packages are never deleted — only deactivated — and the
 * editor warns before type or session changes on packages with members.
 */
export default function Packages() {
  const { packages, setPackageActive, sel } = useData();
  const { push } = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [editor, setEditor] = useState(null); // package id, or "__new__"
  const [pendingToggle, setPendingToggle] = useState(null);

  const activeTotal = packages.filter((p) => p.active).length;
  const inactiveTotal = packages.length - activeTotal;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return packages.filter((p) => {
      if (status === "active" && !p.active) return false;
      if (status === "inactive" && p.active) return false;
      if (needle && !p.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [packages, q, status]);

  const openEditor = (id) => setEditor(id || "__new__");
  const editingPkg = editor && editor !== "__new__" ? packages.find((p) => p.id === editor) : null;

  const toggle = (pkg) => {
    if (!pkg.active) {
      setPackageActive(pkg.id, true);
      push("Package ‘" + pkg.name + "’ activated. It can be assigned to new memberships.");
      return;
    }
    setPendingToggle(pkg.id);
  };

  const confirmDeactivate = () => {
    const pkg = packages.find((p) => p.id === pendingToggle);
    setPendingToggle(null);
    if (!pkg) return;
    setPackageActive(pkg.id, false);
    push("Package ‘" + pkg.name + "’ deactivated. Existing memberships are unchanged.");
  };

  const pending = pendingToggle ? packages.find((p) => p.id === pendingToggle) : null;
  const pendingStats = pending ? sel.packageStats(pending.id) : { active: 0, total: 0, names: [] };

  return (
    <>
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">Packages</h1>
          <p className="page-meta">
            <span>Membership catalogue</span>
            <span className="dot-sep" />
            <span>{packages.length} packages</span>
            <span className="dot-sep" />
            <span>Changes apply to new memberships</span>
          </p>
          <p className="hero-sentence">
            Set the price and terms once. <span className="num">{activeTotal}</span> packages are open to new
            memberships.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" type="button" onClick={() => openEditor(null)}>
            <Icon name="plus" />
            New package
          </button>
        </div>
      </div>

      <PackageAnatomy />

      <section className="card" aria-labelledby="pkg-list-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="pkg-list-title">Package catalogue</h2>
            <p className="card-sub">
              Member counts and revenue are read from existing customer records. Inactive packages keep their history.
            </p>
          </div>
        </div>

        <div className="pkg-toolbar">
          <div className="search">
            <Icon name="search" />
            <input
              className="input"
              id="pkg-search"
              type="search"
              value={q}
              placeholder="Search package name"
              aria-label="Search packages by name"
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="chips" role="group" aria-label="Filter packages by status">
            {CHIPS.map((c) => {
              const count = c.key === "all" ? packages.length : c.key === "active" ? activeTotal : inactiveTotal;
              return (
                <button
                  key={c.key}
                  className={"chip " + (status === c.key ? "is-active" : "")}
                  type="button"
                  aria-pressed={status === c.key ? "true" : "false"}
                  onClick={() => setStatus(c.key)}
                >
                  {c.label} <span className="count">{count}</span>
                </button>
              );
            })}
          </div>
          <span className="pkg-count">{rows.length} of {packages.length} shown</span>
        </div>

        {rows.length ? (
          <PackageTable packages={rows} stats={sel.packageStats} onEdit={openEditor} onToggle={toggle} />
        ) : (
          <div className="table-wrap">
            <div className="table-empty">
              <p>No packages match this search and filter.</p>
              <div className="pkg-empty-actions">
                <button
                  className="btn btn-sm"
                  type="button"
                  onClick={() => {
                    setQ("");
                    setStatus("all");
                  }}
                >
                  Clear filters
                </button>
                <button className="btn btn-sm btn-primary" type="button" onClick={() => openEditor(null)}>
                  <Icon name="plus" />
                  New package
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="card-foot">
          <span className="fine-print">
            Revenue counts payments recorded against memberships of each package. It is not list price × members.
            Deactivating blocks new assignments only; it never deletes a package or a membership.
          </span>
        </div>
      </section>

      {editor && (
        <PackageForm pkg={editor === "__new__" ? null : editingPkg} onClose={() => setEditor(null)} />
      )}

      {pending && (
        <Modal
          title={"Deactivate ‘" + pending.name + "’?"}
          onClose={() => setPendingToggle(null)}
          footer={
            <>
              <Button onClick={() => setPendingToggle(null)}>Cancel</Button>
              <Button variant="danger" onClick={confirmDeactivate}>Deactivate package</Button>
            </>
          }
        >
          <div className="modal-body">
            {pendingStats.names.length ? (
              <>
                <p style={{ margin: "0 0 6px" }}>Affected active members, by name:</p>
                <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: "12.5px", lineHeight: 1.6 }}>
                  {pendingStats.names.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p>No active memberships are affected.</p>
            )}
            <p>
              {pendingStats.names.length} active {pendingStats.names.length === 1 ? "membership is" : "memberships are"}{" "}
              affected.{" "}
              {pendingStats.total > pendingStats.names.length
                ? "Historical memberships keep their terms. "
                : ""}
              New assignments are blocked until you reactivate the package. Nothing is deleted.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}