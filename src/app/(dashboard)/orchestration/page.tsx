import { redirect } from "next/navigation";

/** Legacy route — Cybrid actions under Transfers → Transfer tab. */
export default function OrchestrationRedirectPage() {
  redirect("/transfer?tab=cybrid");
}
