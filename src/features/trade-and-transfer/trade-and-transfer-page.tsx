"use client";

import * as React from "react";
import { Coins, Loader2, X } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AdminApiError,
  adminTradeAndTransferExecute,
  adminTradeAndTransferPreview,
  type AdminTradeAndTransferExecuteData,
  type AdminTradeAndTransferPreviewData,
} from "@/lib/remittance-admin-api";
import { cn } from "@/lib/utils";

function usdToCents(value: string): { cents: number; error?: string } {
  const raw = value.trim().replace(/[$,\s]/g, "");
  if (!raw) return { cents: 0, error: "Enter amount." };
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return { cents: 0, error: "Enter a valid positive amount." };
  if (n < 0.01) return { cents: 0, error: "Minimum amount is $0.01." };
  return { cents: Math.round(n * 100) };
}

function fmtUsd(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Cybrid USDC_SOL amounts are typically expressed in 10⁻⁶ token units. */
function fmtUsdcMinor(minor: number): string {
  if (!Number.isFinite(minor)) return "—";
  const v = minor / 1e6;
  return `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USDC`;
}

export function TradeAndTransferPage() {
  const { getAccessToken, refreshAccessToken } = useAuth();
  const [modalOpen, setModalOpen] = React.useState(false);

  const [useFull, setUseFull] = React.useState(false);
  const [amountUsd, setAmountUsd] = React.useState("");

  const [preview, setPreview] = React.useState<AdminTradeAndTransferPreviewData | null>(null);
  const [quoteLoading, setQuoteLoading] = React.useState(false);
  const [quoteError, setQuoteError] = React.useState<string | null>(null);

  const [executeLoading, setExecuteLoading] = React.useState(false);
  const [executeError, setExecuteError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<AdminTradeAndTransferExecuteData | null>(null);
  /** Used when the API does not set `CYBRID_ADMIN_TRADE_TRANSFER_EXTERNAL_WALLET_GUID` (preview shows no destination). */
  const [fallbackExternalWallet, setFallbackExternalWallet] = React.useState("");

  const idempotencyKeyRef = React.useRef<string | null>(null);

  const resetFlow = React.useCallback(() => {
    setPreview(null);
    setQuoteError(null);
    setExecuteError(null);
    setSuccess(null);
    setFallbackExternalWallet("");
    idempotencyKeyRef.current = null;
  }, []);

  const closeModal = React.useCallback(() => {
    setModalOpen(false);
    resetFlow();
    setAmountUsd("");
    setUseFull(false);
    setFallbackExternalWallet("");
  }, [resetFlow]);

  React.useEffect(() => {
    if (!modalOpen) return;
    resetFlow();
  }, [modalOpen, resetFlow]);

  const parsed = usdToCents(amountUsd);

  const hasExecuteDestination = Boolean(
    preview?.destination_external_wallet_guid?.trim() || fallbackExternalWallet.trim().length >= 16,
  );

  const getQuote = async () => {
    setQuoteError(null);
    setExecuteError(null);
    setSuccess(null);
    idempotencyKeyRef.current = null;

    const token = getAccessToken();
    if (!token) {
      setQuoteError("Sign in to continue.");
      return;
    }

    if (!useFull && parsed.error) {
      setQuoteError(parsed.error);
      return;
    }

    setQuoteLoading(true);
    try {
      const body = useFull
        ? { use_full_fiat_balance: true as const }
        : { use_full_fiat_balance: false as const, deliver_amount_usd_cents: parsed.cents };
      const data = await adminTradeAndTransferPreview(token, body);
      setPreview(data);
    } catch (e) {
      setPreview(null);
      setQuoteError(e instanceof AdminApiError ? e.message : "Could not create trade quote.");
    } finally {
      setQuoteLoading(false);
    }
  };

  const confirmExecute = async () => {
    setExecuteError(null);
    if (!preview) {
      setExecuteError("Get a quote first.");
      return;
    }

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `tt-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    }

    const ext =
      preview.destination_external_wallet_guid?.trim() || fallbackExternalWallet.trim() || undefined;
    if (!ext) {
      setExecuteError(
        "No destination wallet: set CYBRID_ADMIN_TRADE_TRANSFER_EXTERNAL_WALLET_GUID on payment-service, or enter the external wallet GUID below.",
      );
      return;
    }

    const run = async (token: string) =>
      adminTradeAndTransferExecute(token, {
        trade_quote_guid: preview.trade_quote_guid,
        deliver_amount_usd_cents: preview.deliver_amount_usd_cents,
        ...(preview.destination_external_wallet_guid?.trim()
          ? {}
          : { external_wallet_guid: ext }),
        idempotency_key: idempotencyKeyRef.current!,
      });

    const token = getAccessToken();
    if (!token) {
      setExecuteError("Sign in to continue.");
      return;
    }

    setExecuteLoading(true);
    try {
      const data = await run(token);
      setSuccess(data);
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) {
        const ok = await refreshAccessToken();
        if (ok) {
          const next = getAccessToken();
          if (next) {
            try {
              const data = await run(next);
              setSuccess(data);
              return;
            } catch (e2) {
              setExecuteError(e2 instanceof AdminApiError ? e2.message : "Execute failed.");
              return;
            }
          }
        }
      }
      setExecuteError(e instanceof AdminApiError ? e.message : "Trade and transfer failed.");
    } finally {
      setExecuteLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Cybrid</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Trade &amp; transfer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Convert platform FIAT to USDC on Solana, then send to the external wallet configured on payment-service
          (<code className="text-xs">CYBRID_ADMIN_TRADE_TRANSFER_EXTERNAL_WALLET_GUID</code>), or pass a wallet in the
          API request when that env is unset.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Coins className="size-5 text-primary" />
            FIAT → USDC_SOL → external wallet
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Trading quote → trade → crypto transfer quote → transfer. Destination is controlled by the API environment.
          </p>
        </CardHeader>
        <CardContent>
          <Button type="button" className="h-11 font-semibold" onClick={() => setModalOpen(true)}>
            Trade to USDC &amp; transfer
          </Button>
        </CardContent>
      </Card>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tt-modal-title"
        >
          <Card className={cn("relative max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-xl")}>
            <button
              type="button"
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => closeModal()}
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
            <CardHeader className="pr-12">
              <CardTitle id="tt-modal-title">Trade to USDC &amp; transfer</CardTitle>
              <p className="text-sm text-muted-foreground">
                Get a quote, review estimated USDC, then confirm. The same idempotency key is reused if you retry after
                an error until you refresh the quote.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={useFull}
                  onChange={(e) => {
                    setUseFull(e.target.checked);
                    setPreview(null);
                    setQuoteError(null);
                    idempotencyKeyRef.current = null;
                  }}
                />
                Use full platform FIAT balance
              </label>

              {!useFull ? (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Amount (USD)</label>
                  <Input
                    value={amountUsd}
                    onChange={(e) => {
                      setAmountUsd(e.target.value);
                      setPreview(null);
                      idempotencyKeyRef.current = null;
                    }}
                    placeholder="100.00"
                    inputMode="decimal"
                    className="mt-1 font-mono"
                  />
                  {parsed.error ? <p className="mt-1 text-xs text-destructive">{parsed.error}</p> : null}
                </div>
              ) : null}

              {preview ? (
                <div className="rounded-lg border border-border bg-surface-muted/40 px-3 py-2 text-sm space-y-1">
                  <p>
                    <span className="text-muted-foreground">FIAT balance: </span>
                    {fmtUsd(preview.fiat_balance_cents)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Deliver: </span>
                    {fmtUsd(preview.deliver_amount_usd_cents)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Est. receive: </span>
                    <span className="font-medium">{fmtUsdcMinor(preview.estimated_usdc_receive_minor)}</span>
                    <span className="ml-2 text-xs text-muted-foreground font-mono">
                      ({preview.estimated_usdc_receive_minor} minor)
                    </span>
                  </p>
                  {preview.destination_external_wallet_guid ? (
                    <p className="font-mono text-xs break-all">
                      <span className="text-muted-foreground">Destination wallet ({preview.destination_wallet_source}): </span>
                      {preview.destination_external_wallet_guid}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-800 dark:text-amber-200/90">
                      Remittance API has no <code className="text-[11px]">CYBRID_ADMIN_TRADE_TRANSFER_EXTERNAL_WALLET_GUID</code>
                      — enter the payout wallet GUID below, or set that env and restart the API, then get quote again.
                    </p>
                  )}
                  <p className="font-mono text-xs text-muted-foreground break-all">
                    trade_quote_guid: {preview.trade_quote_guid}
                  </p>
                </div>
              ) : null}

              {preview && !preview.destination_external_wallet_guid ? (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">External wallet GUID (USDC_SOL)</label>
                  <Input
                    value={fallbackExternalWallet}
                    onChange={(e) => setFallbackExternalWallet(e.target.value)}
                    placeholder="ed37dbc99008df8ac4334f7e4461aa5c"
                    className="mt-1 font-mono text-xs"
                    spellCheck={false}
                  />
                </div>
              ) : null}

              {quoteError ? <p className="text-sm text-destructive">{quoteError}</p> : null}
              {executeError ? <p className="text-sm text-destructive">{executeError}</p> : null}

              {success ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm space-y-1">
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {success.idempotent ? "Already completed (idempotent)" : "Submitted successfully"}
                  </p>
                  <p className="font-mono text-xs">
                    trade_id: {success.trade_id ?? "—"}
                    <br />
                    transfer_id: {success.transfer_id ?? "—"}
                  </p>
                  {success.transfer_state ? (
                    <p className="text-xs capitalize text-muted-foreground">Transfer state: {success.transfer_state}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => void getQuote()}
                  disabled={quoteLoading || executeLoading || (!useFull && !!parsed.error) || success != null}
                >
                  {quoteLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Get quote
                </Button>
                <Button
                  type="button"
                  className="flex-1 font-semibold"
                  onClick={() => void confirmExecute()}
                  disabled={
                    executeLoading || quoteLoading || !preview || success != null || !hasExecuteDestination
                  }
                >
                  {executeLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Confirm trade &amp; transfer
                </Button>
              </div>

              <Button type="button" variant="ghost" className="w-full" onClick={() => closeModal()}>
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
