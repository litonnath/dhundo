// ---------------------------------------------------------------------------
// TERMS OF SERVICE at /terms (the Play Store, Meta and PayU ask for a link).
// Plain English. DRAFT: have a lawyer who works on Indian consumer and
// e-commerce law read it before relying on it. Edit TERMS below to change it.
// ---------------------------------------------------------------------------
import React from "react";
import { T } from "./ui.jsx";
import { CONTACT, GRIEVANCE } from "./brand.jsx";

const TERMS = {
  title: "Terms of Service",
  updated: "Last updated: 13 October 2026",
  s: [
    ["Who we are", "DhundoNow is an online platform that helps people in India find and book independent local service providers (workers, drivers, riders), order from shops and restaurants, and buy and sell second-hand items. DhundoNow is the platform. The providers, shops and sellers are independent businesses or individuals. They are not employees or agents of DhundoNow."],
    ["Using DhundoNow", "You must be 18 or older, or use DhundoNow with a parent or guardian who accepts these terms. Give true details, keep your PIN private, and do not let anyone else use your account. You are responsible for what happens under your account."],
    ["What DhundoNow does and does not do", "We show listings, take bookings, orders and ride requests, hold payments, and pass them on. We do not provide the service, deliver the goods, or inspect second-hand items ourselves. The service, goods and any promises about them come from the provider or seller. Prices, fares and fees are shown before you confirm."],
    ["Payments, holding and payouts", "Online payments are collected through our payment partner (PayU). We hold the money until the work is done: an order is delivered, a ride is completed, a booking is finished, or a second-hand item is handed over. Then the provider's share is released to their DhundoNow wallet. A platform fee and GST are shown at checkout. Cash-on-delivery orders carry an extra charge shown before you confirm. A delivery fee paid up front can be partly refunded to your wallet when the real fee is lower."],
    ["Cancellations and refunds", "You can cancel before the work starts, as shown in the app. Refunds are checked and approved by DhundoNow, not paid out automatically, and go to your DhundoNow wallet or the original payment method as shown in the app. We may refuse a refund if the service was given or the rules were broken. Second-hand items cannot be cancelled once the seller has accepted. If you paid twice or an amount does not match, we record it and refund the difference after checking."],
    ["Wallet and withdrawals", "Earnings and refunds sit in your DhundoNow wallet. You can withdraw to a bank account or UPI ID you own after your phone number is checked. We may delay or refuse a withdrawal that looks like fraud, until we have checked it."],
    ["Rules for everyone", "Do not post false, illegal, offensive or misleading content. Do not sell prohibited or stolen goods. Do not harass others, misuse live location, chat or contact details, copy listings, or try to break or overload the platform. Do not take a booking or order off the platform to avoid fees."],
    ["Providers, shops and sellers", "You must be allowed to do the work you offer and follow the law (licences, safety, taxes, food rules, traffic rules). Keep your prices, hours and details correct. Riders and drivers must keep the right licence, vehicle papers and insurance. You are responsible for your own taxes."],
    ["Reviews and ratings", "Reviews must be honest and about your own experience. We may remove reviews that are fake, abusive or unrelated."],
    ["Safety and location", "Live location is shared only to run the booking, ride or delivery you chose, and only while it runs. Meet in safe places, check the trip code before a ride, and do not share your PIN or OTP codes."],
    ["Our responsibility", "We try to keep DhundoNow working, but we do not promise it will always be available or error-free. We are not responsible for the quality, safety or delivery of services and goods from independent providers, or for losses we could not reasonably have prevented. Where the law allows, our total responsibility to you for any claim is limited to the amount you paid through DhundoNow for the order, ride or booking in question. Nothing here limits rights you have under Indian consumer law."],
    ["Suspending an account", "We may warn, limit or close an account that breaks these terms, is used for fraud, or puts others at risk. You may close your account from the app. Money you are owed, after any checks, stays yours."],
    ["Your data", "How we use your personal data is explained in our Privacy Notice at /privacy. You can see, correct and delete your data from the app."],
    ["Changes to these terms", "We may update these terms. We will show the date above and, for big changes, a notice in the app. Using DhundoNow after a change means you accept it."],
    ["Law and complaints", "Indian law applies. Courts in India have jurisdiction. For a complaint about an order, ride, booking, payment or these terms, contact {who} using the details below. We will reply within the time the law requires."],
  ],
};

export function TermsPage() {
  const contact = [CONTACT.email, CONTACT.whatsapp ? `WhatsApp +${CONTACT.whatsapp.replace(/^91/, "91 ")}` : ""].filter(Boolean).join(" · ");
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "22px 18px 40px", background: T.white,
                  minHeight: "100vh", boxSizing: "border-box",
                  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
      <a href="/" style={{ color: T.brandDark, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>← DhundoNow</a>
      <div style={{ height: 10 }} />
      <h1 style={{ fontSize: 22, fontWeight: 800, color: T.ink, margin: "0 0 2px" }}>{TERMS.title}</h1>
      <div style={{ fontSize: 12.5, color: T.inkFaint, marginBottom: 14 }}>{TERMS.updated}</div>
      {TERMS.s.map(([h, body], i) => (
        <section key={i} style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, margin: "0 0 3px" }}>{h}</h2>
          <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.65, margin: 0 }}>{body.replace("{who}", GRIEVANCE.name)}</p>
        </section>
      ))}
      {contact && <p style={{ fontSize: 14, color: T.ink, fontWeight: 700 }}>{contact}</p>}
      <p style={{ fontSize: 13, color: T.inkFaint }}><a href="/privacy" style={{ color: T.brandDark }}>Privacy Notice</a></p>
    </div>
  );
}
