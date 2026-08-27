import { describe, expect, it } from "vitest";
import { createHydroClient, erc20Abi, hydroLocal } from "../src/index.js";

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
