import sharp from "sharp";
import path from "path";

const WIDTH = 1500;
const HEIGHT = 500;

// Build SVG that matches app theme: green header gradient, clean white areas, dark text
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="headerGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#1b5e20"/>
      <stop offset="50%" stop-color="#2e7d32"/>
      <stop offset="100%" stop-color="#388e3c"/>
    </linearGradient>
    <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8faf8"/>
    </linearGradient>
    <filter id="cardShadow" x="-5%" y="-5%" width="110%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="8" flood-color="rgba(0,0,0,0.08)"/>
    </filter>
    <filter id="softShadow" x="-5%" y="-5%" width="110%" height="120%">
      <feDropShadow dx="0" dy="1" stdDeviation="3" flood-color="rgba(0,0,0,0.12)"/>
    </filter>
  </defs>

  <!-- White background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#f5f7f5"/>

  <!-- Green header bar (matches app) -->
  <rect width="${WIDTH}" height="72" fill="url(#headerGrad)"/>

  <!-- Header text -->
  <text x="90" y="44" fill="white" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="20" font-weight="600" letter-spacing="-0.3">okrunit</text>

  <!-- Header nav items (subtle, like the real app) -->
  <text x="${WIDTH - 400}" y="44" fill="rgba(255,255,255,0.7)" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="14" font-weight="500">Overview</text>
  <text x="${WIDTH - 310}" y="44" fill="rgba(255,255,255,0.7)" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="14" font-weight="500">Requests</text>
  <text x="${WIDTH - 220}" y="44" fill="rgba(255,255,255,0.7)" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="14" font-weight="500">Playground</text>
  <text x="${WIDTH - 120}" y="44" fill="rgba(255,255,255,0.7)" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="14" font-weight="500">Settings</text>

  <!-- Main content area -->
  <!-- Left side: tagline and CTA -->
  <g transform="translate(90, 120)">
    <text fill="#1b5e20" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="14" font-weight="600" letter-spacing="1.5" text-transform="uppercase">HUMAN-IN-THE-LOOP APPROVALS</text>

    <text y="50" fill="#1a1a2e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="38" font-weight="700" letter-spacing="-1.2">The approval gateway for</text>
    <text y="92" fill="#1a1a2e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="38" font-weight="700" letter-spacing="-1.2">your automations and</text>
    <text y="134" fill="#1a1a2e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="38" font-weight="700" letter-spacing="-1.2">AI agents.</text>

    <text y="175" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="16" font-weight="400">Route high-risk actions through a human approval</text>
    <text y="197" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="16" font-weight="400">queue before they execute.</text>

    <!-- CTA button -->
    <rect y="220" width="160" height="44" rx="10" fill="#1b5e20"/>
    <text x="80" y="248" text-anchor="middle" fill="white" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="15" font-weight="600">Start Free</text>

    <!-- Integration logos row -->
    <g transform="translate(0, 290)">
      <text fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="500">Works with</text>
      <g transform="translate(80, -10)">
        <rect width="60" height="26" rx="6" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1"/>
        <text x="30" y="17" text-anchor="middle" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">Zapier</text>
      </g>
      <g transform="translate(150, -10)">
        <rect width="55" height="26" rx="6" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1"/>
        <text x="28" y="17" text-anchor="middle" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">Make</text>
      </g>
      <g transform="translate(215, -10)">
        <rect width="45" height="26" rx="6" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1"/>
        <text x="23" y="17" text-anchor="middle" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">n8n</text>
      </g>
      <g transform="translate(270, -10)">
        <rect width="65" height="26" rx="6" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1"/>
        <text x="33" y="17" text-anchor="middle" fill="#475569" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">Any API</text>
      </g>
    </g>
  </g>

  <!-- Right side: approval request cards (like the app dashboard) -->
  <g transform="translate(750, 95)">
    <!-- Card 1: Pending -->
    <g filter="url(#cardShadow)">
      <rect width="640" height="80" rx="12" fill="url(#cardGrad)" stroke="#e5e7eb" stroke-width="1"/>
      <!-- Source icon circle -->
      <circle cx="40" cy="40" r="18" fill="#ff6d00" opacity="0.15"/>
      <text x="40" y="45" text-anchor="middle" fill="#ff6d00" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="16" font-weight="700">Z</text>
      <!-- Request text -->
      <text x="70" y="30" fill="#1a1a2e" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="14" font-weight="600">Deploy staging to production</text>
      <text x="70" y="50" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12">Zapier  ·  Alex Johnson  ·  2 min ago</text>
      <!-- Status badge -->
      <rect x="440" y="22" width="72" height="26" rx="13" fill="#fef3c7"/>
      <text x="476" y="40" text-anchor="middle" fill="#d97706" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">Pending</text>
      <!-- Priority -->
      <rect x="520" y="22" width="50" height="26" rx="13" fill="#fee2e2"/>
      <text x="545" y="40" text-anchor="middle" fill="#dc2626" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">High</text>
      <!-- Approve/Reject buttons -->
      <rect x="580" y="22" width="24" height="26" rx="6" fill="#dcfce7"/>
      <text x="592" y="40" text-anchor="middle" fill="#16a34a" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="14">&#10003;</text>
      <rect x="608" y="22" width="24" height="26" rx="6" fill="#fee2e2"/>
      <text x="620" y="40" text-anchor="middle" fill="#dc2626" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="14">&#10005;</text>
    </g>

    <!-- Card 2: Pending -->
    <g transform="translate(0, 95)" filter="url(#cardShadow)">
      <rect width="640" height="80" rx="12" fill="url(#cardGrad)" stroke="#e5e7eb" stroke-width="1"/>
      <circle cx="40" cy="40" r="18" fill="#9c27b0" opacity="0.15"/>
      <text x="40" y="45" text-anchor="middle" fill="#9c27b0" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="16" font-weight="700">M</text>
      <text x="70" y="30" fill="#1a1a2e" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="14" font-weight="600">Update billing address for OKrunit</text>
      <text x="70" y="50" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12">Make  ·  Sarah Chen  ·  5 min ago</text>
      <rect x="440" y="22" width="72" height="26" rx="13" fill="#fef3c7"/>
      <text x="476" y="40" text-anchor="middle" fill="#d97706" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">Pending</text>
      <rect x="520" y="22" width="60" height="26" rx="13" fill="#dbeafe"/>
      <text x="550" y="40" text-anchor="middle" fill="#2563eb" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">Medium</text>
      <rect x="588" y="22" width="24" height="26" rx="6" fill="#dcfce7"/>
      <text x="600" y="40" text-anchor="middle" fill="#16a34a" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="14">&#10003;</text>
      <rect x="616" y="22" width="24" height="26" rx="6" fill="#fee2e2"/>
      <text x="628" y="40" text-anchor="middle" fill="#dc2626" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="14">&#10005;</text>
    </g>

    <!-- Card 3: Approved -->
    <g transform="translate(0, 190)" filter="url(#cardShadow)">
      <rect width="640" height="80" rx="12" fill="url(#cardGrad)" stroke="#e5e7eb" stroke-width="1"/>
      <circle cx="40" cy="40" r="18" fill="#e91e63" opacity="0.15"/>
      <text x="40" y="45" text-anchor="middle" fill="#e91e63" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="16" font-weight="700">n</text>
      <text x="70" y="30" fill="#1a1a2e" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="14" font-weight="600">Send bulk email campaign</text>
      <text x="70" y="50" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12">n8n  ·  Alex Johnson  ·  12 min ago</text>
      <rect x="440" y="22" width="78" height="26" rx="13" fill="#dcfce7"/>
      <text x="479" y="40" text-anchor="middle" fill="#16a34a" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">Approved</text>
      <rect x="526" y="22" width="50" height="26" rx="13" fill="#f1f5f9"/>
      <text x="551" y="40" text-anchor="middle" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">Low</text>
    </g>

    <!-- Card 4: Rejected (partially visible) -->
    <g transform="translate(0, 285)" filter="url(#cardShadow)">
      <rect width="640" height="80" rx="12" fill="url(#cardGrad)" stroke="#e5e7eb" stroke-width="1"/>
      <circle cx="40" cy="40" r="18" fill="#ff6d00" opacity="0.15"/>
      <text x="40" y="45" text-anchor="middle" fill="#ff6d00" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="16" font-weight="700">Z</text>
      <text x="70" y="30" fill="#1a1a2e" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="14" font-weight="600">Delete all user records from staging</text>
      <text x="70" y="50" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12">Zapier  ·  Mike Roberts  ·  18 min ago</text>
      <rect x="440" y="22" width="72" height="26" rx="13" fill="#fee2e2"/>
      <text x="476" y="40" text-anchor="middle" fill="#dc2626" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">Rejected</text>
      <rect x="520" y="22" width="60" height="26" rx="13" fill="#fee2e2"/>
      <text x="550" y="40" text-anchor="middle" fill="#dc2626" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">Critical</text>
    </g>
  </g>

  <!-- Fade overlay at bottom of cards -->
  <defs>
    <linearGradient id="fadeBottom" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f5f7f5" stop-opacity="0"/>
      <stop offset="100%" stop-color="#f5f7f5" stop-opacity="1"/>
    </linearGradient>
  </defs>
  <rect x="750" y="420" width="660" height="80" fill="url(#fadeBottom)"/>

  <!-- okrunit.com watermark -->
  <text x="${WIDTH - 50}" y="${HEIGHT - 15}" text-anchor="end" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13" font-weight="500">okrunit.com</text>
</svg>`;

async function main() {
  const outDir = path.resolve("public/banners");

  // Composite: render the SVG, then overlay the logo PNG
  const logoPng = await sharp(path.resolve("public/logo-icon.png"))
    .resize(48, 48, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // White version of logo for header
  const logoWhite = await sharp(path.resolve("public/logo-icon.png"))
    .resize(36, 36, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const svgBuffer = Buffer.from(svg);

  await sharp(svgBuffer)
    .resize(WIDTH, HEIGHT)
    .composite([
      // Logo in header bar
      { input: logoWhite, left: 42, top: 18 },
    ])
    .png()
    .toFile(path.join(outDir, "twitter-banner.png"));

  console.log("Generated twitter-banner.png");

  // Also save the SVG
  const fs = await import("fs");
  fs.writeFileSync(path.join(outDir, "twitter-banner.svg"), svg);
  console.log("Generated twitter-banner.svg");
}

main().catch(console.error);
