// ===========================================================================
// states.js -- every state and union territory of India.
//
// The English name is the key everywhere: it is what the database stores in
// services_workers.state and services_regions.state, what GeoNames and
// OpenStreetMap call the place (after ALIASES below), and what the import
// scripts write. The translated names are display only.
//
// Adding or renaming one means a line here AND the list in sql/75 -- the
// database checks the same names.
// ===========================================================================

// Alphabetical, states first and then union territories, the way both are
// usually listed. The picker shows them in this order.
export const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
];

// The two letters at the start of a number plate, per state, used only for
// the example shown in the vehicle box. Any Indian plate is accepted whatever
// its letters: this is a hint, not a rule.
export const RTO_CODE = {
  "Andhra Pradesh": "AP", "Arunachal Pradesh": "AR", "Assam": "AS", "Bihar": "BR",
  "Chhattisgarh": "CG", "Goa": "GA", "Gujarat": "GJ", "Haryana": "HR",
  "Himachal Pradesh": "HP", "Jharkhand": "JH", "Karnataka": "KA", "Kerala": "KL",
  "Madhya Pradesh": "MP", "Maharashtra": "MH", "Manipur": "MN", "Meghalaya": "ML",
  "Mizoram": "MZ", "Nagaland": "NL", "Odisha": "OD", "Punjab": "PB", "Rajasthan": "RJ",
  "Sikkim": "SK", "Tamil Nadu": "TN", "Telangana": "TS", "Tripura": "TR",
  "Uttar Pradesh": "UP", "Uttarakhand": "UK", "West Bengal": "WB",
  "Andaman and Nicobar Islands": "AN", "Chandigarh": "CH",
  "Dadra and Nagar Haveli and Daman and Diu": "DD", "Delhi": "DL",
  "Jammu and Kashmir": "JK", "Ladakh": "LA", "Lakshadweep": "LD", "Puducherry": "PY",
};
export const plateExample = (state) => `${RTO_CODE[state] || "DL"} 01 AB 1234`;

// Where somebody lands before they have picked or been detected anywhere.
// Tripura, because that is where the directory started and where most
// listings still are -- not because it is first alphabetically.
export const DEFAULT_STATE = "Tripura";

// What OpenStreetMap, GeoNames and older data sometimes call a state instead.
// Compared lower-case, so only spelling differences need listing.
const ALIASES = {
  "nct of delhi": "Delhi",
  "national capital territory of delhi": "Delhi",
  "nct": "Delhi",
  "new delhi": "Delhi",
  "orissa": "Odisha",
  "pondicherry": "Puducherry",
  "uttaranchal": "Uttarakhand",
  "andaman and nicobar": "Andaman and Nicobar Islands",
  "andaman & nicobar islands": "Andaman and Nicobar Islands",
  "jammu & kashmir": "Jammu and Kashmir",
  "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
  "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
  "dadra & nagar haveli and daman & diu": "Dadra and Nagar Haveli and Daman and Diu",
  "the dadra and nagar haveli and daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
};

const BY_LOWER = Object.fromEntries(STATES.map((s) => [s.toLowerCase(), s]));

// The app's name for a state however it was spelled, or the input unchanged
// when it is not an Indian state at all -- so the caller can still say
// "we are not in <that place> yet".
export function normalizeState(name) {
  if (!name) return name;
  const k = String(name).trim().toLowerCase().replace(/\s+/g, " ");
  return BY_LOWER[k] || ALIASES[k] || name;
}

