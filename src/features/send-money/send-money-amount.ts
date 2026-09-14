/** Match transfer-service computeLockedReceiveAmountMinor (receive in major/local units). */
export function lockedReceiveMajor(sendUsd: number, rate: number): number {
  if (!Number.isFinite(sendUsd) || !Number.isFinite(rate) || rate <= 0) return 0;
  const sendMinor = Math.round(sendUsd * 100);
  return Math.round((sendMinor / 100) * rate);
}

/** Derive USD send from a target receive amount and FX rate (1 USD → rate local). */
export function sendUsdFromReceiveMajor(receiveMajor: number, rate: number): number {
  if (!Number.isFinite(receiveMajor) || receiveMajor <= 0 || !Number.isFinite(rate) || rate <= 0) {
    return 0;
  }
  const sendMinor = Math.round((receiveMajor / rate) * 100);
  return sendMinor / 100;
}

export function parseLocalReceiveInput(raw: string): number {
  const normalized = raw.replace(/,/g, "").replace(/\s/g, "").trim();
  if (!normalized) return 0;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}
