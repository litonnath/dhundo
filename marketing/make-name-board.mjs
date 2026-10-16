// Renders a comparison board of candidate app names in the DhundoNow logo style.
// Run:  CHROME=/opt/pw-browsers/chromium node marketing/make-name-board.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const logo = "data:image/png;base64," + fs.readFileSync("public/logo-mark.png").toString("base64");
// name, last letter(s) in orange, hindi, bengali, english tagline
const NAMES = [
  ["Khojo",   "o",  "खोजो",    "খোঁজো",    "Search. Find. Done."],
  ["Haazir",  "ir", "हाज़िर",   "হাজির",    "Everything, at your service."],
  ["Bulao",   "ao", "बुलाओ",   "বুলাও",    "Call a worker. Call a ride."],
  ["Aaspaas", "paas","आसपास",  "আশেপাশে",  "Everything around you."],
  ["EkTap",   "Tap","एक टैप",  "এক ট্যাপ", "One tap. Everything near you."],
  ["Paaslo",  "lo", "पास लो",   "পাশ লো",   "Take what is near you."],
  ["JhatPat", "Pat","झटपट",    "ঝটপট",     "Right away."],
  ["Karao",   "ao", "कराओ",    "করাও",     "Get any job done."],
];
const card = ([n, tail, hi, bn, en]) => {
  const head = n.slice(0, n.length - tail.length), t = n.slice(n.length - tail.length);
  return `<div class="card">
    <div class="row"><img src="${logo}"><div class="word">${head}<span>${t}</span></div></div>
    <div class="dev">${hi} &nbsp;·&nbsp; ${bn}</div>
    <div class="tag">${en}</div>
    <div class="pill"><b>${n}</b></div>
  </div>`;
};
const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@600;800&family=Noto+Sans+Devanagari:wght@600;800&family=Poppins:wght@500;600;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0}
body{width:1600px;background:#F4F7FC;font-family:'Poppins','Noto Sans','Noto Sans Devanagari','Noto Sans Bengali',sans-serif;padding:56px}
h1{font-size:40px;font-weight:800;color:#032C61;margin-bottom:6px}
.sub{font-size:20px;color:#4B6A94;margin-bottom:36px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:28px}
.card{background:#fff;border:2px solid #D6E3F5;border-radius:28px;padding:34px 38px}
.row{display:flex;align-items:center;gap:22px}
.row img{width:96px;height:96px;object-fit:contain}
.word{font-size:84px;font-weight:800;color:#0A5BB8;letter-spacing:-2px;line-height:1}
.word span{color:#FF8A1F}
.dev{margin-top:20px;font-size:34px;font-weight:800;color:#032C61}
.tag{margin-top:6px;font-size:24px;color:#4B6A94;font-weight:600}
.pill{display:none}
</style></head><body>
<h1>Name board</h1><div class="sub">Each name in the DhundoNow logo style, with its Hindi and Bengali spelling and a tagline. Search the IP India trademark site, Google Play and domains before choosing.</div>
<div class="grid">${NAMES.map(card).join("")}</div></body></html>`;
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
await p.setContent(html, { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
await p.screenshot({ path: "marketing/names/name-board.png", fullPage: true });
await b.close(); console.log("wrote marketing/names/name-board.png");
