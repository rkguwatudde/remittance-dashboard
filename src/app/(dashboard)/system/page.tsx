import { Suspense } from "react";

import { SystemAdminPage } from "@/features/system-admin/system-admin-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SystemAdminPage />
    </Suspense>
  );
}
