import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { CheckoutPage } from "@/components/billing/checkout-page";

export const metadata = {
  title: "Checkout - OKrunit",
  description: "Subscribe to a plan.",
};

export default async function OrgCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; cycle?: string }>;
}) {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership } = ctx;

  if (membership.role !== "owner" && membership.role !== "admin") redirect("/org/overview");

  const params = await searchParams;
  const planId = params.plan;
  const cycle = params.cycle ?? "yearly";

  if (!planId || !["pro", "business"].includes(planId)) {
    redirect("/org/subscription");
  }

  if (!["monthly", "yearly"].includes(cycle)) {
    redirect("/org/subscription");
  }

  return (
    <CheckoutPage
      planId={planId as "pro" | "business"}
      billingCycle={cycle as "monthly" | "yearly"}
    />
  );
}
