// Sends the alerts waiting in services_notify_queue to people's phones (web push).
// Called by a Supabase Database Webhook on INSERT into services_notify_queue.
// See PUSH.md for the five setup steps.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const secret = Deno.env.get("PUSH_SECRET")!;
webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:support@dhundo.in",
  Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);

type Row = Record<string, string>;
const T: Record<string, Row> = {
  order_new: { en: "New order", bn: "নতুন অর্ডার", hi: "नया ऑर्डर", as: "নতুন অৰ্ডাৰ", gu: "નવો ઓર્ડર", kn: "ಹೊಸ ಆರ್ಡರ್", ml: "പുതിയ ഓർഡർ", mr: "नवीन ऑर्डर", or: "ନୂଆ ଅର୍ଡର", pa: "ਨਵਾਂ ਆਰਡਰ", ta: "புதிய ஆர்டர்", te: "కొత్త ఆర్డర్" },
  order_accepted: { en: "Your order was accepted", bn: "আপনার অর্ডার গ্রহণ করা হয়েছে", hi: "आपका ऑर्डर स्वीकार हुआ", as: "আপোনাৰ অৰ্ডাৰ গ্ৰহণ কৰা হ’ল", gu: "તમારો ઓર્ડર સ્વીકારાયો", kn: "ನಿಮ್ಮ ಆರ್ಡರ್ ಒಪ್ಪಲಾಗಿದೆ", ml: "നിങ്ങളുടെ ഓർഡർ സ്വീകരിച്ചു", mr: "तुमचा ऑर्डर स्वीकारला", or: "ଆପଣଙ୍କ ଅର୍ଡର ଗ୍ରହଣ ହେଲା", pa: "ਤੁਹਾਡਾ ਆਰਡਰ ਮਨਜ਼ੂਰ ਹੋਇਆ", ta: "உங்கள் ஆர்டர் ஏற்கப்பட்டது", te: "మీ ఆర్డర్ అంగీకరించబడింది" },
  order_ready: { en: "Your order is ready", bn: "আপনার অর্ডার তৈরি", hi: "आपका ऑर्डर तैयार है", as: "আপোনাৰ অৰ্ডাৰ সাজু", gu: "તમારો ઓર્ડર તૈયાર છે", kn: "ನಿಮ್ಮ ಆರ್ಡರ್ ಸಿದ್ಧವಾಗಿದೆ", ml: "നിങ്ങളുടെ ഓർഡർ തയ്യാർ", mr: "तुमचा ऑर्डर तयार आहे", or: "ଆପଣଙ୍କ ଅର୍ଡର ପ୍ରସ୍ତୁତ", pa: "ਤੁਹਾਡਾ ਆਰਡਰ ਤਿਆਰ ਹੈ", ta: "உங்கள் ஆர்டர் தயார்", te: "మీ ఆర్డర్ సిద్ధంగా ఉంది" },
  order_delivered: { en: "Your order was delivered", bn: "আপনার অর্ডার পৌঁছে গেছে", hi: "आपका ऑर्डर पहुँच गया", as: "আপোনাৰ অৰ্ডাৰ পোৱা গ’ল", gu: "તમારો ઓર્ડર પહોંચી ગયો", kn: "ನಿಮ್ಮ ಆರ್ಡರ್ ತಲುಪಿದೆ", ml: "നിങ്ങളുടെ ഓർഡർ എത്തിച്ചു", mr: "तुमचा ऑर्डर पोहोचला", or: "ଆପଣଙ୍କ ଅର୍ଡର ପହଞ୍ଚିଲା", pa: "ਤੁਹਾਡਾ ਆਰਡਰ ਪਹੁੰਚ ਗਿਆ", ta: "உங்கள் ஆர்டர் வழங்கப்பட்டது", te: "మీ ఆర్డర్ అందింది" },
  order_rejected: { en: "Your order was declined", bn: "আপনার অর্ডার প্রত্যাখ্যাত হয়েছে", hi: "आपका ऑर्डर अस्वीकार हुआ", as: "আপোনাৰ অৰ্ডাৰ প্ৰত্যাখ্যান কৰা হ’ল", gu: "તમારો ઓર્ડર નકારાયો", kn: "ನಿಮ್ಮ ಆರ್ಡರ್ ನಿರಾಕರಿಸಲಾಗಿದೆ", ml: "നിങ്ങളുടെ ഓർഡർ നിരസിച്ചു", mr: "तुमचा ऑर्डर नाकारला", or: "ଆପଣଙ୍କ ଅର୍ଡର ପ୍ରତ୍ୟାଖ୍ୟାନ ହେଲା", pa: "ਤੁਹਾਡਾ ਆਰਡਰ ਰੱਦ ਹੋਇਆ", ta: "உங்கள் ஆர்டர் நிராகரிக்கப்பட்டது", te: "మీ ఆర్డర్ తిరస్కరించబడింది" },
  job_new: { en: "New delivery job near you", bn: "কাছে নতুন ডেলিভারি কাজ", hi: "पास में नया डिलीवरी काम", as: "ওচৰত নতুন ডেলিভাৰীৰ কাম", gu: "નજીક નવું ડિલિવરી કામ", kn: "ಹತ್ತಿರ ಹೊಸ ಡೆಲಿವರಿ ಕೆಲಸ", ml: "അടുത്ത് പുതിയ ഡെലിവറി ജോലി", mr: "जवळ नवीन डिलिव्हरी काम", or: "ପାଖରେ ନୂଆ ଡେଲିଭରି କାମ", pa: "ਨੇੜੇ ਨਵਾਂ ਡਿਲੀਵਰੀ ਕੰਮ", ta: "அருகில் புதிய டெலிவரி வேலை", te: "దగ్గరలో కొత్త డెలివరీ పని" },
  ride_new: { en: "New ride request near you", bn: "কাছে নতুন রাইডের অনুরোধ", hi: "पास में नई राइड रिक्वेस्ट", as: "ওচৰত নতুন ৰাইডৰ অনুৰোধ", gu: "નજીક નવી રાઇડ વિનંતી", kn: "ಹತ್ತಿರ ಹೊಸ ರೈಡ್ ವಿನಂತಿ", ml: "അടുത്ത് പുതിയ റൈഡ് അഭ്യർത്ഥന", mr: "जवळ नवीन राइड विनंती", or: "ପାଖରେ ନୂଆ ରାଇଡ୍ ଅନୁରୋଧ", pa: "ਨੇੜੇ ਨਵੀਂ ਰਾਈਡ ਬੇਨਤੀ", ta: "அருகில் புதிய சவாரி கோரிக்கை", te: "దగ్గరలో కొత్త రైడ్ అభ్యర్థన" },
  ride_accepted: { en: "A driver accepted your ride", bn: "একজন চালক আপনার রাইড নিয়েছেন", hi: "एक ड्राइवर ने आपकी राइड स्वीकार की", as: "এজন চালকে আপোনাৰ ৰাইড লৈছে", gu: "એક ડ્રાઇવરે તમારી રાઇડ સ્વીકારી", kn: "ಒಬ್ಬ ಚಾಲಕ ನಿಮ್ಮ ರೈಡ್ ಒಪ್ಪಿದ್ದಾರೆ", ml: "ഒരു ഡ്രൈവർ നിങ്ങളുടെ റൈഡ് സ്വീകരിച്ചു", mr: "एका चालकाने तुमची राइड स्वीकारली", or: "ଜଣେ ଚାଳକ ଆପଣଙ୍କ ରାଇଡ୍ ଗ୍ରହଣ କଲେ", pa: "ਇੱਕ ਡਰਾਈਵਰ ਨੇ ਤੁਹਾਡੀ ਰਾਈਡ ਮਨਜ਼ੂਰ ਕੀਤੀ", ta: "ஒரு ஓட்டுநர் உங்கள் சவாரியை ஏற்றார்", te: "ఒక డ్రైవర్ మీ రైడ్ అంగీకరించారు" },
};
const OPEN: Row = { en: "Tap to open Dhundo", bn: "Dhundo খুলতে ট্যাপ করুন", hi: "Dhundo खोलने के लिए टैप करें", as: "Dhundo খুলিবলৈ টেপ কৰক", gu: "Dhundo ખોલવા ટૅપ કરો", kn: "Dhundo ತೆರೆಯಲು ಟ್ಯಾಪ್ ಮಾಡಿ", ml: "Dhundo തുറക്കാൻ ടാപ്പ് ചെയ്യുക", mr: "Dhundo उघडण्यासाठी टॅप करा", or: "Dhundo ଖୋଲିବାକୁ ଟାପ୍ କରନ୍ତୁ", pa: "Dhundo ਖੋਲ੍ਹਣ ਲਈ ਟੈਪ ਕਰੋ", ta: "Dhundo ஐத் திறக்கத் தட்டவும்", te: "Dhundo తెరవడానికి ట్యాప్ చేయండి" };

