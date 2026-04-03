import type { Metadata } from "next";
import { Geist, Geist_Mono, DM_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { ClientErrorReporter } from "@/components/client-error-reporter";
import { UTMTracker } from "@/components/tracking/utm-tracker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "OKrunit - Human-in-the-Loop Approval Gateway for AI Agents & Automations",
    template: "%s | OKrunit",
  },
  description:
    "Add human approval to any automation workflow. OKrunit pauses AI agents, Zapier zaps, Make scenarios, and n8n workflows until a human approves. One API call. Approve from Slack, email, or dashboard.",
  keywords: [
    "human-in-the-loop",
    "approval gateway",
    "AI agent approval",
    "automation approval",
    "Zapier approval",
    "Make.com approval",
    "n8n approval",
    "workflow approval",
    "human approval API",
    "AI safety",
    "destructive action prevention",
  ],
  metadataBase: new URL("https://okrunit.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "OKrunit - Human Approval for Every Automation",
    description:
      "Add human approval to any automation workflow. One API call pauses execution until a human approves. Works with Zapier, Make, n8n, Slack, and any REST API.",
    url: "https://okrunit.com",
    siteName: "OKrunit",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OKrunit - Human Approval for Every Automation",
    description:
      "Add human approval to any automation workflow. One API call pauses execution until a human approves.",
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "OKrunit",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${dmSans.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <ClientErrorReporter />
          <UTMTracker />
        </ThemeProvider>
      </body>
    </html>
  );
}
