// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Verifier} from "./TransferValidityVerifier.sol";

/// @title HydroSettlement
/// @notice A minimal L1 settlement layer: an on-chain ledger of account
/// balances that can only be updated by submitting a valid zk/circuits
/// TransferValidity proof showing the transition is a legal transfer. This
/// is the "accept a state transition only with a valid proof" pattern a
/// real rollup settlement contract uses.
///
/// What this is NOT: a batch/rollup settlement contract. It applies one
/// proven transfer at a time against its own balances mapping, not a
/// whole block of transactions proven at once against a Merkle state
/// root. There is no sequencer batching transactions into it yet
/// (chain/sequencer is still unbuilt), and its verifying key comes from
/// an insecure, non-ceremony Groth16 setup (see zk/circuits/README.md).
/// Do not deploy this anywhere real value depends on it.
contract HydroSettlement {
    Verifier public immutable verifier;
    address public immutable owner;

    mapping(address => uint64) public balances;

    event Funded(address indexed account, uint64 amount);
    event TransferSettled(
        address indexed sender,
        address indexed recipient,
        uint64 senderBalanceAfter,
        uint64 recipientBalanceAfter
    );

    constructor(address verifierAddress) {
        verifier = Verifier(verifierAddress);
        owner = msg.sender;
    }

    /// @notice Dev-only faucet to seed ledger balances for demos and
    /// tests. A real settlement layer would credit balances through a
    /// verified L1->L2 deposit (a bridge), not an owner-only faucet — that
    /// bridge doesn't exist yet (see apps/bridge).
    function fund(address account, uint64 amount) external {
        require(msg.sender == owner, "HydroSettlement: not owner");
        balances[account] += amount;
        emit Funded(account, amount);
    }

    /// @notice Applies a transfer, but only if `proof` proves it valid
    /// against `sender` and `recipient`'s *current on-chain* balances —
    /// their "before" balances are read from storage and bound into the
    /// public inputs here, not taken on trust from the caller. See
    /// zk/circuits/src/transferValidity.zok for exactly what's proved.
    function submitTransfer(
        address sender,
        address recipient,
        uint64 senderBalanceAfter,
        uint64 recipientBalanceAfter,
        Verifier.Proof calldata proof
    ) external {
        uint64 senderBalanceBefore = balances[sender];
        uint64 recipientBalanceBefore = balances[recipient];

        // Order must match the circuit's public parameter declaration
        // order, output last: [senderBefore, senderAfter, recipientBefore,
        // recipientAfter, output]. The circuit only ever returns true when
        // satisfiable (there's no false-but-provable path), so the last
        // slot is always the constant 1.
        uint256[5] memory input = [
            uint256(senderBalanceBefore),
            uint256(senderBalanceAfter),
            uint256(recipientBalanceBefore),
            uint256(recipientBalanceAfter),
            uint256(1)
        ];

        require(verifier.verifyTx(proof, input), "HydroSettlement: invalid proof");

        balances[sender] = senderBalanceAfter;
        balances[recipient] = recipientBalanceAfter;

        emit TransferSettled(sender, recipient, senderBalanceAfter, recipientBalanceAfter);
    }
}