// Display names. Missing entries fall back to English, which is also what
// most people see printed on signboards for the smaller union territories.
const NAMES = {
  bn: {
    "Andhra Pradesh": "অন্ধ্রপ্রদেশ", "Arunachal Pradesh": "অরুণাচল প্রদেশ", "Assam": "অসম",
    "Bihar": "বিহার", "Chhattisgarh": "ছত্তিশগড়", "Goa": "গোয়া", "Gujarat": "গুজরাট",
    "Haryana": "হরিয়ানা", "Himachal Pradesh": "হিমাচল প্রদেশ", "Jharkhand": "ঝাড়খণ্ড",
    "Karnataka": "কর্ণাটক", "Kerala": "কেরালা", "Madhya Pradesh": "মধ্যপ্রদেশ",
    "Maharashtra": "মহারাষ্ট্র", "Manipur": "মণিপুর", "Meghalaya": "মেঘালয়",
    "Mizoram": "মিজোরাম", "Nagaland": "নাগাল্যান্ড", "Odisha": "ওড়িশা", "Punjab": "পাঞ্জাব",
    "Rajasthan": "রাজস্থান", "Sikkim": "সিকিম", "Tamil Nadu": "তামিলনাড়ু",
    "Telangana": "তেলেঙ্গানা", "Tripura": "ত্রিপুরা", "Uttar Pradesh": "উত্তরপ্রদেশ",
    "Uttarakhand": "উত্তরাখণ্ড", "West Bengal": "পশ্চিমবঙ্গ",
    "Andaman and Nicobar Islands": "আন্দামান ও নিকোবর দ্বীপপুঞ্জ", "Chandigarh": "চণ্ডীগড়",
    "Dadra and Nagar Haveli and Daman and Diu": "দাদরা ও নগর হাভেলি এবং দমন ও দিউ",
    "Delhi": "দিল্লি", "Jammu and Kashmir": "জম্মু ও কাশ্মীর", "Ladakh": "লাদাখ",
    "Lakshadweep": "লাক্ষাদ্বীপ", "Puducherry": "পুদুচেরি",
  },
  hi: {
    "Andhra Pradesh": "आंध्र प्रदेश", "Arunachal Pradesh": "अरुणाचल प्रदेश", "Assam": "असम",
    "Bihar": "बिहार", "Chhattisgarh": "छत्तीसगढ़", "Goa": "गोवा", "Gujarat": "गुजरात",
    "Haryana": "हरियाणा", "Himachal Pradesh": "हिमाचल प्रदेश", "Jharkhand": "झारखंड",
    "Karnataka": "कर्नाटक", "Kerala": "केरल", "Madhya Pradesh": "मध्य प्रदेश",
    "Maharashtra": "महाराष्ट्र", "Manipur": "मणिपुर", "Meghalaya": "मेघालय",
    "Mizoram": "मिज़ोरम", "Nagaland": "नागालैंड", "Odisha": "ओडिशा", "Punjab": "पंजाब",
    "Rajasthan": "राजस्थान", "Sikkim": "सिक्किम", "Tamil Nadu": "तमिलनाडु",
    "Telangana": "तेलंगाना", "Tripura": "त्रिपुरा", "Uttar Pradesh": "उत्तर प्रदेश",
    "Uttarakhand": "उत्तराखंड", "West Bengal": "पश्चिम बंगाल",
    "Andaman and Nicobar Islands": "अंडमान और निकोबार द्वीप समूह", "Chandigarh": "चंडीगढ़",
    "Dadra and Nagar Haveli and Daman and Diu": "दादरा और नगर हवेली और दमन और दीव",
    "Delhi": "दिल्ली", "Jammu and Kashmir": "जम्मू और कश्मीर", "Ladakh": "लद्दाख",
    "Lakshadweep": "लक्षद्वीप", "Puducherry": "पुडुचेरी",
  },
  mr: {
    "Andhra Pradesh": "आंध्र प्रदेश", "Arunachal Pradesh": "अरुणाचल प्रदेश", "Assam": "आसाम",
    "Bihar": "बिहार", "Chhattisgarh": "छत्तीसगड", "Goa": "गोवा", "Gujarat": "गुजरात",
    "Haryana": "हरियाणा", "Himachal Pradesh": "हिमाचल प्रदेश", "Jharkhand": "झारखंड",
    "Karnataka": "कर्नाटक", "Kerala": "केरळ", "Madhya Pradesh": "मध्य प्रदेश",
    "Maharashtra": "महाराष्ट्र", "Manipur": "मणिपूर", "Meghalaya": "मेघालय",
    "Mizoram": "मिझोरम", "Nagaland": "नागालँड", "Odisha": "ओडिशा", "Punjab": "पंजाब",
    "Rajasthan": "राजस्थान", "Sikkim": "सिक्कीम", "Tamil Nadu": "तमिळनाडू",
    "Telangana": "तेलंगणा", "Tripura": "त्रिपुरा", "Uttar Pradesh": "उत्तर प्रदेश",
    "Uttarakhand": "उत्तराखंड", "West Bengal": "पश्चिम बंगाल",
    "Andaman and Nicobar Islands": "अंदमान आणि निकोबार बेटे", "Chandigarh": "चंदीगड",
    "Dadra and Nagar Haveli and Daman and Diu": "दादरा आणि नगर हवेली आणि दमण आणि दीव",
    "Delhi": "दिल्ली", "Jammu and Kashmir": "जम्मू आणि काश्मीर", "Ladakh": "लडाख",
    "Lakshadweep": "लक्षद्वीप", "Puducherry": "पुदुच्चेरी",
  },
  te: {
    "Andhra Pradesh": "ఆంధ్రప్రదేశ్", "Arunachal Pradesh": "అరుణాచల్ ప్రదేశ్", "Assam": "అస్సాం",
    "Bihar": "బీహార్", "Chhattisgarh": "ఛత్తీస్‌గఢ్", "Goa": "గోవా", "Gujarat": "గుజరాత్",
    "Haryana": "హర్యానా", "Himachal Pradesh": "హిమాచల్ ప్రదేశ్", "Jharkhand": "జార్ఖండ్",
    "Karnataka": "కర్ణాటక", "Kerala": "కేరళ", "Madhya Pradesh": "మధ్యప్రదేశ్",
    "Maharashtra": "మహారాష్ట్ర", "Manipur": "మణిపూర్", "Meghalaya": "మేఘాలయ",
    "Mizoram": "మిజోరం", "Nagaland": "నాగాలాండ్", "Odisha": "ఒడిశా", "Punjab": "పంజాబ్",
    "Rajasthan": "రాజస్థాన్", "Sikkim": "సిక్కిం", "Tamil Nadu": "తమిళనాడు",
    "Telangana": "తెలంగాణ", "Tripura": "త్రిపుర", "Uttar Pradesh": "ఉత్తర ప్రదేశ్",
    "Uttarakhand": "ఉత్తరాఖండ్", "West Bengal": "పశ్చిమ బెంగాల్",
    "Andaman and Nicobar Islands": "అండమాన్ నికోబార్ దీవులు", "Chandigarh": "చండీగఢ్",
    "Dadra and Nagar Haveli and Daman and Diu": "దాద్రా నగర్ హవేలీ, డామన్ డయ్యూ",
    "Delhi": "ఢిల్లీ", "Jammu and Kashmir": "జమ్మూ కాశ్మీర్", "Ladakh": "లడఖ్",
    "Lakshadweep": "లక్షద్వీప్", "Puducherry": "పుదుచ్చేరి",
  },
  ta: {
    "Andhra Pradesh": "ஆந்திரப் பிரதேசம்", "Arunachal Pradesh": "அருணாச்சலப் பிரதேசம்", "Assam": "அசாம்",
    "Bihar": "பீகார்", "Chhattisgarh": "சத்தீஸ்கர்", "Goa": "கோவா", "Gujarat": "குஜராத்",
    "Haryana": "ஹரியானா", "Himachal Pradesh": "இமாச்சலப் பிரதேசம்", "Jharkhand": "ஜார்க்கண்ட்",
    "Karnataka": "கர்நாடகா", "Kerala": "கேரளா", "Madhya Pradesh": "மத்தியப் பிரதேசம்",
    "Maharashtra": "மகாராஷ்டிரா", "Manipur": "மணிப்பூர்", "Meghalaya": "மேகாலயா",
    "Mizoram": "மிசோரம்", "Nagaland": "நாகாலாந்து", "Odisha": "ஒடிசா", "Punjab": "பஞ்சாப்",
    "Rajasthan": "ராஜஸ்தான்", "Sikkim": "சிக்கிம்", "Tamil Nadu": "தமிழ்நாடு",
    "Telangana": "தெலங்கானா", "Tripura": "திரிபுரா", "Uttar Pradesh": "உத்தரப் பிரதேசம்",
    "Uttarakhand": "உத்தராகண்ட்", "West Bengal": "மேற்கு வங்காளம்",
    "Andaman and Nicobar Islands": "அந்தமான் நிக்கோபார் தீவுகள்", "Chandigarh": "சண்டிகர்",
    "Dadra and Nagar Haveli and Daman and Diu": "தாத்ரா நகர் ஹவேலி மற்றும் டாமன் டையூ",
    "Delhi": "டெல்லி", "Jammu and Kashmir": "ஜம்மு காஷ்மீர்", "Ladakh": "லடாக்",
    "Lakshadweep": "லட்சத்தீவு", "Puducherry": "புதுச்சேரி",
  },
  gu: {
    "Andhra Pradesh": "આંધ્ર પ્રદેશ", "Arunachal Pradesh": "અરુણાચલ પ્રદેશ", "Assam": "આસામ",
    "Bihar": "બિહાર", "Chhattisgarh": "છત્તીસગઢ", "Goa": "ગોવા", "Gujarat": "ગુજરાત",
    "Haryana": "હરિયાણા", "Himachal Pradesh": "હિમાચલ પ્રદેશ", "Jharkhand": "ઝારખંડ",
    "Karnataka": "કર્ણાટક", "Kerala": "કેરળ", "Madhya Pradesh": "મધ્ય પ્રદેશ",
    "Maharashtra": "મહારાષ્ટ્ર", "Manipur": "મણિપુર", "Meghalaya": "મેઘાલય",
    "Mizoram": "મિઝોરમ", "Nagaland": "નાગાલેન્ડ", "Odisha": "ઓડિશા", "Punjab": "પંજાબ",
    "Rajasthan": "રાજસ્થાન", "Sikkim": "સિક્કિમ", "Tamil Nadu": "તમિલનાડુ",
    "Telangana": "તેલંગાણા", "Tripura": "ત્રિપુરા", "Uttar Pradesh": "ઉત્તર પ્રદેશ",
    "Uttarakhand": "ઉત્તરાખંડ", "West Bengal": "પશ્ચિમ બંગાળ",
    "Andaman and Nicobar Islands": "આંદામાન અને નિકોબાર ટાપુઓ", "Chandigarh": "ચંદીગઢ",
    "Dadra and Nagar Haveli and Daman and Diu": "દાદરા અને નગર હવેલી અને દમણ અને દીવ",
    "Delhi": "દિલ્હી", "Jammu and Kashmir": "જમ્મુ અને કાશ્મીર", "Ladakh": "લદ્દાખ",
    "Lakshadweep": "લક્ષદ્વીપ", "Puducherry": "પુડુચેરી",
  },
  kn: {
    "Andhra Pradesh": "ಆಂಧ್ರ ಪ್ರದೇಶ", "Arunachal Pradesh": "ಅರುಣಾಚಲ ಪ್ರದೇಶ", "Assam": "ಅಸ್ಸಾಂ",
    "Bihar": "ಬಿಹಾರ", "Chhattisgarh": "ಛತ್ತೀಸ್‌ಗಢ", "Goa": "ಗೋವಾ", "Gujarat": "ಗುಜರಾತ್",
    "Haryana": "ಹರಿಯಾಣ", "Himachal Pradesh": "ಹಿಮಾಚಲ ಪ್ರದೇಶ", "Jharkhand": "ಜಾರ್ಖಂಡ್",
    "Karnataka": "ಕರ್ನಾಟಕ", "Kerala": "ಕೇರಳ", "Madhya Pradesh": "ಮಧ್ಯ ಪ್ರದೇಶ",
    "Maharashtra": "ಮಹಾರಾಷ್ಟ್ರ", "Manipur": "ಮಣಿಪುರ", "Meghalaya": "ಮೇಘಾಲಯ",
    "Mizoram": "ಮಿಜೋರಾಂ", "Nagaland": "ನಾಗಾಲ್ಯಾಂಡ್", "Odisha": "ಒಡಿಶಾ", "Punjab": "ಪಂಜಾಬ್",
    "Rajasthan": "ರಾಜಸ್ಥಾನ", "Sikkim": "ಸಿಕ್ಕಿಂ", "Tamil Nadu": "ತಮಿಳುನಾಡು",
    "Telangana": "ತೆಲಂಗಾಣ", "Tripura": "ತ್ರಿಪುರ", "Uttar Pradesh": "ಉತ್ತರ ಪ್ರದೇಶ",
    "Uttarakhand": "ಉತ್ತರಾಖಂಡ", "West Bengal": "ಪಶ್ಚಿಮ ಬಂಗಾಳ",
    "Andaman and Nicobar Islands": "ಅಂಡಮಾನ್ ಮತ್ತು ನಿಕೋಬಾರ್ ದ್ವೀಪಗಳು", "Chandigarh": "ಚಂಡೀಗಢ",
    "Dadra and Nagar Haveli and Daman and Diu": "ದಾದ್ರಾ ಮತ್ತು ನಗರ ಹವೇಲಿ ಮತ್ತು ದಮನ್ ಮತ್ತು ದಿಯು",
    "Delhi": "ದೆಹಲಿ", "Jammu and Kashmir": "ಜಮ್ಮು ಮತ್ತು ಕಾಶ್ಮೀರ", "Ladakh": "ಲಡಾಖ್",
    "Lakshadweep": "ಲಕ್ಷದ್ವೀಪ", "Puducherry": "ಪುದುಚೇರಿ",
  },
  ml: {
    "Andhra Pradesh": "ആന്ധ്രാപ്രദേശ്", "Arunachal Pradesh": "അരുണാചൽ പ്രദേശ്", "Assam": "അസം",
    "Bihar": "ബിഹാർ", "Chhattisgarh": "ഛത്തീസ്ഗഢ്", "Goa": "ഗോവ", "Gujarat": "ഗുജറാത്ത്",
    "Haryana": "ഹരിയാന", "Himachal Pradesh": "ഹിമാചൽ പ്രദേശ്", "Jharkhand": "ഝാർഖണ്ഡ്",
    "Karnataka": "കർണാടക", "Kerala": "കേരളം", "Madhya Pradesh": "മധ്യപ്രദേശ്",
    "Maharashtra": "മഹാരാഷ്ട്ര", "Manipur": "മണിപ്പൂർ", "Meghalaya": "മേഘാലയ",
    "Mizoram": "മിസോറം", "Nagaland": "നാഗാലാൻഡ്", "Odisha": "ഒഡീഷ", "Punjab": "പഞ്ചാബ്",
    "Rajasthan": "രാജസ്ഥാൻ", "Sikkim": "സിക്കിം", "Tamil Nadu": "തമിഴ്‌നാട്",
    "Telangana": "തെലങ്കാന", "Tripura": "ത്രിപുര", "Uttar Pradesh": "ഉത്തർപ്രദേശ്",
    "Uttarakhand": "ഉത്തരാഖണ്ഡ്", "West Bengal": "പശ്ചിമ ബംഗാൾ",
    "Andaman and Nicobar Islands": "ആൻഡമാൻ നിക്കോബാർ ദ്വീപുകൾ", "Chandigarh": "ചണ്ഡീഗഢ്",
    "Dadra and Nagar Haveli and Daman and Diu": "ദാദ്ര നഗർ ഹവേലി, ദാമൻ ദിയു",
    "Delhi": "ഡൽഹി", "Jammu and Kashmir": "ജമ്മു കശ്മീർ", "Ladakh": "ലഡാക്ക്",
    "Lakshadweep": "ലക്ഷദ്വീപ്", "Puducherry": "പുതുച്ചേരി",
  },
  or: {
    "Andhra Pradesh": "ଆନ୍ଧ୍ର ପ୍ରଦେଶ", "Arunachal Pradesh": "ଅରୁଣାଚଳ ପ୍ରଦେଶ", "Assam": "ଆସାମ",
    "Bihar": "ବିହାର", "Chhattisgarh": "ଛତିଶଗଡ଼", "Goa": "ଗୋଆ", "Gujarat": "ଗୁଜରାଟ",
    "Haryana": "ହରିୟାଣା", "Himachal Pradesh": "ହିମାଚଳ ପ୍ରଦେଶ", "Jharkhand": "ଝାଡ଼ଖଣ୍ଡ",
    "Karnataka": "କର୍ଣ୍ଣାଟକ", "Kerala": "କେରଳ", "Madhya Pradesh": "ମଧ୍ୟ ପ୍ରଦେଶ",
    "Maharashtra": "ମହାରାଷ୍ଟ୍ର", "Manipur": "ମଣିପୁର", "Meghalaya": "ମେଘାଳୟ",
    "Mizoram": "ମିଜୋରାମ", "Nagaland": "ନାଗାଲାଣ୍ଡ", "Odisha": "ଓଡ଼ିଶା", "Punjab": "ପଞ୍ଜାବ",
    "Rajasthan": "ରାଜସ୍ଥାନ", "Sikkim": "ସିକିମ", "Tamil Nadu": "ତାମିଲନାଡୁ",
    "Telangana": "ତେଲେଙ୍ଗାନା", "Tripura": "ତ୍ରିପୁରା", "Uttar Pradesh": "ଉତ୍ତର ପ୍ରଦେଶ",
    "Uttarakhand": "ଉତ୍ତରାଖଣ୍ଡ", "West Bengal": "ପଶ୍ଚିମ ବଙ୍ଗ",
    "Andaman and Nicobar Islands": "ଆଣ୍ଡାମାନ ଓ ନିକୋବର ଦ୍ୱୀପପୁଞ୍ଜ", "Chandigarh": "ଚଣ୍ଡୀଗଡ଼",
    "Dadra and Nagar Haveli and Daman and Diu": "ଦାଦ୍ରା ଓ ନଗର ହାଭେଲି ଏବଂ ଦମନ ଓ ଦିଉ",
    "Delhi": "ଦିଲ୍ଲୀ", "Jammu and Kashmir": "ଜମ୍ମୁ ଓ କାଶ୍ମୀର", "Ladakh": "ଲଦାଖ",
    "Lakshadweep": "ଲକ୍ଷଦ୍ୱୀପ", "Puducherry": "ପୁଦୁଚେରୀ",
  },
  pa: {
    "Andhra Pradesh": "ਆਂਧਰਾ ਪ੍ਰਦੇਸ਼", "Arunachal Pradesh": "ਅਰੁਣਾਚਲ ਪ੍ਰਦੇਸ਼", "Assam": "ਅਸਾਮ",
    "Bihar": "ਬਿਹਾਰ", "Chhattisgarh": "ਛੱਤੀਸਗੜ੍ਹ", "Goa": "ਗੋਆ", "Gujarat": "ਗੁਜਰਾਤ",
    "Haryana": "ਹਰਿਆਣਾ", "Himachal Pradesh": "ਹਿਮਾਚਲ ਪ੍ਰਦੇਸ਼", "Jharkhand": "ਝਾਰਖੰਡ",
    "Karnataka": "ਕਰਨਾਟਕ", "Kerala": "ਕੇਰਲ", "Madhya Pradesh": "ਮੱਧ ਪ੍ਰਦੇਸ਼",
    "Maharashtra": "ਮਹਾਰਾਸ਼ਟਰ", "Manipur": "ਮਣੀਪੁਰ", "Meghalaya": "ਮੇਘਾਲਿਆ",
    "Mizoram": "ਮਿਜ਼ੋਰਮ", "Nagaland": "ਨਾਗਾਲੈਂਡ", "Odisha": "ਓਡੀਸ਼ਾ", "Punjab": "ਪੰਜਾਬ",
    "Rajasthan": "ਰਾਜਸਥਾਨ", "Sikkim": "ਸਿੱਕਮ", "Tamil Nadu": "ਤਾਮਿਲਨਾਡੂ",
    "Telangana": "ਤੇਲੰਗਾਨਾ", "Tripura": "ਤ੍ਰਿਪੁਰਾ", "Uttar Pradesh": "ਉੱਤਰ ਪ੍ਰਦੇਸ਼",
    "Uttarakhand": "ਉੱਤਰਾਖੰਡ", "West Bengal": "ਪੱਛਮੀ ਬੰਗਾਲ",
    "Andaman and Nicobar Islands": "ਅੰਡੇਮਾਨ ਅਤੇ ਨਿਕੋਬਾਰ ਟਾਪੂ", "Chandigarh": "ਚੰਡੀਗੜ੍ਹ",
    "Dadra and Nagar Haveli and Daman and Diu": "ਦਾਦਰਾ ਅਤੇ ਨਗਰ ਹਵੇਲੀ ਅਤੇ ਦਮਨ ਅਤੇ ਦੀਉ",
    "Delhi": "ਦਿੱਲੀ", "Jammu and Kashmir": "ਜੰਮੂ ਅਤੇ ਕਸ਼ਮੀਰ", "Ladakh": "ਲੱਦਾਖ",
    "Lakshadweep": "ਲਕਸ਼ਦੀਪ", "Puducherry": "ਪੁਡੂਚੇਰੀ",
  },
  as: {
    "Andhra Pradesh": "অন্ধ্ৰপ্ৰদেশ", "Arunachal Pradesh": "অৰুণাচল প্ৰদেশ", "Assam": "অসম",
    "Bihar": "বিহাৰ", "Chhattisgarh": "ছত্তীশগড়", "Goa": "গোৱা", "Gujarat": "গুজৰাট",
    "Haryana": "হাৰিয়ানা", "Himachal Pradesh": "হিমাচল প্ৰদেশ", "Jharkhand": "ঝাৰখণ্ড",
    "Karnataka": "কৰ্ণাটক", "Kerala": "কেৰেলা", "Madhya Pradesh": "মধ্যপ্ৰদেশ",
    "Maharashtra": "মহাৰাষ্ট্ৰ", "Manipur": "মণিপুৰ", "Meghalaya": "মেঘালয়",
    "Mizoram": "মিজোৰাম", "Nagaland": "নাগালেণ্ড", "Odisha": "ওড়িশা", "Punjab": "পাঞ্জাব",
    "Rajasthan": "ৰাজস্থান", "Sikkim": "ছিক্কিম", "Tamil Nadu": "তামিলনাডু",
    "Telangana": "তেলেংগানা", "Tripura": "ত্ৰিপুৰা", "Uttar Pradesh": "উত্তৰ প্ৰদেশ",
    "Uttarakhand": "উত্তৰাখণ্ড", "West Bengal": "পশ্চিমবংগ",
    "Andaman and Nicobar Islands": "আন্দামান আৰু নিকোবৰ দ্বীপপুঞ্জ", "Chandigarh": "চণ্ডীগড়",
    "Dadra and Nagar Haveli and Daman and Diu": "দাদৰা আৰু নগৰ হাভেলী আৰু দমন আৰু দিউ",
    "Delhi": "দিল্লী", "Jammu and Kashmir": "জম্মু আৰু কাশ্মীৰ", "Ladakh": "লাডাখ",
    "Lakshadweep": "লাক্ষাদ্বীপ", "Puducherry": "পুডুচেৰী",
  },
};

