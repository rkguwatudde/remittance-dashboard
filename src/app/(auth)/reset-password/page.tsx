import { Suspense } from "react";
import { ResetPasswordPage } from "@/features/auth/reset-password-page";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
          Loading…
        </div>
      }
    >
      <ResetPasswordPage />
    </Suspense>
  );
}
