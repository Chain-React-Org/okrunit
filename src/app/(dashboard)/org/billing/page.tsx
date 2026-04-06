import { permanentRedirect } from "next/navigation";
import { connection } from "next/server";

export const metadata = {
  title: "Subscription - OKrunit",
  description: "Manage your subscription and billing.",
};

export default async function OrgBillingPage() {
  await connection();
  permanentRedirect("/org/subscription");
}
