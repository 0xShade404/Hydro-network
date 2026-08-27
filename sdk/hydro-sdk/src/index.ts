import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { erc20Abi, hydroSettlementAbi } from "./abi.js";
import { hydroLocal } from "./chain.js";

export { hydroLocal } from "./chain.js";
export { erc20Abi, hydroSettlementAbi } from "./abi.js";

export interface HydroClientOptions {
  /** JSON-RPC URL of the Hydro network to connect to. Defaults to the local devnet. */
  rpcUrl?: string;
}

/** A read-only client for querying the Hydro network. */
export function createHydroClient(options: HydroClientOptions = {}): PublicClient {
  return createPublicClient({
    chain: hydroLocal,
    transport: http(options.rpcUrl ?? hydroLocal.rpcUrls.default.http[0]),
  });
}

/** A signing client for a given private key, able to send transactions. */
export function createHydroWalletClient(
  privateKey: `0x${string}`,
  options: HydroClientOptions = {}
): WalletClient {
  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: hydroLocal,
    transport: http(options.rpcUrl ?? hydroLocal.rpcUrls.default.http[0]),
  });
}

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
}

/** Reads name/symbol/decimals/totalSupply for an ERC-20 (e.g. HydroToken). */
export async function getTokenInfo(client: PublicClient, tokenAddress: Address): Promise<TokenInfo> {
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "name" }),
    client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "symbol" }),
    client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "decimals" }),
    client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "totalSupply" }),
  ]);
  return { name, symbol, decimals, totalSupply };
}

/** Reads an account's balance of an ERC-20 token. */
export async function getTokenBalance(
  client: PublicClient,
  tokenAddress: Address,
  account: Address
): Promise<bigint> {
  return client.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account],
  });
}

/** Transfers an ERC-20 token and returns the transaction hash. */
export async function transferToken(
  walletClient: WalletClient,
  tokenAddress: Address,
  to: Address,
  amount: bigint
): Promise<Hash> {
  if (!walletClient.account) {
    throw new Error("transferToken: wallet client has no account");
  }
  return walletClient.writeContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amount],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}

/** Reads how much `spender` is currently allowed to pull from `owner`. */
export async function getAllowance(
  client: PublicClient,
  tokenAddress: Address,
  owner: Address,
  spender: Address
): Promise<bigint> {
  return client.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  });
}

/** Approves `spender` to pull up to `amount` of an ERC-20 token. */
export async function approveToken(
  walletClient: WalletClient,
  tokenAddress: Address,
  spender: Address,
  amount: bigint
): Promise<Hash> {
  if (!walletClient.account) {
    throw new Error("approveToken: wallet client has no account");
  }
  return walletClient.writeContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}

/**
 * chain/settlement helpers — the bridge primitive that locks/releases
 * real HYDRO 1:1 against HydroSettlement's on-chain ledger. See
 * chain/settlement/README.md for what this is (and isn't).
 */

/** Reads an account's ledger balance on a HydroSettlement contract. */
export async function getSettlementBalance(
  client: PublicClient,
  settlementAddress: Address,
  account: Address
): Promise<bigint> {
  return client.readContract({
    address: settlementAddress,
    abi: hydroSettlementAbi,
    functionName: "balances",
    args: [account],
  });
}

/**
 * Deposits `amount` HYDRO into a HydroSettlement ledger, approving first
 * if the existing allowance isn't already enough. Returns the deposit
 * transaction hash (and the approval's, if one was needed).
 */
export async function depositToSettlement(
  publicClient: PublicClient,
  walletClient: WalletClient,
  settlementAddress: Address,
  tokenAddress: Address,
  amount: bigint
): Promise<{ approveHash?: Hash; depositHash: Hash }> {
  if (!walletClient.account) {
    throw new Error("depositToSettlement: wallet client has no account");
  }
  const owner = walletClient.account.address;

  let approveHash: Hash | undefined;
  const currentAllowance = await getAllowance(publicClient, tokenAddress, owner, settlementAddress);
  if (currentAllowance < amount) {
    approveHash = await approveToken(walletClient, tokenAddress, settlementAddress, amount);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  const depositHash = await walletClient.writeContract({
    address: settlementAddress,
    abi: hydroSettlementAbi,
    functionName: "deposit",
    args: [amount],
    account: walletClient.account,
    chain: walletClient.chain,
  });

  return { approveHash, depositHash };
}

/** Withdraws `amount` HYDRO from a HydroSettlement ledger back to the caller's wallet. */
export async function withdrawFromSettlement(
  walletClient: WalletClient,
  settlementAddress: Address,
  amount: bigint
): Promise<Hash> {
  if (!walletClient.account) {
    throw new Error("withdrawFromSettlement: wallet client has no account");
  }
  return walletClient.writeContract({
    address: settlementAddress,
    abi: hydroSettlementAbi,
    functionName: "withdraw",
    args: [amount],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}
