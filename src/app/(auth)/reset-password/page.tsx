import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = {
  title: "Reset Password - OKRunit",
  description: "Set a new password for your OKRunit account.",
};

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
