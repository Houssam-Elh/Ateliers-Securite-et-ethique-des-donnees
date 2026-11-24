export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";
export const RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";
export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 31337);

export const STATUSES = ["Reported", "Assigned", "InProgress", "Resolved", "Closed"];
export const PRIORITIES = ["Low", "Medium", "High"];
export const TYPES = ["StreetLight", "RoadPothole", "Waste", "Water", "Other"];

const ISSUE = "tuple(string issueId,string issueType,string location,string description,string reportDate,uint8 priority,string reportedBy,string assignedTo,uint8 status,address reporterAddress,bool exists)";
const ENTRY = "tuple(uint256 timestamp,uint8 status,string assignedTo,string comment,address updater)";
export const ABI = [
  "function municipalityAdmin() view returns (address)",
  "function createIssue(string,string,string,string,string,uint8,string,string)",
  "function assignIssue(string,string)",
  "function updateStatus(string,uint8,string)",
  `function getIssue(string) view returns (${ISSUE})`,
  `function getIssueHistory(string) view returns (${ENTRY}[])`,
  "function getAllIssueIds() view returns (string[])",
];

export const short = (a = "") => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export const errMsg = (e) =>
  e?.reason || e?.info?.error?.message || e?.shortMessage || e?.message || "Transaction failed";

export const fmtIssue = (i) => ({
  id: i.issueId, type: i.issueType, location: i.location, description: i.description,
  date: i.reportDate, priority: PRIORITIES[Number(i.priority)], reportedBy: i.reportedBy,
  team: i.assignedTo, status: STATUSES[Number(i.status)], reporter: i.reporterAddress,
});

export const fmtEntry = (e) => ({
  at: new Date(Number(e.timestamp) * 1000), status: STATUSES[Number(e.status)],
  team: e.assignedTo, comment: e.comment, by: e.updater,
});
