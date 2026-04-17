import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service - OKrunit",
  description: "Terms of Service for OKrunit, the human-in-the-loop approval gateway.",
  alternates: { canonical: "https://okrunit.com/terms" },
};

export default function TermsOfServicePage() {
  return (
    <div>
      <div className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Terms of Service</h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: March 30, 2026</p>
      </div>

      <div className="prose prose-zinc max-w-none prose-headings:font-semibold prose-a:text-primary">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using OKrunit (&quot;the Service&quot;), operated by OKrunit (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;),
            you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            OKrunit is a human-in-the-loop approval gateway that allows users to add human approval
            checkpoints to automated workflows. The Service includes a web dashboard, REST API,
            OAuth integrations, and notification delivery.
          </p>

          <h2>3. Account Registration</h2>
          <p>
            You must provide accurate information when creating an account. You are responsible for
            maintaining the security of your account credentials and for all activity under your account.
          </p>

          <h2>4. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any illegal purpose</li>
            <li>Attempt to access other users&apos; data without authorization</li>
            <li>Interfere with or disrupt the Service infrastructure</li>
            <li>Exceed published rate limits or abuse the API</li>
            <li>Resell or redistribute the Service without permission</li>
          </ul>

          <h2>5. Data and Privacy</h2>
          <p>
            Your use of the Service is also governed by our{" "}
            <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            You retain ownership of all data you submit to the Service. We process your data only
            to provide and improve the Service.
          </p>

          <h2>6. Service Availability</h2>
          <p>
            We strive for high availability but do not guarantee uninterrupted service. We may
            perform maintenance that temporarily affects availability. Enterprise customers may
            negotiate specific SLA terms.
          </p>

          <h2>7. Payment and Billing</h2>
          <p>
            Paid plans are billed monthly or annually via Stripe. You may cancel at any time.
            Refunds are not provided for partial billing periods. Free tier usage is subject to
            published limits.
          </p>

          <h2>8. Intellectual Property</h2>
          <p>
            The Service, including all software, design, and documentation, is owned by OKrunit.
            You are granted a limited, non-exclusive license to use the Service for its intended purpose.
          </p>

          <h2>9. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, OKrunit shall not be liable for any indirect,
            incidental, special, or consequential damages arising from your use of the Service,
            including but not limited to lost profits, data loss, or business interruption.
          </p>

          <h2>10. Termination</h2>
          <p>
            We may suspend or terminate your account if you violate these terms. You may delete
            your account at any time from the account settings page. Upon termination, your data
            will be deleted according to our data retention policy.
          </p>

          <h2>11. Changes to Terms</h2>
          <p>
            We may update these terms from time to time. Material changes will be communicated
            via email or in-app notification. Continued use after changes constitutes acceptance.
          </p>

          <h2>12. Governing Law</h2>
          <p>
            OKrunit is operated from the United States. These terms are governed by the laws of
            the State of Washington, United States, without regard to conflict of law principles.
          </p>

          <h2>13. Contact</h2>
          <p>
            For questions about these terms, contact us at{" "}
            <a href="mailto:support@okrunit.com" className="text-primary hover:underline">
              support@okrunit.com
            </a>.
          </p>
      </div>
    </div>
  );
}
