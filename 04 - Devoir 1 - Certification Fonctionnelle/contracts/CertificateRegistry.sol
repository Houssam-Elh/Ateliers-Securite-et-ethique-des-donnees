// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CertificateRegistry
 * @dev Système décentralisé d'émission et de vérification de certificats académiques.
 * Réalisé dans le cadre du Devoir 1 - M115 Sécurité et éthique des données (FSTT).
 */
contract CertificateRegistry {

    // ==========================================
    // 1. MODÈLE DE DONNÉES (Conforme au sujet)
    // ==========================================
    struct Certificate {
        string studentName;
        string studentId;       // CNE ou identifiant unique (ex: 2023-INF-042)
        string diplomaTitle;    // Intitulé du diplôme (ex: Licence Informatique)
        string issueDate;       // Format ISO: AAAA-MM-JJ
        string grade;          // Mention: Bien, Très Bien, etc.
        address recipient;      // Adresse wallet du destinataire
        bool revoked;           // Statut de révocation
    }

    // ==========================================
    // 2. ÉTATS DU CONTRAT ET CONTRÔLE D'ACCÈS
    // ==========================================
    address public owner;

    // Compteur auto-incrémenté pour attribuer un identifiant unique à chaque certificat
    uint256 private _nextCertId = 1;

    // Mapping principal : certId => Certificate
    mapping(uint256 => Certificate) private certificates;

    // Mapping anti-doublon : hash(studentId) => bool
    mapping(bytes32 => bool) private hasCertificate;

    // Mapping indexé : hash(studentId) => certId
    mapping(bytes32 => uint256) private studentIdToCertId;

    // Multi-admins autorisés (départements, scolarité)
    mapping(address => bool) public isAdmin;

    // ==========================================
    // 3. ÉVÉNEMENTS
    // ==========================================
    event CertificateMinted(
        uint256 indexed certId,
        string studentId,
        string studentName,
        string diplomaTitle,
        address indexed recipient,
        address indexed issuer
    );

    event CertificateRevoked(
        uint256 indexed certId,
        string studentId,
        address indexed revoker,
        string reason
    );

    event AdminAdded(address indexed account);
    event AdminRemoved(address indexed account);

    // ==========================================
    // 4. MODIFICATEURS DE SÉCURITÉ
    // ==========================================
    modifier onlyAuthorized() {
        require(msg.sender == owner || isAdmin[msg.sender], "Acces refuse: reserve a l'administration");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Acces refuse: reserve au proprietaire");
        _;
    }

    // ==========================================
    // 5. CONSTRUCTEUR
    // ==========================================
    constructor() {
        owner = msg.sender;
        isAdmin[msg.sender] = true;
    }

    // ==========================================
    // 6. GESTION DES ADMINISTRATEURS
    // ==========================================
    function addAdmin(address _account) external onlyOwner {
        require(_account != address(0), "Adresse invalide");
        isAdmin[_account] = true;
        emit AdminAdded(_account);
    }

    function removeAdmin(address _account) external onlyOwner {
        require(_account != owner, "Impossible de retirer le proprietaire");
        isAdmin[_account] = false;
        emit AdminRemoved(_account);
    }

    // ==========================================
    // 7. LOGIQUE INTERNE D'ÉMISSION (FACTORISÉE)
    // ==========================================
    /**
     * @dev Fonction interne factorisée appelée par mintCertificate et batchMint.
     * Applique de manière stricte les vérifications d'intégrité et anti-doublon.
     */
    function _mint(
        address to,
        string calldata studentName,
        string calldata studentId,
        string calldata diplomaTitle,
        string calldata issueDate,
        string calldata grade
    ) internal returns (uint256 certId) {
        require(bytes(studentName).length > 0, "Le nom de l'etudiant est requis");
        require(bytes(studentId).length > 0, "Le CNE / ID etudiant est requis");
        require(bytes(diplomaTitle).length > 0, "L'intitule du diplome est requis");

        bytes32 studentIdHash = keccak256(abi.encodePacked(studentId));
        require(!hasCertificate[studentIdHash], string(abi.encodePacked("Un certificat existe deja pour: ", studentId)));

        certId = _nextCertId;
        _nextCertId++;

        certificates[certId] = Certificate({
            studentName: studentName,
            studentId: studentId,
            diplomaTitle: diplomaTitle,
            issueDate: issueDate,
            grade: grade,
            recipient: to,
            revoked: false
        });

        hasCertificate[studentIdHash] = true;
        studentIdToCertId[studentIdHash] = certId;

        emit CertificateMinted(certId, studentId, studentName, diplomaTitle, to, msg.sender);
    }

    // ==========================================
    // 8. FONCTIONS D'ÉMISSION PUBLIQUES (ADMIN)
    // ==========================================
    function mintCertificate(
        address to,
        string calldata studentName,
        string calldata studentId,
        string calldata diplomaTitle,
        string calldata issueDate,
        string calldata grade
    ) external onlyAuthorized returns (uint256 certId) {
        return _mint(to, studentName, studentId, diplomaTitle, issueDate, grade);
    }

    function batchMint(
        address[] calldata recipients,
        string[] calldata studentNames,
        string[] calldata studentIds,
        string[] calldata diplomaTitles,
        string[] calldata issueDates,
        string[] calldata grades
    ) external onlyAuthorized {
        uint256 count = studentNames.length;
        require(count > 0, "Aucun etudiant a emettre");
        require(
            recipients.length == count &&
            studentIds.length == count &&
            diplomaTitles.length == count &&
            issueDates.length == count &&
            grades.length == count,
            "Taille des tableaux incoherente"
        );

        for (uint256 i = 0; i < count; i++) {
            _mint(
                recipients[i],
                studentNames[i],
                studentIds[i],
                diplomaTitles[i],
                issueDates[i],
                grades[i]
            );
        }
    }

    // ==========================================
    // 9. RÉVOCATION
    // ==========================================
    /**
     * @notice Révocation conforme au prototype suggéré par la consigne : revoke(uint256 certId)
     */
    function revoke(uint256 certId) external onlyAuthorized {
        require(certId > 0 && certId < _nextCertId, "Certificat inexistant");
        require(!certificates[certId].revoked, "Certificat deja revoque");

        certificates[certId].revoked = true;
        emit CertificateRevoked(certId, certificates[certId].studentId, msg.sender, "Revoque par l'administration");
    }

    /**
     * @notice Variante de révocation avec motif personnalisé
     */
    function revokeWithReason(uint256 certId, string calldata reason) external onlyAuthorized {
        require(certId > 0 && certId < _nextCertId, "Certificat inexistant");
        require(!certificates[certId].revoked, "Certificat deja revoque");

        certificates[certId].revoked = true;
        emit CertificateRevoked(certId, certificates[certId].studentId, msg.sender, reason);
    }

    // ==========================================
    // 10. FONCTIONS DE LECTURE PUBLIQUE (VIEW)
    // ==========================================
    function getCertificate(uint256 certId) external view returns (Certificate memory) {
        require(certId > 0 && certId < _nextCertId, "Certificat inexistant");
        return certificates[certId];
    }

    function getCertificateByStudentId(string calldata studentId) external view returns (uint256, Certificate memory) {
        bytes32 studentIdHash = keccak256(abi.encodePacked(studentId));
        uint256 certId = studentIdToCertId[studentIdHash];
        require(certId > 0, "Aucun certificat trouve pour cet etudiant");
        return (certId, certificates[certId]);
    }

    function isCertificateValid(uint256 certId) external view returns (bool) {
        if (certId == 0 || certId >= _nextCertId) {
            return false;
        }
        return !certificates[certId].revoked;
    }

    function getTotalCertificates() external view returns (uint256) {
        return _nextCertId - 1;
    }
}
