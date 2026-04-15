import type { Metadata } from "next";
import { DocsImage } from "@/components/docs/docs-image";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Passkeys & Security Keys",
  description: "Register hardware security keys (YubiKey) or biometrics (Touch ID, Face ID) for stronger authentication.",
};

export default function PasskeysPage() {
  return (
    <article>
      <BreadcrumbJsonLd items={[{ name: "Docs", href: "/docs" }, { name: "Passkeys", href: "/docs/passkeys" }]} />

      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Passkeys &amp; Security Keys</h1>
      <p className="mt-4 text-lg text-zinc-600 leading-relaxed">
        Add hardware security keys or biometric authentication for phishing-resistant login.
        Supports YubiKey, Touch ID, Face ID, Windows Hello, and any FIDO2-compatible authenticator.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">What Are Passkeys?</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Passkeys are a modern authentication standard (WebAuthn/FIDO2) that replaces passwords with
        cryptographic key pairs. They&apos;re phishing-resistant because the private key never leaves your device.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Supported Authenticators</h2>
      <ul className="mt-4 list-disc pl-6 space-y-2 text-zinc-600">
        <li><strong>Hardware keys</strong>: YubiKey 5 series, Google Titan, Feitian, SoloKeys</li>
        <li><strong>Biometrics</strong>: Touch ID (Mac), Face ID (iPhone/iPad), Windows Hello (fingerprint/face)</li>
        <li><strong>Platform authenticators</strong>: iCloud Keychain, Google Password Manager, 1Password</li>
      </ul>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Registering a Passkey</h2>
      <ol className="mt-4 list-decimal pl-6 space-y-2 text-zinc-600">
        <li>Go to <strong>Settings → Account</strong></li>
        <li>Scroll to the <strong>Passkeys &amp; Security Keys</strong> section</li>
        <li>Click <strong>Add Passkey</strong></li>
        <li>Enter a <strong>name</strong> for the key (e.g. &quot;YubiKey&quot;, &quot;MacBook Touch ID&quot;)</li>
        <li>Click <strong>Register</strong></li>
        <li>Follow your browser&apos;s prompt: tap your security key, use fingerprint, or confirm with Face ID</li>
        <li>The passkey appears in your registered list</li>
      </ol>

      <DocsImage
        src="/screenshots/docs/account-settings.webp"
        alt="Account settings page showing the Passkeys section with registered security keys and Add Passkey button"
        caption="Manage your passkeys and security keys in Account Settings."
      />

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Managing Passkeys</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        The Passkeys section shows all registered credentials with:
      </p>
      <ul className="mt-3 list-disc pl-6 space-y-1 text-zinc-600">
        <li>Name you gave it</li>
        <li>Device type (Hardware Key or Synced Passkey)</li>
        <li>When it was added</li>
        <li>When it was last used</li>
        <li>Remove button to delete the credential</li>
      </ul>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Browser Support</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        WebAuthn is supported in all modern browsers:
      </p>
      <ul className="mt-3 list-disc pl-6 space-y-1 text-zinc-600">
        <li>Chrome 67+ / Edge 18+</li>
        <li>Safari 14+ / iOS 14+</li>
        <li>Firefox 60+</li>
      </ul>
      <p className="mt-3 text-zinc-600 leading-relaxed">
        If your browser doesn&apos;t support passkeys, you&apos;ll see a message and the Add Passkey button will be hidden.
      </p>
    </article>
  );
}
