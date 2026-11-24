import { useMemo, useState } from "react";
import { PRIORITIES, TYPES } from "./config";
import { Icons } from "./icons";

export default function Report({ issues, send, account }) {
  const autoId = useMemo(() => {
    const ids = new Set(issues.map(i => i.id));
    let n = issues.length + 1;
    while (ids.has(`CITY-${new Date().getFullYear()}-${String(n).padStart(3, "0")}`)) n++;
    return `CITY-${new Date().getFullYear()}-${String(n).padStart(3, "0")}`;
  }, [issues]);

  const [customId, setCustomId] = useState("");
  const activeId = customId.trim() || autoId;

  const blank = { type: TYPES[0], location: "", description: "", priority: "Medium", by: "" };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const ok = f.location.trim() && f.description.trim();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const err = await send(
      c => c.createIssue(activeId, f.type, f.location.trim(), f.description.trim(),
        new Date().toISOString().slice(0, 10), PRIORITIES.indexOf(f.priority), f.by.trim(), ""),
      `Issue ${activeId} reported successfully`
    );
    setBusy(false);
    if (!err) {
      setF(blank);
      setCustomId("");
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Report an Urban Issue</h2>
          <p>This report will be immutably recorded onto the blockchain.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 620 }}>
        {!account && (
          <div className="note" style={{ marginBottom: 20 }}>
            <Icons.AlertCircle style={{ flexShrink: 0 }} />
            <div>Please connect your wallet before submitting a report.</div>
          </div>
        )}

        <form className="form-grid" onSubmit={submit}>
          <div className="field">
            <label>Issue Identifier (customizable or auto-generated)</label>
            <input
              value={customId}
              placeholder={`Auto: ${autoId}`}
              onChange={e => setCustomId(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="field">
              <label>Category</label>
              <select value={f.type} onChange={set("type")}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Priority Level</label>
              <select value={f.priority} onChange={set("priority")}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Location *</label>
            <input
              value={f.location}
              onChange={set("location")}
              placeholder="e.g. Avenue Mohammed V, Quartier Hassan"
              required
            />
          </div>

          <div className="field">
            <label>Description *</label>
            <textarea
              rows="4"
              value={f.description}
              onChange={set("description")}
              placeholder="Provide specific details about the issue..."
              required
            />
          </div>

          <div className="field">
            <label>Reporter Identifier / Pseudonym (optional)</label>
            <input
              value={f.by}
              onChange={set("by")}
              placeholder="e.g. Citizen01"
            />
          </div>

          <button
            className="btn btn-primary"
            disabled={!ok || busy || !account}
            style={{ justifySelf: "start" }}
          >
            {busy ? (
              <>
                <Icons.Refresh className="spin" style={{ width: 14, height: 14 }} />
                <span>Submitting Transaction...</span>
              </>
            ) : (
              <>
                <Icons.Send style={{ width: 14, height: 14 }} />
                <span>Submit to Blockchain</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
