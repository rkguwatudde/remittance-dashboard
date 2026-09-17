import type { AdminRemittanceTransactionRow } from "@/lib/remittance-admin-api";

/** Failed Pegasus poll timeout — safe to re-run GetTransactionDetails (not a new PostTransaction). */
export function isPegasusInvalidTransactionPollFailure(
  tx: AdminRemittanceTransactionRow,
): boolean {
  if (tx.status?.toUpperCase() !== "FAILED") {
    return false;
  }

  const combined = [
    tx.error_message,
    tx.payout_provider_status,
    tx.provider_status,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  if (!combined.includes("INVALID TRANSACTION")) {
    return false;
  }

  const provider = (tx.provider ?? "").trim().toLowerCase();
  if (provider && provider !== "pegasus") {
    return false;
  }

  const receive = (tx.currency_receive ?? tx.currency ?? "").trim().toUpperCase();
  if (!provider && receive === "USD") {
    return false;
  }

  return true;
}
