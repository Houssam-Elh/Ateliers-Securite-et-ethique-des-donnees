import { useState } from "react";
import * as XLSX from "xlsx";
import { PRIORITIES, STATUSES } from "./config";

const pad = (n) => String(n).padStart(2, "0");
const text = (v) =>
  v instanceof Date ? `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}` : String(v ?? "").trim();
const canon = (list, v) => list.find((x) => x.toLowerCase() === v.toLowerCase()) ?? v;

const REQUIRED = ["issueId", "issueType", "location", "description", "reportDate", "priority"];

function check(r, onChain, seen) {
  const e = [];
  if (!r.issueId) e.push("issueId is missing");
  else if (onChain.has(r.issueId)) e.push("already on chain");
  else if (seen.has(r.issueId)) e.push("duplicate in file");
  if (!r.location) e.push("location is missing");
  if (!r.description) e.push("description is missing");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.reportDate)) e.push("reportDate must be YYYY-MM-DD");
  if (!PRIORITIES.includes(r.priority)) e.push("priority must be Low, Medium or High");
  if (r.status && !STATUSES.includes(r.status)) e.push("unknown status");
  else if (STATUSES.indexOf(r.status) >= 1 && !r.assignedTo) e.push("assignedTo required for this status");
  seen.add(r.issueId);
  return e;
}

export default function Import({ issues, send, load, disabled }) {
  const [rows, setRows] = useState(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState("");

  async function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setName(file.name);
    setFileError("");
    setRows(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      const cols = data.length ? Object.keys(data[0]).map((k) => k.trim()) : [];
      const missing = REQUIRED.filter((c) => !cols.includes(c));
      if (!data.length || missing.length) {
        setFileError(!data.length ? "The file is empty." : `Missing columns: ${missing.join(", ")}`);
        return;
      }
      const onChain = new Set(issues.map((i) => i.id));
      const seen = new Set();
      setRows(data.map((d) => {
        const r = Object.fromEntries(Object.entries(d).map(([k, v]) => [k.trim(), text(v)]));
        r.priority = canon(PRIORITIES, r.priority || "");
        r.status = r.status ? canon(STATUSES, r.status) : "";
        const errors = check(r, onChain, seen);
        return { ...r, errors, selected: !errors.length, result: "" };
      }));
    } catch {
      setFileError("Could not read this file. Use .xlsx, .xls or .csv.");
    }
  }

  const patch = (i, p) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...p } : r)));
  const picked = rows?.filter((r) => r.selected && !r.errors.length).length ?? 0;

  async function save() {
    setBusy(true);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.selected || r.errors.length || r.result === "Saved") continue;
      patch(i, { result: "Saving…" });

      let err = await send((c) => c.createIssue(r.issueId, r.issueType, r.location, r.description,
        r.reportDate, PRIORITIES.indexOf(r.priority), r.reportedBy, r.assignedTo));

      // The contract only allows one step at a time, so walk up to the target status.
      const target = r.status ? STATUSES.indexOf(r.status) : 0;
      let cur = r.assignedTo ? 1 : 0; // createIssue starts at Assigned when a team is given
      while (!err && cur < target) {
        const next = ++cur;
        err = await send((c) => c.updateStatus(r.issueId, next, "Imported from spreadsheet"));
      }

      patch(i, { result: err ? `Failed: ${err}` : "Saved", selected: !!err });
    }
    await load();
    setBusy(false);
  }

  return (
    <section className="panel">
      <h2>Import from Excel or CSV</h2>
      <p className="muted">
        Columns: issueId, issueType, location, description, reportDate, priority, reportedBy, assignedTo, status.
        Nothing is sent until you confirm.
      </p>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} disabled={disabled || busy} />
      {fileError && <p className="small" style={{ color: "crimson" }}>{fileError}</p>}
      {rows && (
        <>
          <p className="muted">{name}: {rows.length} rows, {rows.filter((r) => !r.errors.length).length} valid.</p>
          <div className="scroll">
            <table>
              <thead><tr><th /><th>ID</th><th>Type</th><th>Location</th><th>Priority</th><th>Status</th><th>Check</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={r.errors.length ? "invalid" : ""}>
                    <td><input type="checkbox" checked={r.selected} disabled={!!r.errors.length || busy}
                      onChange={(e) => patch(i, { selected: e.target.checked })} aria-label={`Select ${r.issueId}`} /></td>
                    <td>{r.issueId}</td><td>{r.issueType}</td><td>{r.location}</td><td>{r.priority}</td><td>{r.status}</td>
                    <td className="small">{r.result || (r.errors.length ? r.errors.join(", ") : "Ready")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="primary" disabled={disabled || busy || !picked} onClick={save}>
            {busy ? "Saving…" : `Save ${picked} on blockchain`}
          </button>
        </>
      )}
    </section>
  );
}
