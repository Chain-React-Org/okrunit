import { redirect } from "next/navigation";

export const metadata = {
  title: "Subscription - OKRunit",
  description: "Manage your subscription and billing.",
};

export default function OrgBillingPage() {
  redirect("/org/subscription");
}
