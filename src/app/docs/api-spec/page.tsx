// ---------------------------------------------------------------------------
// OKrunit -- Interactive API Documentation (Swagger UI)
// ---------------------------------------------------------------------------
// Renders the OpenAPI spec using swagger-ui via CDN. No additional npm
// dependency needed.
// ---------------------------------------------------------------------------

import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "API Reference | OKrunit",
  description: "Interactive API documentation for the OKrunit approval gateway.",
};

export default function ApiSpecPage() {
  const specUrl =
    (process.env.NEXT_PUBLIC_APP_URL || "") + "/api/v1/openapi";

  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css"
        />
      </head>
      <body style={{ margin: 0 }}>
        <div id="swagger-ui" />
        <Script
          src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"
          strategy="beforeInteractive"
        />
        <Script
          id="swagger-init"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `
              SwaggerUIBundle({
                url: "${specUrl}",
                dom_id: '#swagger-ui',
                presets: [
                  SwaggerUIBundle.presets.apis,
                  SwaggerUIBundle.SwaggerUIStandalonePreset
                ],
                layout: 'BaseLayout',
                deepLinking: true,
                defaultModelsExpandDepth: 1,
                defaultModelExpandDepth: 2,
              });
            `,
          }}
        />
      </body>
    </html>
  );
}
