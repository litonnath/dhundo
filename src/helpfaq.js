// The DhundoNow helper's knowledge base. Free, no server, no AI service: the helper reads what the person
// typed, finds the entries whose words match best, and shows their answer in the person's language.
// To teach it something new, add an entry here: [id, "words|that|match", {en,bn,hi question}, {en,bn,hi answer}].
// Words are matched as typed (English, Hinglish, Banglish, Bengali and Hindi script). Missing languages fall back to English.
export const FAQ = [
  ["hello", "hi|hello|hey|namaste|namaskar|hola|হ্যালো|নমস্কার|নমস্তে|नमस्ते|हेलो|हाय",
    { en: "Say hello" },
    { en: "Hi! Ask me about orders, payments, refunds, rides, bookings, your wallet or your account. For anything else, tap Talk to our team.", bn: "নমস্কার! অর্ডার, পেমেন্ট, রিফান্ড, রাইড, বুকিং, ওয়ালেট বা অ্যাকাউন্ট নিয়ে প্রশ্ন করুন। অন্য কিছুর জন্য আমাদের টিমের সঙ্গে কথা বলুন চাপুন।", hi: "नमस्ते! ऑर्डर, भुगतान, रिफंड, राइड, बुकिंग, वॉलेट या खाते के बारे में पूछिए। बाकी के लिए हमारी टीम से बात करें दबाइए।" }],

  ["order_where", "where is my order|track order|order status|order late|late order|delay|delayed|not delivered|order kab aayega|kaha hai|kothay|deri|দেরি|কোথায় আমার অর্ডার|অর্ডার কোথায়|देर|ऑर्डर कहाँ|कहाँ है मेरा ऑर्डर|अभी तक नहीं आया",
    { en: "Where is my order?", bn: "আমার অর্ডার কোথায়?", hi: "मेरा ऑर्डर कहाँ है?" },
    { en: "Open Activity, then Things I ordered. The card shows the order step by step. If it is late, call the shop or the rider from the same card. If nothing helps, tap Talk to our team.", bn: "অ্যাক্টিভিটি, তারপর আমার অর্ডার খুলুন। কার্ডে ধাপে ধাপে অবস্থা দেখা যায়। দেরি হলে একই কার্ড থেকে দোকান বা রাইডারকে ফোন করুন। তাতে না হলে আমাদের টিমের সঙ্গে কথা বলুন চাপুন।", hi: "एक्टिविटी, फिर मेरे ऑर्डर खोलिए। कार्ड पर ऑर्डर का हर चरण दिखता है। देर हो तो उसी कार्ड से दुकान या राइडर को फ़ोन करें। फिर भी हल न हो तो हमारी टीम से बात करें दबाइए।" }],

  ["order_cancel", "cancel order|cancel my order|order cancel|cancel the order|order cancel korbo|order cancel karna|অর্ডার বাতিল|অর্ডার ক্যান্সেল|ऑर्डर रद्द|ऑर्डर कैंसिल",
    { en: "Cancel an order", bn: "অর্ডার বাতিল", hi: "ऑर्डर रद्द करना" },
    { en: "You can cancel from Activity, Things I ordered, before the shop accepts it. If you already paid, a refund request is made and the DhundoNow team checks it, then the money goes to your wallet. Once the shop is making it, ask the shop by chat or call.", bn: "দোকান গ্রহণ করার আগে অ্যাক্টিভিটি, আমার অর্ডার থেকে বাতিল করতে পারেন। টাকা দিয়ে থাকলে রিফান্ড অনুরোধ তৈরি হয়, DhundoNow টিম দেখে নেয়, তারপর টাকা আপনার ওয়ালেটে যায়। দোকান বানাতে শুরু করলে চ্যাট বা ফোনে দোকানকে বলুন।", hi: "दुकान के स्वीकार करने से पहले एक्टिविटी, मेरे ऑर्डर से रद्द कर सकते हैं। भुगतान किया हो तो रिफंड अनुरोध बनता है, DhundoNow टीम जाँचती है, फिर पैसे आपके वॉलेट में जाते हैं। दुकान बनाना शुरू कर दे तो चैट या फ़ोन पर दुकान से कहिए।" }],

  ["order_wrong", "missing item|item missing|wrong item|wrong order|not received|damaged|cold food|kam mila|galat|nahi mila|পাইনি|ভুল জিনিস|কম এসেছে|नहीं मिला|गलत ऑर्डर|कम आया",
    { en: "Missing or wrong item", bn: "জিনিস কম বা ভুল", hi: "सामान कम या गलत" },
    { en: "Tap Talk to our team and tell us the order and what was missing or wrong. Please do not share your delivery code until you have everything. The team checks and helps.", bn: "আমাদের টিমের সঙ্গে কথা বলুন চাপুন, কোন অর্ডার আর কী কম বা ভুল ছিল জানান। সব জিনিস না পাওয়া পর্যন্ত ডেলিভারি কোড দেবেন না। টিম দেখে সাহায্য করবে।", hi: "हमारी टीम से बात करें दबाइए, बताइए कौन सा ऑर्डर और क्या कम या गलत था। पूरा सामान मिलने तक डिलीवरी कोड न दें। टीम जाँचकर मदद करेगी।" }],

  ["cod", "cash on delivery|cod|pay cash|cash payment|extra charge|30 rupee|rs 30|ক্যাশ অন ডেলিভারি|ক্যাশ|नकद|कैश ऑन डिलीवरी|कैश",
    { en: "Cash on delivery", bn: "ক্যাশ অন ডেলিভারি", hi: "कैश ऑन डिलीवरी" },
    { en: "You can choose cash on delivery when you confirm the order. It costs Rs 30 extra, shown before you confirm. You pay the rider in cash. Paying online or from the wallet avoids this charge.", bn: "অর্ডার নিশ্চিত করার সময় ক্যাশ অন ডেলিভারি বেছে নিতে পারেন। এতে ৩০ টাকা বেশি লাগে, নিশ্চিত করার আগেই দেখানো হয়। রাইডারকে নগদে দেবেন। অনলাইনে বা ওয়ালেট থেকে দিলে এই খরচ নেই।", hi: "ऑर्डर पक्का करते समय कैश ऑन डिलीवरी चुन सकते हैं। इसमें 30 रुपये अतिरिक्त लगते हैं, पक्का करने से पहले दिखता है। राइडर को नकद देते हैं। ऑनलाइन या वॉलेट से देने पर यह शुल्क नहीं लगता।" }],

  ["pay_how", "how to pay|pay online|payment options|how do i pay|upi payment|card payment|pay by wallet|কিভাবে পেমেন্ট|কীভাবে পেমেন্ট|कैसे भुगतान|कैसे पेमेंट",
    { en: "How do I pay?", bn: "কীভাবে পেমেন্ট করব?", hi: "भुगतान कैसे करूँ?" },
    { en: "When you confirm an order you pay online (UPI or card) or from your DhundoNow wallet. You can also choose cash on delivery for Rs 30 extra. For a booking or a ride, pay from the booking or ride card. DhundoNow holds your money until the work is done.", bn: "অর্ডার নিশ্চিত করার সময় অনলাইনে (UPI বা কার্ড) বা DhundoNow ওয়ালেট থেকে দিন। ৩০ টাকা বেশিতে ক্যাশ অন ডেলিভারিও বেছে নিতে পারেন। বুকিং বা রাইডের জন্য বুকিং বা রাইড কার্ড থেকে দিন। কাজ শেষ না হওয়া পর্যন্ত DhundoNow আপনার টাকা ধরে রাখে।", hi: "ऑर्डर पक्का करते समय ऑनलाइन (UPI या कार्ड) या DhundoNow वॉलेट से दीजिए। 30 रुपये अतिरिक्त में कैश ऑन डिलीवरी भी चुन सकते हैं। बुकिंग या राइड के लिए बुकिंग या राइड कार्ड से दीजिए। काम पूरा होने तक DhundoNow आपका पैसा रोककर रखता है।" }],

  ["pay_failed", "payment failed|payment not working|payment problem|money deducted|amount deducted|deducted but|not confirmed|failed payment|পেমেন্ট ফেল|টাকা কেটে|পেমেন্ট হয়নি|पेमेंट फेल|पैसे कट गए|पैसा कट|भुगतान विफल",
    { en: "Payment failed or money deducted", bn: "পেমেন্ট ফেল বা টাকা কেটেছে", hi: "भुगतान फेल या पैसे कटे" },
    { en: "Wait two minutes and open the order or booking again. It updates by itself once the payment arrives. If money was taken and it still shows unpaid after ten minutes, tap Talk to our team with the order and the time. Paid twice or a wrong amount is refunded after checking.", bn: "দুই মিনিট অপেক্ষা করে অর্ডার বা বুকিং আবার খুলুন। পেমেন্ট এলে নিজে থেকেই আপডেট হয়। টাকা কেটে গিয়ে দশ মিনিট পরেও বাকি দেখালে অর্ডার আর সময় জানিয়ে আমাদের টিমের সঙ্গে কথা বলুন চাপুন। দুবার বা ভুল অঙ্ক কাটলে যাচাইয়ের পর ফেরত দেওয়া হয়।", hi: "दो मिनट रुककर ऑर्डर या बुकिंग फिर खोलिए। भुगतान पहुँचते ही अपने आप अपडेट होता है। पैसे कटे हों और दस मिनट बाद भी बाकी दिखे तो ऑर्डर और समय बताकर हमारी टीम से बात करें दबाइए। दो बार या गलत रकम कटने पर जाँच के बाद वापस होती है।" }],

  ["paid_twice", "paid twice|double payment|charged twice|two times|twice|দুবার|দুইবার|दो बार|दोबारा कटा",
    { en: "Paid twice", bn: "দুবার টাকা কেটেছে", hi: "दो बार पैसे कटे" },
    { en: "If the same thing was paid twice, we do not credit it twice. The extra payment is saved for the team, who check it and refund the difference. Tap Talk to our team and tell us the order and the time.", bn: "একই জিনিসের জন্য দুবার টাকা কাটলে আমরা দুবার জমা করি না। বাড়তি টাকা টিমের জন্য সংরক্ষিত থাকে, তারা দেখে ফেরত দেয়। আমাদের টিমের সঙ্গে কথা বলুন চাপুন, অর্ডার আর সময় জানান।", hi: "एक ही चीज़ का दो बार भुगतान हो तो हम दो बार जमा नहीं करते। अतिरिक्त भुगतान टीम के लिए सुरक्षित रहता है, वे जाँचकर अंतर वापस करते हैं। हमारी टीम से बात करें दबाइए, ऑर्डर और समय बताइए।" }],

  ["refund", "refund|money back|return money|get my money|when will i get|রিফান্ড|টাকা ফেরত|ফেরত|रिफंड|पैसे वापस|पैसा वापस",
    { en: "Refunds", bn: "রিফান্ড", hi: "रिफंड" },
    { en: "When a paid order, ride, booking or item is cancelled, a refund request is made. The DhundoNow team checks it and approves it, then the money goes to your wallet. It is not instant. You can see it in your wallet history. If it takes long, tap Talk to our team.", bn: "টাকা দেওয়া অর্ডার, রাইড, বুকিং বা জিনিস বাতিল হলে রিফান্ড অনুরোধ তৈরি হয়। DhundoNow টিম দেখে অনুমোদন করলে টাকা আপনার ওয়ালেটে যায়। এটি সঙ্গে সঙ্গে হয় না। ওয়ালেটের ইতিহাসে দেখতে পাবেন। দেরি হলে আমাদের টিমের সঙ্গে কথা বলুন চাপুন।", hi: "भुगतान किया ऑर्डर, राइड, बुकिंग या सामान रद्द होने पर रिफंड अनुरोध बनता है। DhundoNow टीम जाँचकर मंज़ूर करती है, फिर पैसे आपके वॉलेट में जाते हैं। यह तुरंत नहीं होता। वॉलेट इतिहास में दिखेगा। देर हो तो हमारी टीम से बात करें दबाइए।" }],

  ["delivery_fee", "delivery fee|delivery partner fee|delivery charge|rider fee|fee refundable|ডেলিভারি ফি|ডেলিভারি চার্জ|डिलीवरी शुल्क|डिलीवरी फीस|डिलीवरी चार्ज",
    { en: "Delivery fee", bn: "ডেলিভারি ফি", hi: "डिलीवरी शुल्क" },
    { en: "The delivery partner fee is paid together with your order. You pay up to the limit shown in the cart. Once the real fee for the distance is set, if it is lower the difference comes back to your wallet.", bn: "ডেলিভারি পার্টনার ফি অর্ডারের সঙ্গেই দেওয়া হয়। কার্টে দেখানো সীমা পর্যন্ত দেন। দূরত্ব অনুযায়ী আসল ফি ঠিক হলে তা কম হলে বাকিটা আপনার ওয়ালেটে ফেরত আসে।", hi: "डिलीवरी पार्टनर शुल्क ऑर्डर के साथ ही दिया जाता है। कार्ट में दिखी सीमा तक देते हैं। दूरी के हिसाब से असली शुल्क तय होने पर वह कम हो तो अंतर आपके वॉलेट में लौट आता है।" }],

  ["gst", "gst|tax|bill|জিএসটি|ট্যাক্স|বিল|जीएसटी|टैक्स|बिल",
    { en: "GST and bill", bn: "জিএসটি ও বিল", hi: "जीएसटी और बिल" },
    { en: "GST is shown at checkout before you pay, together with the item price, the platform fee and the delivery fee. The total you see is what you pay.", bn: "পেমেন্টের আগে চেকআউটে পণ্যের দাম, প্ল্যাটফর্ম ফি ও ডেলিভারি ফি-র সঙ্গে জিএসটি দেখানো হয়। যে মোট দেখেন সেটাই আপনি দেন।", hi: "भुगतान से पहले चेकआउट पर सामान की कीमत, प्लेटफ़ॉर्म शुल्क और डिलीवरी शुल्क के साथ जीएसटी दिखता है। जो कुल दिखता है वही आप देते हैं।" }],

  ["wallet", "wallet|wallet balance|my balance|where is wallet|ওয়ালেট|ব্যালেন্স|वॉलेट|बैलेंस",
    { en: "My wallet", bn: "আমার ওয়ালেট", hi: "मेरा वॉलेट" },
    { en: "Your wallet is in the top bar. It shows your balance and history: refunds, earnings and payments. You can pay for orders from it. Earnings can be withdrawn to a UPI ID or a bank account.", bn: "ওয়ালেট উপরের বারে আছে। সেখানে ব্যালেন্স ও ইতিহাস দেখা যায়: রিফান্ড, আয় ও পেমেন্ট। এখান থেকে অর্ডারের টাকা দেওয়া যায়। আয় UPI আইডি বা ব্যাংক অ্যাকাউন্টে তোলা যায়।", hi: "वॉलेट ऊपर की पट्टी में है। वहाँ बैलेंस और इतिहास दिखता है: रिफंड, कमाई और भुगतान। इससे ऑर्डर का भुगतान कर सकते हैं। कमाई UPI आईडी या बैंक खाते में निकाल सकते हैं।" }],

  ["withdraw", "withdraw|withdrawal|bank transfer|payout|cash out|transfer to bank|তুলতে|টাকা তুলব|উইথড্র|निकालना|निकाल|विड्रॉ",
    { en: "Withdraw money", bn: "টাকা তোলা", hi: "पैसे निकालना" },
    { en: "Open your wallet and tap withdraw. Choose UPI or bank account. You need your phone number checked first. The minimum is Rs 100. A new UPI ID or bank account waits 24 hours before the first withdrawal, to keep your money safe.", bn: "ওয়ালেট খুলে টাকা তুলুন চাপুন। UPI বা ব্যাংক অ্যাকাউন্ট বেছে নিন। আগে ফোন নম্বর যাচাই করতে হবে। ন্যূনতম ১০০ টাকা। আপনার টাকা নিরাপদ রাখতে নতুন UPI আইডি বা ব্যাংক অ্যাকাউন্টে প্রথম উইথড্র করতে ২৪ ঘণ্টা অপেক্ষা করতে হয়।", hi: "वॉलेट खोलकर पैसे निकालें दबाइए। UPI या बैंक खाता चुनिए। पहले आपके फ़ोन नंबर की जाँच ज़रूरी है। न्यूनतम 100 रुपये। आपके पैसे सुरक्षित रखने के लिए नई UPI आईडी या बैंक खाते से पहली निकासी के लिए 24 घंटे रुकना पड़ता है।" }],

  ["phone_check", "verify phone|phone check|verification|verify number|code not coming|otp not coming|check my phone|ফোন যাচাই|ফোন নম্বর যাচাই|कोड नहीं आया|फ़ोन जाँच|फोन जांच|नंबर वेरिफाई",
    { en: "Check my phone number", bn: "ফোন নম্বর যাচাই", hi: "फ़ोन नंबर की जाँच" },
    { en: "You check your phone number once. It is needed to receive rewards and to withdraw money. Tap the red reminder in your wallet. If the code does not come, wait a minute and try again. If it still fails, tap Talk to our team.", bn: "ফোন নম্বর একবারই যাচাই করতে হয়। পুরস্কার পেতে ও টাকা তুলতে এটি লাগে। ওয়ালেটের লাল নোটিসে চাপুন। কোড না এলে এক মিনিট অপেক্ষা করে আবার চেষ্টা করুন। তবুও না হলে আমাদের টিমের সঙ্গে কথা বলুন চাপুন।", hi: "फ़ोन नंबर की जाँच एक ही बार करनी होती है। इनाम पाने और पैसे निकालने के लिए यह ज़रूरी है। वॉलेट के लाल रिमाइंडर पर दबाइए। कोड न आए तो एक मिनट रुककर फिर कोशिश कीजिए। फिर भी न हो तो हमारी टीम से बात करें दबाइए।" }],

  ["pin", "forgot pin|reset pin|change pin|forgot password|password|pin bhul|পিন ভুলে|পিন|পাসওয়ার্ড|पिन भूल|पिन|पासवर्ड",
    { en: "Forgot my PIN", bn: "পিন ভুলে গেছি", hi: "पिन भूल गया" },
    { en: "On the sign-in screen tap Forgot PIN, enter your phone number, type the SMS code we send, and choose a new 6-digit PIN. If that does not work, tap Talk to our team. Never share your PIN with anyone.", bn: "সাইন ইন পর্দায় পিন ভুলে গেছেন চাপুন, ফোন নম্বর দিন, আমাদের পাঠানো SMS কোড লিখুন এবং নতুন ৬ সংখ্যার পিন বেছে নিন। তাতে না হলে আমাদের টিমের সঙ্গে কথা বলুন চাপুন। পিন কাউকে বলবেন না।", hi: "साइन इन स्क्रीन पर पिन भूल गए दबाइए, फ़ोन नंबर डालिए, हमारा भेजा SMS कोड लिखिए और नया 6 अंकों का पिन चुनिए। उससे न हो तो हमारी टीम से बात करें दबाइए। पिन किसी को न बताएँ।" }],

  ["login", "cannot login|can't login|login problem|sign in|log in|not able to login|সাইন ইন|লগইন|লগ ইন|लॉगिन|साइन इन",
    { en: "Sign in problem", bn: "সাইন ইন সমস্যা", hi: "साइन इन की समस्या" },
    { en: "Sign in with your 10-digit phone number and your 6-digit PIN. If you are new, tap Create account. If you forgot the PIN, tap Forgot PIN on the sign-in screen.", bn: "১০ সংখ্যার ফোন নম্বর ও ৬ সংখ্যার পিন দিয়ে সাইন ইন করুন। নতুন হলে অ্যাকাউন্ট খুলুন চাপুন। পিন ভুলে গেলে আমাদের টিমের সঙ্গে কথা বলুন চাপুন।", hi: "10 अंकों के फ़ोन नंबर और 6 अंकों के पिन से साइन इन कीजिए। नए हैं तो खाता बनाएँ दबाइए। पिन भूल गए हों तो हमारी टीम से बात करें दबाइए।" }],

  ["delete_account", "delete account|remove account|delete my data|download my data|close account|অ্যাকাউন্ট মুছ|অ্যাকাউন্ট ডিলিট|ডেটা মুছ|खाता हटा|अकाउंट डिलीट|डेटा हटा|खाता डिलीट",
    { en: "Delete my account or data", bn: "অ্যাকাউন্ট বা ডেটা মোছা", hi: "खाता या डेटा हटाना" },
    { en: "Go to Account, then My data. There you can see and download your data, name a person to act for you, and delete your account. Money you are owed is checked first.", bn: "অ্যাকাউন্ট, তারপর আমার ডেটা-য় যান। সেখানে আপনার ডেটা দেখা ও ডাউনলোড, আপনার হয়ে কাজ করার একজনের নাম দেওয়া এবং অ্যাকাউন্ট মোছা যায়। আপনার পাওনা টাকা আগে যাচাই করা হয়।", hi: "खाता, फिर मेरा डेटा में जाइए। वहाँ अपना डेटा देख और डाउनलोड कर सकते हैं, अपनी ओर से काम करने वाले का नाम दे सकते हैं और खाता हटा सकते हैं। आपके बकाया पैसे पहले जाँचे जाते हैं।" }],

  ["profile", "change name|change photo|edit profile|profile photo|update profile|নাম বদল|ছবি বদল|প্রোফাইল|नाम बदल|फोटो बदल|प्रोफाइल",
    { en: "Change my name or photo", bn: "নাম বা ছবি বদলানো", hi: "नाम या फ़ोटो बदलना" },
    { en: "Go to Account, then Edit profile. Change your name or photo and save.", bn: "অ্যাকাউন্ট, তারপর প্রোফাইল সম্পাদনা-য় যান। নাম বা ছবি বদলে সংরক্ষণ করুন।", hi: "खाता, फिर प्रोफ़ाइल बदलें में जाइए। नाम या फ़ोटो बदलकर सेव कीजिए।" }],

  ["delivery_code", "delivery code|rider code|code for rider|4 digit|four digit|otp for delivery|ডেলিভারি কোড|রাইডারকে কোড|कोड राइडर|डिलीवरी कोड",
    { en: "The delivery code", bn: "ডেলিভারি কোড", hi: "डिलीवरी कोड" },
    { en: "Your order shows a 4-digit delivery code. Tell it to the rider only when you are holding your order. The rider types it in to confirm delivery.", bn: "আপনার অর্ডারে ৪ সংখ্যার ডেলিভারি কোড দেখা যায়। অর্ডার হাতে পেলেই শুধু রাইডারকে কোডটি বলুন। রাইডার কোডটি লিখে ডেলিভারি নিশ্চিত করেন।", hi: "आपके ऑर्डर पर 4 अंकों का डिलीवरी कोड दिखता है। ऑर्डर हाथ में आने पर ही राइडर को कोड बताइए। राइडर कोड डालकर डिलीवरी पक्की करता है।" }],

  ["rider_late", "rider late|rider not coming|no rider|rider not found|rider cancelled|rider did not come|রাইডার আসেনি|রাইডার নেই|राइडर नहीं आया|राइडर देर|राइडर नहीं मिला",
    { en: "Rider late or not found", bn: "রাইডার দেরি বা পাওয়া যাচ্ছে না", hi: "राइडर देर से या नहीं मिला" },
    { en: "We look for a rider for your order. If a rider gives the job back before pickup, we look for another one automatically. Once you have paid online, a rider cannot give the job back. If it takes too long, call the shop from the order card or tap Talk to our team.", bn: "আপনার অর্ডারের জন্য আমরা রাইডার খুঁজি। পিকআপের আগে রাইডার কাজ ফেরত দিলে আমরা নিজে থেকেই অন্য রাইডার খুঁজি। অনলাইনে টাকা দিয়ে দিলে রাইডার আর কাজ ফেরত দিতে পারেন না। বেশি দেরি হলে অর্ডার কার্ড থেকে দোকানকে ফোন করুন বা আমাদের টিমের সঙ্গে কথা বলুন চাপুন।", hi: "हम आपके ऑर्डर के लिए राइडर ढूँढते हैं। पिकअप से पहले राइडर काम लौटा दे तो हम अपने आप दूसरा ढूँढते हैं। ऑनलाइन भुगतान के बाद राइडर काम वापस नहीं कर सकता। बहुत देर हो तो ऑर्डर कार्ड से दुकान को फ़ोन करें या हमारी टीम से बात करें दबाइए।" }],

  ["ride_fare", "ride fare|fare|how much for ride|auto fare|cab fare|bike fare|price of ride|asks for more|asking for more|wants more|more money|overcharge|charging more|extra money|বেশি চাইছে|বেশি টাকা|ज़्यादा माँग|ज्यादा मांग|ভাড়া|রাইডের দাম|किराया|राइड का दाम",
    { en: "Ride fare", bn: "রাইডের ভাড়া", hi: "राइड का किराया" },
    { en: "The fare is set by the distance from pickup to destination and shown before you book. If a driver asks for more than the fare shown, do not pay extra and tell us through Talk to our team.", bn: "পিকআপ থেকে গন্তব্যের দূরত্ব অনুযায়ী ভাড়া ঠিক হয় এবং বুকিংয়ের আগে দেখানো হয়। চালক দেখানো ভাড়ার বেশি চাইলে বেশি দেবেন না, আমাদের টিমের সঙ্গে কথা বলুন চাপুন।", hi: "पिकअप से मंज़िल तक की दूरी के हिसाब से किराया तय होता है और बुक करने से पहले दिखता है। चालक दिखाए किराए से ज़्यादा माँगे तो ज़्यादा न दें और हमारी टीम से बात करें दबाकर बताइए।" }],

  ["ride_code", "pickup code|ride code|ride otp|start ride|ride start|start the ride|রাইড কোড|পিকআপ কোড|राइड कोड|पिकअप कोड",
    { en: "Ride pickup code", bn: "রাইডের পিকআপ কোড", hi: "राइड पिकअप कोड" },
    { en: "When the driver arrives, show the 4-digit pickup code on your ride screen. The driver types it to start the ride. Only the driver can mark the ride completed, after you reach the destination.", bn: "চালক এলে রাইড স্ক্রিনের ৪ সংখ্যার পিকআপ কোড দেখান। চালক কোডটি লিখে রাইড শুরু করেন। গন্তব্যে পৌঁছানোর পর শুধু চালকই রাইড সম্পূর্ণ করতে পারেন।", hi: "चालक के आने पर राइड स्क्रीन का 4 अंकों का पिकअप कोड दिखाइए। चालक कोड डालकर राइड शुरू करता है। मंज़िल पर पहुँचने के बाद सिर्फ़ चालक ही राइड पूरी कर सकता है।" }],

  ["ride_cancel", "cancel ride|ride cancel|cancel my ride|driver cancelled|driver not coming|রাইড বাতিল|চালক আসেনি|राइड रद्द|ड्राइवर नहीं आया|राइड कैंसिल",
    { en: "Cancel a ride", bn: "রাইড বাতিল", hi: "राइड रद्द करना" },
    { en: "You can cancel before the ride starts. If you already paid online, a refund request is made and the team checks it. After you have paid online, the driver cannot cancel. If a driver does not come, tap Talk to our team.", bn: "রাইড শুরুর আগে বাতিল করা যায়। অনলাইনে টাকা দিয়ে থাকলে রিফান্ড অনুরোধ তৈরি হয় ও টিম দেখে। অনলাইনে টাকা দিলে চালক বাতিল করতে পারেন না। চালক না এলে আমাদের টিমের সঙ্গে কথা বলুন চাপুন।", hi: "राइड शुरू होने से पहले रद्द कर सकते हैं। ऑनलाइन भुगतान किया हो तो रिफंड अनुरोध बनता है और टीम जाँचती है। ऑनलाइन भुगतान के बाद चालक रद्द नहीं कर सकता। चालक न आए तो हमारी टीम से बात करें दबाइए।" }],

  ["ride_pay", "ride payment|pay for ride|unpaid ride|payment due|cannot book|can't book|blocked|pay the fare|ভাড়া দেওয়া|বুক করতে পারছি না|किराया देना|बुक नहीं हो रहा",
    { en: "Pay for a ride, or cannot book", bn: "রাইডের টাকা দেওয়া বা বুক করা যাচ্ছে না", hi: "राइड का भुगतान या बुक नहीं हो रहा" },
    { en: "After the ride is completed, pay online, from the wallet, or in cash to the driver. A finished ride that is unpaid stops new rides, bookings and orders until you pay it. Open the payment bar at the bottom and pay.", bn: "রাইড সম্পূর্ণ হলে অনলাইনে, ওয়ালেট থেকে বা চালককে নগদে দিন। শেষ হওয়া রাইডের টাকা বাকি থাকলে তা না দেওয়া পর্যন্ত নতুন রাইড, বুকিং ও অর্ডার বন্ধ থাকে। নিচের পেমেন্ট বার খুলে দিন।", hi: "राइड पूरी होने के बाद ऑनलाइन, वॉलेट से या चालक को नकद दीजिए। पूरी हुई राइड का भुगतान बाकी हो तो जब तक न दें, नई राइड, बुकिंग और ऑर्डर रुके रहते हैं। नीचे की भुगतान पट्टी खोलकर दीजिए।" }],

  ["hire", "hire for work|hire driver|hire a driver|by the hour|hourly|per day|daily hire|book a worker|book worker|hire worker|ঘণ্টা|দিনের জন্য|ভাড়ায় নিতে|घंटे के लिए|दिन के लिए|किराये पर",
    { en: "Hire a worker or driver", bn: "কর্মী বা চালক ভাড়া", hi: "कर्मी या चालक किराये पर" },
    { en: "Find the worker or driver, choose Hire for work, and pick hours or days. The worker sends you a price first. You tap Yes if you are OK with it, then the worker can accept. For a hired driver, show the 4-digit start code to begin. You pay from the booking card and can rate the worker after.", bn: "কর্মী বা চালক খুঁজুন, কাজের জন্য ভাড়া বেছে ঘণ্টা বা দিন ঠিক করুন। কর্মী আগে দাম পাঠান। রাজি থাকলে হ্যাঁ চাপুন, তারপর কর্মী গ্রহণ করতে পারেন। ভাড়া করা চালকের ক্ষেত্রে শুরুর জন্য ৪ সংখ্যার কোড দেখান। বুকিং কার্ড থেকে টাকা দিন ও পরে কর্মীকে রেটিং দিন।", hi: "कर्मी या चालक ढूँढिए, काम के लिए किराया चुनिए और घंटे या दिन तय कीजिए। कर्मी पहले कीमत भेजता है। सहमत हों तो हाँ दबाइए, फिर कर्मी स्वीकार कर सकता है। किराये के चालक के लिए शुरू करने को 4 अंकों का कोड दिखाइए। बुकिंग कार्ड से भुगतान कीजिए और बाद में कर्मी को रेटिंग दीजिए।" }],

  ["price_agree", "worker price|agree price|ok with price|quote|price sent|দাম রাজি|দাম পাঠিয়েছে|কর্মী দাম|कीमत सहमत|कीमत भेजी|कर्मी की कीमत",
    { en: "Agree a price", bn: "দামে রাজি হওয়া", hi: "कीमत पर सहमति" },
    { en: "A worker names the price before accepting your booking. Open Activity, My bookings. You see Are you OK with it? Tap Yes to agree, or No and the worker sends a new price. Once you agree, the price is final.", bn: "বুকিং গ্রহণের আগে কর্মী দাম জানান। অ্যাক্টিভিটি, আমার বুকিং খুলুন। আপনি কি রাজি? দেখাবে। রাজি হলে হ্যাঁ, না হলে না চাপুন, কর্মী নতুন দাম পাঠাবেন। রাজি হলে দাম চূড়ান্ত।", hi: "बुकिंग स्वीकार करने से पहले कर्मी कीमत बताता है। एक्टिविटी, मेरी बुकिंग खोलिए। क्या आप सहमत हैं? दिखेगा। सहमत हों तो हाँ, नहीं तो ना दबाइए, कर्मी नई कीमत भेजेगा। सहमति के बाद कीमत अंतिम होती है।" }],

  ["booking", "my bookings|reschedule|change time|cancel booking|booking cancel|rate worker|booking|বুকিং|সময় বদল|রেটিং|बुकिंग|समय बदल|रेटिंग",
    { en: "My bookings", bn: "আমার বুকিং", hi: "मेरी बुकिंग" },
    { en: "Open Activity, then My bookings. There you can chat, call, change the time, or cancel before it is accepted. When the work is done the worker marks it done and you can rate them.", bn: "অ্যাক্টিভিটি, তারপর আমার বুকিং খুলুন। সেখানে চ্যাট, কল, সময় বদল বা গ্রহণের আগে বাতিল করা যায়। কাজ শেষ হলে কর্মী শেষ করে দেন এবং আপনি রেটিং দিতে পারেন।", hi: "एक्टिविटी, फिर मेरी बुकिंग खोलिए। वहाँ चैट, कॉल, समय बदलना या स्वीकार होने से पहले रद्द करना कर सकते हैं। काम पूरा होने पर कर्मी उसे पूरा करता है और आप रेटिंग दे सकते हैं।" }],

  ["scheduled", "scheduled ride|daily ride|weekly ride|every day|repeat ride|schedule a ride|monthly ride|রোজ রাইড|প্রতিদিন|সাপ্তাহিক|रोज़ राइड|हर दिन|साप्ताहिक",
    { en: "Scheduled rides", bn: "নির্ধারিত রাইড", hi: "तय राइड" },
    { en: "Choose a pickup, a destination, the pickup and drop time, and once, daily or weekly. You can see when the driver is free. The price is the distance fare times the trips. Each trip day has a 4-digit code you show the driver to start.", bn: "পিকআপ, গন্তব্য, পিকআপ ও ড্রপের সময় এবং একবার, প্রতিদিন বা সাপ্তাহিক বেছে নিন। চালক কবে ফাঁকা দেখা যায়। দাম হলো দূরত্বের ভাড়া গুণ ট্রিপ। প্রতি ট্রিপের দিনে একটি ৪ সংখ্যার কোড চালককে দেখালে ট্রিপ শুরু হয়।", hi: "पिकअप, मंज़िल, पिकअप और ड्रॉप का समय, और एक बार, रोज़ या साप्ताहिक चुनिए। चालक कब खाली है यह दिखता है। कीमत दूरी का किराया गुणा ट्रिप है। हर ट्रिप के दिन एक 4 अंकों का कोड चालक को दिखाने पर ट्रिप शुरू होती है।" }],

  ["second_hand", "second hand|secondhand|sell item|buy and sell|old item|used item|buy sell|পুরনো জিনিস|বেচা|কেনা|বিক্রি|पुराना सामान|बेचना|खरीदना|सेकंड हैंड",
    { en: "Buy and sell second-hand", bn: "পুরনো জিনিস কেনা-বেচা", hi: "पुराना सामान खरीदना-बेचना" },
    { en: "Open Buy and sell. The buyer asks, the seller accepts. Once paid it cannot be cancelled. After the item is handed over, the money goes to the seller.", bn: "কিনুন-বেচুন খুলুন। ক্রেতা অনুরোধ করেন, বিক্রেতা গ্রহণ করেন। টাকা দেওয়ার পর বাতিল করা যায় না। জিনিস হাতে দেওয়ার পর টাকা বিক্রেতার কাছে যায়।", hi: "खरीदें-बेचें खोलिए। खरीदार अनुरोध करता है, विक्रेता स्वीकार करता है। भुगतान के बाद रद्द नहीं हो सकता। सामान सौंपने के बाद पैसे विक्रेता को जाते हैं।" }],

  ["become_provider", "become a worker|list my work|list my shop|register as|earn money|earn with|join as|add my shop|work with dhundo|work with dhundonow|how to earn|আয় করতে|কাজ করতে চাই|দোকান যোগ|कमाई|काम करना चाहता|दुकान जोड़",
    { en: "Earn with DhundoNow", bn: "DhundoNow-তে আয়", hi: "DhundoNow से कमाई" },
    { en: "Sign in, open the listing form, choose what you do (worker, driver, rider, shop or restaurant), fill your details and location, and save. You then get requests nearby. Earnings go to your wallet and you can withdraw them to UPI or a bank account. One login can run one kind of work.", bn: "সাইন ইন করে লিস্টিং ফর্ম খুলুন, আপনি কী করেন বেছে নিন (কর্মী, চালক, রাইডার, দোকান বা রেস্তোরাঁ), তথ্য ও অবস্থান দিয়ে সংরক্ষণ করুন। তারপর কাছের অনুরোধ পাবেন। আয় ওয়ালেটে জমা হয় ও UPI বা ব্যাংকে তোলা যায়। এক লগইনে এক ধরনের কাজ চলে।", hi: "साइन इन करके लिस्टिंग फ़ॉर्म खोलिए, चुनिए आप क्या करते हैं (कर्मी, चालक, राइडर, दुकान या रेस्टोरेंट), जानकारी और जगह भरकर सेव कीजिए। फिर पास के अनुरोध मिलेंगे। कमाई वॉलेट में जमा होती है और UPI या बैंक में निकाल सकते हैं। एक लॉगिन से एक ही तरह का काम चलता है।" }],

  ["location", "location|gps|location permission|wrong location|live location|share location|লোকেশন|অবস্থান|लोकेशन|जगह",
    { en: "Location", bn: "লোকেশন", hi: "लोकेशन" },
    { en: "DhundoNow uses your location to show nearby workers, shops and rides. Allow location in your phone or browser settings. Live location is shared only while a ride, delivery or booking is running. You can change or withdraw this in Account, Privacy.", bn: "কাছের কর্মী, দোকান ও রাইড দেখাতে DhundoNow আপনার লোকেশন ব্যবহার করে। ফোন বা ব্রাউজারের সেটিংসে লোকেশন অনুমতি দিন। লাইভ লোকেশন শুধু রাইড, ডেলিভারি বা বুকিং চলার সময় শেয়ার হয়। অ্যাকাউন্ট, গোপনীয়তা-য় এটি বদলাতে বা প্রত্যাহার করতে পারেন।", hi: "पास के कर्मी, दुकान और राइड दिखाने के लिए DhundoNow आपकी लोकेशन इस्तेमाल करता है। फ़ोन या ब्राउज़र की सेटिंग में लोकेशन की अनुमति दीजिए। लाइव लोकेशन सिर्फ़ राइड, डिलीवरी या बुकिंग चलने के दौरान साझा होती है। खाता, गोपनीयता में इसे बदल या वापस ले सकते हैं।" }],

  ["notifications", "notification|notifications|alerts|not getting alerts|push|নোটিফিকেশন|অ্যালার্ট|नोटिफिकेशन|अलर्ट",
    { en: "Notifications", bn: "নোটিফিকেশন", hi: "नोटिफिकेशन" },
    { en: "Alerts show in the bell. To get them when the app is closed, switch on alerts when the app asks, and allow notifications in your phone settings. The bell shows the latest few; tap Show more for older ones.", bn: "অ্যালার্ট ঘণ্টায় দেখা যায়। অ্যাপ বন্ধ থাকলেও পেতে অ্যাপ জিজ্ঞাসা করলে অ্যালার্ট চালু করুন এবং ফোনের সেটিংসে নোটিফিকেশনের অনুমতি দিন। ঘণ্টায় সাম্প্রতিক কয়েকটি দেখায়; পুরনোগুলোর জন্য আরও দেখুন চাপুন।", hi: "अलर्ट घंटी में दिखते हैं। ऐप बंद होने पर भी पाने के लिए ऐप के पूछने पर अलर्ट चालू कीजिए और फ़ोन की सेटिंग में नोटिफिकेशन की अनुमति दीजिए। घंटी में ताज़ा कुछ दिखते हैं; पुराने के लिए और देखें दबाइए।" }],

  ["language", "language|change language|bengali|hindi|assamese|ভাষা|ভাষা বদল|भाषा|भाषा बदल",
    { en: "Change the language", bn: "ভাষা বদল", hi: "भाषा बदलना" },
    { en: "Tap the language button in the top bar and choose your language. DhundoNow is available in many Indian languages.", bn: "উপরের বারে ভাষার বোতামে চেপে আপনার ভাষা বেছে নিন। DhundoNow অনেক ভারতীয় ভাষায় পাওয়া যায়।", hi: "ऊपर की पट्टी में भाषा के बटन पर दबाकर अपनी भाषा चुनिए। DhundoNow कई भारतीय भाषाओं में उपलब्ध है।" }],

  ["safety", "safe|safety|scam|fraud|cheat|share pin|share otp|fake call|asked for my pin|প্রতারণা|নিরাপদ|ঠগ|धोखा|सुरक्षित|ठग|फर्जी कॉल",
    { en: "Safety", bn: "নিরাপত্তা", hi: "सुरक्षा" },
    { en: "Never share your PIN. DhundoNow staff never ask for your PIN. Give the 4-digit codes only to the driver or rider you are meeting. Pay only through the app or to the person you are meeting. If someone asks you to pay outside DhundoNow or acts strangely, tap Talk to our team.", bn: "পিন কাউকে বলবেন না। DhundoNow-র কর্মীরা কখনও পিন চায় না। ৪ সংখ্যার কোড শুধু যার সঙ্গে দেখা হচ্ছে সেই চালক বা রাইডারকে দিন। অ্যাপে বা যার সঙ্গে দেখা হচ্ছে তাকেই টাকা দিন। কেউ DhundoNow-র বাইরে টাকা চাইলে বা অদ্ভুত আচরণ করলে আমাদের টিমের সঙ্গে কথা বলুন চাপুন।", hi: "पिन किसी को न बताएँ। DhundoNow का स्टाफ़ कभी पिन नहीं माँगता। 4 अंकों के कोड सिर्फ़ उसी चालक या राइडर को दें जिससे आप मिल रहे हैं। भुगतान ऐप में या उसी व्यक्ति को कीजिए जिससे मिल रहे हैं। कोई DhundoNow के बाहर भुगतान माँगे या अजीब व्यवहार करे तो हमारी टीम से बात करें दबाइए।" }],

  ["contact", "contact|talk to human|customer care|customer support|support|call you|agent|whatsapp|help me|real person|যোগাযোগ|সাপোর্ট|মানুষের সঙ্গে|संपर्क|सहायता|इंसान से|सपोर्ट",
    { en: "Talk to a person", bn: "মানুষের সঙ্গে কথা", hi: "इंसान से बात" },
    { en: "Tap Talk to our team below and write what happened. The team replies in the same chat, and you can come back to it from the helper's first screen. You can also use the WhatsApp button there.", bn: "নিচে আমাদের টিমের সঙ্গে কথা বলুন চাপুন এবং কী হয়েছে লিখুন। টিম একই চ্যাটে উত্তর দেয়, সহায়কের প্রথম পর্দা থেকে আবার আসতে পারবেন। সেখানে হোয়াটসঅ্যাপ বোতামও আছে।", hi: "नीचे हमारी टीम से बात करें दबाइए और लिखिए क्या हुआ। टीम उसी चैट में जवाब देती है, और सहायक की पहली स्क्रीन से वापस आ सकते हैं। वहाँ व्हाट्सऐप बटन भी है।" }],
];

