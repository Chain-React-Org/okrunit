import Stripe from "stripe";
import { logger } from "@/lib/monitoring/logger";

if (!process.env.STRIPE_SECRET_KEY) {
  logger.warn("STRIPE_SECRET_KEY not set. Billing features disabled.");
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export function getStripeOrThrow(): Stripe {
  if (!stripe) throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
  return stripe;
}
