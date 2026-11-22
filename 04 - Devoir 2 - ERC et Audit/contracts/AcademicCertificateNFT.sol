// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title AcademicCertificateNFT
 * @dev Système de certification académique conforme au standard ERC-721 (NFT).
 * Réalisé dans le cadre du Devoir 2 - M115 Sécurité et éthique des données (FSTT).
 * Intègre OpenZeppelin AccessControl, ERC721URIStorage et les exigences d'audit de sécurité.
 */
contract AcademicCertificateNFT is ERC721URIStorage, AccessControl {

    // ==========================================
    // 1. RÔLES DE SÉCURITÉ (AccessControl)
    // ==========================================
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

    // ==========================================
    // 2. STRUCTURE DE DONNÉES ACADÉMIQUES
    // ==========================================
    struct Certificate {
        string studentName;
        string studentId;       // CNE ou identifiant étudiant unique
        string diplomaTitle;    // Intitulé du diplôme
        string issueDate;       // Format ISO: AAAA-MM-JJ
        string grade;          // Mention: Passable, Bien, Très Bien
        bool revoked;           // Statut de révocation
        string revocationReason;// Motif en cas de révocation
    }

    // Compteur de tokenId (NFTs) démarrant à 1
    uint256 private _nextTokenId = 1;

    // Mapping tokenId => Certificate
    mapping(uint256 => Certificate) private _certificates;

    // Mapping anti-doublon : hash(studentId) => bool
    mapping(bytes32 => bool) private _studentIdUsed;

    // Mapping indexé : hash(studentId) => tokenId
    mapping(bytes32 => uint256) private _studentIdToTokenId;

    // ==========================================
    // 3. ÉVÉNEMENTS CONFORMES AU CAHIER DES CHARGES
    // ==========================================
    event CertificateMinted(
        uint256 indexed tokenId,
        string studentId,
        string studentName,
        string diplomaTitle,
        string tokenURI,
        address indexed recipient,
        address indexed issuer
    );

    event CertificateRevoked(
        uint256 indexed tokenId,
        string studentId,
        address indexed revoker,
        string reason
    );

    // ==========================================
    // 4. CONSTRUCTEUR
    // ==========================================
    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {
        // Le déployeur reçoit le rôle d'administration suprême et le rôle de minter
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(REVOKER_ROLE, msg.sender);
    }

    // ==========================================
    // 5. FONCTIONS D'ÉMISSION (MINTER_ROLE)
    // ==========================================
    /**
     * @dev Fonction interne factorisée de frappe (mint).
     * Vérifie la validité des inputs et l'unicité stricte du studentId.
     */
    function _mintCertificateInternal(
        address to,
        string memory studentName,
        string memory studentId,
        string memory diplomaTitle,
        string memory issueDate,
        string memory grade,
        string memory uri
    ) internal returns (uint256 tokenId) {
        require(to != address(0), "Adresse destinataire invalide (zero address)");
        require(bytes(studentName).length > 0, "Nom etudiant requis");
        require(bytes(studentId).length > 0, "CNE etudiant requis");
        require(bytes(diplomaTitle).length > 0, "Intitule diplome requis");

        bytes32 studentIdHash = keccak256(abi.encodePacked(studentId));
        require(!_studentIdUsed[studentIdHash], string(abi.encodePacked("Un certificat existe deja pour: ", studentId)));

        tokenId = _nextTokenId;
        _nextTokenId++;

        // Frappe sécurisée du NFT ERC-721 vers l'étudiant
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        _certificates[tokenId] = Certificate({
            studentName: studentName,
            studentId: studentId,
            diplomaTitle: diplomaTitle,
            issueDate: issueDate,
            grade: grade,
            revoked: false,
            revocationReason: ""
        });

        _studentIdUsed[studentIdHash] = true;
        _studentIdToTokenId[studentIdHash] = tokenId;

        emit CertificateMinted(tokenId, studentId, studentName, diplomaTitle, uri, to, msg.sender);
    }

    /**
     * @notice Émission unitaire d'un certificat NFT.
     */
    function mintCertificate(
        address to,
        string calldata studentName,
        string calldata studentId,
        string calldata diplomaTitle,
        string calldata issueDate,
        string calldata grade,
        string calldata uri
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        return _mintCertificateInternal(to, studentName, studentId, diplomaTitle, issueDate, grade, uri);
    }

    /**
     * @notice Émission groupée atomique (batch) de certificats NFTs.
     */
    function batchMintCertificates(
        address[] calldata recipients,
        string[] calldata studentNames,
        string[] calldata studentIds,
        string[] calldata diplomaTitles,
        string[] calldata issueDates,
        string[] calldata grades,
        string[] calldata uris
    ) external onlyRole(MINTER_ROLE) {
        uint256 count = recipients.length;
        require(count > 0, "Aucun certificat a emettre");
        require(
            studentNames.length == count &&
            studentIds.length == count &&
            diplomaTitles.length == count &&
            issueDates.length == count &&
            grades.length == count &&
            uris.length == count,
            "Tailles des tableaux incoherentes"
        );

        for (uint256 i = 0; i < count; i++) {
            _mintCertificateInternal(
                recipients[i],
                studentNames[i],
                studentIds[i],
                diplomaTitles[i],
                issueDates[i],
                grades[i],
                uris[i]
            );
        }
    }

    // ==========================================
    // 6. RÉVOCATION DE CERTIFICAT
    // ==========================================
    /**
     * @notice Révocation d'un certificat avec motif d'invalidation officiel.
     * Conforme au standard : accessible par les administrateurs ou revokers.
     */
    function revokeCertificate(uint256 tokenId, string calldata reason) external onlyRole(REVOKER_ROLE) {
        require(_ownerOf(tokenId) != address(0), "Certificat inexistant");
        require(!_certificates[tokenId].revoked, "Certificat deja revoque");

        _certificates[tokenId].revoked = true;
        _certificates[tokenId].revocationReason = reason;

        emit CertificateRevoked(tokenId, _certificates[tokenId].studentId, msg.sender, reason);
    }

    // ==========================================
    // 7. FONCTIONS DE CONSULTATION PUBLIQUE (VIEW)
    // ==========================================
    function getCertificate(uint256 tokenId) external view returns (Certificate memory) {
        require(_ownerOf(tokenId) != address(0), "Certificat inexistant");
        return _certificates[tokenId];
    }

    function getCertificateByStudentId(string calldata studentId) external view returns (uint256, Certificate memory) {
        bytes32 studentIdHash = keccak256(abi.encodePacked(studentId));
        uint256 tokenId = _studentIdToTokenId[studentIdHash];
        require(tokenId > 0, "Aucun certificat pour cet etudiant");
        return (tokenId, _certificates[tokenId]);
    }

    function isCertificateValid(uint256 tokenId) external view returns (bool) {
        if (_ownerOf(tokenId) == address(0)) {
            return false;
        }
        return !_certificates[tokenId].revoked;
    }

    function getTotalCertificates() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    // ==========================================
    // 8. SOUTIEN DES INTERFACES (ERC-165)
    // ==========================================
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
