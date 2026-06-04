import { redirect } from "next/navigation";

/** Legacy route — Transfer tab under /transfer (Transfers hub) */
export default function TransfersLegacyPage() {
  redirect("/transfer?tab=cybrid");
}
