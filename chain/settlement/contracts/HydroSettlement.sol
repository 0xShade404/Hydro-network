// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Verifier} from "./TransferValidityVerifier.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title HydroSettlement
/// @notice A minimal L1 settlement layer: an on-chain ledger of account
/// balances that can only be updated by submitting a valid zk/circuits
/// TransferValidity proof showing the transition is a legal transfer. This
/// is the "accept a state transition only with a valid proof" pattern a
/// real rollup settlement contract uses. `deposit`/`withdraw` are the
/// bridge half: they lock and release real HYDRO 1:1 against the ledger,
/// so every balance here is always fully backed by HYDRO this contract
/// actually holds — see "Solvency" below.
///
/// What this is NOT: a batch/rollup settlement contract. It applies one
/// proven transfer at a time against its own balances mapping, not a
/// whole block of transactions proven at once against a Merkle state
/// root. There is no sequencer batching transactions into it yet
/// (chain/sequencer is still unbuilt), and its verifying key comes from
/// an insecure, non-ceremony Groth16 setup (see zk/circuits/README.md).
/// Do not deploy this anywhere real value depends on it.
contract HydroSettlement is ReentrancyGuard {
    using SafeERC20 for IERC20;

    Verifier public immutable verifier;
    IERC20 public immutable token;

    mapping(address => uint256) public balances;

    event Deposited(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event TransferSettled(
        address indexed sender,
        address indexed recipient,
        uint256 senderBalanceAfter,
        uint256 recipientBalanceAfter
    );

    constructor(address verifierAddress, address tokenAddress) {
        verifier = Verifier(verifierAddress);
        token = IERC20(tokenAddress);
    }

    /// @notice Locks `amount` HYDRO from the caller and credits their
    /// ledger balance 1:1 — the L1->L2 deposit half of a bridge. Requires
    /// a prior `approve`.
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "HydroSettlement: zero amount");
        balances[msg.sender] += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    /// @notice Debits the caller's ledger balance and releases the same
    /// amount of real HYDRO back to them — the L2->L1 withdrawal half.
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "HydroSettlement: zero amount");
        require(balances[msg.sender] >= amount, "HydroSettlement: insufficient ledger balance");
        balances[msg.sender] -= amount;
        token.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Applies a transfer, but only if `proof` proves it valid
    /// against `sender` and `recipient`'s *current on-chain* balances —
    /// their "before" balances are read from storage and bound into the
    /// public inputs here, not taken on trust from the caller. See
    /// zk/circuits/src/transferValidity.zok for exactly what's proved.
    function submitTransfer(
        address sender,
        address recipient,
        uint256 senderBalanceAfter,
        uint256 recipientBalanceAfter,
        Verifier.Proof calldata proof
    ) external {
        uint256 senderBalanceBefore = balances[sender];
        uint256 recipientBalanceBefore = balances[recipient];

        // Order must match the circuit's public parameter declaration
        // order, output last: [senderBefore, senderAfter, recipientBefore,
        // recipientAfter, output]. The circuit only ever returns true when
        // satisfiable (there's no false-but-provable path), so the last
        // slot is always the constant 1. The generated verifier itself
        // rejects any input >= the BN128 scalar field's modulus, so an
        // out-of-range uint256 here fails closed rather than silently
        // wrapping.
        uint256[5] memory input = [
            senderBalanceBefore,
            senderBalanceAfter,
            recipientBalanceBefore,
            recipientBalanceAfter,
            uint256(1)
        ];

        require(verifier.verifyTx(proof, input), "HydroSettlement: invalid proof");

        balances[sender] = senderBalanceAfter;
        balances[recipient] = recipientBalanceAfter;

        emit TransferSettled(sender, recipient, senderBalanceAfter, recipientBalanceAfter);
    }

    /// @notice Solvency check: every ledger balance is backed by real
    /// locked HYDRO. `deposit` only credits what it locks, `withdraw` only
    /// releases what it debits, and `submitTransfer` only moves value
    /// between existing balances — so this contract's token balance
    /// should never fall below the sum of all ledger balances. There's no
    /// cheap way to sum a mapping on-chain to assert this generally, but
    /// it's exactly what `test/HydroSettlement.test.ts`'s deposit/withdraw
    /// tests check for the accounts involved.
    function tokenBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}
