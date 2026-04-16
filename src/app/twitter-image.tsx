import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt =
  "OKrunit - Human-in-the-loop approval gateway for AI agents and automations";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function TwitterImage() {
  const logoData = await readFile(
    join(process.cwd(), "public", "logo.png")
  );
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #f8faf8 0%, #e8f5e9 50%, #f0f4f0 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Logo */}
        <img
          src={logoSrc}
          width={180}
          height={180}
          style={{ marginBottom: 24 }}
        />

        {/* Title */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: "#1a2e1a",
            letterSpacing: "-0.02em",
            marginBottom: 16,
          }}
        >
          OKrunit
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 26,
            fontWeight: 500,
            color: "#4a6a4a",
            textAlign: "center",
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          Human-in-the-loop approval gateway
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 400,
            color: "#6a8a6a",
            textAlign: "center",
            maxWidth: 800,
            marginTop: 8,
          }}
        >
          for AI agents and automations
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            background: "linear-gradient(90deg, #2e7d32, #66bb6a)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
