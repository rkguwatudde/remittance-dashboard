import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

const MARK_SRC = "/brand/borabond-mark.png";

const markBox = {
  sm: "size-8",
  md: "size-10",
  lg: "size-14",
  xl: "size-16",
} as const;

const markPx = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 64,
} as const;

export type BoraBondLogoSize = keyof typeof markBox;

type BoraBondMarkProps = {
  size?: BoraBondLogoSize;
  className?: string;
  priority?: boolean;
  /** Set empty when the wordmark is already visible next to the mark. */
  alt?: string;
};

/** Folded-B mark on a white plate so it reads on light and dark surfaces. */
export function BoraBondMark({
  size = "md",
  className,
  priority = false,
  alt = "BoraBond",
}: BoraBondMarkProps) {
  const px = markPx[size];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5 dark:ring-white/10",
        markBox[size],
        className,
      )}
    >
      <Image
        src={MARK_SRC}
        alt={alt}
        width={px}
        height={px}
        priority={priority}
        className="size-full object-contain p-[7%]"
      />
    </span>
  );
}

type BoraBondLockupProps = {
  size?: BoraBondLogoSize;
  subtitle?: string | null;
  href?: string | null;
  className?: string;
  stacked?: boolean;
  priority?: boolean;
};

export function BoraBondLockup({
  size = "md",
  subtitle = "Operations",
  href = "/",
  className,
  stacked = false,
  priority = false,
}: BoraBondLockupProps) {
  const title = (
    <p
      className={cn(
        "font-semibold tracking-tight text-foreground",
        stacked ? "text-2xl" : "text-[15px] leading-tight",
      )}
    >
      BoraBond
    </p>
  );
  const caption =
    subtitle == null ? null : (
      <p
        className={cn(
          "text-muted-foreground",
          stacked ? "mt-1 text-sm" : "text-[11px] leading-tight",
        )}
      >
        {subtitle}
      </p>
    );

  const inner = stacked ? (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <BoraBondMark size={size} priority={priority} alt="" />
      <div className="mt-4">
        {title}
        {caption}
      </div>
    </div>
  ) : (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <BoraBondMark size={size} priority={priority} alt="" />
      <div className="min-w-0">
        {title}
        {caption}
      </div>
    </div>
  );

  if (!href) return inner;

  return (
    <Link
      href={href}
      className="rounded-xl outline-offset-4 transition-opacity hover:opacity-90"
      aria-label="BoraBond Operations home"
    >
      {inner}
    </Link>
  );
}
