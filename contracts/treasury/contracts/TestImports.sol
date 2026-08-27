// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

// Pulls TimelockController into compilation so its artifact exists for
// tests to deploy directly (proving HydroTreasury is governance-owned the
// same way contracts/staking is) — this file is never itself deployed.
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
