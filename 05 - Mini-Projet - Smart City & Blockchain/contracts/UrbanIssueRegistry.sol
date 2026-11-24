// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title UrbanIssueRegistry
 * @dev Smart Contract de gestion décentralisée des signalements urbains (Smart City).
 * Permet l'enregistrement, l'affectation, la mise à jour des statuts et la traçabilité complète.
 */
contract UrbanIssueRegistry {
    // Statuts possibles d'un signalement
    enum IssueStatus {
        Reported,
        Assigned,
        InProgress,
        Resolved,
        Closed
    }

    // Niveaux de priorité
    enum Priority {
        Low,
        Medium,
        High
    }

    // Entrée d'historique pour la traçabilité des interventions
    struct HistoryEntry {
        uint256 timestamp;
        IssueStatus status;
        string assignedTo;
        string comment;
        address updater;
    }

    // Modèle de données d'un signalement urbain
    struct UrbanIssue {
        string issueId;        // Identifiant unique (ex: "CITY-2026-001")
        string issueType;      // Type d'incident (ex: "StreetLight", "RoadPothole")
        string location;       // Localisation textuelle
        string description;    // Description du problème
        string reportDate;     // Date de signalement (ex: "2026-11-19")
        Priority priority;     // Priorité (Low, Medium, High)
        string reportedBy;     // Pseudo ou identifiant du citoyen signaleur
        string assignedTo;     // Équipe municipale affectée
        IssueStatus status;    // Statut courant
        address reporterAddress; // Clé publique de l'émetteur
        bool exists;           // Flag de vérification d'existence
    }

    // Administrateur (représentant la municipalité)
    address public municipalityAdmin;

    // Mapping issueId => UrbanIssue
    mapping(string => UrbanIssue) private issues;

    // Mapping issueId => Tableau d'entrées d'historique
    mapping(string => HistoryEntry[]) private issueHistory;

    // Liste de tous les identifiants pour permettre le listing / pagination
    string[] private issueIds;

    // Evénements pour la traçabilité on-chain
    event IssueCreated(
        string indexed issueId,
        string issueType,
        string location,
        Priority priority,
        string reportedBy,
        address indexed reporterAddress,
        uint256 timestamp
    );

    event IssueAssigned(
        string indexed issueId,
        string assignedTo,
        address indexed updater,
        uint256 timestamp
    );

    event StatusUpdated(
        string indexed issueId,
        IssueStatus newStatus,
        string comment,
        address indexed updater,
        uint256 timestamp
    );

    modifier onlyAdmin() {
        require(msg.sender == municipalityAdmin, "Only municipality admin can perform this action");
        _;
    }

    modifier issueMustExist(string memory _issueId) {
        require(issues[_issueId].exists, "Issue does not exist");
        _;
    }

    constructor() {
        municipalityAdmin = msg.sender;
    }

    /**
     * @notice Enregistre un nouveau signalement urbain.
     */
    function createIssue(
        string memory _issueId,
        string memory _issueType,
        string memory _location,
        string memory _description,
        string memory _reportDate,
        Priority _priority,
        string memory _reportedBy,
        string memory _assignedTo
    ) external {
        require(bytes(_issueId).length > 0, "Issue ID cannot be empty");
        require(!issues[_issueId].exists, "Issue ID already exists");
        require(bytes(_location).length > 0, "Location cannot be empty");
        require(bytes(_description).length > 0, "Description cannot be empty");

        IssueStatus initialStatus = bytes(_assignedTo).length > 0 
            ? IssueStatus.Assigned 
            : IssueStatus.Reported;

        UrbanIssue storage newIssue = issues[_issueId];
        newIssue.issueId = _issueId;
        newIssue.issueType = _issueType;
        newIssue.location = _location;
        newIssue.description = _description;
        newIssue.reportDate = _reportDate;
        newIssue.priority = _priority;
        newIssue.reportedBy = _reportedBy;
        newIssue.assignedTo = _assignedTo;
        newIssue.status = initialStatus;
        newIssue.reporterAddress = msg.sender;
        newIssue.exists = true;

        issueIds.push(_issueId);

        // Premier point d'historique (création)
        issueHistory[_issueId].push(
            HistoryEntry({
                timestamp: block.timestamp,
                status: initialStatus,
                assignedTo: _assignedTo,
                comment: "Issue reported by citizen",
                updater: msg.sender
            })
        );

        emit IssueCreated(
            _issueId,
            _issueType,
            _location,
            _priority,
            _reportedBy,
            msg.sender,
            block.timestamp
        );

        if (initialStatus == IssueStatus.Assigned) {
            emit IssueAssigned(_issueId, _assignedTo, msg.sender, block.timestamp);
        }
    }

    /**
     * @notice Affecte une équipe d'intervention à un signalement (réservé à l'administration municipale).
     */
    function assignIssue(
        string memory _issueId,
        string memory _assignedTo
    ) external onlyAdmin issueMustExist(_issueId) {
        require(bytes(_assignedTo).length > 0, "Assigned team cannot be empty");

        UrbanIssue storage issue = issues[_issueId];
        require(issue.status != IssueStatus.Closed, "Issue is already closed");

        issue.assignedTo = _assignedTo;
        if (issue.status == IssueStatus.Reported) {
            issue.status = IssueStatus.Assigned;
        }

        issueHistory[_issueId].push(
            HistoryEntry({
                timestamp: block.timestamp,
                status: issue.status,
                assignedTo: _assignedTo,
                comment: string(abi.encodePacked("Assigned to team: ", _assignedTo)),
                updater: msg.sender
            })
        );

        emit IssueAssigned(_issueId, _assignedTo, msg.sender, block.timestamp);
    }

    /**
     * @notice Met à jour le statut d'un signalement urbain avec un commentaire optionnel (réservé à l'administration municipale).
     */
    function updateStatus(
        string memory _issueId,
        IssueStatus _newStatus,
        string memory _comment
    ) external onlyAdmin issueMustExist(_issueId) {
        UrbanIssue storage issue = issues[_issueId];
        require(issue.status != _newStatus, "Status is already set to this value");

        // Contrôle du workflow séquentiel : Reported -> Assigned -> InProgress -> Resolved -> Closed
        require(
            uint8(_newStatus) == uint8(issue.status) + 1,
            "Invalid status transition: must follow sequential lifecycle"
        );

        issue.status = _newStatus;

        issueHistory[_issueId].push(
            HistoryEntry({
                timestamp: block.timestamp,
                status: _newStatus,
                assignedTo: issue.assignedTo,
                comment: _comment,
                updater: msg.sender
            })
        );

        emit StatusUpdated(_issueId, _newStatus, _comment, msg.sender, block.timestamp);
    }

    /**
     * @notice Consulte les détails d'un signalement.
     */
    function getIssue(string memory _issueId)
        external
        view
        issueMustExist(_issueId)
        returns (UrbanIssue memory)
    {
        return issues[_issueId];
    }

    /**
     * @notice Consulte l'historique complet d'un signalement (traçabilité).
     */
    function getIssueHistory(string memory _issueId)
        external
        view
        issueMustExist(_issueId)
        returns (HistoryEntry[] memory)
    {
        return issueHistory[_issueId];
    }

    /**
     * @notice Récupère la liste complète des identifiants de signalements.
     */
    function getAllIssueIds() external view returns (string[] memory) {
        return issueIds;
    }

    /**
     * @notice Retourne le nombre total de signalements enregistrés.
     */
    function getIssueCount() external view returns (uint256) {
        return issueIds.length;
    }
}
