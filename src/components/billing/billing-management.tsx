"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Plus, RefreshCw, Trash2, Shield, ExternalLink, Check, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/lib/types/database";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StripeProvider } from "./stripe-provider";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

/* ------------------------------------------------------------------ */
/*  Add Card Form                                                      */
/* ------------------------------------------------------------------ */

function AddCardForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    const result = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (result.error) {
      toast.error(result.error.message ?? "Failed to add card");
      setProcessing(false);
      return;
    }

    // Set as default if it's the first card
    const pmId = result.setupIntent?.payment_method;
    if (pmId && typeof pmId === "string") {
      await fetch("/api/v1/billing/payment-methods", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method_id: pmId }),
      });
    }

    toast.success("Card added successfully");
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!stripe || processing}>
          {processing ? "Adding..." : "Add card"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={processing}>
          Cancel
        </Button>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Shield className="size-3" />
        Secured by Stripe. Your card details never touch our servers.
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Payment Methods Section                                            */
/* ------------------------------------------------------------------ */

function PaymentMethodsSection({ isAdmin }: { isAdmin: boolean }) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  const fetchMethods = useCallback(async () => {
    const res = await fetch("/api/v1/billing/payment-methods");
    const data = await res.json();
    setMethods(data.paymentMethods ?? []);
    setDefaultId(data.defaultPaymentMethodId ?? null);
    setLoaded(true);
  }, []);

  useEffect(() => { fetchMethods(); }, [fetchMethods]);

  const handleStartAdd = async () => {
    const res = await fetch("/api/v1/billing/setup-intent", { method: "POST" });
    const data = await res.json();
    if (data.clientSecret) {
      setSetupSecret(data.clientSecret);
      setShowAddForm(true);
    } else {
      toast.error(data.error ?? "Failed to start card setup");
    }
  };

  const handleAddSuccess = () => {
    setShowAddForm(false);
    setSetupSecret(null);
    fetchMethods();
  };

  const handleSetDefault = async (pmId: string) => {
    setSettingDefaultId(pmId);
    try {
      const res = await fetch("/api/v1/billing/payment-methods", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method_id: pmId }),
      });
      if (res.ok) {
        toast.success("Default payment method updated");
        setDefaultId(pmId);
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to update default");
      }
    } catch { toast.error("Failed to update default"); }
    finally { setSettingDefaultId(null); }
  };

  const handleRemove = async (pmId: string) => {
    setRemovingId(null);
    try {
      const res = await fetch("/api/v1/billing/payment-methods", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method_id: pmId }),
      });
      if (res.ok) {
        toast.success("Card removed");
        fetchMethods();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to remove card");
      }
    } catch { toast.error("Failed to remove card"); }
  };

  if (!loaded) {
    return (
      <div className="rounded-lg border bg-white dark:bg-card p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          Loading payment methods...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Payment Methods</h3>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={handleStartAdd} className="text-xs gap-1.5">
            <Plus className="size-3.5" />
            Add card
          </Button>
        )}
      </div>

      {showAddForm && setupSecret && (
        <div className="rounded-lg border bg-white dark:bg-card p-5">
          <StripeProvider clientSecret={setupSecret}>
            <AddCardForm onSuccess={handleAddSuccess} onCancel={() => { setShowAddForm(false); setSetupSecret(null); }} />
          </StripeProvider>
        </div>
      )}

      {methods.length === 0 ? (
        <div className="rounded-lg border bg-white dark:bg-card p-6 text-center text-sm text-muted-foreground">
          No payment methods on file.
        </div>
      ) : (
        <div className="divide-y rounded-lg border bg-white dark:bg-card">
          {methods.map((method) => {
            const isDefault = method.id === defaultId;
            return (
              <div key={method.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
                <div className="flex items-center gap-3">
                  <CreditCard className="size-5 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize">{method.brand}</span>
                      <span className="text-sm text-muted-foreground">ending in {method.last4}</span>
                      {isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Expires {String(method.expMonth).padStart(2, "0")}/{method.expYear}
                    </span>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    {!isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs gap-1.5"
                        onClick={() => handleSetDefault(method.id)}
                        disabled={settingDefaultId === method.id}
                      >
                        <Check className="size-3.5" />
                        {settingDefaultId === method.id ? "Setting..." : "Set default"}
                      </Button>
                    )}
                    {!isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs gap-1.5 text-destructive hover:text-destructive"
                        onClick={() => setRemovingId(method.id)}
                      >
                        <Trash2 className="size-3.5" />
                        Remove
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Remove card confirmation */}
      <AlertDialog open={!!removingId} onOpenChange={(open) => !open && setRemovingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove payment method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this card? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => removingId && handleRemove(removingId)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Invoice History Section                                            */
/* ------------------------------------------------------------------ */

function InvoiceSection({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Invoice History</h3>
        <div className="rounded-lg border bg-white dark:bg-card p-6 text-center text-sm text-muted-foreground">
          No invoices yet. Your invoice history will appear here.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Invoice History</h3>
      <div className="overflow-x-auto rounded-lg border bg-white dark:bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3 whitespace-nowrap">
                  {new Date(inv.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={inv.status === "paid" ? "default" : "secondary"}
                    className={cn(
                      "text-xs",
                      inv.status === "paid" && "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
                    )}
                  >
                    {inv.status === "paid" ? "Paid" : inv.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  Subscription payment
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">
                  ${(inv.amount_cents / 100).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">
                  {inv.hosted_invoice_url && (
                    <Button variant="ghost" size="sm" asChild className="text-xs gap-1">
                      <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                        View <ExternalLink className="size-3" />
                      </a>
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Billing Management Page                                       */
/* ------------------------------------------------------------------ */

interface BillingManagementProps {
  invoices: Invoice[];
  isAdmin: boolean;
}

export function BillingManagement({ invoices, isAdmin }: BillingManagementProps) {
  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/org/subscription"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to subscription
        </Link>
        <h2 className="text-lg font-semibold tracking-tight">Manage Billing</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your payment methods and view invoices.
        </p>
      </div>

      <PaymentMethodsSection isAdmin={isAdmin} />
      <InvoiceSection invoices={invoices} />
    </div>
  );
}
