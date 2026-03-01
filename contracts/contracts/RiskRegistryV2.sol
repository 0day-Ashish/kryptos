// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title RiskRegistryV2
 * @notice On-chain registry for wallet risk assessment reports with Upgradeability.
 *         Implements UUPS proxy pattern and role-based access control.
 */
contract RiskRegistryV2 is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");

    struct RiskReport {
        uint8 riskScore;
        string ipfsHash;
        uint64 timestamp;
    }

    /// @notice Maps wallet address → risk report
    mapping(bytes32 => RiskReport) public reports;

    /// @notice Emitted when a new report is stored
    event ReportStored(
        bytes32 indexed wallet,
        uint8 riskScore,
        string ipfsHash,
        uint64 timestamp
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() initializer public {
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UPDATER_ROLE, msg.sender);
    }

    /**
     * @notice Store a risk report for a given wallet address.
     * @dev Only users with UPDATER_ROLE can call this.
     */
    function storeReport(
        bytes32 wallet,
        uint8 riskScore,
        string calldata ipfsHash,
        uint64 timestamp
    ) external onlyRole(UPDATER_ROLE) {
        require(riskScore <= 100, "Risk score must be between 0 and 100");

        reports[wallet] = RiskReport({
            riskScore: riskScore,
            ipfsHash: ipfsHash,
            timestamp: timestamp
        });

        emit ReportStored(wallet, riskScore, ipfsHash, timestamp);
    }

    /**
     * @notice Batch store risk reports to save gas.
     * @dev Arrays must be of equal length. Only UPDATER_ROLE can call.
     */
    function storeReportsBatch(
        bytes32[] calldata wallets,
        uint8[] calldata riskScores,
        string[] calldata ipfsHashes,
        uint64[] calldata timestamps
    ) external onlyRole(UPDATER_ROLE) {
        require(
            wallets.length == riskScores.length &&
            wallets.length == ipfsHashes.length &&
            wallets.length == timestamps.length,
            "Array lengths must match"
        );

        for (uint256 i = 0; i < wallets.length; i++) {
            require(riskScores[i] <= 100, "Risk score must be between 0 and 100");

            reports[wallets[i]] = RiskReport({
                riskScore: riskScores[i],
                ipfsHash: ipfsHashes[i],
                timestamp: timestamps[i]
            });

            emit ReportStored(wallets[i], riskScores[i], ipfsHashes[i], timestamps[i]);
        }
    }

    /**
     * @notice Read the risk report for a given wallet address.
     */
    function getReport(bytes32 wallet)
        external
        view
        returns (uint8 riskScore, string memory ipfsHash, uint64 timestamp)
    {
        RiskReport memory r = reports[wallet];
        return (r.riskScore, r.ipfsHash, r.timestamp);
    }

    /**
     * @dev Required override by UUPSUpgradeable to authorize contract upgrades.
     *      Restricts upgrades to DEFAULT_ADMIN_ROLE.
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(DEFAULT_ADMIN_ROLE)
        override
    {}
}
