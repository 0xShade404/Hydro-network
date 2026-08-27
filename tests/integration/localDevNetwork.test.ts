import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPublicClient, createWalletClient, http, parseUnits, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createHydroClient, getTokenBalance, getTokenInfo, hydroLocal, transferToken } from "@hydro/sdk";

/**
 * End-to-end check of the first milestone: a Hydro local devnet (Hardhat
 * network) serving JSON-RPC, the HydroToken contract deployed to it, and
 * the Hydro SDK reading/writing against that deployment.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");
const CONTRACTS_TOKEN_DIR = path.join(REPO_ROOT, "contracts", "token");
const HARDHAT_BIN = path.join(REPO_ROOT, "node_modules", ".bin", "hardhat");
const ARTIFACT_PATH = path.join(
  CONTRACTS_TOKEN_DIR,
  "artifacts",
  "contracts",
  "HydroToken.sol",
  "HydroToken.json"
);

// Hardhat's well-known local devnet account #0 — publicly known, funds have
// no value; used only against the ephemeral node spawned by this test.
const DEPLOYER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const RECIPIENT_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;

let nodeProcess: ChildProcess;

async function waitForRpc(rpcUrl: string, timeoutMs = 30_000) {
  const client = createPublicClient({ chain: hydroLocal, transport: http(rpcUrl) });
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await client.getBlockNumber();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Hydro devnet RPC at ${rpcUrl} did not become ready in time`);
}

describe("local Hydro devnet + HydroToken + SDK", () => {
  beforeAll(async () => {
    // Spawn the hardhat binary directly rather than via `npx`: npx forks
    // an extra process, and killing the npx wrapper alone leaves the
    // actual hardhat node running (a real leak observed while writing this
    // test) instead of shutting it down with the test.
    nodeProcess = spawn(HARDHAT_BIN, ["node"], {
      cwd: CONTRACTS_TOKEN_DIR,
      stdio: "ignore",
    });
    await waitForRpc(hydroLocal.rpcUrls.default.http[0]);
  }, 40_000);

  afterAll(() => {
    nodeProcess?.kill();
  });

  it("serves EVM JSON-RPC with block production", async () => {
    const client = createHydroClient();
    const chainId = await client.getChainId();
    expect(chainId).toBe(hydroLocal.id);

    // viem caches getBlockNumber for `cacheTime` ms by default; force a
    // fresh read on both sides so this actually observes block production.
    const blockBefore = await client.getBlockNumber({ cacheTime: 0 });
    const deployer = privateKeyToAccount(DEPLOYER_KEY);
    const wallet = createWalletClient({ account: deployer, chain: hydroLocal, transport: http() });
    const hash = await wallet.sendTransaction({ to: deployer.address, value: 0n });
    await client.waitForTransactionReceipt({ hash });
    const blockAfter = await client.getBlockNumber({ cacheTime: 0 });

    expect(blockAfter).toBeGreaterThan(blockBefore);
  });

  it("deploys HydroToken and reads/transfers via the SDK", async () => {
    const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
    const client = createHydroClient();
    const deployer = privateKeyToAccount(DEPLOYER_KEY);
    const recipient = privateKeyToAccount(RECIPIENT_KEY);
    const deployerWallet = createWalletClient({ account: deployer, chain: hydroLocal, transport: http() });

    const deployHash = await deployerWallet.deployContract({
      abi: artifact.abi,
      bytecode: artifact.bytecode,
      args: [deployer.address],
    });
    const receipt = await client.waitForTransactionReceipt({ hash: deployHash });
    const tokenAddress = receipt.contractAddress as Address;
    expect(tokenAddress).toBeTruthy();

    const info = await getTokenInfo(client, tokenAddress);
    expect(info.name).toBe("Hydro");
    expect(info.symbol).toBe("HYDRO");
    expect(info.decimals).toBe(18);
    expect(info.totalSupply).toBe(parseUnits("371000000", 18));

    const deployerBalance = await getTokenBalance(client, tokenAddress, deployer.address);
    expect(deployerBalance).toBe(info.totalSupply);

    const amount = parseUnits("1000", 18);
    const transferHash = await transferToken(deployerWallet, tokenAddress, recipient.address, amount);
    await client.waitForTransactionReceipt({ hash: transferHash });

    const recipientBalance = await getTokenBalance(client, tokenAddress, recipient.address);
    expect(recipientBalance).toBe(amount);

    const deployerBalanceAfter = await getTokenBalance(client, tokenAddress, deployer.address);
    expect(deployerBalanceAfter).toBe(info.totalSupply - amount);
  });
});
