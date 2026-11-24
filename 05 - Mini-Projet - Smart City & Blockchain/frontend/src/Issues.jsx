import { useState } from "react";
import { STATUSES } from "./config";
import { Icons } from "./icons";
import { Badge, PrioBadge, Detail } from "./ui";

export default function Issues({ issues, loading, reader, actions }) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState("All");
  const [sel, setSel] = useState(null);

  const list = issues.filter(
    (i) => (st === "All" || i.status === st) &&
      `${i.id} ${i.location} ${i.type} ${i.reportedBy}`.toLowerCase().includes(q.toLowerCase())
  );
  const cur = issues.find((i) => i.id === sel);

  return (
    <div className="card-grid">
      <div>
        <div className="page-header">
          <div>
            <h2>Urban Issues</h2>
            <p>{list.length} issue{list.length !== 1 ? "s" : ""} found</p>
          </div>
        </div>

        <div className="filters">
          <div className="search-box">
            <span className="search-icon">
              <Icons.Search />
            </span>
            <input
              placeholder="Search by ID, location or type…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
          <select value={st} onChange={e => setSt(e.target.value)} style={{ width: "auto" }}>
            <option>All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {loading && !issues.length ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Icons.Refresh className="spin" style={{ width: 36, height: 36, opacity: 0.4 }} />
            </div>
            <p>Loading issues from blockchain...</p>
          </div>
        ) : !list.length ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Icons.ClipboardList style={{ width: 36, height: 36, opacity: 0.4 }} />
            </div>
            <p>No issues match your criteria.</p>
            <button className="btn btn-sm" onClick={() => { setQ(""); setSt("All"); }}>Reset Filters</button>
          </div>
        ) : (
          <ul className="issue-list">
            {list.map(i => (
              <li key={i.id}>
                <button
                  className={`issue-row ${i.id === sel ? "active" : ""}`}
                  onClick={() => setSel(i.id)}
                >
                  <div className="issue-row-left">
                    <div className="issue-row-id">{i.id}</div>
                    <div className="issue-row-meta" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Icons.MapPin style={{ width: 12, height: 12, color: "var(--muted)" }} />
                      {i.location} &middot; {i.type}
                    </div>
                  </div>
                  <div className="issue-row-right">
                    <Badge s={i.status} />
                    <PrioBadge p={i.priority} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        {cur ? (
          <Detail issue={cur} reader={reader} tick={issues}>
            {actions?.(cur)}
          </Detail>
        ) : (
          <div className="card empty-state" style={{ minHeight: 320 }}>
            <div className="empty-icon">
              <Icons.ClipboardList style={{ width: 40, height: 40, opacity: 0.3 }} />
            </div>
            <p>Select an issue to inspect its details and verification audit trail.</p>
          </div>
        )}
      </div>
    </div>
  );
}
