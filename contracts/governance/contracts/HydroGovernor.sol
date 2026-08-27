// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorSettings} from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import {GovernorCountingSimple} from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {GovernorVotesQuorumFraction} from "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

/// @title HydroGovernor
/// @notice Token-weighted on-chain governance over Hydro contracts (e.g.
/// contracts/staking's owner-only functions), built almost entirely from
/// OpenZeppelin's audited Governor framework rather than custom voting
/// logic — the investor-relevant guarantees here come from well-reviewed,
/// widely-deployed code (the same pattern used by Compound, Uniswap and
/// most major DAOs), not a bespoke mechanism.
///
/// What protects an investor's position specifically:
///  - Voting power is checkpointed (HydroToken's ERC20Votes): power is read
///    from a snapshot at proposal creation, not live balance, so tokens
///    borrowed right before a vote don't count — no flash-loan governance.
///  - A `TimelockController` sits between a passed vote and execution: even
///    a successful malicious proposal cannot execute immediately, giving
///    holders a window to react (e.g. exit) before anything happens.
///  - `proposalThreshold` keeps spam/griefing proposals from a trivial
///    stake; `quorumFraction` keeps a low-turnout minority from deciding
///    outcomes that affect everyone.
///  - This contract has no special privileges of its own beyond what it's
///    explicitly given (e.g. contracts/staking's ownership, transferred to
///    the timelock in deployment) — it cannot mint HYDRO or move funds it
///    was never granted control over.
contract HydroGovernor is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    /// @param token The checkpointed voting token (HydroToken).
    /// @param timelock The TimelockController proposals execute through.
    /// @param votingDelay_ Blocks between a proposal being created and voting opening.
    /// @param votingPeriod_ Blocks voting stays open for.
    /// @param proposalThreshold_ Minimum voting power required to create a proposal.
    /// @param quorumFractionPercent Percent of total supply that must vote for a proposal to be valid (0-100).
    constructor(
        IVotes token,
        TimelockController timelock,
        uint48 votingDelay_,
        uint32 votingPeriod_,
        uint256 proposalThreshold_,
        uint256 quorumFractionPercent
    )
        Governor("HydroGovernor")
        GovernorSettings(votingDelay_, votingPeriod_, proposalThreshold_)
        GovernorVotes(token)
        GovernorVotesQuorumFraction(quorumFractionPercent)
        GovernorTimelockControl(timelock)
    {}

    // The following overrides are required by Solidity whenever more than
    // one inherited contract defines the same function — see
    // contracts/governance/README.md for why each override exists.

    function votingDelay() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }

    function votingPeriod() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }

    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
    }

    function quorum(uint256 timepoint) public view override(Governor, GovernorVotesQuorumFraction) returns (uint256) {
        return super.quorum(timepoint);
    }

    function state(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (ProposalState) {
        return super.state(proposalId);
    }

    function proposalNeedsQueuing(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (bool) {
        return super.proposalNeedsQueuing(proposalId);
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) {
        return super._executor();
    }
}
