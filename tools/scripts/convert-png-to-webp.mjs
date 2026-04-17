import sharp from "sharp";
import fs from "fs";
import path from "path";

const publicDir = "public";

// Files safe to convert. Excludes:
// - icon-192.png, icon-512.png (PWA manifest requires image/png)
// - og-image.png, og-card.png, Open Graph - OKrunit.png (social crawlers need PNG)
// - make_temp.png (109 bytes, placeholder)
const filesToConvert = [
  "logo.png",
  "logo-icon.png",
  "logo_text.png",
  "logo_text_white.png",
  "okrunit logo.png",
  "zapier-icon.png",
  "zapier-icon-v2.png",
  "banners/twitter-banner.png",
  "logos/platforms/n8n.png",
  "logos/platforms/resend.png",
  "logos/platforms/telegram.png",
  "logos/platforms/make.png",
  "logos/platforms/zapier.png",
  "logos/platforms/windmill.png",
  "logos/platforms/github.png",
  "logos/platforms/temporal.png",
  "logos/platforms/dagster.png",
  "logos/platforms/slack.png",
  "logos/platforms/discord.png",
  "logos/platforms/pipedream.png",
  "logos/platforms/prefect.png",
  "logos/platforms/monday.png",
  "logos/platforms/teams.png",
];

async function convert() {
  let totalOld = 0;
  let totalNew = 0;
  for (const file of filesToConvert) {
    const src = path.join(publicDir, file);
    const dest = src.replace(/\.png$/, ".webp");
    if (!fs.existsSync(src)) {
      console.log("SKIP (not found): " + src);
      continue;
    }
    const oldSize = fs.statSync(src).size;
    await sharp(src).webp({ quality: 90 }).toFile(dest);
    const newSize = fs.statSync(dest).size;
    totalOld += oldSize;
    totalNew += newSize;
    const pctSmaller = ((1 - newSize / oldSize) * 100).toFixed(0);
    console.log(
      file +
        ": " +
        (oldSize / 1024).toFixed(1) +
        "K -> " +
        (newSize / 1024).toFixed(1) +
        "K (" +
        pctSmaller +
        "% smaller)"
    );
  }
  console.log("");
  const totalPct = ((1 - totalNew / totalOld) * 100).toFixed(0);
  console.log(
    "Total: " +
      (totalOld / 1024).toFixed(1) +
      "K -> " +
      (totalNew / 1024).toFixed(1) +
      "K (" +
      totalPct +
      "% smaller)"
  );
}

convert().catch((e) => {
  console.error(e);
  process.exit(1);
});
