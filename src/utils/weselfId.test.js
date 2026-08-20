// @vitest-environment node
//
// The spine's canonical vectors. These are the contract between Tiplyfi's
// vendored copy and @weself/core/identity. If weselfId.js drifts from these,
// CI fails - which is the entire reason vendoring is permitted at all.
import { describe, it, expect } from "vitest";
import { weselfIdToBytes32, idFor, subjectId } from "./weselfId.js";

// From the spine chat, measured on the live ReferenceVaultFactory:
//   bind(0xf776c53c..., 0x40C7...04b7) returned the subjectId below.
const WESELF_ID = "00000000-0000-0000-0000-000000000001";
const OWNER = "0x40C7329C3B39EBece3e0883DaF0dd1Eab6F504b7";
const W32 = "0xf776c53c2d36ffac1e6fd2ee1f65dbc47b624e949fe81fcd79aea14694441dc1";
const SUBJECT_ID = "0x853537b2b565467d15dfeb22b03d80a899d228b0cab2947933b424b677e0fb29";

describe("weselfId - canonical vectors", () => {
  it("layer 1: text id -> bytes32", () => {
    expect(weselfIdToBytes32(WESELF_ID, "user")).toBe(W32);
  });

  it("layer 2: (bytes32, owner) -> subjectId", () => {
    expect(idFor(W32, OWNER)).toBe(SUBJECT_ID);
  });

  it("full derivation matches the on-chain bind result", () => {
    expect(subjectId(WESELF_ID, OWNER, "user")).toBe(SUBJECT_ID);
  });

  it("defaults to the user namespace", () => {
    expect(subjectId(WESELF_ID, OWNER)).toBe(SUBJECT_ID);
  });
});

describe("weselfId - namespace isolation", () => {
  it("a user id and an order id never collide", () => {
    const asUser = weselfIdToBytes32(WESELF_ID, "user");
    const asOrder = weselfIdToBytes32(WESELF_ID, "order");
    const asGroup = weselfIdToBytes32(WESELF_ID, "group");
    expect(asUser).not.toBe(asOrder);
    expect(asUser).not.toBe(asGroup);
    expect(asOrder).not.toBe(asGroup);
  });

  it("rejects an unknown subject kind", () => {
    expect(() => weselfIdToBytes32(WESELF_ID, "wallet")).toThrow();
  });

  it("rejects an empty id", () => {
    expect(() => weselfIdToBytes32("", "user")).toThrow();
  });
});

describe("weselfId - owner sensitivity", () => {
  it("a different owner yields a different subjectId", () => {
    const other = "0x0fB13B58737D522Ee9DAd2D3539dA95cBb3a5530";
    expect(subjectId(WESELF_ID, other)).not.toBe(SUBJECT_ID);
  });

  it("rejects a bad-checksum owner rather than deriving a wrong id", () => {
    const bad = "0x40c7329c3b39ebece3e0883daf0dd1eab6f504b7XX";
    expect(() => subjectId(WESELF_ID, bad)).toThrow();
  });
});
