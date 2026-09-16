"use client";

import { Plus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type RecipientEmptyStateProps = {
  onAdd: () => void;
  hasFilters: boolean;
  /** Center inside a flex panel without growing the page. */
  embedded?: boolean;
};

export function RecipientEmptyState({ onAdd, hasFilters, embedded }: RecipientEmptyStateProps) {
  return (
    <Card
      className={
        embedded
          ? "flex min-h-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border-border/80 px-6 py-10 text-center shadow-[var(--shadow-card)]"
          : "flex flex-col items-center justify-center gap-4 px-8 py-16 text-center shadow-[var(--shadow-card)]"
      }
    >
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary-muted text-primary">
        <Users className="size-8" />
      </div>
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold text-foreground">
          {hasFilters ? "No matches" : "No recipients yet"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {hasFilters
            ? "Try clearing search or filters to see more saved beneficiaries."
            : "Saved recipients speed up repeat transfers with validated mobiles and bank accounts."}
        </p>
      </div>
      {!hasFilters ? (
        <Button type="button" className="gap-2 rounded-xl shadow-sm" onClick={onAdd}>
          <Plus className="size-4" />
          Add recipient
        </Button>
      ) : null}
    </Card>
  );
}