Deno.serve(async (req) => {
  if (req.headers.get("x-push-secret") !== secret) return new Response("no", { status: 401 });
  const body = await req.json().catch(() => null);
  const rec = body && (body.record || body);
  if (!rec || !rec.user_id || !rec.kind) return new Response("ignored");
  const db = createClient(url, serviceKey);
  const { data: subs } = await db.from("services_push_subs").select("id,endpoint,p256dh,auth,lang").eq("user_id", rec.user_id);
  let sent = 0;
  for (const s of subs || []) {
    const lang = s.lang in OPEN ? s.lang : "en";
    const title = (T[rec.kind] || {})[lang] || (T[rec.kind] || {}).en || "Dhundo";
    const text = rec.kind === "order_new" && rec.extra ? `₹${rec.extra} · ${OPEN[lang]}` : OPEN[lang];
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title, body: text, url: "/", tag: rec.kind }), { TTL: 3600 });
      sent++;
    } catch (e) {
      // A phone that is gone (410 or 404) is forgotten.
      if (e && (e.statusCode === 404 || e.statusCode === 410)) await db.from("services_push_subs").delete().eq("id", s.id);
    }
  }
  await db.from("services_notify_queue").update({ sent_at: new Date().toISOString() }).eq("id", rec.id);
  await db.from("services_notify_queue").delete().lt("created_at", new Date(Date.now() - 86400000).toISOString());
  return new Response(`sent ${sent}`);
});
