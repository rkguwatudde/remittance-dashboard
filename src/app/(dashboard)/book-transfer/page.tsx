import { redirect } from "next/navigation";

/** Legacy route — book transfer is a tab under /transfer */
export default function BookTransferLegacyPage() {
  redirect("/transfer?tab=book");
}
