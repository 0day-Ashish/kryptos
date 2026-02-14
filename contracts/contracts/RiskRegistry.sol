// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title RiskRegistry
 * @notice On-chain registry for wallet risk assessment reports.
 *         Migrated from Midnight Compact to Solidity for Base deployment.
 */
contract RiskRegistry {
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

    /**
     * @notice Store a risk report for a given wallet address.
     * @param wallet    The keccak256 hash of the wallet address being assessed
     * @param riskScore Risk score between 0 and 100
     * @param ipfsHash  IPFS CID pointing to the full report data
     * @param timestamp Unix timestamp of the assessment
     */
    function storeReport(
        bytes32 wallet,
        uint8 riskScore,
        string calldata ipfsHash,
        uint64 timestamp
    ) external {
        require(riskScore <= 100, "Risk score must be between 0 and 100");

        reports[wallet] = RiskReport({
            riskScore: riskScore,
            ipfsHash: ipfsHash,
            timestamp: timestamp
        });

        emit ReportStored(wallet, riskScore, ipfsHash, timestamp);
    }

    /**
     * @notice Read the risk report for a given wallet address.
     * @param wallet The keccak256 hash of the wallet address
     * @return riskScore The risk score (0-100)
     * @return ipfsHash  The IPFS CID of the full report
     * @return timestamp The assessment timestamp
     */
    function getReport(bytes32 wallet)
        external
        view
        returns (uint8 riskScore, string memory ipfsHash, uint64 timestamp)
    {
        RiskReport memory r = reports[wallet];
        return (r.riskScore, r.ipfsHash, r.timestamp);
    }
}
