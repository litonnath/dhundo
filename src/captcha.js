// ---------------------------------------------------------------------------
// The CAPTCHA check Supabase asks for when "CAPTCHA protection" is switched on
// (Authentication > Attack Protection). Works with Cloudflare Turnstile or
// hCaptcha. Switched on by two lines in src/config.js:
//   export const CAPTCHA_PROVIDER = "turnstile";   // or "hcaptcha"
//   export const CAPTCHA_SITE_KEY = "...";          // the PUBLIC site key
// With no site key nothing is shown and nothing is sent, so a project that has
// not switched the protection on is unaffected.
// ---------------------------------------------------------------------------
const SRC = {
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  hcaptcha: "https://js.hcaptcha.com/1/api.js?render=explicit",
};
const loading = {};

function load(provider) {
  if (typeof window !== "undefined" && window[provider]) return Promise.resolve();
  if (!loading[provider]) {
    loading[provider] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SRC[provider]; s.async = true; s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => { loading[provider] = null; reject(new Error("CAPTCHA")); };
      document.head.appendChild(s);
    });
  }
  return loading[provider];
}

export async function captchaToken(cfg) {
  if (!cfg || !cfg.captchaKey) return null;
  const provider = cfg.captchaProvider === "hcaptcha" ? "hcaptcha" : "turnstile";
  await load(provider);
  return new Promise((resolve, reject) => {
    const overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.style.cssText = "position:fixed;inset:0;z-index:900;background:rgba(15,20,25,.55);display:flex;align-items:center;justify-content:center;padding:16px";
    const box = document.createElement("div");
    box.style.cssText = "background:#fff;border-radius:14px;padding:18px;min-width:300px;min-height:80px;display:flex;flex-direction:column;align-items:center;gap:10px;position:relative";
    const x = document.createElement("button");
    x.type = "button"; x.textContent = "✕"; x.setAttribute("aria-label", "Close");
    x.style.cssText = "position:absolute;top:6px;right:8px;border:none;background:none;font-size:18px;cursor:pointer;color:#555";
    const mount = document.createElement("div");
    box.appendChild(x); box.appendChild(mount); overlay.appendChild(box); document.body.appendChild(overlay);
    let id = null;
    const done = (fn, v) => {
      try { if (id != null) window[provider].remove ? window[provider].remove(id) : window[provider].reset(id); } catch (_) {}
      overlay.remove(); fn(v);
    };
    x.onclick = () => done(reject, new Error("CAPTCHA"));
    try {
      const opts = {
        sitekey: cfg.captchaKey,
        callback: (tok) => done(resolve, tok),
        "error-callback": () => done(reject, new Error("CAPTCHA")),
        "expired-callback": () => {},
      };
      if (provider === "turnstile") opts.appearance = "interaction-only";
      id = window[provider].render(mount, opts);
    } catch (_) { done(reject, new Error("CAPTCHA")); }
  });
}
