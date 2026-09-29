// ===========================================================================
// tradewords.js -- what people call each trade, in every language the app
// speaks, so a search typed or spoken in any of them finds the trade.
//
// The trade names in the database exist in English, Hindi and Bengali only.
// Somebody typing "பிளம்பர்" or "సుతార్" -- or the everyday word rather than
// the formal one: "nalwala", "bijli wala", "rajmistri" -- would otherwise get
// nothing. Each entry below lists those words; `keys` are how the trade is
// named in English in the database (matched at the start of a word), so the
// list keeps working whatever slug a trade has.
//
// Adding a word is one line. Adding a trade means adding an entry whose key
// appears in that trade's English name.
// ===========================================================================

export const TRADE_WORDS = [
  { keys: ["mason", "mistri"], words: [
    "mistri", "mistry", "rajmistri", "raj mistri", "mason", "mistiri",
    "मिस्त्री", "राजमिस्त्री", "मिस्तरी", "राज मिस्त्री", "गवंडी",
    "মিস্ত্রি", "রাজমিস্ত্রি", "মিস্ত্ৰী", "ৰাজমিস্ত্ৰী",
    "మేస్త్రీ", "తాపీ మేస్త్రీ", "கொத்தனார்", "மேஸ்திரி", "કડિયા", "મિસ્ત્રી",
    "ಮೇಸ್ತ್ರಿ", "ಗಾರೆ", "മേസ്തിരി", "കല്പണിക്കാരൻ", "ମିସ୍ତ୍ରୀ", "ରାଜମିସ୍ତ୍ରୀ",
    "ਮਿਸਤਰੀ", "ਰਾਜ ਮਿਸਤਰੀ"] },
  { keys: ["plumb"], words: [
    "plumber", "nalwala", "nal wala", "plumbing",
    "प्लंबर", "नलवाला", "नल वाला", "প্লাম্বার", "কলের মিস্ত্রি", "প্লাম্বাৰ",
    "ప్లంబర్", "பிளம்பர்", "પ્લમ્બર", "ಪ್ಲಂಬರ್", "പ്ലംബർ", "ପ୍ଲମ୍ବର", "ਪਲੰਬਰ"] },
  { keys: ["electric"], words: [
    "electrician", "bijli", "bijliwala", "bijli wala", "wireman", "light wala",
    "इलेक्ट्रीशियन", "बिजली", "बिजलीवाला", "बिजली वाला", "इलेक्ट्रिशियन", "वायरमन",
    "ইলেকট্রিশিয়ান", "বিদ্যুৎ মিস্ত্রি", "ইলেকট্ৰিচিয়ান", "লাইট মিস্ত্রি",
    "ఎలక్ట్రీషియన్", "எலக்ட்ரீஷியன்", "ઇલેક્ટ્રિશિયન", "ಎಲೆಕ್ಟ್ರಿಷಿಯನ್",
    "ഇലക്ട്രീഷ്യൻ", "ଇଲେକ୍ଟ୍ରିସିଆନ", "ਇਲੈਕਟ੍ਰੀਸ਼ੀਅਨ", "ਬਿਜਲੀ"] },
  { keys: ["carpent"], words: [
    "carpenter", "badhai", "barhai", "kath mistri", "sutar",
    "बढ़ई", "कारपेंटर", "सुतार", "কাঠমিস্ত্রি", "ছুতোর", "কাঠমিস্ত্ৰী",
    "వడ్రంగి", "தச்சர்", "સુથાર", "ಬಡಗಿ", "ആശാരി", "ବଢ଼େଇ", "ਤਰਖਾਣ"] },
  // The SHOP, before the painter: "rang ki dukan" also contains "rang".
  { keys: ["paints"], words: [
    "paint shop", "paints shop", "paint dukan", "paint ki dukan", "rang ki dukan", "colour shop",
    "पेंट की दुकान", "रंग की दुकान", "पेंट दुकान", "রঙের দোকান", "পেইন্টের দোকান", "ৰঙৰ দোকান",
    "रंगाचे दुकान", "పెయింట్ షాప్", "பெயிண்ட் கடை", "રંગની દુકાન", "ಪೇಂಟ್ ಅಂಗಡಿ", "പെയിന്റ് കട",
    "ରଙ୍ଗ ଦୋକାନ", "ਪੇਂਟ ਦੀ ਦੁਕਾਨ"] },
  { keys: ["paint"], words: [
    "painter", "rang", "rangai", "rangari",
    "पेंटर", "रंगाई", "रंगारी", "রং মিস্ত্রি", "পেইন্টার", "পেইণ্টাৰ",
    "పెయింటర్", "பெயிண்டர்", "પેઇન્ટર", "રંગારો", "ಪೇಂಟರ್", "പെയിന്റർ", "ପେଣ୍ଟର", "ਪੇਂਟਰ"] },
  { keys: ["auto", "rickshaw", "toto", "e-rickshaw"], words: [
    "auto", "rickshaw", "riksha", "toto", "tuk tuk",
    "ऑटो", "रिक्शा", "रिक्षा", "অটো", "রিকশা", "টোটো", "ৰিক্সা",
    "ఆటో", "ஆட்டோ", "રિક્ષા", "ಆಟೋ", "ഓട്ടോ", "ଅଟୋ", "ਆਟੋ"] },
  { keys: ["driver"], words: [
    "driver", "chalak", "gaadi chalane wala",
    "ड्राइवर", "चालक", "ड्रायव्हर", "ড্রাইভার", "চালক", "ড্ৰাইভাৰ",
    "డ్రైవర్", "டிரைவர்", "ஓட்டுநர்", "ડ્રાઇવર", "ಡ್ರೈವರ್", "ಚಾಲಕ", "ഡ്രൈവർ", "ଡ୍ରାଇଭର", "ਡਰਾਈਵਰ"] },
  { keys: ["cook", "chef"], words: [
    "cook", "rasoiya", "khana banane wala", "bawarchi", "chef",
    "रसोइया", "कुक", "बावर्ची", "स्वयंपाकी", "आचारी", "রাঁধুনি", "ৰান্ধনী",
    "వంటవాడు", "వంట", "சமையல்காரர்", "રસોઇયો", "ಅಡುಗೆಯವರು", "പാചകക്കാരൻ", "ରୋଷେୟା", "ਰਸੋਈਆ"] },
  { keys: ["maid", "house help", "domestic", "housekeep"], words: [
    "maid", "bai", "kaamwali", "kamwali", "house help", "naukrani",
    "बाई", "कामवाली", "नौकरानी", "मोलकरीण", "কাজের লোক", "কাজের মাসি", "ঘৰুৱা কাম",
    "పనిమనిషి", "வேலைக்காரி", "કામવાળી", "ಕೆಲಸದವರು", "വീട്ടുജോലിക്കാരി", "ଘର କାମ", "ਕੰਮ ਵਾਲੀ"] },
  { keys: ["weld"], words: [
    "welder", "welding", "वेल्डर", "ওয়েল্ডার", "ৱেল্ডাৰ", "వెల్డర్", "வெல்டர்",
    "વેલ્ડર", "ವೆಲ್ಡರ್", "വെൽഡർ", "ୱେଲଡର", "ਵੈਲਡਰ"] },
  { keys: ["mechanic"], words: [
    "mechanic", "mistri gaadi", "मैकेनिक", "मेकॅनिक", "মেকানিক", "మెకానిక్",
    "மெக்கானிக்", "મિકેનિક", "ಮೆಕ್ಯಾನಿಕ್", "മെക്കാനിക്ക്", "ମେକାନିକ", "ਮਕੈਨਿਕ"] },
  { keys: ["tailor"], words: [
    "tailor", "darzi", "दर्जी", "शिंपी", "দর্জি", "দৰ্জী", "దర్జీ", "தையல்காரர்",
    "દરજી", "ದರ್ಜಿ", "തയ്യൽക്കാരൻ", "ଦରଜି", "ਦਰਜ਼ੀ"] },
  { keys: ["cement"], words: [
    "cement", "सीमेंट", "सिमेंट", "সিমেন্ট", "চিমেণ্ট", "సిమెంట్", "சிமெண்ட்",
    "સિમેન્ટ", "ಸಿಮೆಂಟ್", "സിമന്റ്", "ସିମେଣ୍ଟ", "ਸੀਮਿੰਟ"] },
  { keys: ["sand"], words: [
    "sand", "balu", "bajri", "reti", "बालू", "रेत", "बजरी", "वाळू", "বালি",
    "ఇసుక", "மணல்", "રેતી", "ಮರಳು", "മണൽ", "ବାଲି", "ਰੇਤ"] },
  { keys: ["brick"], words: [
    "brick", "eet", "int", "ईंट", "वीट", "ইট", "ইটা", "ఇటుక", "செங்கல்",
    "ઈંટ", "ಇಟ್ಟಿಗೆ", "ഇഷ്ടിക", "ଇଟା", "ਇੱਟ"] },
  { keys: ["steel", "rod", "tmt"], words: [
    "rod", "saria", "sariya", "steel", "सरिया", "छड़", "রড", "ৰড", "రాడ్",
    "கம்பி", "સળિયા", "ಕಬ್ಬಿಣ", "കമ്പി", "ରଡ", "ਸਰੀਆ"] },
  { keys: ["hardware"], words: [
    "hardware", "हार्डवेयर", "हार्डवेअर", "হার্ডওয়্যার", "হাৰ্ডৱেৰ", "హార్డ్‌వేర్",
    "ஹார்டுவேர்", "હાર્ડવેર", "ಹಾರ್ಡ್‌ವೇರ್", "ഹാർഡ്‌വെയർ", "ହାର୍ଡୱେର", "ਹਾਰਡਵੇਅਰ"] },
  { keys: ["tile", "marble"], words: [
    "tiles", "tile", "marble", "टाइल", "टाइल्स", "मार्बल", "টাইলস", "মার্বেল",
    "టైల్స్", "டைல்ஸ்", "ટાઇલ્સ", "ಟೈಲ್ಸ್", "ടൈൽസ്", "ଟାଇଲ୍ସ", "ਟਾਈਲਾਂ"] },
];

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

