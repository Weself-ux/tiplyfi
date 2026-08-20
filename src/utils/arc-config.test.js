// @vitest-environment node
import { describe, it, expect } from "vitest";
import { computeTipAmounts, usdcToWei, weiToDisplay, FEE_BPS } from "./arc-config.js";

const SCALE = 1_000_000_000_000n;
const BPS = 10_000n;
const MAX_FEE_BPS = 1_000n;
const MIN_TIP = 1_000_000_000_000_000_000n;

const AMOUNTS = ["1", "1.01", "5", "9.99", "10", "100", "1234.56"];

describe("usdcToWei", () => {
  it("is exact past Number.MAX_SAFE_INTEGER", () => {
    expect(usdcToWei("9007199254.740993")).toBe(9007199254740993000000000000n);
  });

  it("handles the smallest tip the UI allows", () => {
    expect(usdcToWei("0.01")).toBe(10_000_000_000_000_000n);
    expect(usdcToWei("1")).toBe(MIN_TIP);
  });

  it("round-trips through the display formatter", () => {
    expect(weiToDisplay(usdcToWei("1234.56"))).toBe("1234.56");
  });
});

describe("computeTipAmounts", () => {
  it("charges 600 bps", () => {
    expect(FEE_BPS).toBe(600n);
  });

  for (const amount of AMOUNTS) {
    for (const fanCovers of [true, false]) {
      for (const platformTip of [true, false]) {
        const label = amount + " fanCovers=" + fanCovers + " tip=" + platformTip;

        it("conserves value exactly: " + label, () => {
          const a = computeTipAmounts(amount, fanCovers, platformTip);
          expect(a.netWei + a.feeWei + a.platformTipWei).toBe(a.valueWei);
          expect(a.tipTotalWei + a.platformTipWei).toBe(a.valueWei);
        });

        it("snaps every figure to 6 decimals: " + label, () => {
          const a = computeTipAmounts(amount, fanCovers, platformTip);
          for (const v of [a.valueWei, a.tipTotalWei, a.feeWei, a.platformTipWei, a.netWei]) {
            expect(v % SCALE).toBe(0n);
          }
        });

        it("clears the contract fee floor: " + label, () => {
          const a = computeTipAmounts(amount, fanCovers, platformTip);
          expect(a.feeWei * BPS >= a.netWei * FEE_BPS).toBe(true);
        });

        it("stays under the contract fee ceiling: " + label, () => {
          const a = computeTipAmounts(amount, fanCovers, platformTip);
          expect(a.feeWei * BPS <= a.tipTotalWei * MAX_FEE_BPS).toBe(true);
        });

        it("keeps the platform tip under half the transaction: " + label, () => {
          const a = computeTipAmounts(amount, fanCovers, platformTip);
          expect(a.platformTipWei <= a.valueWei - a.platformTipWei).toBe(true);
        });

        it("never falls below the 1 USDC minimum: " + label, () => {
          const a = computeTipAmounts(amount, fanCovers, platformTip);
          expect(a.tipTotalWei >= MIN_TIP).toBe(true);
        });
      }
    }
  }

  it("sits exactly on the floor when the fan covers, above it when the creator absorbs", () => {
    const covered = computeTipAmounts("10", true, false);
    expect(covered.feeWei * BPS).toBe(covered.netWei * FEE_BPS);

    const absorbed = computeTipAmounts("10", false, false);
    expect(absorbed.feeWei * BPS > absorbed.netWei * FEE_BPS).toBe(true);
  });

  it("splits a 10 USDC tip the way the contract expects", () => {
    const absorbed = computeTipAmounts("10", false, false);
    expect(absorbed.valueWei).toBe(10_000_000_000_000_000_000n);
    expect(absorbed.feeWei).toBe(600_000_000_000_000_000n);
    expect(absorbed.netWei).toBe(9_400_000_000_000_000_000n);

    const covered = computeTipAmounts("10", true, false);
    expect(covered.valueWei).toBe(10_600_000_000_000_000_000n);
    expect(covered.netWei).toBe(10_000_000_000_000_000_000n);
  });

  it("snaps sub-cent input down rather than rejecting it", () => {
    expect(computeTipAmounts("1.019", false, false).tipTotalWei).toBe(usdcToWei("1.01"));
  });
});
