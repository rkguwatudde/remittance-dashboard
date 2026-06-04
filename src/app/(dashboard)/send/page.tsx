import { redirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Legacy route: all send-money traffic lives under /transfer?tab=send
 */
export default async function SendPage({ searchParams }: { searchParams?: SearchParams }) {
  const sp = (await searchParams) ?? {};
  const params = new URLSearchParams();
  params.set("tab", "send");
  for (const [key, value] of Object.entries(sp)) {
    if (key === "tab") continue;
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else {
      params.set(key, value);
    }
  }
  redirect(`/transfer?${params.toString()}`);
}
