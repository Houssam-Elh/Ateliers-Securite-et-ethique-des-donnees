import { useEffect, useState } from "react";
import { STATUSES, fmtEntry, short } from "./config";
import { Icons } from "./icons";

export const Badge = ({ s }) => <span className={`badge badge-${s}`}>{s}</span>;

export const PrioBadge = ({ p }) => <span className={`prio prio-${p}`}>{p}</span>;

export function Stepper({ status }) {
  const at = STATUSES.indexOf(status);
  return (
    <div className="stepper" aria-label="Progress">
      {STATUSES.map((s, i) => {
        const cls = i < at ? "step done" : i === at ? "step current" : "step";
        return (
          <div key={s} className={cls}>
            <div className="step-dot">
              {i < at ? <Icons.Check style={{ width: 11, height: 11 }} /> : i + 1}
            </div>
            <label>{s}</label>
          </div>
        );
      })}
    </div>
  );
}

function tlDotClass(status) {
  const m = { Reported: "reported", Assigned: "assigned", InProgress: "inprogress", Resolved: "resolved", Closed: "closed" };
  return `tl-dot ${m[status] || ""}`;
}

export function Timeline({ reader, id, tick }) {
  const [h, setH] = useState(null);
  useEffect(() => {
    let off = false;
    setH(null);
    reader.getIssueHistory(id)
      .then(r => !off && setH(r.map(fmtEntry)))
      .catch(() => !off && setH([]));
    return () => { off = true; };
  }, [reader, id, JSON.stringify(tick)]);

  if (!h) return <p style={{ color: "var(--muted)", fontSize: ".82rem" }}>Loading history…</p>;
  return (
    <ol className="timeline">
      {h.map((e, k) => (
        <li key={k}>
          <div className={tlDotClass(e.status)}>
            <Icons.Activity style={{ width: 10, height: 10 }} />
          </div>
          <div className="tl-body">
            <div className="tl-top">
              <Badge s={e.status} />
              <span style={{ fontSize: ".73rem", color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                <Icons.Calendar style={{ width: 12, height: 12 }} />
                {e.at.toLocaleString()}
              </span>
            </div>
            {e.comment && <div className="tl-comment">{e.comment}</div>}
            <div className="tl-by" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 2 }}>
              {e.team ? (
                <>
                  <Icons.Users style={{ width: 12, height: 12 }} />
                  <span>Team: <strong>{e.team}</strong> · </span>
                </>
              ) : null}
              <span>by <span title={e.by}>{short(e.by)}</span></span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Detail({ issue, reader, tick, children }) {
  return (
    <div className="card detail-panel">
      <div className="detail-header">
        <div>
          <div className="detail-id">{issue.id}</div>
          <div style={{ fontSize: ".75rem", color: "var(--muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
            <Icons.MapPin style={{ width: 12, height: 12 }} />
            {issue.location} &middot; {issue.type}
          </div>
        </div>
        <Badge s={issue.status} />
      </div>

      <p className="detail-desc">{issue.description}</p>

      <Stepper status={issue.status} />

      <div className="meta-grid">
        <div className="meta-item">
          <div className="meta-key">Type</div>
          <div className="meta-val">{issue.type}</div>
        </div>
        <div className="meta-item">
          <div className="meta-key">Priority</div>
          <div className="meta-val"><PrioBadge p={issue.priority} /></div>
        </div>
        <div className="meta-item">
          <div className="meta-key">Location</div>
          <div className="meta-val" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Icons.MapPin style={{ width: 13, height: 13, color: "var(--muted)" }} />
            {issue.location}
          </div>
        </div>
        <div className="meta-item">
          <div className="meta-key">Report Date</div>
          <div className="meta-val" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Icons.Calendar style={{ width: 13, height: 13, color: "var(--muted)" }} />
            {issue.date}
          </div>
        </div>
        <div className="meta-item">
          <div className="meta-key">Reported by</div>
          <div className="meta-val" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Icons.User style={{ width: 13, height: 13, color: "var(--muted)" }} />
            {issue.reportedBy || "Anonymous"}
          </div>
        </div>
        <div className="meta-item">
          <div className="meta-key">Assigned Team</div>
          <div className="meta-val" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Icons.Users style={{ width: 13, height: 13, color: "var(--muted)" }} />
            {issue.team || <span style={{ color: "var(--muted)" }}>Not assigned</span>}
          </div>
        </div>
        <div className="meta-item" style={{ gridColumn: "1/-1" }}>
          <div className="meta-key">Reporter Wallet</div>
          <div className="meta-val" title={issue.reporter} style={{ fontFamily: "monospace", fontSize: ".8rem", display: "flex", alignItems: "center", gap: 6 }}>
            <Icons.Wallet style={{ width: 13, height: 13, color: "var(--muted)" }} />
            {issue.reporter}
          </div>
        </div>
      </div>

      {children}

      <div>
        <h3>History &amp; Traceability</h3>
        <Timeline reader={reader} id={issue.id} tick={tick} />
      </div>
    </div>
  );
}