export function stateName(state, lang) {
  return (NAMES[lang] && NAMES[lang][state]) || state;
}

// Roughly the middle of each state's population (usually the capital), used
// only to bias place search toward the state being browsed. A ranking hint,
// not a location anybody sees.
export const STATE_CENTERS = {
  "Andhra Pradesh": [16.51, 80.52], "Arunachal Pradesh": [27.08, 93.61], "Assam": [26.14, 91.74],
  "Bihar": [25.59, 85.14], "Chhattisgarh": [21.25, 81.63], "Goa": [15.49, 73.83],
  "Gujarat": [23.02, 72.57], "Haryana": [29.06, 76.09], "Himachal Pradesh": [31.10, 77.17],
  "Jharkhand": [23.34, 85.31], "Karnataka": [12.97, 77.59], "Kerala": [10.0, 76.3],
  "Madhya Pradesh": [23.26, 77.41], "Maharashtra": [19.08, 73.9], "Manipur": [24.82, 93.94],
  "Meghalaya": [25.58, 91.89], "Mizoram": [23.73, 92.72], "Nagaland": [25.67, 94.11],
  "Odisha": [20.30, 85.82], "Punjab": [30.9, 75.85], "Rajasthan": [26.91, 75.79],
  "Sikkim": [27.33, 88.61], "Tamil Nadu": [13.08, 80.27], "Telangana": [17.39, 78.49],
  "Tripura": [23.83, 91.28], "Uttar Pradesh": [26.85, 80.95], "Uttarakhand": [30.32, 78.03],
  "West Bengal": [22.57, 88.36], "Andaman and Nicobar Islands": [11.62, 92.73],
  "Chandigarh": [30.73, 76.78], "Dadra and Nagar Haveli and Daman and Diu": [20.40, 72.83],
  "Delhi": [28.61, 77.21], "Jammu and Kashmir": [34.08, 74.8], "Ladakh": [34.15, 77.58],
  "Lakshadweep": [10.57, 72.64], "Puducherry": [11.94, 79.81],
};
