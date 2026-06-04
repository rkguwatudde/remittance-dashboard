import { redirect } from "next/navigation";

/** Legacy route — trade & transfer is a tab under /transfer */
export default function TradeAndTransferLegacyPage() {
  redirect("/transfer?tab=trade");
}
