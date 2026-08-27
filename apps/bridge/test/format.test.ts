import { describe, expect, it } from "vitest";
import { formatHydro, shortenHash } from "../src/lib/format";

describe("shortenHash", () => {
  it("shortens a long hash", () => {
    expect(shortenHash("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234…5678");
  });

  it("leaves short strings unchanged", () => {
    expect(shortenHash("0x12")).toBe("0x12");
  });
});

describe("formatHydro", () => {
  it("formats 18-decimal base units as HYDRO", () => {
    expect(formatHydro(1_500_000_000_000_000_000n)).toBe("1.5000");
    expect(formatHydro(0n)).toBe("0.0000");
  });
});
