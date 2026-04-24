import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Log In - OKrunit",
  description: "Sign in to your OKrunit account.",
};

// Auth check lives in its own async component so Next 16's cache-components
// can stream the shell first and suspend only the auth lookup. Calling
// getAuthUser() at the top of the page body (outside <Suspense>) trips the
// "Uncached data was accessed outside of <Suspense>" prerender error.
async function LoginGate() {
  const { user } = await getAuthUser();
  if (user) redirect("/org/overview");
  return <LoginForm />;
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginGate />
    </Suspense>
  );
}
