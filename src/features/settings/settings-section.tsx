"use client";

import type { ComponentType, ReactNode } from "react";

export function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  id: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)] ring-1 ring-foreground/[0.02] dark:ring-white/[0.04]">
        <div className="border-b border-border bg-gradient-to-br from-primary-muted/40 via-surface-muted/50 to-surface px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex gap-4">
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-primary shadow-sm ring-1 ring-border/60 dark:bg-surface-muted/80"
              aria-hidden
            >
              <Icon className="size-6" />
            </div>
            <div className="min-w-0 pt-0.5">
              <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>
          </div>
        </div>
        <div className="p-5 sm:p-7">{children}</div>
      </div>
    </section>
  );
}
