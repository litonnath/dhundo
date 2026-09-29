// Bengali screens for the ad video. Separate from shot.mjs so the
// verification harness stays a verification harness.
import { chromium } from "playwright";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = path.resolve("dist");
const TY = {".html":"text/html",".js":"text/javascript",".png":"image/png",
            ".webmanifest":"application/manifest+json",".json":"application/json"};
const srv = http.createServer((q,r)=>{let p=q.url.split("?")[0]; if(p==="/")p="/index.html";
  const f=path.join(ROOT,p); if(!fs.existsSync(f)){r.writeHead(404);return r.end("no");}
  r.writeHead(200,{"Content-Type":TY[path.extname(f)]||"application/octet-stream"});
  r.end(fs.readFileSync(f));});
await new Promise(r=>srv.listen(4180,r));

const GROUPS=["Construction","Drivers","Home & Domestic","Food","Repairs","Vehicle","Events","Suppliers"];
const BN={Construction:"মিস্ত্রি",Drivers:"ড্রাইভার","Home & Domestic":"ঘরের কাজ",Food:"রান্না",
          Repairs:"সারাই",Vehicle:"গাড়ি",Events:"অনুষ্ঠান",Suppliers:"দোকান"};
const trades=GROUPS.flatMap((g,gi)=>Array.from({length:4},(_,i)=>({
  slug:`t${gi}-${i}`, name_en:`${g} job ${i+1}`, name_bn:`${BN[g]} ${i+1}`, name_hi:null,
  kind:"worker", group_name:g, sort_order:gi*10+i, listing_count:gi===0?3-i:0,
  requires_vehicle:g==="Drivers", requires_id:g==="Drivers"||g==="Home & Domestic"})));

const workers=[
 {id:"1",full_name:"রঞ্জিত দেববর্মা",trade_slug:"t0-0",trade_name:"রাজমিস্ত্রি",other_trades:[],
  years_experience:12,day_rate_min:700,day_rate_max:900,locality:"কৃষ্ণনগর",city:"আগরতলা",
  about:"ইট গাঁথা, প্লাস্টার, ছোট মেরামত।",languages:["Bengali"],photos:[],verified:true,
  distance_km:1.2,total_count:3},
 {id:"2",full_name:"সুজিত দাস",trade_slug:"t0-1",trade_name:"কাঠমিস্ত্রি",other_trades:[],
  years_experience:6,day_rate_min:800,day_rate_max:null,locality:"বনমালীপুর",city:"আগরতলা",
  about:"দরজা, জানালা, আসবাব।",languages:["Bengali"],photos:[],verified:false,
  distance_km:2.8,total_count:3},
 {id:"3",full_name:"বিকাশ দেবনাথ",trade_slug:"t0-0",trade_name:"রাজমিস্ত্রি",other_trades:[],
  years_experience:9,day_rate_min:650,day_rate_max:850,locality:"পানিসাগর",city:"আগরতলা",
  about:"ঢালাই আর টাইলের কাজ।",languages:["Bengali"],photos:[],verified:true,
  distance_km:4.1,total_count:3}];

async function shot(name, go, {w=390,h=844}={}) {
  const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:3});
  const page=await ctx.newPage();
  page.on("pageerror",e=>console.log("PAGEERROR",name,e.message));
  await page.route("**/rest/v1/rpc/**",(route)=>{
    const u=route.request().url();
    const body=u.includes("list_trades")?trades
      :u.includes("browse_workers")?workers
      :u.includes("services_cities")?[{id:1,place:"পানিসাগর",district:"উত্তর ত্রিপুরা",block:null,lat:24.1,lng:92.2},
                                      {id:2,place:"ধর্মনগর",district:"উত্তর ত্রিপুরা",block:null,lat:24.3,lng:92.1}]
      :u.includes("wallet_balance")?500
      :u.includes("my_referrals")?[{code:"Y7RWHJ",invited:0,published:0,earned_paise:0}]
      :u.includes("wallet_history")?[{id:"e1",amount_paise:500,kind:"signup_bonus",note:"Welcome bonus",created_at:new Date().toISOString()}]
      :u.includes("services_me")?[{account_id:"acc-1",phone:"919862012345",full_name:"লিটন",is_admin:false}]
      :[];
    route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
  });
  await page.route("**/auth/v1/**",r=>r.fulfill({status:400,contentType:"application/json",body:"{}"}));
  await page.addInitScript(()=>{try{
    localStorage.setItem("services_lang","bn");
    localStorage.setItem("dhundo_geo_tried","1");
    localStorage.setItem("dhundo_place",JSON.stringify({area:"কৃষ্ণনগর",state:"Tripura"}));
    localStorage.setItem("dhundo_session",JSON.stringify({
      user:{id:"acc-1",phone:"919862012345",full_name:"লিটন",is_admin:false},
      access_token:"t",refresh_token:"t",expires_at:Date.now()+3600000}));
  }catch(e){}});
  await page.goto("http://localhost:4180/",{waitUntil:"networkidle"});
  if(go) await go(page);
  await page.waitForTimeout(400);
  await page.screenshot({path:`ad/${name}.png`});
  await ctx.close();
  console.log("ad shot", name);
}

const browser=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"});
fs.mkdirSync("ad",{recursive:true});

await shot("home", null);
await shot("results", async p=>{
  // Through the search box, which is how somebody actually uses this --
  // and far more robust than counting buttons in the header.
  const box = p.locator('input[placeholder]').first();
  await box.fill("মিস্ত্রি");
  await p.waitForTimeout(900);
});

await shot("form", async p=>{
  await p.getByRole("button").nth(4).click().catch(()=>{});
  await p.waitForTimeout(800);
});

await shot("wallet", async p=>{
  await p.getByText("₹5",{exact:true}).first().click();
  await p.waitForTimeout(600);
});

await browser.close(); srv.close();
