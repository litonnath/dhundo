// ===========================================================================
// itemwords.js -- what people call the things they buy and sell, in every
// language the app speaks, so the Buy & Sell search finds the category:
// "purana bike", "পুরনো মোবাইল", "सोफा" go straight to bikes, mobiles,
// furniture. Adding a word is one entry in a list.
// ===========================================================================

export const ITEM_CATEGORIES = [
  { key: "bikes",       emoji: "🏍️" },
  { key: "cars",        emoji: "🚗" },
  { key: "mobiles",     emoji: "📱" },
  { key: "electronics", emoji: "📺" },
  { key: "appliances",  emoji: "🧺" },
  { key: "furniture",   emoji: "🛋️" },
  { key: "building",    emoji: "🧱" },
  { key: "tools",       emoji: "🛠️" },
  { key: "other",       emoji: "📦" },
];

export const ITEM_WORDS = {
  bikes: ["bike", "motorbike", "motorcycle", "scooter", "scooty", "activa", "splendor", "pulsar",
    "cycle", "bicycle", "moped", "बाइक", "मोटरसाइकिल", "स्कूटर", "स्कूटी", "साइकिल", "बाईक",
    "বাইক", "মোটরসাইকেল", "স্কুটার", "সাইকেল", "বাইচাইকেল", "मोटारसायकल", "सायकल",
    "బైక్", "స్కూటర్", "సైకిల్", "பைக்", "ஸ்கூட்டர்", "சைக்கிள்", "બાઇક", "સ્કૂટર", "સાયકલ",
    "ಬೈಕ್", "ಸ್ಕೂಟರ್", "ಸೈಕಲ್", "ബൈക്ക്", "സ്കൂട്ടർ", "സൈക്കിൾ", "ବାଇକ", "ସ୍କୁଟର", "ସାଇକେଲ",
    "ਬਾਈਕ", "ਸਕੂਟਰ", "ਸਾਈਕਲ", "বাইক", "চাইকেল"],
  cars: ["car", "gaadi", "gadi", "jeep", "suv", "maruti", "alto", "swift", "कार", "गाड़ी", "गाडी",
    "গাড়ি", "কার", "গাড়ী", "कार", "కారు", "கார்", "કાર", "ગાડી", "ಕಾರು", "കാർ", "କାର", "ਕਾਰ", "গাড়ী"],
  mobiles: ["mobile", "phone", "smartphone", "iphone", "samsung", "redmi", "vivo", "oppo", "realme",
    "मोबाइल", "फ़ोन", "फोन", "মোবাইল", "ফোন", "মোবাইল", "मोबाईल", "మొబైల్", "ఫోన్", "மொபைல்",
    "போன்", "મોબાઇલ", "ફોન", "ಮೊಬೈಲ್", "ಫೋನ್", "മൊബൈൽ", "ഫോൺ", "ମୋବାଇଲ", "ଫୋନ", "ਮੋਬਾਈਲ", "ਫ਼ੋਨ"],
  electronics: ["tv", "television", "laptop", "computer", "speaker", "camera", "inverter", "battery",
    "टीवी", "लैपटॉप", "कंप्यूटर", "इन्वर्टर", "টিভি", "ল্যাপটপ", "কম্পিউটার", "ইনভার্টার",
    "टीव्ही", "టీవీ", "ల్యాప్‌టాప్", "டிவி", "லேப்டாப்", "ટીવી", "લેપટોપ", "ಟಿವಿ", "ಲ್ಯಾಪ್‌ಟಾಪ್",
    "ടിവി", "ലാപ്ടോപ്പ്", "ଟିଭି", "ଲାପଟପ", "ਟੀਵੀ", "ਲੈਪਟਾਪ"],
  appliances: ["fridge", "refrigerator", "washing machine", "ac", "cooler", "fan", "mixer", "geyser",
    "microwave", "फ्रिज", "फ़्रिज", "वॉशिंग मशीन", "कूलर", "पंखा", "मिक्सर", "ফ্রিজ",
    "ওয়াশিং মেশিন", "কুলার", "পাখা", "ফ্ৰিজ", "फ्रीज", "ఫ్రిజ్", "కూలర్", "ஃபிரிட்ஜ்", "கூலர்",
    "ફ્રિજ", "કૂલર", "ಫ್ರಿಜ್", "ಕೂಲರ್", "ഫ്രിഡ്ജ്", "കൂളർ", "ଫ୍ରିଜ", "କୁଲର", "ਫਰਿੱਜ", "ਕੂਲਰ"],
  furniture: ["furniture", "sofa", "bed", "table", "chair", "almirah", "almari", "cupboard", "wardrobe",
    "dining", "फर्नीचर", "सोफा", "बेड", "पलंग", "कुर्सी", "मेज़", "अलमारी", "আসবাব", "সোফা",
    "খাট", "চেয়ার", "টেবিল", "আলমারি", "सोफा", "खुर्ची", "ఫర్నిచర్", "సోఫా", "మంచం", "தளபாடம்",
    "சோபா", "கட்டில்", "ફર્નિચર", "સોફા", "પલંગ", "ಪೀಠೋಪಕರಣ", "ಸೋಫಾ", "ഫർണിച്ചർ", "സോഫ",
    "ଆସବାବ", "ସୋଫା", "ਫਰਨੀਚਰ", "ਸੋਫਾ", "পালেং"],
  building: ["leftover", "extra cement", "tiles left", "second hand tiles", "old doors", "old windows",
    "scrap", "कबाड़", "पुराना दरवाजा", "বাড়তি সিমেন্ট", "পুরনো দরজা", "ভাঙারি"],
  tools: ["tool", "tools", "drill", "machine", "generator", "pump", "motor", "grinder", "welding machine",
    "औज़ार", "मशीन", "जनरेटर", "पंप", "মেশিন", "জেনারেটর", "পাম্প", "যন্ত্র", "यंत्र",
    "యంత్రం", "இயந்திரம்", "મશીન", "ಯಂತ್ರ", "യന്ത്രം", "ଯନ୍ତ୍ର", "ਮਸ਼ੀਨ"],
};

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const has = (q, words) => words.some((w) => {
  const n = norm(w);
  if (!n) return false;
  // Short Latin words must match a whole word: "ac" is not in "tractor".
  if (/^[a-z0-9 ]+$/.test(n) && n.length <= 4) return new RegExp(`(^|[^a-z])${n}([^a-z]|$)`).test(q);
  return q.includes(n);
});

// The Buy & Sell category a search is about, or null.
export function itemCategoryFor(text) {
  const q = norm(text);
  if (q.length < 2) return null;
  for (const [key, words] of Object.entries(ITEM_WORDS)) if (has(q, words)) return key;
  return null;
}
