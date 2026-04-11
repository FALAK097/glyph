import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const changelogPath = resolve(__dirname, "../../../CHANGELOG.md");
const changelogStr = readFileSync(changelogPath, "utf-8");

const releases = [];
let currentRelease = null;

for (const line of changelogStr.split("\n")) {
  if (line.startsWith("## ")) {
    let versionStr = line.replace("## ", "").trim();
    let version = versionStr;
    let date = new Date().toISOString().split("T")[0];

    const match = line.match(/\[([^\]]+)\](?:\(([^)]+)\))?\s*(?:\(([^)]+)\))?/);
    if (match) {
      version = match[1];
      date = match[3] || match[2] || date;
    } else {
      const parts = versionStr.split(" (");
      version = parts[0].trim();
      if (parts[1]) {
        date = parts[1].replace(")", "").trim();
      }
    }

    // Clean up version and date
    version = version.replace(/^v/, "");
    date = date.replace(/.*\//, "").trim(); // if it captured a URL by mistake
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      date = new Date().toISOString().split("T")[0];
    }

    const pubDate = new Date(`${date}T00:00:00Z`).toUTCString();

    currentRelease = {
      version,
      pubDate,
      content: "",
    };
    releases.push(currentRelease);
  } else if (currentRelease) {
    currentRelease.content += line + "\n";
  }
}

let rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Glyph Changelog</title>
    <link>https://glyph.falakgala.dev/changelog/</link>
    <description>Recent releases and updates for Glyph</description>
    <atom:link href="https://glyph.falakgala.dev/rss.xml" rel="self" type="application/rss+xml"/>
`;

for (const release of releases) {
  const htmlContent = release.content.trim();

  rssContent += `    <item>
      <title>Glyph v${release.version}</title>
      <link>https://glyph.falakgala.dev/changelog/</link>
      <pubDate>${release.pubDate}</pubDate>
      <guid>https://glyph.falakgala.dev/changelog/#v${release.version}</guid>
      <description><![CDATA[${htmlContent}]]></description>
    </item>
`;
}

rssContent += `  </channel>\n</rss>\n`;

writeFileSync(resolve(__dirname, "../public/rss.xml"), rssContent);
console.log("Generated rss.xml");
