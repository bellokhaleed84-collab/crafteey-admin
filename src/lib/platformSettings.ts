export type PlatformSettingsValues = {
  debtAlertKobo: number;
  debtBlockKobo: number;
  riderSharePercent: number;
  commission: { basic: number; regular: number; premium: number };
  withdrawalDays: number[]; // 0 = Sunday ... 6 = Saturday
};

// Same values the apps use today.
export const DEFAULT_SETTINGS: PlatformSettingsValues = {
  debtAlertKobo: 500_000,
  debtBlockKobo: 800_000,
  riderSharePercent: 80,
  commission: { basic: 15, regular: 20, premium: 30 },
  withdrawalDays: [1, 4],
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Checks a submitted settings object. Returns clean values or an error message. */
export function validateSettings(
  input: any
): { ok: true; value: PlatformSettingsValues } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Invalid settings." };

  const { debtAlertKobo, debtBlockKobo, riderSharePercent, commission, withdrawalDays } = input;

  if (!isNum(debtAlertKobo) || !isNum(debtBlockKobo) || debtAlertKobo < 0 || debtBlockKobo <= 0) {
    return { ok: false, error: "Debt limits must be positive amounts." };
  }
  if (debtAlertKobo >= debtBlockKobo) {
    return { ok: false, error: "The debt alert must be lower than the block limit." };
  }
  if (!isNum(riderSharePercent) || riderSharePercent < 50 || riderSharePercent > 100) {
    return { ok: false, error: "Rider share must be between 50% and 100%." };
  }
  const tiers = ["basic", "regular", "premium"] as const;
  for (const t of tiers) {
    const v = commission?.[t];
    if (!isNum(v) || v < 0 || v > 50) return { ok: false, error: `The ${t} commission must be between 0% and 50%.` };
  }
  if (
    !Array.isArray(withdrawalDays) ||
    withdrawalDays.length === 0 ||
    !withdrawalDays.every((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)
  ) {
    return { ok: false, error: "Pick at least one withdrawal day." };
  }

  return {
    ok: true,
    value: {
      debtAlertKobo: Math.round(debtAlertKobo),
      debtBlockKobo: Math.round(debtBlockKobo),
      riderSharePercent,
      commission: { basic: commission.basic, regular: commission.regular, premium: commission.premium },
      withdrawalDays: [...new Set<number>(withdrawalDays)].sort(),
    },
  };
}