import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "./sha256-hex";

function nodeSha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

describe("sha256Hex", () => {
  it("matches known SHA-256 vectors", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("matches node:crypto across block boundaries and multi-byte text", () => {
    const samples = [
      "IT Project Manager\n---\nRichardson, TX",
      "What You’ll Do — résumé naïve 日本語 🚀",
      "a".repeat(55),
      "a".repeat(56),
      "a".repeat(63),
      "a".repeat(64),
      "a".repeat(65),
      "x".repeat(10_000),
    ];
    for (const sample of samples) {
      expect(sha256Hex(sample)).toBe(nodeSha256(sample));
    }
  });
});
