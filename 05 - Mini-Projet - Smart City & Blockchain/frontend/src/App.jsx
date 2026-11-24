import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";
import { ABI, CHAIN_ID, CONTRACT_ADDRESS, RPC_URL, errMsg, fmtIssue, short, STATUSES } from "./config";
import { Icons } from "./icons";
import Issues from "./Issues";
import Report from "./Report";
import Manage from "./Manage";

const TABS = [
  { id: "Issues",       label: "Issues",       Icon: Icons.ClipboardList },
  { id: "Report",       label: "Report Issue",  Icon: Icons.FilePlus },
  { id: "Municipality", label: "Municipality",  Icon: Icons.ShieldCheck },
];

export default function App() {
  const [tab, setTab] = useState("Issues");
  const [issues, setIssues] = useState([]);
  const [admin, setAdmin] = useState("");
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState("");
  const [signer, setSigner] = useState(null);
  const [toast, setToast] = useState(null);

  const notify = (msg, kind = "info") => {
    setToast({ msg, kind });
    if (kind !== "info") setTimeout(() => setToast(null), 5000);
  };

  const reader = useMemo(
    () => (CONTRACT_ADDRESS ? new Contract(CONTRACT_ADDRESS, ABI, new JsonRpcProvider(RPC_URL)) : null), []);
  const writer = useMemo(() => (signer ? new Contract(CONTRACT_ADDRESS, ABI, signer) : null), [signer]);

  const load = useCallback(async () => {
    if (!reader) return;
    setLoading(true);
    try {
      const ids = await reader.getAllIssueIds();
      const list = await Promise.all(ids.map(async (id) => fmtIssue(await reader.getIssue(id))));
      setIssues(list.reverse());
      setAdmin((await reader.municipalityAdmin()).toLowerCase());
    } catch {
      notify("Could not read the contract. Check that the Hardhat node is running.", "error");
    }
    setLoading(false);
  }, [reader]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    window.ethereum?.on?.("accountsChanged", () => window.location.reload());
    window.ethereum?.on?.("chainChanged",    () => window.location.reload());
  }, []);

  async function connect() {
    if (!window.ethereum) return notify("MetaMask is not installed.", "error");
    try {
      await new BrowserProvider(window.ethereum).send("eth_requestAccounts", []);
      if (Number((await new BrowserProvider(window.ethereum).getNetwork()).chainId) !== CHAIN_ID) {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x" + CHAIN_ID.toString(16) }] });
      }
      const s = await new BrowserProvider(window.ethereum).getSigner();
      setSigner(s);
      setAccount(await s.getAddress());
    } catch (e) {
      notify(e?.code === 4902 ? `Add network with chain ID ${CHAIN_ID} to MetaMask.` : errMsg(e), "error");
    }
  }

  const send = async (fn, ok) => {
    if (!writer) { notify("Connect your wallet first.", "error"); return "Wallet not connected"; }
    try {
      const tx = await fn(writer);
      if (ok) notify("Waiting for confirmation…", "info");
      await tx.wait();
      if (ok) { notify(ok, "ok"); await load(); }
      return null;
    } catch (e) {
      const m = errMsg(e);
      if (ok) notify(m, "error");
      return m;
    }
  };

  const isAdmin = account && account.toLowerCase() === admin;
  const shared  = { issues, loading, reader, send, load, account, admin };

  const total      = issues.length;
  const open       = issues.filter(i => i.status === "Reported").length;
  const inProgress = issues.filter(i => i.status === "InProgress" || i.status === "Assigned").length;
  const resolved   = issues.filter(i => i.status === "Resolved" || i.status === "Closed").length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Icons.Building />
          </div>
          Urban Issue Registry
        </div>
        <div className="topbar-right">
          {account ? (
            <>
              {isAdmin && (
                <span className="chip" style={{ color: "var(--accent)", borderColor: "rgba(37,99,235,.3)" }}>
                  <Icons.ShieldCheck style={{ marginRight: 4 }} />
                  Municipality Admin
                </span>
              )}
              <span className="chip">
                <span className="dot" />
                <Icons.Wallet style={{ marginRight: 4, width: 13, height: 13 }} />
                {short(account)}
              </span>
            </>
          ) : (
            <button className="btn btn-connect" onClick={connect}>
              <Icons.Wallet style={{ marginRight: 6 }} />
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      <nav className="sidebar">
        <div className="nav-label">Navigation</div>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`nav-btn ${tab === id ? "active" : ""}`}
            onClick={() => setTab(id)}
          >
            <span className="nav-icon"><Icon /></span>
            {label}
          </button>
        ))}

        <div className="nav-label" style={{ marginTop: 24 }}>Network</div>
        <div style={{ padding: "8px 12px", fontSize: ".78rem", color: "var(--muted)" }}>
          <div style={{ marginBottom: 4 }}>Chain ID: <span style={{ color: "var(--ink)", fontWeight: 500 }}>31337</span></div>
          <div>RPC: <span style={{ color: "var(--ink)", fontWeight: 500 }}>localhost:8545</span></div>
        </div>

        {admin && (
          <>
            <div className="nav-label" style={{ marginTop: 16 }}>Admin Address</div>
            <div style={{ padding: "4px 12px", fontSize: ".75rem", color: "var(--muted)" }}>
              <span title={admin}>{short(admin)}</span>
            </div>
          </>
        )}
      </nav>

      <main className="main-content">
        {!CONTRACT_ADDRESS ? (
          <div className="note">
            <Icons.AlertCircle style={{ flexShrink: 0 }} />
            <div>
              No contract address set. Run&nbsp;
              <code>node ./node_modules/hardhat/internal/cli/cli.js run scripts/deploy.js --network localhost</code>
              &nbsp;then restart the dev server.
            </div>
          </div>
        ) : (
          <>
            {(tab === "Issues" || tab === "Municipality") && (
              <div className="stats-row">
                <div className="stat-card accent">
                  <div className="stat-label">Total Issues</div>
                  <div className="stat-value">{total}</div>
                  <div className="stat-sub">on-chain records</div>
                </div>
                <div className="stat-card red">
                  <div className="stat-label">Reported</div>
                  <div className="stat-value">{open}</div>
                  <div className="stat-sub">pending assignment</div>
                </div>
                <div className="stat-card yellow">
                  <div className="stat-label">In Progress</div>
                  <div className="stat-value">{inProgress}</div>
                  <div className="stat-sub">active interventions</div>
                </div>
                <div className="stat-card green">
                  <div className="stat-label">Resolved</div>
                  <div className="stat-value">{resolved}</div>
                  <div className="stat-sub">closed &amp; validated</div>
                </div>
              </div>
            )}

            {tab === "Issues"       && <Issues {...shared} />}
            {tab === "Report"       && <Report {...shared} />}
            {tab === "Municipality" && <Manage {...shared} />}
          </>
        )}
      </main>

      {toast && (
        <div className={`toast ${toast.kind}`} role="status">
          {toast.kind === "ok" ? <Icons.Check /> : toast.kind === "error" ? <Icons.AlertCircle /> : <Icons.Activity />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