// A word said inside a sentence. English words must match as whole words:
// "paint" contains "int" (a brick, in Hindi) but is not about bricks.
const inside = (q, n) =>
  /^[a-z0-9 -]+$/.test(n) ? ` ${q} `.includes(` ${n} `) : q.includes(n);

// The English name keys for whatever was typed or said, or null. Every
// entry that matches as well as the best one counts, so a word that fits two
// trades -- "paint": the painter and the paint shop -- gives the keys of both
// and the search shows both. A closer match wins outright: "paint shop" is
// only the shop, "painter" only the painter.
export function tradeKeysFor(text) {
  const q = norm(text);
  if (q.length < 2) return null;
  let best = 0;
  let keys = [];
  for (const entry of TRADE_WORDS) {
    let score = 0;
    for (const w of entry.words) {
      const n = norm(w);
      // 3: exactly what was said. 2: said inside a sentence ("I need a
      // plumber"). 1: the start of a word still being typed ("plum").
      const sc = q === n ? 3 : n.length >= 3 && inside(q, n) ? 2 : q.length >= 3 && n.startsWith(q) ? 1 : 0;
      if (sc > score) score = sc;
    }
    if (!score) continue;
    if (score > best) { best = score; keys = [...entry.keys]; }
    else if (score === best) keys.push(...entry.keys);
  }
  return keys.length ? keys : null;
}
