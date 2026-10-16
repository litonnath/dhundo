// Renders the DhundoNow marketing banners (English, Bengali, Hindi) to PNG.
// Run from the project folder:  node marketing/make-banners.mjs
import { chromium } from "playwright";
import fs from "node:fs"; import path from "node:path";

const W = 1080, H = 1350;
const logo = "data:image/png;base64," + fs.readFileSync("public/logo-mark.png").toString("base64");
const URL_TXT = "dhundonow.shortlistone.com";

const B = {
  find: {
    icons: ["🔨", "🚗", "🍛", "🔧"], theme: "blue",
    en: { h: "Need a mistri, driver or cook? <em>Find them near you.</em>", s: "Trusted local workers. See rates. Call or book in minutes.", cta: "Open DhundoNow" },
    bn: { h: "মিস্ত্রি, ড্রাইভার বা রান্নার লোক দরকার? <em>কাছেই খুঁজে নিন।</em>", s: "ভরসাযোগ্য স্থানীয় কর্মী। রেট দেখুন। কয়েক মিনিটে কল বা বুক করুন।", cta: "DhundoNow খুলুন" },
    hi: { h: "मिस्त्री, ड्राइवर या कुक चाहिए? <em>अपने पास ही खोजें।</em>", s: "भरोसेमंद स्थानीय कारीगर। रेट देखें। कुछ ही मिनट में कॉल या बुक करें।", cta: "DhundoNow खोलें" },
  },
  more: {
    icons: ["🛵", "🍕", "🚕", "📦"], theme: "orange",
    en: { h: "Food, rides and more — <em>in one app.</em>", s: "Order from nearby shops. Book a bike, auto or cab. Buy and sell second-hand. Your money stays safe until the work is done.", cta: "Open DhundoNow" },
    bn: { h: "খাবার, রাইড আর আরও অনেক কিছু — <em>একটাই অ্যাপে।</em>", s: "কাছের দোকান থেকে অর্ডার করুন। বাইক, অটো বা ক্যাব বুক করুন। পুরনো জিনিস কিনুন-বেচুন। কাজ শেষ না হওয়া পর্যন্ত আপনার টাকা নিরাপদ।", cta: "DhundoNow খুলুন" },
    hi: { h: "खाना, राइड और भी बहुत कुछ — <em>एक ही ऐप में।</em>", s: "पास की दुकानों से ऑर्डर करें। बाइक, ऑटो या कैब बुक करें। पुराना सामान खरीदें-बेचें। काम पूरा होने तक आपका पैसा सुरक्षित।", cta: "DhundoNow खोलें" },
  },
  earn: {
    icons: ["🛠️", "🏪", "🛺", "💰"], theme: "dark",
    en: { h: "Got a skill, a shop or a vehicle? <em>Earn with DhundoNow.</em>", s: "List yourself, get requests nearby, and withdraw your earnings to UPI or your bank.", cta: "Start earning" },
    bn: { h: "দক্ষতা, দোকান বা গাড়ি আছে? <em>DhundoNow-তে আয় করুন।</em>", s: "নিজেকে লিস্ট করুন, কাছের অনুরোধ পান, আর আয় তুলুন UPI বা ব্যাংকে।", cta: "আয় শুরু করুন" },
    hi: { h: "हुनर, दुकान या गाड़ी है? <em>DhundoNow पर कमाएँ।</em>", s: "खुद को लिस्ट करें, पास के अनुरोध पाएँ और कमाई UPI या बैंक में निकालें।", cta: "कमाई शुरू करें" },
  },
};
B.pooja = {
  icons: ["🪔", "🚕", "🍛", "🎉"], theme: "festival",
  en: { h: "Shubho Pujo! <em>Everything for your Puja, near you.</em>", s: "Book a ride to the pandal, order festive food, find decorators and caterers.", cta: "Open DhundoNow" },
  bn: { h: "শুভ পুজো! <em>পুজোর সব কিছু, কাছেই।</em>", s: "প্যান্ডেলে যেতে রাইড বুক করুন, পুজোর খাবার অর্ডার করুন, ডেকোরেটর ও ক্যাটারার খুঁজুন।", cta: "DhundoNow খুলুন" },
  hi: { h: "शुभो पूजो! <em>पूजा की हर चीज़, आपके पास।</em>", s: "पंडाल जाने के लिए राइड बुक करें, त्योहार का खाना ऑर्डर करें, डेकोरेटर और केटरर खोजें।", cta: "DhundoNow खोलें" },
};
const THEMES = {
  festival: { bg: "linear-gradient(160deg,#B3122B 0%,#6B0A1A 100%)", accent: "#FFC247", ink: "#fff", soft: "rgba(255,255,255,.92)", btn: "#FFC247", btnInk: "#6B0A1A", frame: true },
  blue:   { bg: "linear-gradient(160deg,#0A5BB8 0%,#032C61 100%)", accent: "#FF8A1F", ink: "#fff", soft: "rgba(255,255,255,.88)", btn: "#FF8A1F", btnInk: "#fff" },
  orange: { bg: "linear-gradient(160deg,#FF8A1F 0%,#E0600A 100%)", accent: "#032C61", ink: "#fff", soft: "rgba(255,255,255,.95)", btn: "#032C61", btnInk: "#fff" },
  dark:   { bg: "linear-gradient(160deg,#032C61 0%,#0A5BB8 100%)", accent: "#FFC247", ink: "#fff", soft: "rgba(255,255,255,.88)", btn: "#FFC247", btnInk: "#032C61" },
};

