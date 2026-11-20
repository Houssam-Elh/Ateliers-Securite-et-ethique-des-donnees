import React, { useState } from "react";
import * as XLSX from "xlsx";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useWriteContract,
  useReadContract,
  usePublicClient,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { zeroAddress, isAddress } from "viem";
import contractInfo from "./config/contractInfo.json";
import {
  Award,
  Upload,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Search,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  ExternalLink,
  Layers,
  FilePlus,
  RefreshCw,
} from "lucide-react";

// ============================================================
// VALIDATION DES LIGNES EXCEL (côté client, avant envoi)
// ============================================================
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const BATCH_SIZE = 10; // lots de 10 max par transaction batchMint

function validateRows(rows) {
  const errors = [];
  const seen = new Set();
  rows.forEach((r) => {
    const line = r.idx + 2; // +2 : ligne Excel réelle (en-tête = ligne 1)
    const id = String(r.studentId).trim();

    if (!String(r.studentName).trim())
      errors.push(`Ligne ${line} : nom manquant`);
    if (!id)
      errors.push(`Ligne ${line} : studentId manquant`);
    if (!String(r.diplomaTitle).trim())
      errors.push(`Ligne ${line} : diplôme manquant`);
    if (!ISO_DATE.test(String(r.issueDate)))
      errors.push(`Ligne ${line} : date invalide (format AAAA-MM-JJ attendu)`);
    if (
      r.recipientAddress &&
      r.recipientAddress !== zeroAddress &&
      !isAddress(r.recipientAddress)
    )
      errors.push(`Ligne ${line} : adresse wallet invalide`);
    if (id && seen.has(id))
      errors.push(`Ligne ${line} : studentId en double dans le fichier (${id})`);
    if (id) seen.add(id);
  });
  return errors;
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export default function App() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const publicClient = usePublicClient();

  // Navigation tab: 'admin' ou 'public'
  const [activeTab, setActiveTab] = useState("admin");

  // Adresse du contrat (pré-remplie depuis contractInfo.json, modifiable)
  const [contractAddress, setContractAddress] = useState(contractInfo.address);

  // ==========================================
  // ZONE 1 : ÉMISSION UNITAIRE (ADMIN)
  // ==========================================
  const [singleForm, setSingleForm] = useState({
    recipient: "",
    studentName: "",
    studentId: "",
    diplomaTitle: "",
    issueDate: new Date().toISOString().split("T")[0],
    grade: "Mention Bien",
  });
  const [singleTxHash, setSingleTxHash] = useState("");
  const [singleError, setSingleError] = useState("");

  const { writeContractAsync: writeSingleMint, isPending: isSingleMinting } =
    useWriteContract();

  const handleSingleMint = async (e) => {
    e.preventDefault();
    setSingleError("");
    setSingleTxHash("");

    try {
      const recipient =
        singleForm.recipient.trim() && isAddress(singleForm.recipient.trim())
          ? singleForm.recipient.trim()
          : zeroAddress;

      const hash = await writeSingleMint({
        address: contractAddress,
        abi: contractInfo.abi,
        functionName: "mintCertificate",
        args: [
          recipient,
          singleForm.studentName.trim(),
          singleForm.studentId.trim(),
          singleForm.diplomaTitle.trim(),
          singleForm.issueDate,
          singleForm.grade.trim(),
        ],
      });

      // Attendre la confirmation réelle avant d'afficher le succès
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") throw new Error("Transaction annulée par le contrat");

      setSingleTxHash(hash);
      setSingleForm({
        recipient: "",
        studentName: "",
        studentId: "",
        diplomaTitle: "",
        issueDate: new Date().toISOString().split("T")[0],
        grade: "Mention Bien",
      });
    } catch (err) {
      console.error(err);
      setSingleError(err.shortMessage || err.message || "Erreur lors de l'émission");
    }
  };

  // ==========================================
  // ZONE 1 : EXCEL UPLOAD & BATCH MINT (ADMIN)
  // ==========================================
  const [excelData, setExcelData] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [batchTxHash, setBatchTxHash] = useState("");
  const [batchError, setBatchError] = useState("");
  const [isBatchMinting, setIsBatchMinting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });

  const { writeContractAsync: writeBatchMint } = useWriteContract();

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setBatchError("");
    setBatchTxHash("");

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (!data || data.length === 0) {
          setBatchError("Le fichier Excel est vide.");
          return;
        }

        // Normaliser les colonnes (tolérant à la casse et aux variantes)
        const normalized = data.map((row, idx) => ({
          idx,
          studentName: row.studentName || row.StudentName || row.nom || "",
          studentId: row.studentId || row.StudentId || row.cne || row.CNE || "",
          diplomaTitle: row.diplomaTitle || row.DiplomaTitle || row.diplome || "",
          issueDate:
            row.issueDate || row.IssueDate || row.date ||
            new Date().toISOString().split("T")[0],
          recipientAddress:
            row.recipientAddress || row.RecipientAddress || row.adresse || zeroAddress,
          grade: row.grade || row.Grade || row.mention || "Admis",
        }));

        setExcelData(normalized);
        setSelectedRows(normalized.map((r) => r.idx)); // tout sélectionné par défaut
      } catch (err) {
        setBatchError("Erreur de lecture du fichier : " + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const toggleRowSelection = (idx) => {
    if (selectedRows.includes(idx)) {
      setSelectedRows(selectedRows.filter((i) => i !== idx));
    } else {
      setSelectedRows([...selectedRows, idx]);
    }
  };

  const selectAllRows = () => {
    if (selectedRows.length === excelData.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(excelData.map((r) => r.idx));
    }
  };

  const handleBatchMint = async () => {
    setBatchError("");
    setBatchTxHash("");

    const toMint = excelData.filter((r) => selectedRows.includes(r.idx));
    if (toMint.length === 0) {
      setBatchError("Veuillez sélectionner au moins une ligne à émettre.");
      return;
    }

    // Validation côté client avant tout envoi
    const problems = validateRows(toMint);
    if (problems.length > 0) {
      setBatchError(problems.join(" | "));
      return;
    }

    setIsBatchMinting(true);
    setBatchProgress({ done: 0, total: toMint.length });
    const hashes = [];

    try {
      // Envoi par chunks de BATCH_SIZE via batchMint (1 tx par chunk)
      for (let i = 0; i < toMint.length; i += BATCH_SIZE) {
        const chunk = toMint.slice(i, i + BATCH_SIZE);

        const hash = await writeBatchMint({
          address: contractAddress,
          abi: contractInfo.abi,
          functionName: "batchMint",
          args: [
            chunk.map((r) =>
              r.recipientAddress && isAddress(r.recipientAddress)
                ? r.recipientAddress
                : zeroAddress
            ),
            chunk.map((r) => String(r.studentName).trim()),
            chunk.map((r) => String(r.studentId).trim()),
            chunk.map((r) => String(r.diplomaTitle).trim()),
            chunk.map((r) => String(r.issueDate)),
            chunk.map((r) => String(r.grade)),
          ],
        });

        // Attendre confirmation réelle avant de passer au chunk suivant
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "reverted")
          throw new Error(`Chunk ${Math.floor(i / BATCH_SIZE) + 1} annulé par le contrat`);

        hashes.push(hash);
        setBatchProgress({ done: Math.min(i + BATCH_SIZE, toMint.length), total: toMint.length });
      }

      setBatchTxHash(hashes.join("\n"));
    } catch (err) {
      console.error(err);
      if (hashes.length > 0) setBatchTxHash(hashes.join("\n")); // afficher les chunks qui ont réussi
      setBatchError(err.shortMessage || err.message || "Erreur lors de l'émission groupée");
    } finally {
      setIsBatchMinting(false);
    }
  };

  // ==========================================
  // ZONE 2 : RECHERCHE PUBLIQUE & VÉRIFICATION
  // ==========================================
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSubmitted, setSearchSubmitted] = useState("");
  const [searchMode, setSearchMode] = useState("id"); // 'id' ou 'cne'

  // Recherche par ID numérique uniquement (évite BigInt("abc") crash)
  const isSearchById = searchMode === "id" && /^\d+$/.test(searchSubmitted);
  const { data: certByIdData, error: certByIdError, isLoading: certByIdLoading } =
    useReadContract({
      address: contractAddress,
      abi: contractInfo.abi,
      functionName: "getCertificate",
      args: isSearchById ? [BigInt(searchSubmitted)] : undefined,
      query: { enabled: isSearchById },
    });

  const isSearchByCne = searchMode === "cne" && !!searchSubmitted;
  const { data: certByCneData, error: certByCneError, isLoading: certByCneLoading } =
    useReadContract({
      address: contractAddress,
      abi: contractInfo.abi,
      functionName: "getCertificateByStudentId",
      args: isSearchByCne ? [searchSubmitted] : undefined,
      query: { enabled: isSearchByCne },
    });

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchSubmitted(searchQuery.trim());
  };

  const displayedCertificate = isSearchById
    ? certByIdData
    : certByCneData
    ? certByCneData[1]
    : null;

  const resolvedCertId = isSearchById
    ? searchSubmitted
    : certByCneData
    ? String(certByCneData[0])
    : null;

  const currentSearchLoading = certByIdLoading || certByCneLoading;
  const currentSearchError = isSearchById ? certByIdError : certByCneError;

  // ============================================================
  // RENDU
  // ============================================================
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", fontFamily: "system-ui, sans-serif" }}>
      {/* HEADER */}
      <header style={{ backgroundColor: "#1e293b", color: "#fff", padding: "16px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Award style={{ color: "#38bdf8", width: 32, height: 32 }} />
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>CertiChain Academic</h1>
              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>Système de Certification Académique sur Blockchain (Devoir 1 - FSTT)</p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isConnected ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "#334155", padding: "6px 14px", borderRadius: 20, fontSize: 13 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#22c55e" }}></span>
                <span style={{ fontFamily: "monospace" }}>{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                <button
                  onClick={() => disconnect()}
                  style={{ marginLeft: 6, background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                >
                  Déconnexion
                </button>
              </div>
            ) : (
              <button
                onClick={() => connect({ connector: injected() })}
                style={{ backgroundColor: "#0284c7", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              >
                <UserCheck size={16} /> Connecter Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* TABS & CONTRACT CONFIG */}
      <div style={{ maxWidth: 1200, margin: "20px auto 0", padding: "0 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, borderBottom: "2px solid #cbd5e1", paddingBottom: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setActiveTab("admin")}
              style={{
                padding: "8px 16px", borderRadius: "6px 6px 0 0", fontWeight: 600, cursor: "pointer",
                border: "none", display: "flex", alignItems: "center", gap: 6,
                backgroundColor: activeTab === "admin" ? "#0284c7" : "#e2e8f0",
                color: activeTab === "admin" ? "#fff" : "#475569",
              }}
            >
              <Layers size={16} /> Zone Administrateur (Émission)
            </button>
            <button
              onClick={() => setActiveTab("public")}
              style={{
                padding: "8px 16px", borderRadius: "6px 6px 0 0", fontWeight: 600, cursor: "pointer",
                border: "none", display: "flex", alignItems: "center", gap: 6,
                backgroundColor: activeTab === "public" ? "#0284c7" : "#e2e8f0",
                color: activeTab === "public" ? "#fff" : "#475569",
              }}
            >
              <Search size={16} /> Zone Publique (Vérification)
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b" }}>
            <span>Contrat :</span>
            <input
              type="text"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              style={{ fontFamily: "monospace", fontSize: 12, padding: "4px 8px", borderRadius: 4, border: "1px solid #cbd5e1", width: 340 }}
              placeholder="0x..."
            />
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <main style={{ maxWidth: 1200, margin: "24px auto", padding: "0 16px" }}>

        {/* ===================== TAB ADMIN ===================== */}
        {activeTab === "admin" && (
          <div>
            {!isConnected && (
              <div style={{ backgroundColor: "#fef3c7", borderLeft: "4px solid #f59e0b", padding: "12px 16px", borderRadius: 6, marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                <AlertTriangle style={{ color: "#d97706" }} />
                <span style={{ fontSize: 14, color: "#92400e" }}>
                  Veuillez connecter votre portefeuille (MetaMask) avec un compte autorisé pour émettre des certificats.
                </span>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24 }}>

              {/* SECTION A : ÉMISSION UNITAIRE */}
              <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>
                  <FilePlus style={{ color: "#0284c7" }} />
                  <h2 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Émission Unitaire</h2>
                </div>

                <form onSubmit={handleSingleMint} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Nom complet de l'étudiant *</label>
                    <input
                      type="text" required placeholder="Ex: Amina Benali"
                      value={singleForm.studentName}
                      onChange={(e) => setSingleForm({ ...singleForm, studentName: e.target.value })}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>CNE / Identifiant unique *</label>
                    <input
                      type="text" required placeholder="Ex: 2023-INF-042"
                      value={singleForm.studentId}
                      onChange={(e) => setSingleForm({ ...singleForm, studentId: e.target.value })}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Intitulé du diplôme *</label>
                    <input
                      type="text" required placeholder="Ex: Licence Informatique"
                      value={singleForm.diplomaTitle}
                      onChange={(e) => setSingleForm({ ...singleForm, diplomaTitle: e.target.value })}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Mention / Note</label>
                      <input
                        type="text" placeholder="Mention Bien"
                        value={singleForm.grade}
                        onChange={(e) => setSingleForm({ ...singleForm, grade: e.target.value })}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Date d'émission</label>
                      <input
                        type="date"
                        value={singleForm.issueDate}
                        onChange={(e) => setSingleForm({ ...singleForm, issueDate: e.target.value })}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Adresse Wallet destinataire (optionnel)</label>
                    <input
                      type="text" placeholder="0x... (ou laisser vide)"
                      value={singleForm.recipient}
                      onChange={(e) => setSingleForm({ ...singleForm, recipient: e.target.value })}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", boxSizing: "border-box", fontFamily: "monospace", fontSize: 12 }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSingleMinting || !isConnected}
                    style={{
                      marginTop: 8,
                      backgroundColor: isConnected ? "#0284c7" : "#94a3b8",
                      color: "#fff", border: "none", padding: "10px", borderRadius: 6,
                      fontWeight: 600, cursor: isConnected ? "pointer" : "not-allowed",
                      display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
                    }}
                  >
                    {isSingleMinting ? <RefreshCw className="animate-spin" size={16} /> : <Award size={16} />}
                    {isSingleMinting ? "Émission en cours..." : "Émettre le certificat"}
                  </button>

                  {singleTxHash && (
                    <div style={{ marginTop: 12, padding: 10, backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, fontSize: 13, color: "#166534" }}>
                      <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        <CheckCircle size={16} /> Certificat émis et confirmé !
                      </div>
                      <div style={{ marginTop: 4, wordBreak: "break-all", fontSize: 11, fontFamily: "monospace" }}>
                        Tx Hash: {singleTxHash}
                      </div>
                    </div>
                  )}

                  {singleError && (
                    <div style={{ marginTop: 12, padding: 10, backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 13, color: "#991b1b" }}>
                      <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        <XCircle size={16} /> Erreur
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12 }}>{singleError}</div>
                    </div>
                  )}
                </form>
              </div>

              {/* SECTION B : IMPORT EXCEL & BATCH MINT */}
              <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>
                  <FileSpreadsheet style={{ color: "#16a34a" }} />
                  <h2 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Import Excel / CSV (SheetJS)</h2>
                </div>

                <div
                  style={{
                    border: "2px dashed #cbd5e1", borderRadius: 8, padding: "24px 16px",
                    textAlign: "center", backgroundColor: "#f8fafc", marginBottom: 16,
                  }}
                >
                  <Upload style={{ color: "#64748b", margin: "0 auto 8px", width: 36, height: 36 }} />
                  <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#334155" }}>Choisissez le fichier étudiants (.xlsx, .csv)</p>
                  <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b" }}>
                    Colonnes attendues : studentName, studentId, diplomaTitle, issueDate (AAAA-MM-JJ), grade, recipientAddress (optionnel)
                  </p>
                  <input
                    type="file" accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    style={{ fontSize: 12 }}
                  />
                </div>

                {excelData.length > 0 && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                        {excelData.length} étudiants chargés ({selectedRows.length} sélectionnés)
                      </span>
                      <button
                        onClick={selectAllRows}
                        style={{ background: "none", border: "none", color: "#0284c7", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        {selectedRows.length === excelData.length ? "Tout désélectionner" : "Tout sélectionner"}
                      </button>
                    </div>

                    <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 6, marginBottom: 16 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                        <thead style={{ backgroundColor: "#f8fafc", position: "sticky", top: 0 }}>
                          <tr style={{ borderBottom: "1px solid #cbd5e1" }}>
                            <th style={{ padding: "6px 8px" }}></th>
                            <th style={{ padding: "6px 8px" }}>Nom</th>
                            <th style={{ padding: "6px 8px" }}>CNE / ID</th>
                            <th style={{ padding: "6px 8px" }}>Diplôme</th>
                            <th style={{ padding: "6px 8px" }}>Mention</th>
                          </tr>
                        </thead>
                        <tbody>
                          {excelData.map((row) => (
                            <tr
                              key={row.idx}
                              style={{
                                borderBottom: "1px solid #f1f5f9",
                                backgroundColor: selectedRows.includes(row.idx) ? "#f0f9ff" : "#fff",
                              }}
                            >
                              <td style={{ padding: "6px 8px" }}>
                                <input
                                  type="checkbox"
                                  checked={selectedRows.includes(row.idx)}
                                  onChange={() => toggleRowSelection(row.idx)}
                                />
                              </td>
                              <td style={{ padding: "6px 8px", fontWeight: 500 }}>{row.studentName}</td>
                              <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>{row.studentId}</td>
                              <td style={{ padding: "6px 8px" }}>{row.diplomaTitle}</td>
                              <td style={{ padding: "6px 8px", color: "#64748b" }}>{row.grade}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      onClick={handleBatchMint}
                      disabled={isBatchMinting || selectedRows.length === 0 || !isConnected}
                      style={{
                        width: "100%",
                        backgroundColor: isConnected && selectedRows.length > 0 ? "#16a34a" : "#94a3b8",
                        color: "#fff", border: "none", padding: "10px", borderRadius: 6,
                        fontWeight: 600, cursor: isConnected && selectedRows.length > 0 ? "pointer" : "not-allowed",
                        display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
                      }}
                    >
                      {isBatchMinting ? <RefreshCw className="animate-spin" size={16} /> : <Layers size={16} />}
                      {isBatchMinting
                        ? `Émission en cours... (${batchProgress.done}/${batchProgress.total})`
                        : `Émettre le lot (${selectedRows.length} certificat${selectedRows.length > 1 ? "s" : ""})`}
                    </button>

                    {batchTxHash && (
                      <div style={{ marginTop: 12, padding: 10, backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, fontSize: 13, color: "#166534" }}>
                        <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                          <CheckCircle size={16} /> Lot émis et confirmé sur la blockchain !
                        </div>
                        {batchTxHash.split("\n").map((hash, i) => (
                          <div key={i} style={{ marginTop: 4, wordBreak: "break-all", fontSize: 11, fontFamily: "monospace" }}>
                            Tx {i + 1} : {hash}
                          </div>
                        ))}
                      </div>
                    )}

                    {batchError && (
                      <div style={{ marginTop: 12, padding: 10, backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 13, color: "#991b1b" }}>
                        <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                          <XCircle size={16} /> Erreur
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12 }}>{batchError}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB PUBLIC ===================== */}
        {activeTab === "public" && (
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginBottom: 24 }}>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <ShieldCheck style={{ width: 44, height: 44, color: "#0284c7", margin: "0 auto 8px" }} />
                <h2 style={{ fontSize: 22, margin: "0 0 6px", fontWeight: 700 }}>Vérification Publique de Diplôme</h2>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                  Consultez l'authenticité et l'immuabilité d'un certificat certifié on-chain
                </p>
              </div>

              <form onSubmit={handleSearch} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "center", gap: 16, fontSize: 13 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio" name="searchMode" value="id"
                      checked={searchMode === "id"}
                      onChange={() => setSearchMode("id")}
                    />
                    Rechercher par Numéro de Certificat (ID)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio" name="searchMode" value="cne"
                      checked={searchMode === "cne"}
                      onChange={() => setSearchMode("cne")}
                    />
                    Rechercher par CNE / Identifiant Étudiant
                  </label>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text" required
                    placeholder={searchMode === "id" ? "Entrez l'ID du certificat (ex: 1, 2...)" : "Entrez le CNE (ex: 2023-INF-042)"}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
                  />
                  <button
                    type="submit"
                    style={{
                      backgroundColor: "#0284c7", color: "#fff", border: "none",
                      padding: "10px 20px", borderRadius: 8, fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <Search size={16} /> Vérifier
                  </button>
                </div>
              </form>
            </div>

            {/* Résultats */}
            {currentSearchLoading && (
              <div style={{ textAlign: "center", padding: 32, color: "#64748b" }}>
                <RefreshCw className="animate-spin" style={{ margin: "0 auto 8px" }} />
                <p style={{ margin: 0 }}>Interrogation de la blockchain en cours...</p>
              </div>
            )}

            {currentSearchError && !currentSearchLoading && searchSubmitted && (
              <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: 20, textAlign: "center", color: "#991b1b" }}>
                <XCircle size={32} style={{ margin: "0 auto 8px", color: "#dc2626" }} />
                <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Certificat Introuvable ou Invalide</h3>
                <p style={{ margin: 0, fontSize: 13 }}>Aucun certificat actif ne correspond à cette référence sur le registre.</p>
              </div>
            )}

            {displayedCertificate && !currentSearchLoading && (
              <div
                style={{
                  backgroundColor: "#fff", borderRadius: 16, padding: 32,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                  border: displayedCertificate.revoked ? "2px solid #ef4444" : "2px solid #22c55e",
                }}
              >
                {/* En-tête diplôme */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: 16, marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Award size={28} style={{ color: "#0284c7" }} />
                    <div>
                      <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#64748b", fontWeight: 700 }}>Université Abdelmalek Essaâdi — FST Tanger</span>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Certificat Académique Officiel</h3>
                    </div>
                  </div>
                  <div>
                    {displayedCertificate.revoked ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, backgroundColor: "#fee2e2", color: "#991b1b", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                        <XCircle size={14} /> RÉVOQUÉ
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, backgroundColor: "#dcfce7", color: "#166534", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                        <CheckCircle size={14} /> CERTIFIÉ VALIDE
                      </span>
                    )}
                  </div>
                </div>

                {/* Corps du diplôme */}
                <div style={{ textAlign: "center", margin: "24px 0" }}>
                  <p style={{ margin: "0 0 6px", fontSize: 13, color: "#64748b" }}>Il est attesté par la présente que</p>
                  <h2 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 800, color: "#0f172a" }}>{displayedCertificate.studentName}</h2>
                  <p style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "monospace", color: "#475569" }}>
                    CNE / Identifiant : <strong>{displayedCertificate.studentId}</strong>
                  </p>
                  <p style={{ margin: "0 0 6px", fontSize: 13, color: "#64748b" }}>a obtenu avec succès le titre de :</p>
                  <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#0284c7" }}>{displayedCertificate.diplomaTitle}</h3>
                  <div style={{ display: "inline-block", backgroundColor: "#f8fafc", padding: "6px 16px", borderRadius: 20, fontSize: 14, fontWeight: 600, color: "#334155", marginTop: 8 }}>
                    {displayedCertificate.grade}
                  </div>
                </div>

                {/* Pied de page */}
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12, color: "#64748b" }}>
                  <div>
                    <span>Date d'émission : </span>
                    <strong style={{ color: "#334155" }}>{displayedCertificate.issueDate}</strong>
                  </div>
                  <div>
                    <span>Certificat N° : </span>
                    <strong style={{ color: "#334155" }}>#{resolvedCertId}</strong>
                  </div>
                  <div style={{ gridColumn: "span 2", wordBreak: "break-all" }}>
                    <span>Destinataire (Wallet) : </span>
                    <strong style={{ fontFamily: "monospace", color: "#334155" }}>
                      {displayedCertificate.recipient === zeroAddress
                        ? "Non renseigné (délivré à l'étudiant)"
                        : displayedCertificate.recipient}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
