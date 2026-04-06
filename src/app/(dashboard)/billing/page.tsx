import { redirect } from "next/navigation";
import { connection } from "next/server";

export default async function BillingPage() {
  await connection();
  redirect("/org/subscription");
}