const html = (d, lang) => {
  const t = THEMES[d.theme], c = d[lang];
  const font = lang === "bn" ? "'Noto Sans Bengali'" : lang === "hi" ? "'Noto Sans Devanagari'" : "'Poppins'";
  const hs = lang === "en" ? 74 : 70;
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@600;800&family=Noto+Sans+Devanagari:wght@600;800&family=Poppins:wght@500;600;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0}
body{width:${W}px;height:${H}px;background:${t.bg};font-family:${font},'Noto Sans',sans-serif;color:${t.ink};position:relative;overflow:hidden}
.frame{position:absolute;inset:28px;border:6px solid #FFC247;border-radius:44px;opacity:.9}.frame2{position:absolute;inset:46px;border:2px solid rgba(255,194,71,.55);border-radius:34px}
.blob{position:absolute;border-radius:50%;background:rgba(255,255,255,.08)}
.b1{width:760px;height:760px;right:-260px;top:-220px}.b2{width:520px;height:520px;left:-200px;bottom:120px}
.top{position:absolute;left:96px;top:96px;display:flex;align-items:center;gap:20px}
.logo{width:104px;height:104px;border-radius:28px;background:#fff;display:flex;align-items:center;justify-content:center}
.logo img{width:80px;height:80px;object-fit:contain}
.brand{font-family:'Poppins',sans-serif;font-weight:800;font-size:56px;letter-spacing:-1px}
.icons{position:absolute;left:96px;right:96px;top:270px;display:flex;gap:26px}
.ic{font-family:'Noto Color Emoji';flex:1;height:170px;border-radius:36px;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;font-size:92px}
h1{font-size:${hs}px;line-height:1.28;font-weight:800;margin-bottom:34px}
.txt{position:absolute;left:96px;right:96px;top:490px}
h1 em{font-style:normal;color:${t.accent}}
p{font-size:${lang==="en"?38:40}px;line-height:1.55;font-weight:600;color:${t.soft}}
.cta{position:absolute;left:96px;bottom:170px;height:116px;padding:0 64px;border-radius:58px;background:${t.btn};color:${t.btnInk};font-size:48px;font-weight:800;display:flex;align-items:center}
.url{position:absolute;left:96px;bottom:96px;font-family:'Poppins',sans-serif;font-size:36px;font-weight:600;color:${t.soft}}
</style></head><body>
${t.frame ? '<div class="frame"></div><div class="frame2"></div>' : ""}<div class="blob b1"></div><div class="blob b2"></div>
<div class="top"><div class="logo"><img src="${logo}"></div><div class="brand">DhundoNow</div></div>
<div class="icons">${d.icons.map((i) => `<div class="ic">${i}</div>`).join("")}</div>
<div class="txt"><h1>${c.h}</h1><p>${c.s}</p></div>
<div class="cta">${c.cta} →</div><div class="url">${URL_TXT}</div>
</body></html>`;
};

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const out = "marketing";
const design = process.env.DESIGN || "find";   // find (default) | pooja | more | earn
const d = B[design];
for (const lang of ["en", "bn", "hi"]) {
  await page.setContent(html(d, lang), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const file = path.join(out, design === "find" ? `dhundo-banner-${lang}.png` : `dhundo-${design}-${lang}.png`);
  await page.screenshot({ path: file });
  console.log("wrote", file);
}
await browser.close();
