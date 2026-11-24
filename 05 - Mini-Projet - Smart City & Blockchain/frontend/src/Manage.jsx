import { useState } from "react";
import { STATUSES, short } from "./config";
import { Icons } from "./icons";
import Issues from "./Issues";
import Import from "./Import";

export default function Manage(props) {
  const { admin, account, send } = props;
  const [view, setView] = useState("issues");
  const isAdmin = !!account && account.toLowerCase() === admin;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Municipality Management Console</h2>
          <p>Assign intervention teams, execute status transitions, and bulk-import municipal records.</p>
        </div>
      </div>

      {!isAdmin && (
        <div className="note" style={{ marginBottom: 20 }}>
          <Icons.AlertCircle style={{ flexShrink: 0 }} />
          <div>
            Read-only mode. Connect the designated municipality administrator wallet
            {admin ? ` (${short(admin)})` : ""} to manage records.
          </div>
        </div>
      )}

      <div className="seg">
        <button className={`btn ${view === "issues" ? "active" : ""}`} onClick={() => setView("issues")}>
          <Icons.ClipboardList style={{ marginRight: 6 }} />
          Manage Issues
        </button>
        <button className={`btn ${view === "import" ? "active" : ""}`} onClick={() => setView("import")}>
          <Icons.FileSpreadsheet style={{ marginRight: 6 }} />
          Batch Import (Excel/CSV)
        </button>
      </div>

      {view === "issues"
        ? <Issues {...props} actions={i => <Actions key={i.id + i.status + i.team} issue={i} send={send} disabled={!isAdmin} />} />
        : <Import {...props} disabled={!isAdmin} />}
    </div>
  );
}

function Actions({ issue, send, disabled }) {
  const [team, setTeam] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn, ok) => { setBusy(true); await send(fn, ok); setBusy(false); };

  const idx = STATUSES.indexOf(issue.status);
  const closed = issue.status === "Closed";
  const needsTeam = issue.status === "Reported"; // Reported -> Assigned goes through "Assign"
  const next = !closed && !needsTeam ? STATUSES[idx + 1] : null;

  return (
    <div style={{ marginTop: 16, display: "grid", gap: 16 }}>
      <div>
        <h3>Assign Intervention Team</h3>
        <div className="action-row">
          <input
            placeholder="e.g. UrbanTeam01"
            value={team}
            onChange={e => setTeam(e.target.value)}
            disabled={disabled || closed}
          />
          <button
            className="btn btn-primary btn-sm"
            disabled={disabled || busy || closed || !team.trim()}
            onClick={() => run(c => c.assignIssue(issue.id, team.trim()), `Assigned to team ${team.trim()}`)}
          >
            <Icons.Users style={{ width: 13, height: 13, marginRight: 4 }} />
            Assign
          </button>
        </div>
      </div>

      <div>
        <h3>Update Status &amp; Add Audit Note</h3>
        {next ? (
          <div className="action-row">
            <input
              placeholder="Audit comment (e.g. Technician dispatched on-site)"
              value={comment}
              onChange={e => setComment(e.target.value)}
              disabled={disabled}
            />
            <button
              className="btn btn-primary btn-sm"
              disabled={disabled || busy}
              onClick={() => run(c => c.updateStatus(issue.id, idx + 1, comment.trim()), `Status updated to ${next}`)}
            >
              <Icons.Check style={{ width: 13, height: 13, marginRight: 4 }} />
              Move to {next}
            </button>
          </div>
        ) : (
          <p className="muted small">
            {closed ? "This issue is closed." : "Assign a team first to move this issue forward."}
          </p>
        )}
      </div>
    </div>
  );
}
