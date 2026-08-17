import type {
  AdminFundingLeg,
  AdminRemittanceTransactionRow,
} from "@/lib/remittance-admin-api";

export type FundingKind = "card" | "cybrid_bank" | "wallet" | "ops" | "unknown";

export type FundingView = {
  kind: FundingKind;
  label: string;
  railLabel: string | null;
  decisionLabel: string | null;
  instrument: string | null;
};

export type FundingLegView = FundingView & {
  role: "remittance" | "bond";
  amountUsd: number | null;
  status: string | null;
  providerReference: string | null;
  paymentTransferId: string | null;
  cybridGuid: string | null;
  cardId: string | null;
  failureReason: string | null;
};

const ACH_RAILS = new Set([
  "SAME_DAY_ACH",
  "STANDARD_ACH",
  "RTP_REQUEST_FOR_PAYMENT",
  "ACH",
]);

const KIND_LABEL: Record<FundingKind, string> = {
  card: "Debit card",
  cybrid_bank: "Cybrid bank",
  wallet: "Wallet",
  ops: "Ops · Pegasus",
  unknown: "Unknown",
};

const RAIL_LABEL: Record<string, string> = {
  SAME_DAY_ACH: "Same-day ACH",
  STANDARD_ACH: "Standard ACH",
  RTP_REQUEST_FOR_PAYMENT: "RTP request",
  ACH: "ACH",
};

const DECISION_LABEL: Record<string, string> = {
  CUSTOMER_SELECTED_CARD: "Customer selected debit card",
  SYSTEM_ROUTED_CARD: "System routed to debit card",
  SYSTEM_ROUTED_BANK: "System routed to Cybrid bank",
  NEW_CUSTOMER_CARD_REQUIRED: "New customer must fund remittance with a debit card",
  BOND_OVERRIDE: "Bond allocation requires Cybrid bank",
  EXISTING_CUSTOMER_ROUTING: "Returning customer · Cybrid bank",
  TRUSTED_CUSTOMER_DEFAULT: "Trusted customer · ACH default",
  FORCED_CARD_ROUTING: "Forced debit-card routing",
  FORCE_CARD_SPLIT_BOND_ACH:
    "Forced card remittance + Cybrid bank bond (split)",
  CUSTOMER_CARD_SPLIT_BOND_ACH:
    "Customer card remittance + Cybrid bank bond (split)",
  ACH_BLOCKED_CARD_FALLBACK: "ACH blocked · card fallback",
  MANUAL_ACH_OVERRIDE: "Manual ACH override",
  WALLET: "Wallet funding",
  OPS_DIRECT_PEGASUS: "Ops dashboard · direct Pegasus",
  REQUESTED: "Requested by customer",
};

function isFundingKind(value: string | null | undefined): value is FundingKind {
  return (
    value === "card" ||
    value === "cybrid_bank" ||
    value === "wallet" ||
    value === "ops" ||
    value === "unknown"
  );
}

export function resolveFundingView(tx: AdminRemittanceTransactionRow): FundingView {
  if (tx.funding_kind && tx.funding_label) {
    const kind = isFundingKind(tx.funding_kind) ? tx.funding_kind : "unknown";
    return {
      kind,
      label: tx.funding_label,
      railLabel: tx.funding_rail_label ?? null,
      decisionLabel: tx.funding_decision_label ?? null,
      instrument: tx.funding_instrument ?? null,
    };
  }

  const method = (tx.funding_method ?? "").trim().toLowerCase();
  const rail = (tx.funding_rail ?? tx.cybrid_transaction_status ?? "").trim().toUpperCase();
  const cardId = tx.linked_debit_card_id?.trim() || null;

  let kind: FundingKind = "unknown";
  if (method === "card" || cardId) kind = "card";
  else if (method === "wallet") kind = "wallet";
  else if (method === "ops") kind = "ops";
  else if (
    method === "bank" ||
    Boolean(tx.cybrid_funding_transfer_guid) ||
    Boolean(tx.linked_bank_account_id) ||
    ACH_RAILS.has(rail)
  ) {
    kind = "cybrid_bank";
  }

  const decisionSource = tx.funding_decision_source?.trim() || null;

  return {
    kind,
    label: KIND_LABEL[kind],
    railLabel: kind === "cybrid_bank" ? (RAIL_LABEL[rail] ?? (rail || null)) : null,
    decisionLabel: decisionSource
      ? (DECISION_LABEL[decisionSource] ?? decisionSource.replace(/_/g, " ").toLowerCase())
      : null,
    instrument: tx.funding_instrument ?? null,
  };
}

function mapApiLeg(leg: AdminFundingLeg, tx: AdminRemittanceTransactionRow): FundingLegView {
  const kind = isFundingKind(leg.funding_kind) ? leg.funding_kind : "unknown";
  return {
    role: leg.role === "bond" ? "bond" : "remittance",
    kind,
    label: leg.funding_label || KIND_LABEL[kind],
    railLabel: leg.funding_rail_label ?? null,
    decisionLabel: tx.funding_decision_label ?? null,
    instrument: leg.funding_instrument ?? null,
    amountUsd: leg.amount_usd,
    status: leg.status,
    providerReference: leg.provider_reference,
    paymentTransferId: leg.payment_transfer_id,
    cybridGuid: leg.cybrid_funding_transfer_guid,
    cardId: leg.linked_debit_card_id,
    failureReason: leg.failure_reason,
  };
}

export function resolveFundingLegs(tx: AdminRemittanceTransactionRow): FundingLegView[] {
  if (tx.funding_legs && tx.funding_legs.length > 0) {
    return tx.funding_legs.map((leg) => mapApiLeg(leg, tx));
  }
  const primary = resolveFundingView(tx);
  return [
    {
      ...primary,
      role: "remittance",
      amountUsd: tx.amount_send,
      status: tx.status,
      providerReference: tx.provider_reference,
      paymentTransferId: null,
      cybridGuid: tx.cybrid_funding_transfer_guid,
      cardId: tx.linked_debit_card_id ?? null,
      failureReason: tx.error_message,
    },
  ];
}

export function fundingBadgeVariant(
  kind: FundingKind,
): "default" | "secondary" | "outline" | "success" {
  if (kind === "card") return "default";
  if (kind === "cybrid_bank") return "secondary";
  if (kind === "wallet") return "success";
  if (kind === "ops") return "outline";
  return "outline";
}

export function formatFundingListLabel(view: FundingView): string {
  if (view.kind === "unknown") return "—";
  return view.railLabel ? `${view.label} · ${view.railLabel}` : view.label;
}

export function formatSplitFundingListLabel(legs: FundingLegView[]): string {
  if (legs.length === 0) return "—";
  if (legs.length === 1) return formatFundingListLabel(legs[0]);
  return legs
    .map((leg) =>
      leg.role === "bond"
        ? "Bank/ACH"
        : leg.kind === "card"
          ? "Card"
          : formatFundingListLabel(leg),
    )
    .join(" + ");
}
