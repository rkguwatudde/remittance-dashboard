import { Suspense } from "react";

import { TransferHubPage } from "@/features/transfer/transfer-hub-page";

export default function TransferPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-lg border border-border bg-surface-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          Loading transfer tools…
        </div>
      }
    >
      <TransferHubPage />
    </Suspense>
  );
}
