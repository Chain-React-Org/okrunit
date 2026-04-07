export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "OKrunit",
    url: "https://okrunit.com",
    logo: "https://okrunit.com/logo.png",
    description:
      "Universal approval gateway for AI agents and automation platforms.",
    sameAs: [],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function SoftwareAppJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "OKrunit",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://okrunit.com",
    description:
      "Human-in-the-loop approval gateway for AI agents and automation platforms. One API call pauses execution until a human approves.",
    offers: [
      {
        "@type": "Offer",
        name: "Free",
        price: "0",
        priceCurrency: "USD",
        description:
          "2 connections, 100 approvals/month, 1 team, email notifications",
      },
      {
        "@type": "Offer",
        name: "Pro",
        price: "20",
        priceCurrency: "USD",
        billingIncrement: "P1M",
        description:
          "Unlimited approvals, 15 connections, 5 teams, Slack notifications, rules engine, analytics",
      },
      {
        "@type": "Offer",
        name: "Business",
        price: "60",
        priceCurrency: "USD",
        billingIncrement: "P1M",
        description:
          "Unlimited everything, SSO/SAML, audit log export, multi-step approvals, custom routing",
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function WebsiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "OKrunit",
    url: "https://okrunit.com",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://okrunit.com/?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function FAQJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is OKrunit?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "OKrunit is a human-in-the-loop approval gateway for AI agents and automation platforms. It pauses automated workflows when they need to perform destructive or sensitive actions, notifies the right humans, and resumes execution after approval.",
        },
      },
      {
        "@type": "Question",
        name: "How does OKrunit work?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Your automation makes a single API call to OKrunit when it needs approval. OKrunit notifies the designated approvers via Slack, email, or push notifications. Once approved or rejected, OKrunit sends a webhook callback to your automation to continue or abort.",
        },
      },
      {
        "@type": "Question",
        name: "What platforms does OKrunit integrate with?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "OKrunit integrates with Zapier, Make.com, n8n, Slack, GitHub Actions, Temporal, Prefect, Dagster, Windmill, Pipedream, and any platform that supports REST APIs or webhooks.",
        },
      },
      {
        "@type": "Question",
        name: "Is OKrunit free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, OKrunit has a free tier with 2 connections, 100 approvals per month, and 1 team. The Pro plan at $20/month includes unlimited approvals, 15 connections, 5 teams, Slack notifications, rules engine, and analytics.",
        },
      },
      {
        "@type": "Question",
        name: "Why do AI agents need human approval?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "AI agents can make mistakes or take actions with irreversible consequences, such as deleting data, sending emails, deploying code, or making payments. Human-in-the-loop approval adds a safety layer so destructive actions only execute after a human reviews and approves them.",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; href: string }[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `https://okrunit.com${item.href}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
