import { describe, expect, it, vi } from "vitest";
import {
  createHydroClient,
  depositToSettlement,
  erc20Abi,
  hydroLocal,
  hydroSettlementAbi,
} from "../src/index.js";
import type { PublicClient, WalletClient } from "viem";

describe("hydroLocal chain definition", () => {
  it("has the provisional Hydro devnet chain id", () => {
    expect(hydroLocal.id).toBe(90731);
  });

  it("points at the local devnet RPC by default", () => {
    expect(hydroLocal.rpcUrls.default.http[0]).toBe("http://127.0.0.1:8545");
  });
});

describe("erc20Abi", () => {
  const functionNames = erc20Abi
    .filter((f) => f.type === "function")
    .map((f) => f.name);

  it("covers the standard ERC-20 read/write surface", () => {
    expect(functionNames).toEqual(
      expect.arrayContaining([
        "name",
        "symbol",
        "decimals",
        "totalSupply",
        "balanceOf",
        "allowance",
        "transfer",
        "approve",
      ])
    );
  });
});

describe("hydroSettlementAbi", () => {
  const functionNames = hydroSettlementAbi
    .filter((f) => f.type === "function")
    .map((f) => f.name);

  it("covers deposit/withdraw/balances/tokenBalance", () => {
    expect(functionNames).toEqual(
      expect.arrayContaining(["deposit", "withdraw", "balances", "tokenBalance", "token"])
    );
  });
});

describe("depositToSettlement", () => {
  const tokenAddress = "0x0000000000000000000000000000000000000001" as `0x${string}`;
  const settlementAddress = "0x0000000000000000000000000000000000000002" as `0x${string}`;
  const owner = "0x0000000000000000000000000000000000000003" as `0x${string}`;

  function mockClients(currentAllowance: bigint) {
    const publicClient = {
      readContract: vi.fn().mockResolvedValue(currentAllowance),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({}),
    } as unknown as PublicClient;

    const writeContract = vi.fn().mockResolvedValueOnce("0xapprove").mockResolvedValueOnce("0xdeposit");
    const walletClient = {
      account: { address: owner },
      writeContract,
    } as unknown as WalletClient;

    return { publicClient, walletClient, writeContract };
  }

  it("skips approval when the existing allowance already covers the deposit", async () => {
    const { publicClient, walletClient, writeContract } = mockClients(1000n);
    const result = await depositToSettlement(publicClient, walletClient, settlementAddress, tokenAddress, 500n);

    expect(result.approveHash).toBeUndefined();
    expect(writeContract).toHaveBeenCalledTimes(1);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "deposit", args: [500n] })
    );
  });

  it("approves first when the existing allowance is insufficient", async () => {
    const { publicClient, walletClient, writeContract } = mockClients(0n);
    const result = await depositToSettlement(publicClient, walletClient, settlementAddress, tokenAddress, 500n);

    expect(result.approveHash).toBe("0xapprove");
    expect(result.depositHash).toBe("0xdeposit");
    expect(writeContract).toHaveBeenCalledTimes(2);
    expect(writeContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ functionName: "approve", args: [settlementAddress, 500n] })
    );
    expect(writeContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ functionName: "deposit", args: [500n] })
    );
  });
});

describe("createHydroClient", () => {
  it("defaults to the Hydro local devnet chain", () => {
    const client = createHydroClient();
    expect(client.chain?.id).toBe(90731);
  });

  it("accepts a custom rpcUrl", () => {
    const client = createHydroClient({ rpcUrl: "http://127.0.0.1:9999" });
    expect(client.transport.url).toBe("http://127.0.0.1:9999");
  });
});
