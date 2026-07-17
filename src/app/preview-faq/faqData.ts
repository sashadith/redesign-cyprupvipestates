// Auto-generated from the live /faq page's FAQPage JSON-LD (verbatim question/answer
// text, paragraph-split from the flattened schema text). Category grouping, slugs and
// descriptions are new IA work for the redesign — the live Sanity "faq" singlepage has
// no category field yet. See preview-faq/page.tsx for how this feeds the FAQPage schema.
//
// This EN content is now also the seed source for the `faqPage` SiteDocument row
// (prisma.siteDocument, type="faqPage", language="en") that [lang]/page.tsx actually
// reads at request time — see scripts/seed-faq-translations.mjs. This file stays as
// the canonical EN reference/fallback; it's not re-imported by the live page anymore.

import type { FaqCategory } from "@/types/faq";
export type { FaqItem, FaqCategory } from "@/types/faq";

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    slug: "foreigner",
    label: "Buying as a Foreigner",
    description: "Eligibility for EU, non-EU and remote buyers.",
    items: [
      {
        id: "can-foreigners-buy-property-in-cyprus",
        question: `Can foreigners buy property in Cyprus?`,
        answer: [
        `Yes, foreigners can buy property in Cyprus, and the country remains one of the more accessible European destinations for overseas property buyers. Citizens of EU member states usually encounter fewer limitations when purchasing property, whereas buyers from outside the EU may be required to obtain permission from the Council of Ministers. In practice, this approval is often handled as part of the legal process and does not usually prevent purchases from moving forward.`,
        `International buyers purchase different types of property in Cyprus, including apartments, villas, townhouses, and off-plan developments. Some buyers are searching for holiday homes, while others relocate permanently or invest for rental income.`,
        `The buying process usually begins with choosing a property and signing a reservation agreement to secure it. A lawyer then performs legal checks, reviews ownership documents, verifies permits, and prepares the contract of sale. After signing, the agreement is lodged with the Land Registry to secure buyer rights.`,
        `Foreign buyers should also consider additional costs beyond the purchase price, such as legal fees, taxes, and currency exchange fluctuations.`,
        ],
      },
      {
        id: "can-i-buy-property-in-cyprus-remotely",
        question: `Can I buy property in Cyprus remotely?`,
        answer: [
        `Yes. Buying property in Cyprus remotely has become increasingly common, particularly among investors and international buyers who cannot travel during the transaction process. Many purchases are completed using legal representation and power of attorney.`,
        `Remote purchases usually involve:`,
        `Online property viewings or video tours Digital communication with agents and lawyers Contract reviews via email Bank transfers for staged payments Representation during legal procedures`,
        `Although remote buying is possible, independent legal checks remain important. Buyers should ensure the property has proper permits, verify ownership status, and understand payment schedules before committing.`,
        `Remote purchasing can save time, but due diligence should never be skipped.`,
        ],
      },
      {
        id: "can-non-eu-citizens-buy-property-in-cyprus",
        question: `Can non-EU citizens buy property in Cyprus?`,
        answer: [
        `Yes. Non-EU citizens can purchase property in Cyprus, although additional procedures may apply compared with EU buyers.`,
        `In some cases, approval from the Council of Ministers is required. This approval process is typically managed by the buyer's lawyer and is considered a standard administrative step rather than a significant obstacle.`,
        `Non-EU buyers often purchase property for:`,
        `Relocation purposes Retirement Holiday homes Long-term investment Rental income generation`,
        `Requirements may vary depending on nationality, intended property use, and individual circumstances. Because regulations can evolve, buyers should always confirm current legal requirements before proceeding.`,
        ],
      },
    ],
  },
  {
    slug: "process",
    label: "The Buying Process",
    description: "Step by step, from reservation to final transfer.",
    items: [
      {
        id: "how-does-the-property-buying-process-work-in-cyprus",
        question: `How does the property buying process work in Cyprus?`,
        answer: [
        `The property buying process in Cyprus usually follows several stages.`,
        `Step 1: Property selection. Buyers compare projects, locations, developers, and investment potential before choosing a property. Step 2: Reservation agreement. A reservation agreement may be signed to temporarily remove the property from the market. Step 3: Legal checks (due diligence). Lawyers review ownership documents, permits, debts, encumbrances, and development approvals. Step 4: Contract preparation and signing. The purchase agreement is prepared and signed by both parties. Step 5: Contract registration. The contract is typically lodged with authorities to secure buyer rights. Step 6: Payment completion and transfer procedures. Remaining payments are made according to agreed schedules.`,
        `The exact process differs between resale properties and new developments.`,
        ],
      },
      {
        id: "how-long-does-buying-property-in-cyprus-take",
        question: `How long does buying property in Cyprus take?`,
        answer: [
        `The timeframe depends on property type, financing, legal checks, and buyer circumstances.`,
        `A straightforward purchase may take several weeks, while more complex transactions involving mortgages, off-plan developments, or additional approvals can take longer.`,
        `Factors affecting duration include:`,
        `Document availability Mortgage approval Legal verification Developer schedules International transfers Residency-related procedures`,
        `Buyers seeking investment property often prioritise speed, while relocation buyers may focus more heavily on due diligence.`,
        ],
      },
      {
        id: "is-visiting-cyprus-necessary-before-purchase",
        question: `Is visiting Cyprus necessary before purchase?`,
        answer: [
        `Not always, but visiting can provide valuable insight into locations, infrastructure, neighbourhoods, and lifestyle.`,
        `Two properties with similar prices may appeal to very different buyer profiles depending on:`,
        `Distance to beaches Schools Transport Restaurants Seasonal activity Rental demand`,
        `Many investors purchase remotely, while lifestyle buyers often prefer in-person visits before making long-term decisions.`,
        ],
      },
      {
        id: "what-is-a-reservation-agreement",
        question: `What is a reservation agreement?`,
        answer: [
        `A reservation agreement is an early document intended to temporarily reserve a property while legal checks are carried out.`,
        `It often outlines:`,
        `Reservation amount Holding period Conditions Refund rules`,
        `Terms vary significantly between sellers and developers.`,
        ],
      },
      {
        id: "is-a-reservation-deposit-refundable",
        question: `Is a reservation deposit refundable?`,
        answer: [
        `Refundability depends entirely on contract terms.`,
        `Some deposits may be refundable under specific circumstances, while others may not. Buyers should review reservation agreements carefully before signing.`,
        ],
      },
      {
        id: "when-is-the-purchase-contract-signed",
        question: `When is the purchase contract signed?`,
        answer: [
        `The contract is generally signed after legal checks and agreement on terms.`,
        `Timing differs depending on:`,
        `Property type Developer Financing Negotiations`,
        ],
      },
      {
        id: "what-happens-after-signing-the-contract",
        question: `What happens after signing the contract?`,
        answer: [
        `After signing, the contract may be registered with authorities to protect buyer rights.`,
        `Additional steps often include:`,
        `Payment schedules Transfer procedures Mortgage completion Final ownership processes`,
        ],
      },
      {
        id: "what-mistakes-do-foreign-buyers-make-when-purchasing-propert",
        question: `What mistakes do foreign buyers make when purchasing property in Cyprus?`,
        answer: [
        `Common mistakes include:`,
        `Choosing based only on price, underestimating additional costs, relying solely on marketing materials, ignoring legal checks, and assuming projected rental returns are guaranteed. Careful planning and independent advice can reduce risk significantly.`,
        ],
      },
    ],
  },
  {
    slug: "legal",
    label: "Documents & Legal Support",
    description: "The paperwork involved, and what a lawyer checks for you.",
    items: [
      {
        id: "what-documents-are-required-to-buy-property-in-cyprus",
        question: `What documents are required to buy property in Cyprus?`,
        answer: [
        `Required documents vary depending on buyer nationality and transaction type, but commonly include:`,
        `Passport identification Proof of address Source of funds documentation Reservation agreements Purchase contracts Financial information (for mortgages)`,
        `Additional paperwork may apply for non-EU buyers or residency-related purchases.`,
        ],
      },
      {
        id: "do-i-need-a-lawyer-when-buying-property-in-cyprus",
        question: `Do I need a lawyer when buying property in Cyprus?`,
        answer: [
        `Independent legal representation is strongly recommended and is considered one of the most important protections during the purchase process.`,
        `A lawyer typically reviews:`,
        `Ownership status Existing debts Planning permissions Building permits Contract terms Registration procedures`,
        `Buying without legal checks increases risk significantly.`,
        ],
      },
      {
        id: "what-does-a-lawyer-check-during-the-purchase-process",
        question: `What does a lawyer check during the purchase process?`,
        answer: [
        `Lawyers commonly verify:`,
        `Whether the seller legally owns the property Existing loans or charges Construction permits Planning permissions Contract accuracy Registration requirements`,
        `These checks help reduce the risk of disputes or unexpected liabilities after purchase.`,
        ],
      },
    ],
  },
  {
    slug: "costs",
    label: "Costs, Taxes & VAT",
    description: "What you'll actually pay beyond the advertised price.",
    items: [
      {
        id: "what-additional-costs-should-i-expect-besides-the-property-p",
        question: `What additional costs should I expect besides the property price?`,
        answer: [
        `The advertised property price is rarely the final amount a buyer spends. Purchasing real estate in Cyprus often involves several additional costs that should be included in budgeting calculations.`,
        `Common extra expenses include:`,
        `Legal fees. Independent lawyers typically charge for contract reviews, ownership verification, and transaction support. Stamp duty. A government fee calculated according to property value. VAT. Some new developments may include Value Added Tax, while resale properties may not. Transfer fees. This may apply in specific cases, depending on whether VAT has already been paid on the property. Property insurance. Especially relevant for financed properties. Bank and currency exchange costs. International transfers can create unexpected expenses.`,
        `Understanding the total acquisition cost is essential, particularly for investors comparing projected rental yields or long-term returns.`,
        ],
      },
      {
        id: "is-vat-included-when-buying-property-in-cyprus",
        question: `Is VAT included when buying property in Cyprus?`,
        answer: [
        `The way VAT is applied mainly depends on whether the property is newly built or part of the resale market.`,
        `New-build properties are often subject to VAT, while resale properties may be exempt. Under certain circumstances, reduced VAT rates can apply when the purchased property becomes the buyer's primary residence.`,
        `Because VAT rules change and eligibility depends on individual situations, buyers should always confirm current requirements before completing a transaction.`,
        `Incorrect assumptions about VAT can significantly affect the overall purchase budget.`,
        ],
      },
      {
        id: "how-much-extra-money-should-buyers-budget-beyond-the-propert",
        question: `How much extra money should buyers budget beyond the property price?`,
        answer: [
        `There is no universal percentage because total additional costs depend on property type, financing structure, and taxation rules.`,
        `Several factors influence budgeting:`,
        `Whether VAT applies Whether financing is required Legal complexity Property value Developer agreements Intended use (investment or residence)`,
        `Buyers focused on investment returns should evaluate acquisition costs together with projected rental income and future resale potential.`,
        `Looking only at purchase price can create unrealistic expectations regarding profitability.`,
        ],
      },
      {
        id: "what-taxes-do-property-buyers-pay-in-cyprus",
        question: `What taxes do property buyers pay in Cyprus?`,
        answer: [
        `Taxes vary depending on the transaction type and whether the property is new or resale.`,
        `Potential costs may include:`,
        `VAT Stamp duty Transfer-related charges Capital gains considerations when selling Municipal charges`,
        `Tax obligations evolve over time and may differ according to buyer circumstances.`,
        `Because taxation directly affects investment performance, many overseas buyers seek professional legal or financial guidance before purchasing.`,
        ],
      },
      {
        id: "what-vat-rates-apply-to-property-purchases-in-cyprus",
        question: `What VAT rates apply to property purchases in Cyprus?`,
        answer: [
        `Applicable VAT rates depend on several factors including:`,
        `Property category Intended use Buyer eligibility Government regulations at the time of purchase`,
        `Reduced rates may apply under specific conditions, while standard rates may apply in others.`,
        `Eligibility requirements can change over time, meaning buyers should verify current rules rather than relying on outdated information.`,
        ],
      },
      {
        id: "can-reduced-vat-apply-when-buying-property",
        question: `Can reduced VAT apply when buying property?`,
        answer: [
        `In some circumstances, reduced VAT treatment may apply, particularly when purchased property becomes a primary residence rather than purely investment property.`,
        `Eligibility conditions often involve:`,
        `Intended use Property size Residency status Regulatory requirements`,
        `Because reduced VAT can significantly lower acquisition costs, buyers considering relocation often examine these rules carefully.`,
        ],
      },
      {
        id: "are-resale-properties-taxed-differently-from-new-development",
        question: `Are resale properties taxed differently from new developments?`,
        answer: [
        `Yes, taxation frequently differs between resale and newly constructed properties.`,
        `New developments may involve VAT, while resale properties often follow different cost structures.`,
        `This distinction can affect:`,
        `Initial acquisition cost Transfer-related charges Investment calculations Long-term profitability`,
        `Buyers comparing off-plan developments with resale units should evaluate total ownership costs rather than focusing only on listing prices.`,
        ],
      },
      {
        id: "what-are-transfer-fees-when-buying-property",
        question: `What are transfer fees when buying property?`,
        answer: [
        `Transfer fees are costs associated with transferring ownership rights.`,
        `Whether transfer fees apply, and how they are calculated, depends on multiple factors including previous VAT treatment and applicable regulations.`,
        `Transfer-related expenses can influence total purchase cost considerably, making them important for budgeting purposes.`,
        ],
      },
      {
        id: "how-much-are-legal-fees-when-buying-property-in-cyprus",
        question: `How much are legal fees when buying property in Cyprus?`,
        answer: [
        `Legal fees vary depending on:`,
        `Transaction complexity Property value Lawyer experience Additional services required`,
        `Independent legal support often includes:`,
        `Ownership verification Permit checks Contract reviews Registration guidance`,
        `While some buyers focus on minimising legal expenses, insufficient legal checks can increase risk significantly.`,
        ],
      },
      {
        id: "are-annual-property-taxes-payable-in-cyprus",
        question: `Are annual property taxes payable in Cyprus?`,
        answer: [
        `Cyprus abolished national immovable property tax several years ago. However, certain local or municipal charges may still apply depending on location.`,
        `Owners should evaluate ongoing costs such as:`,
        `Municipal charges Maintenance fees Insurance Shared development expenses`,
        `Ongoing ownership costs matter particularly for long-term investors.`,
        ],
      },
    ],
  },
  {
    slug: "investment",
    label: "Investment & Rental Returns",
    description: "Yields, strategy, and where investors are buying.",
    items: [
      {
        id: "is-cyprus-good-for-property-investment",
        question: `Is Cyprus good for property investment?`,
        answer: [
        `Cyprus continues attracting property investors due to tourism, relocation demand, favourable climate, and growing interest from international buyers. Popular investment strategies include long-term rentals, holiday lets, resale after construction completion, and income-generating apartments.`,
        `Investment performance varies considerably depending on:`,
        `Location Property type Purchase price Rental strategy Developer quality Infrastructure nearby`,
        `Cities such as Paphos and Limassol often attract different investor profiles. Some buyers are mainly interested in lifestyle benefits or retirement opportunities, while others focus on generating rental returns or achieving long-term capital growth.`,
        `No property investment is risk-free, which is why projected yields should be evaluated together with taxes, maintenance costs, vacancy periods, and management expenses.`,
        ],
      },
      {
        id: "what-rental-yields-can-investors-expect-in-cyprus",
        question: `What rental yields can investors expect in Cyprus?`,
        answer: [
        `Rental yields in Cyprus vary widely and depend on property type, city, seasonality, and rental strategy.`,
        `Properties aimed at the tourism market can offer stronger seasonal rental returns, although occupancy levels may vary throughout the year. Long-term rentals can provide greater predictability but potentially lower peak returns.`,
        `Important factors affecting returns include:`,
        `Distance to the sea City popularity Infrastructure Property condition Nearby schools or business centres Demand from expats or tourists`,
        `Investors should calculate expected income using realistic occupancy assumptions rather than optimistic projections.`,
        ],
      },
      {
        id: "why-do-international-investors-buy-property-in-cyprus",
        question: `Why do international investors buy property in Cyprus?`,
        answer: [
        `Investor motivations vary considerably.`,
        `Common reasons include:`,
        `Rental income generation. Some buyers aim to generate regular income through long-term or short-term rentals. Capital appreciation expectations. Others expect property values to increase over time. Diversification. Real estate may be viewed as an alternative asset compared with stocks or cash holdings. Lifestyle investment. Some buyers combine personal use with future rental plans. Retirement planning. Property ownership may form part of long-term lifestyle decisions.`,
        `Different motivations require different investment strategies.`,
        ],
      },
      {
        id: "what-is-considered-a-good-rental-yield",
        question: `What is considered a good rental yield?`,
        answer: [
        `The answer depends on investment goals and risk tolerance.`,
        `Some investors prioritise:`,
        `Stable occupancy Lower maintenance requirements Long-term appreciation`,
        `Others focus more heavily on maximising short-term returns.`,
        `Yield should never be evaluated in isolation. Expenses, taxes, maintenance, vacancy periods, and management costs all influence actual profitability.`,
        ],
      },
      {
        id: "is-paphos-good-for-property-investment",
        question: `Is Paphos good for property investment?`,
        answer: [
        `Paphos remains popular among overseas investors due to tourism, retirement relocation, and international communities.`,
        `Investment considerations often include:`,
        `Holiday rental demand Lifestyle appeal Coastal location International buyers Retirement communities`,
        `Suitability depends on investment objectives rather than popularity alone.`,
        ],
      },
      {
        id: "is-short-term-rental-more-profitable-than-long-term-rental",
        question: `Is short-term rental more profitable than long-term rental?`,
        answer: [
        `Short-term rentals may generate higher income during strong occupancy periods, particularly in tourist areas.`,
        `However, they may also involve:`,
        `Seasonal fluctuations Greater management effort Marketing expenses Cleaning costs Regulatory considerations`,
        `Long-term rentals may provide more predictable occupancy.`,
        `Profitability depends on property type and location.`,
        ],
      },
      {
        id: "is-long-term-rental-safer-for-investors",
        question: `Is long-term rental safer for investors?`,
        answer: [
        `Some investors prefer long-term tenants because income may be more predictable. Others prioritise flexibility and potentially higher returns from holiday rentals. The preferred strategy depends on risk tolerance and investment objectives.`,
        ],
      },
    ],
  },
  {
    slug: "residency",
    label: "Residency & Relocation",
    description: "Property ownership, residency status, and relocating to Cyprus.",
    items: [
      {
        id: "can-buying-property-help-obtain-residency-in-cyprus",
        question: `Can buying property help obtain residency in Cyprus?`,
        answer: [
        `Property ownership may support residency pathways in Cyprus, depending on programme requirements and the buyer's circumstances. Residency regulations can change, and eligibility often depends on investment value, income, and documentation.`,
        `Some international buyers purchase property not only for lifestyle reasons but also because they intend to relocate permanently or spend significant time in Cyprus.`,
        `When considering residency, buyers should evaluate:`,
        `Minimum investment requirements Family eligibility Processing times Healthcare access Tax implications Long-term relocation goals`,
        `Legal and immigration advice is often recommended before making purchase decisions primarily for residency purposes.`,
        ],
      },
      {
        id: "does-buying-property-automatically-grant-permanent-residency",
        question: `Does buying property automatically grant permanent residency?`,
        answer: [
        `No. Purchasing property does not automatically provide permanent residency status.`,
        `Although property ownership can sometimes support certain residency pathways, separate conditions often apply.`,
        `Applicants may still need to satisfy requirements related to:`,
        `Income Documentation Financial resources Background checks Legal status`,
        `Assuming residency is guaranteed through ownership alone can create unrealistic expectations.`,
        ],
      },
      {
        id: "what-residency-options-exist-for-foreigners-moving-to-cyprus",
        question: `What residency options exist for foreigners moving to Cyprus?`,
        answer: [
        `Residency pathways differ depending on nationality, intended duration of stay, and personal circumstances.`,
        `Common reasons people relocate include:`,
        `Retirement Remote work Family relocation Investment activity Lifestyle changes Business ownership`,
        `Available routes and requirements can change over time.`,
        ],
      },
      {
        id: "can-retirees-relocate-permanently-to-cyprus",
        question: `Can retirees relocate permanently to Cyprus?`,
        answer: [
        `Yes. Cyprus has long attracted retirees due to its climate, slower pace of life, coastal environment, and international communities.`,
        `Retirement buyers often consider factors such as:`,
        `Healthcare access Cost of living Safety Climate Residency options Property maintenance requirements`,
        `Some retirees prioritise apartments with lower upkeep, while others seek villas or communities designed for long-term living.`,
        ],
      },
      {
        id: "is-cyprus-a-good-place-for-retirement",
        question: `Is Cyprus a good place for retirement?`,
        answer: [
        `Many overseas residents consider Cyprus attractive for retirement because of:`,
        `Mild winters Mediterranean lifestyle International communities Outdoor living Healthcare availability Slower pace compared with larger European cities`,
        `However, suitability depends on individual preferences, language expectations, healthcare needs, and financial planning.`,
        ],
      },
      {
        id: "can-families-relocate-permanently-to-cyprus",
        question: `Can families relocate permanently to Cyprus?`,
        answer: [
        `Yes. Families relocate to Cyprus for various reasons, including lifestyle preferences, remote work opportunities, education, and climate.`,
        `Parents often evaluate:`,
        `Schools Safety Healthcare Infrastructure Community environment Cost of living`,
        `Different regions may appeal to different family priorities.`,
        ],
      },
      {
        id: "which-areas-in-cyprus-are-popular-among-families",
        question: `Which areas in Cyprus are popular among families?`,
        answer: [
        `Preferences differ considerably depending on lifestyle goals.`,
        `Families commonly prioritise:`,
        `Access to schools Healthcare facilities Residential neighbourhoods Lower traffic Recreational spaces Long-term community infrastructure`,
        `Some areas attract retirees, while others appeal more strongly to working families or investors.`,
        ],
      },
    ],
  },
  {
    slug: "location",
    label: "Choosing Where to Buy",
    description: "Matching a location to your goals, not just its popularity.",
    items: [
      {
        id: "which-city-in-cyprus-is-best-for-buying-property",
        question: `Which city in Cyprus is best for buying property?`,
        answer: [
        `There is no single answer because the most suitable location depends entirely on buyer priorities.`,
        `Someone purchasing property primarily for rental income may evaluate locations differently from a family relocating permanently. Likewise, retirement buyers often focus on climate, healthcare access, and pace of life rather than investment growth alone.`,
        `Buyers commonly compare factors such as:`,
        `property prices, rental demand, proximity to beaches, infrastructure, schools, international communities, and long-term development activity.`,
        `The better question is often not "Which city is best?" but rather "Which city fits my goals?"`,
        ],
      },
      {
        id: "how-should-buyers-choose-the-right-location-in-cyprus",
        question: `How should buyers choose the right location in Cyprus?`,
        answer: [
        `Choosing a location should ideally begin with defining the purpose of ownership.`,
        `Questions buyers often ask themselves include:`,
        `Is the property intended for investment or personal use? Will the property generate rental income? Is permanent relocation planned? Are schools important? Is retirement the primary motivation? How important is access to airports or healthcare?`,
        `Lifestyle expectations frequently influence satisfaction more than purchase price. Buying solely because an area is popular may not produce the desired outcome.`,
        ],
      },
      {
        id: "is-buying-property-near-the-beach-always-better",
        question: `Is buying property near the beach always better?`,
        answer: [
        `Properties close to the sea often attract attention because coastal living remains highly desirable among international buyers.`,
        `However, sea proximity alone does not automatically create stronger investment performance or better lifestyle outcomes.`,
        `Some buyers prioritise quieter neighbourhoods, easier year-round living, or stronger local infrastructure over direct beach access.`,
        `The value of location depends on intended use rather than assumptions.`,
        ],
      },
    ],
  },
  {
    slug: "financing",
    label: "Financing & Mortgages",
    description: "Borrowing as an overseas buyer, from deposit to approval.",
    items: [
      {
        id: "can-foreigners-get-a-mortgage-in-cyprus",
        question: `Can foreigners get a mortgage in Cyprus?`,
        answer: [
        `Yes, foreign buyers may be able to obtain mortgages in Cyprus, although approval conditions differ depending on nationality, residency status, income, and lender requirements.`,
        `Banks generally evaluate financial stability before approving financing. Buyers purchasing holiday homes, investment properties, or permanent residences may encounter different lending criteria.`,
        `Mortgage availability often depends on factors such as:`,
        `Country of residence Employment status Income level Existing financial obligations Credit history Property value Deposit amount`,
        `Some international buyers choose financing to preserve liquidity for additional investments rather than paying entirely in cash.`,
        `Because lending policies change over time, buyers should confirm current mortgage conditions directly with financial institutions or advisers.`,
        ],
      },
      {
        id: "which-banks-offer-mortgages-to-overseas-property-buyers",
        question: `Which banks offer mortgages to overseas property buyers?`,
        answer: [
        `Mortgage availability changes over time, and different lenders may evaluate international applicants differently.`,
        `Banks often assess:`,
        `Income stability Existing debt obligations Employment type Tax residency Nationality Property purpose`,
        `Buyers should compare financing options rather than relying on a single institution, as terms, approval speed, and borrowing limits may vary considerably.`,
        ],
      },
      {
        id: "how-much-deposit-is-required-when-buying-property",
        question: `How much deposit is required when buying property?`,
        answer: [
        `Required deposits depend on financing arrangements, developer terms, and purchase agreements.`,
        `Buyers commonly encounter deposits during several stages:`,
        `Reservation deposit. Paid to temporarily remove a property from the market. Mortgage down payment. Required when financing through a bank. Construction stage payments. Common for off-plan developments.`,
        `The total upfront amount differs between transactions and should always be confirmed before committing.`,
        ],
      },
      {
        id: "what-down-payment-is-typically-required-for-mortgages",
        question: `What down payment is typically required for mortgages?`,
        answer: [
        `The amount required upfront varies according to lender criteria and buyer profile.`,
        `Several factors influence required contributions:`,
        `Loan amount Property type Buyer nationality Financial history Income stability Intended use of property`,
        `Higher deposits may sometimes improve approval chances or financing terms.`,
        ],
      },
      {
        id: "can-buyers-obtain-mortgages-without-cyprus-residency",
        question: `Can buyers obtain mortgages without Cyprus residency?`,
        answer: [
        `In some situations, yes.`,
        `Mortgage approval does not always require permanent residency in Cyprus. However, lending criteria for non-residents may differ from those applied to local residents.`,
        `Eligibility depends on individual financial circumstances and bank requirements.`,
        ],
      },
      {
        id: "can-self-employed-buyers-get-mortgages-in-cyprus",
        question: `Can self-employed buyers get mortgages in Cyprus?`,
        answer: [
        `Yes, but additional financial documentation may be required.`,
        `Self-employed applicants often need to demonstrate:`,
        `Stable income history Tax records Business activity Financial statements Existing obligations`,
        `Approval procedures can sometimes take longer compared with salaried applicants due to income assessment complexity.`,
        ],
      },
      {
        id: "are-fixed-rate-mortgages-available",
        question: `Are fixed-rate mortgages available?`,
        answer: [
        `Mortgage structures evolve over time and may include different repayment models.`,
        `Buyers comparing financing options should evaluate:`,
        `Interest type Repayment flexibility Long-term affordability Currency exposure Early repayment conditions`,
        `Choosing financing based only on initial rates may overlook longer-term costs.`,
        ],
      },
      {
        id: "what-payment-schedules-exist-for-off-plan-properties",
        question: `What payment schedules exist for off-plan properties?`,
        answer: [
        `Off-plan developments often use staged payment structures linked to construction progress.`,
        `Payments may occur during phases such as:`,
        `Reservation Contract signing Construction milestones Completion Final transfer procedures`,
        `The exact schedule differs between projects and developers.`,
        `Understanding payment timing is important for budgeting and liquidity planning.`,
        ],
      },
      {
        id: "should-buyers-pay-in-euros-or-transfer-from-another-currency",
        question: `Should buyers pay in euros or transfer from another currency?`,
        answer: [
        `International buyers often face currency exchange considerations.`,
        `Exchange fluctuations can influence total acquisition costs significantly, particularly for high-value transactions.`,
        `Buyers transferring funds internationally sometimes evaluate:`,
        `Exchange timing Transfer fees Currency specialists Banking costs`,
        `Ignoring currency exposure may unexpectedly increase total purchase expenses.`,
        ],
      },
    ],
  },
  {
    slug: "offplan",
    label: "Off-Plan & New Developments",
    description: "Buying before construction is complete — process and risk.",
    items: [
      {
        id: "what-does-off-plan-property-mean",
        question: `What does off-plan property mean?`,
        answer: [
        `Off-plan property refers to real estate purchased before construction is fully completed. In some cases, buyers reserve units when construction has only recently started, while others purchase during later building phases.`,
        `Many overseas buyers choose off-plan developments because they want access to newer projects, flexible payment schedules, or locations where demand is expected to increase in the future.`,
        `Buying before completion means decisions are often based on plans, specifications, renderings, and developer information rather than a finished home. This creates both opportunities and additional considerations.`,
        ],
      },
      {
        id: "why-do-investors-buy-off-plan-properties-in-cyprus",
        question: `Why do investors buy off-plan properties in Cyprus?`,
        answer: [
        `Investors are often interested in off-plan projects because purchase prices at earlier stages may differ from prices closer to completion. Some buyers expect potential value growth during construction, while others prioritise payment flexibility.`,
        `Another reason involves access to modern developments. New projects may include updated layouts, energy-efficient features, communal facilities, or locations with expanding infrastructure.`,
        `However, investment expectations should always be balanced against construction risk and changing market conditions.`,
        ],
      },
      {
        id: "are-off-plan-properties-cheaper-than-completed-homes",
        question: `Are off-plan properties cheaper than completed homes?`,
        answer: [
        `Not necessarily.`,
        `In some situations, early-stage pricing can appear attractive compared with completed properties. In others, premium developments may already be positioned at higher price levels.`,
        `The better question is often not whether off-plan property is cheaper, but whether the total long-term value aligns with investment goals.`,
        `Comparisons should include:`,
        `Construction quality expectations Payment structure Future maintenance costs Location potential Market demand`,
        `Lower entry price alone does not automatically mean stronger investment performance.`,
        ],
      },
      {
        id: "is-buying-off-plan-property-risky",
        question: `Is buying off-plan property risky?`,
        answer: [
        `Every property purchase involves some degree of risk, and off-plan developments introduce additional factors because construction has not yet been completed.`,
        `Potential concerns may include delayed completion dates, specification changes, evolving market conditions, or differences between initial expectations and finished results.`,
        `Risk does not necessarily mean buyers should avoid new developments. Rather, it highlights the importance of legal checks, developer research, and realistic expectations.`,
        `Many successful investments are made in off-plan projects, but due diligence remains essential.`,
        ],
      },
      {
        id: "what-happens-if-construction-is-delayed",
        question: `What happens if construction is delayed?`,
        answer: [
        `Construction delays can occur for many reasons, including labour shortages, supply chain issues, permitting procedures, or broader economic conditions.`,
        `The impact of delays depends heavily on contractual terms.`,
        `Buyers should understand:`,
        `Expected completion timelines Extension clauses Payment obligations Delay provisions`,
        `Assuming projects always finish exactly on schedule may create unrealistic expectations.`,
        ],
      },
      {
        id: "can-the-final-property-differ-from-marketing-materials",
        question: `Can the final property differ from marketing materials?`,
        answer: [
        `In some cases, minor differences between visual materials and completed properties may occur.`,
        `Renderings and promotional visuals are designed to illustrate concepts, while finished projects depend on construction realities, materials, and implementation.`,
        `This does not automatically indicate poor quality. However, buyers should review specifications carefully and understand what is contractually included.`,
        ],
      },
      {
        id: "how-do-payment-schedules-work-for-new-developments",
        question: `How do payment schedules work for new developments?`,
        answer: [
        `Many developers structure payments according to construction progress rather than requiring full payment immediately.`,
        `This staged approach is one reason some buyers prefer off-plan purchases.`,
        `Payment timing may be linked to milestones such as:`,
        `reservation, contract signing, structural progress, completion stages, and final delivery.`,
        `Exact schedules differ between projects and developers.`,
        `Understanding payment timing early helps buyers plan finances more realistically.`,
        ],
      },
      {
        id: "why-do-developers-offer-staged-payment-plans",
        question: `Why do developers offer staged payment plans?`,
        answer: [
        `Staged payments can make higher-value purchases more manageable and spread financial commitments across longer periods.`,
        `For investors, this sometimes allows capital to remain available for other opportunities during construction.`,
        `For relocation buyers, staged payments may align more comfortably with longer-term planning.`,
        `The existence of flexible payments does not remove investment risk, but it can change affordability dynamics.`,
        ],
      },
      {
        id: "are-new-developments-safer-investments-than-resale-propertie",
        question: `Are new developments safer investments than resale properties?`,
        answer: [
        `Neither category is automatically safer.`,
        `New developments may offer advantages such as modern standards, warranties, and newer infrastructure. Resale properties may provide existing rental history, immediate occupancy, and clearer market evidence.`,
        `Investment suitability depends more on individual projects than broad categories.`,
        `General assumptions such as "new is always better" or "resale is always safer" rarely apply universally.`,
        ],
      },
      {
        id: "what-guarantees-do-developers-usually-provide",
        question: `What guarantees do developers usually provide?`,
        answer: [
        `Guarantees differ between projects and developers.`,
        `Buyers often review information relating to construction quality, warranties, or obligations connected with completed works.`,
        `The scope of protection varies and should be understood before purchase rather than assumed afterward.`,
        ],
      },
    ],
  },
];

export const FAQ_TOTAL = FAQ_CATEGORIES.reduce((n, c) => n + c.items.length, 0);
