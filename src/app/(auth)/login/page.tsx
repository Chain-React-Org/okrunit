import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Log In - OKrunit",
  description: "Sign in to your OKrunit account.",
};

export default async function LoginPage() {
  // If the user is already signed in, don't show the login form — send
  // them to the dashboard. Matches the mfa-verify / setup redirect pattern.
  const { user } = await getAuthUser();
  if (user) redirect("/org/overview");

  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
