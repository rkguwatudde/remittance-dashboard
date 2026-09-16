"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { SendMoneyFlow } from "@/features/send-money/send-money-flow";
import { BookTransferPage } from "@/features/book-transfer/book-transfer-page";
import { TradeAndTransferPage } from "@/features/trade-and-transfer/trade-and-transfer-page";
import { UsersDirectoryPage } from "@/features/users/users-directory-page";

const TABS = [
  { id: "cybrid", label: "Transfer" },
  { id: "book", label: "Book transfer" },
  { id: "trade", label: "Trade & transfer" },
  { id: "send", label: "Send money" },
] as const;

const DEFAULT_TAB: TabId = "cybrid";

type TabId = (typeof TABS)[number]["id"];

function isTabId(s: string | null): s is TabId {
  return s === "send" || s === "book" || s === "trade" || s === "cybrid";
}

const SEND_TAB_VIEWPORT =
  "flex h-[calc(100dvh-7.5rem)] min-h-0 flex-col overflow-hidden sm:h-[calc(100dvh-7rem)]";

export function TransferHubPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const raw = searchParams?.get("tab") ?? null;
  const activeTab: TabId = isTabId(raw) ? raw : DEFAULT_TAB;

  React.useEffect(() => {
    if (activeTab !== "send") return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [activeTab]);

  const setTab = React.useCallback(
    (id: TabId) => {
      const next = new URLSearchParams(searchParams?.toString() ?? "");
      next.set("tab", id);
      router.replace(`/transfer?${next.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-surface-muted/40 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTab(tab.id)}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-surface/60 hover:text-foreground",
            )}
            aria-pressed={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={activeTab === "send" ? SEND_TAB_VIEWPORT : undefined}>
        {activeTab === "send" ? (
          <SendMoneyFlow
            embeddedInTransferHub
            initialBusinessPartnerId={searchParams?.get("partnerId")}
          />
        ) : null}
        {activeTab === "book" ? <BookTransferPage /> : null}
        {activeTab === "trade" ? <TradeAndTransferPage /> : null}
        {activeTab === "cybrid" ? <UsersDirectoryPage transferHub /> : null}
      </div>
    </div>
  );
}
