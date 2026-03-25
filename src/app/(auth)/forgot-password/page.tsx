import { Suspense } from "react";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = {
  title: "Forgot Password - OKRunit",
  description: "Reset your OKRunit account password.",
};

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
