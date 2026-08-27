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
import { erc20Abi } from "./abi.js";
import { hydroLocal } from "./chain.js";

export { hydroLocal } from "./chain.js";
export { erc20Abi } from "./abi.js";

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
