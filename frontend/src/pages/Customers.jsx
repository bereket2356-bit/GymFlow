import { useMemo, useState } from "react";
import CustomerTable, { sortValue } from "../components/customers/CustomerTable.jsx";
import { NewCustomerModal } from "../components/customers/CustomerModals.jsx";
import Icon from "../components/ui/Icon.jsx";
import Pagination from "../components/ui/Pagination.jsx";
import { useData } from "../context/DataContext.jsx";
import { money, num } from "../lib/money.js";
import { plural } from "../lib/dates.js";
import { currentMembership, memStatus, customerBalance } from "../lib/status.js";

const CHIPS = [
  ["all", "All"],
  ["active", "Active"],
  ["expiring", "Expiring"],
  ["expired", "Expired"],
  ["balance", "Balance due"],
  ["archived", "Archived"],
];

const STATUS_FOR_CHIP = { active: "Active", expiring: "Expiring soon", expired: "Expired" };

const PER_PAGE = 6;

/** Customer register: search, status filter chips, sortable table, pagination. */
export default function Customers() {
  const { customers, payments, sel } = useData();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("name");
  const [dir, setDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [newOpen, setNewOpen] = useState(false);

  const nonArchived = sel.nonArchived();

  const chipCount = (key) => {
    if (key === "all") return nonArchived.length;
    if (key === "archived") return customers.length - nonArchived.length;
    if (key === "balance") return nonArchived.filter((c) => sel.balanceOfCustomer(c) > 0).length;
    const want = STATUS_FOR_CHIP[key];
    return nonArchived.filter((c) => memStatus(currentMembership(c)) === want).length;
  };

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = customers.filter((c) => {
      if (filter === "archived") {
        if (!c.archived) return false;
      } else if (c.archived) {
        return false;
      }
      const m = currentMembership(c);
      const status = memStatus(m);
      if (filter === "active" && status !== "Active") return false;
      if (filter === "expiring" && status !== "Expiring soon") return false;
      if (filter === "expired" && status !== "Expired") return false;
      if (filter === "balance" && sel.balanceOfCustomer(c) <= 0) return false;
      if (needle) {
        const plan = m ? (m.plan || "") : "";
        const hay = (c.name + " " + c.id + " " + c.phone + " " + plan).toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const sign = dir === "desc" ? -1 : 1;
    rows.sort((a, b) => {
      const va = sortValue(a, sort, payments);
      const vb = sortValue(b, sort, payments);
      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [customers, payments, sel, q, filter, sort, dir]);

  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const current = Math.min(page, pages);
  const slice = list.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const onSort = (column) => {
    if (sort === column) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(column);
      setDir("asc");
    }
    setPage(1);
  };

  const reset = () => {
    setQ("");
    setFilter("all");
    setPage(1);
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">Customers</h1>
          <p className="page-meta">
            <span>{num(nonArchived.length)} active files</span>
            <span className="dot-sep" />
            <span>{chipCount("archived")} archived</span>
            <span className="dot-sep" />
            <span>{money(sel.totalOutstanding())} outstanding</span>
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" type="button" onClick={() => setNewOpen(true)}>
            <Icon name="plus" />
            New customer
          </button>
        </div>
      </div>

      <section className="card" aria-labelledby="cust-table-title">
        <div className="card-head">
          <div>
            <h2 className="card-title" id="cust-table-title">Customer register</h2>
            <p className="card-sub">
              Membership status and payment status are tracked separately — a live member can still owe money.
            </p>
          </div>
          <span className="tag">
            {list.length} {plural(list.length, "match", "matches")}
          </span>
        </div>

        <div className="toolbar">
          <div className="search">
            <Icon name="search" />
            <label className="sr-only" htmlFor="customer-search">Search customers</label>
            <input
              className="input"
              id="customer-search"
              type="search"
              placeholder="Search name, ID or phone"
              value={q}
              autoComplete="off"
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="chips" role="group" aria-label="Filter customers">
            {CHIPS.map(([key, label]) => (
              <button
                key={key}
                className={"chip" + (filter === key ? " is-active" : "")}
                type="button"
                aria-pressed={filter === key}
                onClick={() => {
                  setFilter(key);
                  setPage(1);
                }}
              >
                {label}
                <span className="count">{chipCount(key)}</span>
              </button>
            ))}
          </div>
        </div>

        {slice.length ? (
          <CustomerTable
            customers={slice}
            payments={payments}
            sortKey={sort}
            dir={dir}
            onSort={onSort}
          />
        ) : (
          <div className="table-wrap">
            <div className="table-empty">
              <p style={{ marginBottom: 10 }}>No customers match this search and filter.</p>
              <button className="btn btn-sm" type="button" onClick={reset}>Clear filters</button>
            </div>
          </div>
        )}

        <div className="table-foot">
          <span className="fine-print">
            Showing {list.length ? (current - 1) * PER_PAGE + 1 : 0}–{Math.min(current * PER_PAGE, list.length)} of{" "}
            {list.length}. Select a row to open the customer.
          </span>
          <Pagination page={current} pages={pages} onPage={setPage} />
        </div>
      </section>

      {newOpen && <NewCustomerModal onClose={() => setNewOpen(false)} />}
    </>
  );
}