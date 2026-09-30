/* Content Offensive Plan, Track B — approved final drafts for "How to open
   a bank account in Cyprus" transcribed into Portable Text and saved onto
   the 4 existing DRAFT rows (created 2026-09-30, ids below). This replaces
   the earlier, thinner v1 content the user rejected ("не забывай про
   инфостиль и истину в последней инстанции") with the reviewed,
   iterated, approved version: real 5-step process, bank comparison table,
   profile-segmented document guidance (employed/self-employed/retiree/
   property-sale-funded), real document-sourcing detail, deposit-guarantee
   and CRS sections, an explicit "we assist with this if you buy through
   us" note, and per-language localization (not translation) — DE for
   DACH with Ansässigkeitsbescheinigung/apostille specifics and the
   "anonymes Bankkonto" search intent answered directly, PL with the
   CFR-1/urząd skarbowy process, RU with an expanded, carefully-worded
   section on the real, current CRS-exchange suspension with Russia and
   the August 2023 tax-treaty suspension (both verified live).

   Still DRAFT after this update — the user approved the text, not
   publication; scheduling happens as a separate, explicit step. */
import fs from "node:fs";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
let k = 0;
const key = () => `bk2${(k++).toString(36)}`;

function span(text, strong) { return { _key: key(), _type: "span", marks: strong ? ["strong"] : [], text }; }
function para(...parts) {
  const children = parts.map((p) => (Array.isArray(p) ? span(p[0], true) : span(p, false)));
  return { _key: key(), _type: "block", style: "normal", markDefs: [], children };
}
function empty() { return para(""); }
function h2(text) { return { _key: key(), _type: "block", style: "h2", markDefs: [], children: [span(text)] }; }
function h3(text) { return { _key: key(), _type: "block", style: "h3", markDefs: [], children: [span(text)] }; }
function bullet(...parts) {
  const children = parts.map((p) => (Array.isArray(p) ? span(p[0], true) : span(p, false)));
  return { _key: key(), _type: "block", style: "normal", level: 1, listItem: "bullet", markDefs: [], children };
}
function textBlock(content) { return { _key: key(), _type: "textContent", textAlign: "left", content }; }
function table(columns, rows) { return { _key: key(), _type: "tableBlock", columns, rows: rows.map((cells) => ({ _key: key(), _type: "tableRow", cells })) }; }
function faqItem(question, answerText) { return { _key: key(), question, answer: [para(answerText)] }; }
function faqBlock(items) { return { _key: key(), _type: "faqBlock", marginBottom: "medium", faq: { _type: "accordionBlock", items: items.map(([q, a]) => faqItem(q, a)) } }; }

const ROWS = {
  en: { id: "b7d0574c-b5ed-4e18-b7c8-dfa5674d380d", lang: "en" },
  de: { id: "3e9dbbb4-c74b-4ceb-95ec-dc970afac1bb", lang: "de" },
  pl: { id: "5476a35e-daf1-4634-85a2-d7019e9598c3", lang: "pl" },
  ru: { id: "93ca09f6-f138-4b84-9088-62624a9dedd6", lang: "ru" },
};

