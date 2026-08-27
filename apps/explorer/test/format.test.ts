import { describe, expect, it } from "vitest";
import { formatEth, formatTimestamp, formatTokenAmount, shortenHash } from "../src/lib/format";

describe("shortenHash", () => {
  it("shortens a long hash to 0x1234…abcd form", () => {
    expect(shortenHash("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234…5678");
  });

  it("leaves short strings unchanged", () => {
    expect(shortenHash("0x1234")).toBe("0x1234");
  });
});

describe("formatEth", () => {
  it("formats wei as ETH with fixed decimals", () => {
    expect(formatEth(1_500_000_000_000_000_000n)).toBe("1.5000");
    expect(formatEth(0n)).toBe("0.0000");
  });
});

describe("formatTokenAmount", () => {
  it("formats base units using the token's decimals", () => {
    expect(formatTokenAmount(371_000_000n * 10n ** 18n, 18)).toBe("371000000.0000");
  });
});

describe("formatTimestamp", () => {
  it("formats a unix timestamp as a locale string", () => {
    const formatted = formatTimestamp(0n);
    expect(typeof formatted).toBe("string");
    expect(formatted.length).toBeGreaterThan(0);
  });
});
