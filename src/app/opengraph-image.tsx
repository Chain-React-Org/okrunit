import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt =
  "OKrunit - AI Moves Fast. You Stay in Control. Human approval for every automation.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  const imageData = await readFile(
    join(process.cwd(), "public", "og-card.png")
  );
  const imageSrc = `data:image/png;base64,${imageData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#0a0a0a",
        }}
      >
        <img
          src={imageSrc}
          width={1200}
          height={630}
          style={{ objectFit: "cover" }}
        />
      </div>
    ),
    { ...size }
  );
}