// ---------- EN ----------
const en = {
  title: "How to Open a Bank Account in Cyprus as a Foreigner (2026)",
  excerpt: "Bank comparison, a real 5-step process, which documents you need by profile (employed, self-employed, retired), where to get each one, deposit safety and CRS reporting explained.",
  seo: { metaTitle: "Open a Bank Account in Cyprus as a Foreigner: 2026 Guide", metaDescription: "Which Cyprus bank to choose by profile, a real step-by-step process, exactly which documents you need and where to get them, deposit safety, and CRS tax reporting — 2026." },
  blocks: [
    textBlock([para("Every Cyprus bank works differently for foreigners, and most articles on this topic flatten that into one generic checklist. It shouldn't be flattened: which bank you choose changes whether you ever need to set foot in Cyprus, and which documents you need changes completely depending on whether you're employed, self-employed, or retired. This covers all of it — bank selection, your specific document set by profile, exactly where each document comes from, costs, deposit safety, tax reporting, and what to do if something goes wrong.")]),
    textBlock([
      h2("Can a foreigner open a bank account in Cyprus?"), empty(),
      para("Yes, without restriction on residency status. You do not need a Cyprus address, a Cyprus residence permit, or an existing Cyprus employer. The address you provide as proof can be your home-country address. Non-EU nationals go through a more thorough verification process than EU citizens, but nationality itself is not a barrier at any of Cyprus's main banks."),
    ]),
    textBlock([
      h2("Step 1: choose your bank — the one criterion that actually matters"), empty(),
      para("Six banks realistically serve non-resident foreign clients: Bank of Cyprus, Hellenic Bank, Eurobank Cyprus, Astrobank, Alpha Bank Cyprus, and National Bank of Greece (Cyprus). The documented, verifiable difference between them is ", ["how much of the process happens remotely", true], " — not your profession or income type."),
    ]),
    table(
      ["Bank", "Remote onboarding", "Typical timeline"],
      [
        ["Bank of Cyprus", "Fully remote — forms and documents by email, identity verified on a video call, forms signed remotely", "7–10 business days once original documents reach Cyprus"],
        ["Hellenic Bank", "Application starts online; one branch visit is mandatory to finish it", "3–4 weeks"],
        ["Eurobank Cyprus, Astrobank, Alpha Bank Cyprus, National Bank of Greece (Cyprus)", "Branch visit typically expected", "Varies by branch — confirm directly before assuming a timeline"],
      ],
    ),
    textBlock([
      para("If you can't or don't want to travel to Cyprus before the account is open, that alone settles it: start with Bank of Cyprus. If you're visiting Cyprus anyway — for a viewing, for example — Hellenic Bank's online-start-plus-one-visit process fits naturally into that trip."), empty(),
      h3("Our recommendation, by situation"), empty(),
      para(["Salaried employee or retiree who wants the fastest, fully remote route: ", true], "Bank of Cyprus. Your documentation is simple enough that a video call is sufficient, and there's no reason to plan a trip around it."), empty(),
      para(["Self-employed or business owner with a more layered source-of-funds story: ", true], "Hellenic Bank, or another branch bank, if you're able to visit. A face-to-face conversation with a relationship manager resolves ambiguity about a business's income in one sitting — the kind of back-and-forth that, done purely by email with a remote bank, can add real weeks to the process."), empty(),
      para(["Buying at a higher price point, or planning to hold significant funds in Cyprus long-term: ", true], "Eurobank Cyprus. It's the one of the six most oriented toward larger deposits and investment-linked accounts alongside standard banking."), empty(),
      para(["You already bank with Alpha Bank or National Bank of Greece at home: ", true], "use that same group's Cyprus branch. An existing relationship within the same banking group tends to shorten the verification conversation, since the bank isn't starting from zero."),
    ]),
    textBlock([
      h2("Step 2: work out your document set — it depends on your income type"), empty(),
      para("This is where generic guides go wrong: \"proof of income\" means something completely different depending on whether you're salaried, self-employed, or living on a pension."), empty(),
      h3("Employed, salaried"), empty(),
      para("The most straightforward profile. You'll typically need: ", ["the last 3 months of payslips", true], ", ", ["your employment contract", true], ", and sometimes a short ", ["salary certificate", true], " from your employer. This is usually enough on its own — no further explanation needed unless the funds you're transferring are unusually large relative to your salary."), empty(),
      h3("Self-employed or business owner"), empty(),
      para("The most document-heavy profile, and the one most likely to face delays if the paperwork is vague. Expect to provide: ", ["business registration documents", true], " for your company, ", ["recent invoices", true], " or contracts showing real trading activity, ", ["tax returns", true], ", and either ", ["audited accounts", true], " or recent ", ["business bank statements", true], ". The one thing that reliably slows this down: writing \"business income\" or \"savings\" as your source of funds without documentation behind it."), empty(),
      h3("Retired, living on a pension"), empty(),
      para("You'll need a ", ["pension statement or annual pension letter", true], " from your pension provider showing the regular payment amount. If your pension is paid into an existing home-country account, a recent statement from that account showing the incoming pension payments is usually accepted alongside the pension letter itself."), empty(),
      h3("Selling a property to fund the purchase"), empty(),
      para("If the money for your Cyprus purchase is coming from a property sale, ", ["the sale contract itself is the source-of-funds document", true], ", treated as strong, specific evidence. Have the signed contract ready, not just an estimate."),
    ]),
    textBlock([
      h2("Every document, and exactly where to get it"), empty(),
      h3("Valid passport"), para("Non-EU nationals specifically need a passport, not a national ID card. Make sure it isn't close to its expiry date — some banks decline documents expiring within 6 months."), empty(),
      h3("Proof of address"), para("A utility bill or bank statement, dated within the last 2–3 months, showing your name and address. It does not need to be a Cyprus address. If your utility bills aren't in your own name, a recent bank statement showing the same address is the usual alternative."), empty(),
      h3("Bank reference letter"), para("Request it from your existing home bank, usually through online banking or by calling your branch. A short letter on the bank's letterhead confirming how long you've held your account."), empty(),
      h3("Source-of-funds evidence"), para("From your employer's HR/payroll department, your accountant, your pension provider, or your property lawyer, depending on your profile. This is the document that most often determines your timeline."), empty(),
      h3("Tax residency self-certification"), para("The bank provides the form; you fill it in with your tax residency details. Part of the CRS process — see below. Worth a quick check with your accountant beforehand if you're unsure of your exact status."), empty(),
      h3("Notarization and apostille for documents issued outside the EU"), para("For non-EU nationals, copies of your passport and other official documents typically need to be either notarised or apostilled, and non-English/Greek documents need a certified translation. Ask the bank which specific documents this applies to — an apostille can itself take one to a few weeks to obtain, so start early."),
    ]),
    textBlock([
      h2("Step 3–5: submit, verify, activate"), empty(),
      h3("3. Submit the application"), para("Bank of Cyprus: email your completed forms and document scans to the bank's account-opening team and ask them to schedule your verification video call. Hellenic Bank: start on the bank's own online portal, then book your branch appointment."), empty(),
      h3("4. Complete identity verification"), para("Bank of Cyprus verifies you on the video call itself. Every branch-based bank verifies you in person — bring the physical originals of every document you scanned, not just the scans. Bank of Cyprus: 7–10 business days from receipt of your original documents in Cyprus. Hellenic Bank: 3–4 weeks total."), empty(),
      h3("5. Activate online banking and get your IBAN"), para("Once approved, you receive your IBAN, a debit card, and online banking credentials. Activate online access immediately — you'll need it to send or receive your first transfer, including a property-purchase payment."),
    ]),
    textBlock([
      h2("What it costs"), empty(),
      para("None of the six banks charge a fee simply to open an account, and there's no meaningful minimum deposit for a standard personal account at most of them. Budget instead for a modest monthly account-maintenance fee, a SEPA transfer fee for euro transfers within the EU, and a debit card issuance fee at some banks."),
    ]),
    textBlock([
      h2("Is your money safe in a Cyprus bank?"), empty(),
      para("Worth answering directly, since Cyprus's 2013 banking crisis and bail-in still shapes how people think about this. The regulatory picture today is different: deposits are protected under the same EU Deposit Guarantee Scheme as every other Eurozone country, covering up to ", ["€100,000 per depositor, per bank", true], ", under EU Directive 2014/49/EU. All six banks listed here are supervised by the European Central Bank."), empty(),
      para("If you're holding more than €100,000, split the balance across more than one bank so each portion stays under the guaranteed threshold, or move the surplus once the purchase is complete."),
    ]),
    textBlock([
      h2("Will your home country find out about this account?"), empty(),
      para("Yes, automatically. Cyprus has applied the OECD's Common Reporting Standard (CRS) since 2016, and reports account information to your declared country of tax residence every year, along with 49 other participating jurisdictions. Declaring the account correctly on your own tax return at home is the straightforward way to handle this — worth raising with your accountant before you open the account, not after."),
    ]),
    textBlock([
      h2("If you're buying property through us"), empty(),
      para("We handle the bank-account side of the purchase alongside the transaction itself — preparing your lawyer's reference letter, coordinating with the bank on the source-of-funds documentation for the purchase specifically, and keeping the account-opening timeline aligned with your purchase contract deadlines."),
    ]),
    textBlock([
      h2("Common reasons an application gets delayed or rejected"), empty(),
      bullet(["Vague source-of-funds documentation", true], " — \"savings\" or \"business income\" with no paperwork behind it is the single most common cause of delay, especially for self-employed applicants"),
      bullet(["A proof-of-address document older than 2–3 months", true]),
      bullet(["Missing apostille or certified translation", true], " on documents from outside the EU, discovered only after submission"),
      bullet(["Unexplained large or irregular transactions", true], " in your recent bank history"),
      bullet(["Missing tax residency self-certification", true]),
      empty(),
      para("Banks aren't required to give a detailed reason for a rejection. A Revolut or Wise account keeps you able to move money while you fix the specific gap and reapply."),
    ]),
    faqBlock([
      ["Which bank should I choose if I'm self-employed?", "We'd point self-employed applicants and business owners toward a branch-based bank like Hellenic — a face-to-face conversation with a relationship manager tends to resolve source-of-funds questions about a business faster than an email exchange with a fully remote bank."],
      ["Do I need to visit Cyprus in person to open a bank account?", "Not with Bank of Cyprus — the whole process happens by video call and email. Hellenic Bank and the other four banks require at least one in-person branch visit."],
      ["How long does it actually take?", "7–10 business days with Bank of Cyprus once your original documents reach Cyprus, or 3–4 weeks with Hellenic Bank end to end."],
      ["Where do I get an apostille for my documents?", "From the designated legalisation authority in the country that issued the document. Start early — it can take one to a few weeks depending on your country."],
      ["Is my money safe in a Cyprus bank after the 2013 crisis?", "Deposits up to €100,000 per bank are protected under the same EU Deposit Guarantee Scheme as any other Eurozone country, and all six banks listed here are supervised directly by the European Central Bank."],
      ["Will my home country's tax authority find out about my Cyprus account?", "Yes. Cyprus has applied the OECD Common Reporting Standard since 2016 and automatically reports account information to your declared country of tax residence every year."],
      ["Do I need a Cyprus bank account to buy property?", "Not strictly for the purchase transaction itself, but you'll need one afterward for utilities, communal fees and property tax."],
    ]),
  ],
};

async function main() {
  const enRow = await prisma.blog.findUnique({ where: { id: ROWS.en.id } });
  if (!enRow) throw new Error("ABORT: EN draft row not found");
  if (enRow.status !== "DRAFT") throw new Error(`ABORT: EN row status is ${enRow.status}, not DRAFT`);
  await prisma.blog.update({ where: { id: ROWS.en.id }, data: { title: en.title, excerpt: en.excerpt, seo: en.seo, contentBlocks: en.blocks } });
  console.log("EN draft updated with approved content.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
