// Renders the DhundoNow logo files (transparent PNGs) from the real symbol: stacked, horizontal, horizontal on dark.
// Run:  CHROME=/opt/pw-browsers/chromium node marketing/make-logos.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const mark = "data:image/png;base64," + fs.readFileSync("public/logo-mark.png").toString("base64");
const BLUE = "#0A5BB8", ORANGE = "#FF8A1F";
const page = (w, h, body) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@800&display=swap" rel="stylesheet">
<style>*{margin:0;box-sizing:border-box}html,body{background:transparent}
body{width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;font-family:'Poppins',sans-serif;font-weight:800}
.word{letter-spacing:-.03em;line-height:1;white-space:nowrap}</style></head><body>${body}</body></html>`;

const LOGOS = [
  // stacked: symbol above the word (replaces the old logo-lockup.png)
  ["public/logo-lockup.png", 1200, 900, `<div style="display:flex;flex-direction:column;align-items:center;gap:30px">
     <img src="${mark}" style="width:500px;height:500px">
     <div class="word" style="font-size:175px;color:${BLUE}">Dhundo<span style="color:${ORANGE}">Now</span></div></div>`],
  // horizontal: symbol left, word right (like the app header)
  ["public/logo-horizontal.png", 1500, 420, `<div style="display:flex;align-items:center;gap:36px">
     <img src="${mark}" style="width:340px;height:340px">
     <div class="word" style="font-size:230px;color:${BLUE}">Dhundo<span style="color:${ORANGE}">Now</span></div></div>`],
  // horizontal for dark backgrounds
  ["public/logo-horizontal-white.png", 1500, 420, `<div style="display:flex;align-items:center;gap:36px">
     <div style="width:340px;height:340px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center"><img src="${mark}" style="width:270px;height:270px"></div>
     <div class="word" style="font-size:230px;color:#fff">Dhundo<span style="color:${ORANGE}">Now</span></div></div>`],
];
const ICON = (size, safe) => {   // safe < 1 keeps everything inside the middle of the tile (for maskable icons)
  const k = size / 512 * safe;
  return `<div style="width:${size}px;height:${size}px;background:#054291;display:flex;align-items:center;justify-content:center">
    <div style="display:flex;flex-direction:column;align-items:center;gap:${22*k}px">
      <div style="width:${290*k}px;height:${290*k}px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 ${8*k}px ${24*k}px rgba(0,0,0,.25)"><img src="${mark}" style="width:${206*k}px;height:${206*k}px"></div>
      <div class="word" style="font-size:${76*k}px;color:#fff">Dhundo<span style="color:${ORANGE}">Now</span></div>
    </div></div>`;
};
const ICONS = [["public/icon-512.png", 512, 1], ["public/icon-192.png", 192, 1], ["public/apple-touch-icon.png", 180, 1], ["public/icon-maskable-512.png", 512, 0.78]];
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
for (const [file, w, h, body] of LOGOS) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.setContent(page(w, h, body), { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
  await p.screenshot({ path: file, omitBackground: true });
  console.log("wrote", file); await p.close();
}
for (const [file, size, safe] of ICONS) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(page(size, size, ICON(size, safe)), { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: file }); console.log("wrote", file); await p.close();
}
await b.close();
