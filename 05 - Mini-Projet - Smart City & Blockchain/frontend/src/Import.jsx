import { useState } from "react";
import * as XLSX from "xlsx";
import { PRIORITIES, STATUSES } from "./config";

const pad = (n) => String(n).padStart(2, "0");
const text = (v) =>
  v instanceof Date ? `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}` : String(v ?? "").trim();
const canon = (list, v) => list.find((x) => x.toLowerCase() === v.toLowerCase()) ?? v;

const REQUIRED = ["issueId", "issueType", "location", "description", "reportDate", "priority"];

function validDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() === Number(month) - 1
    && date.getUTCDate() === Number(day);
}

function matchesExistingIssue(row, issue) {
  return issue
    && issue.type === row.issueType
    && issue.location === row.location
    && issue.description === row.description
    && issue.date === row.reportDate
    && issue.priority === row.priority
    && issue.reportedBy === row.reportedBy
    && issue.team === row.assignedTo;
}

function check(row, onChain, seen) {
  const errors = [];
  const existing = row.issueId ? onChain.get(row.issueId) : null;

  if (!row.issueId) errors.push("issueId is missing");
  else if (seen.has(row.issueId)) errors.push("duplicate in file");
  else if (existing && !matchesExistingIssue(row, existing)) errors.push("issueId already exists with different data");

  if (!row.issueType) errors.push("issueType is missing");
  if (!row.location) errors.push("location is missing");
  if (!row.description) errors.push("description is missing");
  if (!validDate(row.reportDate)) errors.push("reportDate must be a real date in YYYY-MM-DD format");
  if (!PRIORITIES.includes(row.priority)) errors.push("priority must be Low, Medium or High");

  const target = row.status ? STATUSES.indexOf(row.status) : 0;
  if (row.status && target < 0) {
    errors.push("unknown status");
  } else if (target === 0 && row.assignedTo) {
    errors.push("assignedTo must be empty while status is Reported");
  } else if (target >= 1 && !row.assignedTo) {
    errors.push("assignedTo required for this status");
  }

  if (row.issueId) seen.add(row.issueId);
  return errors;
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
      const onChain = new Map(issues.map((issue) => [issue.id, issue]));
      const seen = new Set();
      setRows(data.map((entry) => {
        const row = Object.fromEntries(Object.entries(entry).map(([k, v]) => [k.trim(), text(v)]));
        row.reportedBy = row.reportedBy || "";
        row.assignedTo = row.assignedTo || "";
        row.priority = canon(PRIORITIES, row.priority || "");
        row.status = row.status ? canon(STATUSES, row.status) : "";
        const errors = check(row, onChain, seen);
        return { ...row, errors, selected: !errors.length, result: "" };
      }));
    } catch {
      setFileError("Could not read this file. Use .xlsx, .xls or .csv.");
    }
  }

  const patch = (i, update) => setRows((current) => current.map((row, index) => (index === i ? { ...row, ...update } : row)));
  const picked = rows?.filter((row) => row.selected && !row.errors.length).length ?? 0;

  async function save() {
    setBusy(true);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.selected || row.errors.length || row.result === "Saved") continue;
      patch(i, { result: "Saving…" });

      const existing = issues.find((issue) => issue.id === row.issueId);
      let currentStatus = existing ? STATUSES.indexOf(existing.status) : -1;
      let error = null;

      if (!existing) {
        error = await send((contract) => contract.createIssue(
          row.issueId,
          row.issueType,
          row.location,
          row.description,
          row.reportDate,
          PRIORITIES.indexOf(row.priority),
          row.reportedBy,
          row.assignedTo
        ));
        currentStatus = row.assignedTo ? 1 : 0;
      }

      const targetStatus = row.status ? STATUSES.indexOf(row.status) : 0;
      while (!error && currentStatus < targetStatus) {
        const nextStatus = currentStatus + 1;
        if (nextStatus === 1) {
          error = await send((contract) => contract.assignIssue(row.issueId, row.assignedTo));
        } else {
          error = await send((contract) => contract.updateStatus(row.issueId, nextStatus, "Imported from spreadsheet"));
        }
        if (!error) currentStatus = nextStatus;
      }

      patch(i, {
        result: error
          ? currentStatus < 0
            ? `Failed during creation: ${error}`
            : `Failed after ${STATUSES[currentStatus]}: ${error}`
          : "Saved",
        selected: !!error,
      });
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
          <p className="muted">{name}: {rows.length} rows, {rows.filter((row) => !row.errors.length).length} valid.</p>
          <div className="scroll">
            <table>
              <thead><tr><th /><th>ID</th><th>Type</th><th>Location</th><th>Priority</th><th>Status</th><th>Check</th></tr></thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={row.errors.length ? "invalid" : ""}>
                    <td><input type="checkbox" checked={row.selected} disabled={!!row.errors.length || busy}
                      onChange={(e) => patch(i, { selected: e.target.checked })} aria-label={`Select ${row.issueId}`} /></td>
                    <td>{row.issueId}</td><td>{row.issueType}</td><td>{row.location}</td><td>{row.priority}</td><td>{row.status}</td>
                    <td className="small">{row.result || (row.errors.length ? row.errors.join(", ") : "Ready")}</td>
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