const norm = (s) => String(s || "").toLowerCase().replace(/[‌‍]/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const pick = (o, lang) => (o && (o[lang] || o.en)) || "";

// Returns { id, answer, related: [{ id, q }] } for the best match, or null when nothing fits.
export function askHelper(text, lang = "en", skip = []) {
  const t = " " + norm(text) + " ";
  if (t.trim().length < 2) return null;
  const scored = FAQ.map(([id, words, q]) => {
    let score = 0;
    for (const w of words.split("|")) {
      const k = norm(w);
      if (!k) continue;
      const multi = k.includes(" ");
      const hit = multi || k.length >= 5 ? t.includes(k) : t.includes(" " + k + " ");
      if (hit) score += multi ? 2 + k.split(" ").length : k.length >= 5 ? 3 : 1.5;
    }
    return { id, score, q };
  }).filter((x) => x.score >= 1.5 && !skip.includes(x.id)).sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  const best = scored[0];
  const entry = FAQ.find((e) => e[0] === best.id);
  return {
    id: best.id,
    answer: pick(entry[3], lang),
    related: scored.slice(1, 3).map((x) => ({ id: x.id, q: pick(x.q, lang) })),
  };
}

export const faqAnswer = (id, lang = "en") => { const e = FAQ.find((x) => x[0] === id); return e ? { id, answer: pick(e[3], lang), q: pick(e[2], lang) } : null; };
// Questions people often ask, shown as quick buttons.
export const POPULAR = ["order_where", "refund", "cod", "withdraw", "ride_fare", "hire"];
export const faqQuestion = (id, lang = "en") => { const e = FAQ.find((x) => x[0] === id); return e ? pick(e[2], lang) : ""; };
