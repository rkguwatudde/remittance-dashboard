import { redirect } from "next/navigation";

/** Legacy route — Cybrid actions moved to /transfers. */
export default function OrchestrationRedirectPage() {
  redirect("/transfers");
}
