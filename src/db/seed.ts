/**
 * Deterministic demo data. `npm run db:seed` wipes the tables and rebuilds them
 * from this file, so a reviewer always lands on the same marketplace and any
 * screenshot in the README still matches.
 */
import { eq } from "drizzle-orm";

import { db } from "./client";
import {
  assets,
  buyerProfiles,
  conversations,
  messages,
  moderationLog,
  savedAssets,
  sellerProfiles,
  sessions,
  users,
} from "./schema";
import { newId } from "@/lib/ids";
import type { BusinessStatus, DealType, InvestorType, Sector, Timeline } from "@/domain/taxonomy";

/** Mulberry32 — small, seeded, and enough for shuffling demo rows. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260901);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const usd = (n: number) => Math.round(n * 100);

type SellerSeed = {
  key: string;
  name: string;
  email: string;
  company: string;
  country: string;
  website: string;
  about: string;
  verified: boolean;
  dealsClosed: number;
};

const SELLERS: SellerSeed[] = [
  {
    key: "baltic",
    name: "Ruta Kazlauskiene",
    email: "ruta@balticlicensing.lt",
    company: "Baltic Licensing Partners",
    country: "LT",
    website: "https://balticlicensing.example",
    about:
      "Vilnius advisory that takes EMI and PI licence holders to market. We prepare the data room before listing, so buyers get financials and licence correspondence on day one.",
    verified: true,
    dealsClosed: 11,
  },
  {
    key: "meridian",
    name: "Andreas Georgiou",
    email: "a.georgiou@meridiancap.cy",
    company: "Meridian Capital Advisors",
    country: "CY",
    website: "https://meridiancap.example",
    about:
      "Sell-side advisor for CySEC-regulated investment firms and payment institutions across Cyprus, Malta and Greece.",
    verified: true,
    dealsClosed: 7,
  },
  {
    key: "northgate",
    name: "Helena Brandt",
    email: "helena@northgate-ma.de",
    company: "Northgate M&A",
    country: "DE",
    website: "https://northgate-ma.example",
    about: "Frankfurt boutique covering BaFin-licensed entities and German lending books.",
    verified: true,
    dealsClosed: 5,
  },
  {
    key: "sable",
    name: "Marcus Owen",
    email: "marcus@sableroute.co.uk",
    company: "Sable Route",
    country: "GB",
    website: "https://sableroute.example",
    about: "London seller focused on FCA-authorised payment and e-money firms.",
    verified: true,
    dealsClosed: 9,
  },
  {
    key: "harbourpoint",
    name: "Yusuf Rahman",
    email: "yusuf@harbourpoint.ae",
    company: "Harbour Point Holdings",
    country: "AE",
    website: "https://harbourpoint.example",
    about: "Dubai holding company divesting non-core fintech and crypto assets from its portfolio.",
    verified: false,
    dealsClosed: 2,
  },
  {
    key: "clearford",
    name: "Sofia Lindqvist",
    email: "sofia@clearford.ee",
    company: "Clearford OÜ",
    country: "EE",
    website: "https://clearford.example",
    about: "Tallinn operator selling its own licensed subsidiaries after a group restructuring.",
    verified: false,
    dealsClosed: 1,
  },
  {
    key: "verdant",
    name: "Tomasz Nowak",
    email: "tomasz@verdantdeals.pl",
    company: "Verdant Deals",
    country: "PL",
    website: "https://verdantdeals.example",
    about: "Warsaw intermediary covering CEE lending platforms and small payment institutions.",
    verified: true,
    dealsClosed: 4,
  },
  {
    key: "quarry",
    name: "Dana Whitfield",
    email: "dana@quarrybridge.com",
    company: "Quarry Bridge",
    country: "US",
    website: "https://quarrybridge.example",
    about: "US broker listing money transmitter licence portfolios and niche lending books.",
    verified: false,
    dealsClosed: 0,
  },
];

type BuyerSeed = {
  name: string;
  email: string;
  country: string;
  headline: string;
  about: string;
  investorType: InvestorType;
  ticketMin: number;
  ticketMax: number;
  sectors: Sector[];
  jurisdictions: string[];
  dealTypes: DealType[];
  timeline: Timeline;
  proofOfFunds: boolean;
  listed?: boolean;
};

const BUYERS: BuyerSeed[] = [
  {
    name: "Elena Marchetti",
    email: "elena@arcvestpartners.com",
    country: "CH",
    headline: "Buying EMI and PI licence holders across the EEA",
    about:
      "We operate a payments group in DACH and buy licensed entities to enter new corridors. We close on cash, no financing condition, and we keep incumbent management for at least 12 months.",
    investorType: "STRATEGIC",
    ticketMin: 2_000_000,
    ticketMax: 12_000_000,
    sectors: ["EMI", "PAYMENT"],
    jurisdictions: ["LT", "CY", "MT", "IE"],
    dealTypes: ["FULL_SALE", "MAJORITY"],
    timeline: "NOW",
    proofOfFunds: true,
  },
  {
    name: "Priya Raghavan",
    email: "priya@lattice.vc",
    country: "GB",
    headline: "Growth fund taking majority positions in profitable fintech",
    about:
      "Lattice writes cheques into fintech operators with at least $2M revenue and positive contribution margin. We prefer majority control with founder rollover.",
    investorType: "PE_VC",
    ticketMin: 5_000_000,
    ticketMax: 40_000_000,
    sectors: ["FINTECH", "PAYMENT", "LENDING"],
    jurisdictions: ["GB", "IE", "NL", "DE"],
    dealTypes: ["MAJORITY"],
    timeline: "3_MONTHS",
    proofOfFunds: true,
  },
  {
    name: "Karl Hoffmann",
    email: "karl@hoffmannfamily.ch",
    country: "CH",
    headline: "Family office, patient capital, regulated entities only",
    about:
      "We hold for a decade or more and do not use leverage. Our preference is a clean licence with a small operating team we can grow.",
    investorType: "FAMILY_OFFICE",
    ticketMin: 1_000_000,
    ticketMax: 8_000_000,
    sectors: ["BANK", "WEALTH", "EMI"],
    jurisdictions: ["CH", "MT", "DE"],
    dealTypes: ["FULL_SALE", "MAJORITY", "MINORITY"],
    timeline: "6_MONTHS",
    proofOfFunds: true,
  },
  {
    name: "Sam Okafor",
    email: "sam@okaforventures.com",
    country: "US",
    headline: "Search fund hunting one payments business to run",
    about:
      "I am looking for a single acquisition to operate full time. Revenue between $1M and $5M, a real customer base, and a seller willing to stay through transition.",
    investorType: "SEARCH_FUND",
    ticketMin: 800_000,
    ticketMax: 4_000_000,
    sectors: ["PAYMENT", "FINTECH"],
    jurisdictions: ["US", "CA", "GB"],
    dealTypes: ["FULL_SALE"],
    timeline: "NOW",
    proofOfFunds: false,
  },
  {
    name: "Mei Lin Chua",
    email: "meilin@parksidegroup.sg",
    country: "SG",
    headline: "APAC operator adding European licence coverage",
    about:
      "Parkside runs a licensed payments business in Singapore and Hong Kong. We want an EU foothold and will pay a premium for a licence with passporting already in place.",
    investorType: "STRATEGIC",
    ticketMin: 3_000_000,
    ticketMax: 20_000_000,
    sectors: ["EMI", "PAYMENT", "CRYPTO"],
    jurisdictions: ["LT", "MT", "CY", "NL", "IE"],
    dealTypes: ["FULL_SALE", "MAJORITY"],
    timeline: "3_MONTHS",
    proofOfFunds: true,
  },
  {
    name: "Jonas Vitkus",
    email: "jonas@vitkus.lt",
    country: "LT",
    headline: "Angel buying small licence-only vehicles",
    about: "Small cheques, fast decisions, no advisors. I buy clean shells and build on them.",
    investorType: "ANGEL",
    ticketMin: 150_000,
    ticketMax: 900_000,
    sectors: ["EMI", "CRYPTO"],
    jurisdictions: ["LT", "EE", "PL", "CZ"],
    dealTypes: ["FULL_SALE", "ASSET_PURCHASE"],
    timeline: "NOW",
    proofOfFunds: false,
  },
  {
    name: "Aisha Nasser",
    email: "aisha@dunecapital.ae",
    country: "AE",
    headline: "Digital asset platforms with a regulated wrapper",
    about:
      "Dune Capital invests in crypto infrastructure that holds a real licence. We avoid unregulated exchanges and anything with retail leverage.",
    investorType: "PE_VC",
    ticketMin: 2_000_000,
    ticketMax: 25_000_000,
    sectors: ["CRYPTO", "FINTECH"],
    jurisdictions: ["AE", "MT", "LT", "CH"],
    dealTypes: ["MAJORITY", "MINORITY"],
    timeline: "6_MONTHS",
    proofOfFunds: true,
  },
  {
    name: "Robert Kwiatkowski",
    email: "robert@kwiat-lending.pl",
    country: "PL",
    headline: "Consumer lending books in CEE",
    about:
      "We buy performing consumer loan books and the platforms that originate them. Portfolio quality matters more to us than brand.",
    investorType: "STRATEGIC",
    ticketMin: 1_500_000,
    ticketMax: 15_000_000,
    sectors: ["LENDING", "FINTECH"],
    jurisdictions: ["PL", "CZ", "BG", "EE", "LT"],
    dealTypes: ["FULL_SALE", "ASSET_PURCHASE"],
    timeline: "3_MONTHS",
    proofOfFunds: true,
  },
  {
    name: "Claire Dubois",
    email: "claire@atlasbridge.eu",
    country: "NL",
    headline: "Buy-and-build in European payments",
    about:
      "Atlas Bridge has acquired four payment institutions since 2022 and integrates them onto one platform. We move quickly on assets that fit the stack.",
    investorType: "PE_VC",
    ticketMin: 4_000_000,
    ticketMax: 30_000_000,
    sectors: ["PAYMENT", "EMI"],
    jurisdictions: ["NL", "DE", "LT", "IE", "GB"],
    dealTypes: ["MAJORITY", "FULL_SALE"],
    timeline: "NOW",
    proofOfFunds: true,
  },
  {
    name: "Daniel Bergstrom",
    email: "daniel@bergstromwealth.se",
    country: "EE",
    headline: "Wealth and brokerage platforms, minority positions welcome",
    about: "We take 20–40% positions in wealth managers and provide distribution in the Nordics.",
    investorType: "STRATEGIC",
    ticketMin: 500_000,
    ticketMax: 6_000_000,
    sectors: ["WEALTH"],
    jurisdictions: ["EE", "GB", "CH"],
    dealTypes: ["MINORITY"],
    timeline: "EXPLORING",
    proofOfFunds: false,
  },
  {
    name: "Isabel Ferreira",
    email: "isabel@ferreiraholdings.br",
    country: "BR",
    headline: "LatAm group looking at European banking licences",
    about: "First European acquisition. We need a seller patient with a longer regulatory approval.",
    investorType: "STRATEGIC",
    ticketMin: 8_000_000,
    ticketMax: 60_000_000,
    sectors: ["BANK"],
    jurisdictions: ["MT", "CY", "BG", "DE"],
    dealTypes: ["FULL_SALE", "MAJORITY"],
    timeline: "6_MONTHS",
    proofOfFunds: true,
  },
  {
    name: "Nathan Cole",
    email: "nathan@colecapital.com",
    country: "US",
    headline: "Money transmitter licence portfolios",
    about: "We consolidate US MTL portfolios. State coverage matters more than revenue.",
    investorType: "STRATEGIC",
    ticketMin: 1_000_000,
    ticketMax: 10_000_000,
    sectors: ["PAYMENT"],
    jurisdictions: ["US", "CA"],
    dealTypes: ["ASSET_PURCHASE", "FULL_SALE"],
    timeline: "3_MONTHS",
    proofOfFunds: true,
  },
  {
    name: "Viktoriya Shevchenko",
    email: "viktoriya@shevchenko.capital",
    country: "PL",
    headline: "Quietly building a payments group, mandate not public",
    about: "Prefers to approach sellers directly rather than appear in the directory.",
    investorType: "FAMILY_OFFICE",
    ticketMin: 700_000,
    ticketMax: 5_000_000,
    sectors: ["PAYMENT", "EMI"],
    jurisdictions: ["PL", "LT", "CZ"],
    dealTypes: ["FULL_SALE"],
    timeline: "EXPLORING",
    proofOfFunds: false,
    listed: false,
  },
  {
    name: "Greg Mallory",
    email: "greg@mallory-arb.com",
    country: "GB",
    headline: "Any asset, any price, guaranteed instant close",
    about:
      "Ready to acquire immediately. Wire transfer only, no due diligence needed, contact me on any channel.",
    investorType: "ANGEL",
    ticketMin: 0,
    ticketMax: 0,
    sectors: [],
    jurisdictions: [],
    dealTypes: [],
    timeline: "NOW",
    proofOfFunds: false,
  },
];

type AssetSeed = {
  seller: string;
  title: string;
  summary: string;
  description: string;
  sector: Sector;
  country: string;
  jurisdiction: string;
  licenseType: string;
  businessStatus: BusinessStatus;
  dealType: DealType;
  stake: number;
  price: number;
  revenue: number;
  ebitda: number;
  employees: number;
  founded: number;
  status?: "PUBLISHED" | "DRAFT" | "UNDER_OFFER" | "SOLD" | "SUSPENDED";
  reason?: string;
  age: number;
};

const ASSETS: AssetSeed[] = [
  {
    seller: "baltic",
    title: "EMI licence holder with live IBAN issuing, Lithuania",
    summary:
      "Bank of Lithuania EMI licence, SEPA and SWIFT access through two partner banks, 4,100 active business accounts.",
    description:
      "The company holds a full EMI licence issued by the Bank of Lithuania in 2019 and has operated without a supervisory finding since. It issues Lithuanian IBANs to SME clients across 14 EU markets, with SEPA Instant through one partner and SWIFT correspondent access through another. The core ledger is built in-house on PostgreSQL, with a card programme running on a third-party BIN sponsor. AML tooling is ComplyAdvantage plus an internal rules engine reviewed by the regulator in 2024. The team is 31 people, of whom 9 sit in compliance and MLRO functions. The shareholders are selling to focus on a separate lending business, and will stay through a six-month transition. Client contracts, the licence, the ledger and the full compliance history transfer with the deal.",
    sector: "EMI",
    country: "LT",
    jurisdiction: "Bank of Lithuania",
    licenseType: "Electronic Money Institution licence",
    businessStatus: "ACTIVE",
    dealType: "FULL_SALE",
    stake: 100,
    price: 8_400_000,
    revenue: 3_900_000,
    ebitda: 1_150_000,
    employees: 31,
    founded: 2018,
    age: 3,
  },
  {
    seller: "baltic",
    title: "Clean EMI licence, no trading history, Lithuania",
    summary:
      "Licence granted 2023, never commercially launched. Corporate structure clean, share capital intact, ready for change of control.",
    description:
      "A Bank of Lithuania EMI licence granted in mid-2023 to a founding team that changed direction before launch. The entity has never onboarded a client and has no transaction history, so a buyer takes on no legacy AML exposure. Regulatory capital of EUR 350,000 sits in a segregated account and the annual audit is clean. Two board members with fit-and-proper approval are willing to stay on for continuity through the change-of-control process, which the regulator typically completes in three to five months. Suits a buyer that wants a licence without inheriting an operating business.",
    sector: "EMI",
    country: "LT",
    jurisdiction: "Bank of Lithuania",
    licenseType: "Electronic Money Institution licence",
    businessStatus: "LICENSE_ONLY",
    dealType: "FULL_SALE",
    stake: 100,
    price: 1_250_000,
    revenue: 0,
    ebitda: 0,
    employees: 3,
    founded: 2022,
    age: 9,
  },
  {
    seller: "sable",
    title: "FCA-authorised payment institution, UK, cross-border SME payments",
    summary:
      "API authorisation held since 2017, GBP 240M annual payment volume, 900 SME clients, profitable for three years.",
    description:
      "An FCA-authorised payment institution serving UK SMEs that pay suppliers in Asia and Eastern Europe. Volume has grown from GBP 90M to GBP 240M over four years, and the business has been profitable since 2022. Revenue comes from FX spread rather than fixed fees, which keeps margin stable when volumes soften. Technology is a mix of an in-house dashboard and Currencycloud rails, and the client book has low concentration, with no client above 4% of revenue. The founders want an exit to a group that can offer their clients lending. Full financials, the FCA correspondence file and the client contract templates are in the data room.",
    sector: "PAYMENT",
    country: "GB",
    jurisdiction: "Financial Conduct Authority",
    licenseType: "Authorised Payment Institution",
    businessStatus: "ACTIVE",
    dealType: "MAJORITY",
    stake: 70,
    price: 11_500_000,
    revenue: 5_200_000,
    ebitda: 1_680_000,
    employees: 24,
    founded: 2016,
    age: 6,
  },
  {
    seller: "sable",
    title: "Small payments agent business, UK, owner retiring",
    summary: "Agent of a principal PI, 140 merchant relationships, steady revenue, no licence of its own.",
    description:
      "A payments agent operating under a principal firm's FCA authorisation, with 140 merchant relationships built over nine years, mostly hospitality and retail in the north of England. Revenue is a share of merchant service charge and has been flat but reliable. The owner is retiring and will introduce the buyer to every merchant personally. There is no licence in the deal, so this suits an authorised firm looking to buy a book rather than a structure.",
    sector: "PAYMENT",
    country: "GB",
    jurisdiction: "Financial Conduct Authority",
    licenseType: "Agent of an authorised PI",
    businessStatus: "ACTIVE",
    dealType: "ASSET_PURCHASE",
    stake: 100,
    price: 620_000,
    revenue: 410_000,
    ebitda: 180_000,
    employees: 4,
    founded: 2015,
    age: 21,
  },
  {
    seller: "meridian",
    title: "CySEC-regulated investment firm with EU passporting",
    summary:
      "CIF licence covering reception, transmission and execution of orders, 2,300 retail clients, MT5 platform.",
    description:
      "A Cyprus Investment Firm authorised by CySEC since 2014, passported into 18 EEA states. The client base is 2,300 retail traders with an average account of EUR 4,100 and a steady deposit pattern. The firm runs MT5 with a B-book on low-risk flow and hedges the rest through a prime broker. Compliance has been stable, with one settled administrative matter in 2019 disclosed in full in the data room. The seller is a group consolidating into a single Maltese entity and wants a clean exit within four months.",
    sector: "WEALTH",
    country: "CY",
    jurisdiction: "CySEC",
    licenseType: "Cyprus Investment Firm licence",
    businessStatus: "ACTIVE",
    dealType: "FULL_SALE",
    stake: 100,
    price: 4_300_000,
    revenue: 2_700_000,
    ebitda: 740_000,
    employees: 19,
    founded: 2013,
    age: 12,
  },
  {
    seller: "meridian",
    title: "Malta VFA services licence, crypto brokerage, operating",
    summary:
      "MFSA-licensed VFA services provider, EUR 60M annual traded volume, institutional and high-net-worth clients only.",
    description:
      "An MFSA-licensed virtual financial assets services provider running a brokerage desk for institutional and high-net-worth clients. No retail exposure, no leverage products, no proprietary token. Volume of EUR 60M a year produces revenue on spread and a small custody fee. Custody sits with two regulated third parties, and the firm has never held client keys itself. MiCA transition work is underway with external counsel, and the file is in the data room. The owners want a partner with distribution rather than a full exit, so a majority sale with rollover is the preferred structure.",
    sector: "CRYPTO",
    country: "MT",
    jurisdiction: "MFSA",
    licenseType: "VFA Services Licence Class 3",
    businessStatus: "ACTIVE",
    dealType: "MAJORITY",
    stake: 60,
    price: 6_800_000,
    revenue: 2_100_000,
    ebitda: 520_000,
    employees: 14,
    founded: 2019,
    age: 17,
  },
  {
    seller: "northgate",
    title: "BaFin-licensed securities institution, Germany",
    summary:
      "Wertpapierinstitut licence, custody and portfolio management, EUR 180M assets under administration.",
    description:
      "A German securities institution licensed by BaFin, administering EUR 180M for 40 institutional and semi-professional clients. Revenue is recurring, based on basis points of assets rather than transactions, and client attrition over five years has been under 3% a year. The staff of 12 includes two licensed portfolio managers whose approvals transfer with the entity. The parent group is exiting Germany after a strategy review. This is a stable, unexciting business that suits a buyer who wants a German regulatory foothold with predictable income.",
    sector: "WEALTH",
    country: "DE",
    jurisdiction: "BaFin",
    licenseType: "Wertpapierinstitut licence",
    businessStatus: "ACTIVE",
    dealType: "FULL_SALE",
    stake: 100,
    price: 9_200_000,
    revenue: 3_100_000,
    ebitda: 980_000,
    employees: 12,
    founded: 2009,
    age: 27,
  },
  {
    seller: "northgate",
    title: "German consumer lending platform with performing book",
    summary:
      "Digital consumer lender, EUR 34M performing book, default rate 2.1%, originates through comparison sites.",
    description:
      "A digital consumer lender originating through German comparison portals, with EUR 34M of performing loans on the balance sheet and a 90-day default rate of 2.1% across the last three vintages. Underwriting is automated on internal scoring calibrated against SCHUFA data, with manual review above EUR 15,000. Funding comes from a forward-flow arrangement with an institutional buyer, renewable annually. The founders will transfer the scoring model, the origination contracts and the servicing team. Sale is driven by the founders' decision to focus on a B2B product built on the same stack.",
    sector: "LENDING",
    country: "DE",
    jurisdiction: "BaFin",
    licenseType: "Kreditinstitut exemption via partner bank",
    businessStatus: "ACTIVE",
    dealType: "FULL_SALE",
    stake: 100,
    price: 14_500_000,
    revenue: 6_400_000,
    ebitda: 2_050_000,
    employees: 38,
    founded: 2017,
    age: 33,
  },
  {
    seller: "clearford",
    title: "Estonian crypto service provider, MiCA application filed",
    summary:
      "Estonian VASP with exchange and custody permissions, MiCA CASP application filed with the FSA in 2025.",
    description:
      "An Estonian virtual asset service provider offering exchange and custodial wallet services, with a MiCA CASP application filed and under review. The company holds 1,900 verified users, mostly Baltic retail, and processes EUR 4M a month in exchange volume. AML is run in-house with two full-time analysts and Sumsub for onboarding. The seller has an operating group elsewhere and does not want to fund the MiCA capital requirement. A buyer takes on the application in progress, which carries risk and a shorter path than starting fresh.",
    sector: "CRYPTO",
    country: "EE",
    jurisdiction: "Estonian Financial Supervision Authority",
    licenseType: "Virtual Asset Service Provider registration",
    businessStatus: "ACTIVE",
    dealType: "FULL_SALE",
    stake: 100,
    price: 2_400_000,
    revenue: 890_000,
    ebitda: 140_000,
    employees: 9,
    founded: 2021,
    age: 5,
  },
  {
    seller: "clearford",
    title: "Estonian payment institution, licence only, dormant since 2024",
    summary: "Payment institution licence, no clients, dormant for 18 months, share capital intact.",
    description:
      "A payment institution licence granted in 2022 that ran a pilot with 40 clients before the group changed direction. The entity has been dormant since early 2024, with the licence maintained through regulatory reporting and an annual audit. All former client relationships were closed and settled. Capital sits untouched. A buyer inherits a licence with a short and fully documented trading history rather than a blank shell, which some regulators view more favourably during change of control.",
    sector: "PAYMENT",
    country: "EE",
    jurisdiction: "Estonian Financial Supervision Authority",
    licenseType: "Payment Institution licence",
    businessStatus: "LICENSE_ONLY",
    dealType: "FULL_SALE",
    stake: 100,
    price: 780_000,
    revenue: 0,
    ebitda: 0,
    employees: 2,
    founded: 2021,
    age: 41,
  },
  {
    seller: "harbourpoint",
    title: "UAE payments infrastructure company, non-core divestment",
    summary:
      "Payment orchestration platform serving 60 regional merchants, no licence, technology and contracts transfer.",
    description:
      "A payment orchestration layer built for merchants in the Gulf, routing across five acquirers and handling reconciliation and settlement reporting. Sixty merchants use it, and revenue is a per-transaction fee. There is no licence in the deal, because the company operates as a technology provider rather than a regulated entity. The holding company is divesting non-core assets and will sell the codebase, the merchant contracts and the six-person engineering team as a unit.",
    sector: "FINTECH",
    country: "AE",
    jurisdiction: "",
    licenseType: "",
    businessStatus: "ACTIVE",
    dealType: "ASSET_PURCHASE",
    stake: 100,
    price: 3_100_000,
    revenue: 1_450_000,
    ebitda: 390_000,
    employees: 6,
    founded: 2020,
    age: 8,
  },
  {
    seller: "harbourpoint",
    title: "Pre-revenue neobank build, UAE, licence application in progress",
    summary: "Product built, team hired, licence application submitted. No revenue and no licence yet.",
    description:
      "A neobank project with a working mobile product, a hired core team and a licence application submitted to the regulator. There is no revenue and no licence, so this is a build a buyer takes over rather than a business they acquire. The holding company funded it for two years and has decided not to continue. Everything transfers: the codebase, the design system, the application file and the employment contracts of the eleven-person team.",
    sector: "FINTECH",
    country: "AE",
    jurisdiction: "",
    licenseType: "",
    businessStatus: "PRE_REVENUE",
    dealType: "FULL_SALE",
    stake: 100,
    price: 1_900_000,
    revenue: 0,
    ebitda: 0,
    employees: 11,
    founded: 2023,
    age: 14,
  },
  {
    seller: "verdant",
    title: "Polish BNPL platform, merchant-integrated, growing",
    summary:
      "Buy-now-pay-later platform integrated with 320 Polish merchants, PLN 11M monthly originations.",
    description:
      "A BNPL platform integrated into 320 Polish e-commerce merchants, originating PLN 11M a month with a 30-day and 3-month product. Credit risk sits with a partner bank, so the company earns a merchant fee without holding the book. Growth has come from a plugin distributed through the two largest Polish e-commerce platforms. The founders are raising rather than selling outright and will take a partner for a minority position with a path to control.",
    sector: "LENDING",
    country: "PL",
    jurisdiction: "KNF",
    licenseType: "Payment services agent",
    businessStatus: "ACTIVE",
    dealType: "MINORITY",
    stake: 35,
    price: 5_600_000,
    revenue: 2_800_000,
    ebitda: 610_000,
    employees: 27,
    founded: 2020,
    age: 11,
  },
  {
    seller: "verdant",
    title: "Czech small payment institution, regional merchant base",
    summary: "SPI registration, 210 merchants, modest but consistent revenue, owner emigrating.",
    description:
      "A Czech small payment institution with 210 merchants concentrated in Brno and Ostrava, processing under the SPI volume threshold. Revenue is modest and consistent, with almost no churn over six years. The owner is emigrating and needs a clean sale within three months. A buyer with an existing full licence could migrate the merchant base and retire the SPI registration.",
    sector: "PAYMENT",
    country: "CZ",
    jurisdiction: "Czech National Bank",
    licenseType: "Small Payment Institution registration",
    businessStatus: "ACTIVE",
    dealType: "FULL_SALE",
    stake: 100,
    price: 940_000,
    revenue: 520_000,
    ebitda: 210_000,
    employees: 7,
    founded: 2018,
    age: 24,
  },
  {
    seller: "quarry",
    title: "US money transmitter licence portfolio, 31 states",
    summary: "MTL coverage across 31 states plus surety bonds in place. No operating business attached.",
    description:
      "A licence portfolio covering 31 US states, with surety bonds current and all state examinations closed without findings. The entity ran a remittance product until 2023 and now maintains the licences only. For a buyer building a US payments product, acquiring this portfolio removes roughly two years of state-by-state applications. The seller will support the change-of-control filings in every state, which is the bulk of the work in a deal like this.",
    sector: "PAYMENT",
    country: "US",
    jurisdiction: "State regulators (31)",
    licenseType: "Money Transmitter Licences",
    businessStatus: "LICENSE_ONLY",
    dealType: "FULL_SALE",
    stake: 100,
    price: 7_200_000,
    revenue: 0,
    ebitda: 0,
    employees: 3,
    founded: 2014,
    age: 19,
  },
  {
    seller: "quarry",
    title: "Niche US lending book, medical financing",
    summary: "USD 12M performing book financing elective medical procedures through 90 clinic partners.",
    description:
      "A specialty lender financing elective medical procedures through 90 partner clinics across the southeast. The book is USD 12M with a charge-off rate of 4.3%, which is normal for the category. Origination happens at the point of care through a tablet application the company built. The founder wants to sell the book and the origination platform together and stay on as a consultant for a year.",
    sector: "LENDING",
    country: "US",
    jurisdiction: "State lending licences",
    licenseType: "Consumer lender licences (7 states)",
    businessStatus: "ACTIVE",
    dealType: "FULL_SALE",
    stake: 100,
    price: 6_100_000,
    revenue: 2_900_000,
    ebitda: 880_000,
    employees: 16,
    founded: 2018,
    age: 29,
  },
  {
    seller: "baltic",
    title: "Bulgarian payment institution with card issuing programme",
    summary:
      "BNB-licensed PI with a principal card issuing programme, 18,000 cards in circulation.",
    description:
      "A Bulgarian payment institution licensed by the Bulgarian National Bank, running a principal issuing programme with Mastercard and 18,000 cards in circulation. Cardholders are mostly gig-economy workers paid through the platform's partner employers. Interchange makes up two-thirds of revenue and FX on cross-border spend makes up the rest. The processing stack is outsourced, which keeps the operating team small. The owner is selling to fund a larger acquisition elsewhere in the group.",
    sector: "EMI",
    country: "BG",
    jurisdiction: "Bulgarian National Bank",
    licenseType: "Payment Institution licence with issuing",
    businessStatus: "ACTIVE",
    dealType: "FULL_SALE",
    stake: 100,
    price: 5_300_000,
    revenue: 2_400_000,
    ebitda: 700_000,
    employees: 18,
    founded: 2019,
    age: 15,
  },
  {
    seller: "meridian",
    title: "Small Maltese credit institution, minority stake available",
    summary:
      "MFSA-licensed credit institution, EUR 210M deposits, seeking a minority investor rather than a sale.",
    description:
      "A small Maltese credit institution with EUR 210M in deposits and a conservative loan book concentrated in local commercial property. Profitability is modest and stable. The shareholders want a minority investor to support a capital increase ahead of a growth plan in trade finance, not a change of control. Regulatory approval for a qualifying holding will be required, and the shareholders have run that process twice before.",
    sector: "BANK",
    country: "MT",
    jurisdiction: "MFSA",
    licenseType: "Credit institution licence",
    businessStatus: "ACTIVE",
    dealType: "MINORITY",
    stake: 25,
    price: 18_000_000,
    revenue: 11_200_000,
    ebitda: 3_400_000,
    employees: 74,
    founded: 2006,
    age: 22,
  },
  {
    seller: "sable",
    title: "Irish EMI with e-commerce merchant base",
    summary:
      "Central Bank of Ireland EMI authorisation, 640 e-commerce merchants, EUR 90M annual processed volume.",
    description:
      "An EMI authorised by the Central Bank of Ireland, serving 640 e-commerce merchants across the EU with accounts, payouts and multi-currency settlement. Processed volume is EUR 90M a year and growing at roughly 20%. Merchant concentration is moderate, with the largest client at 9% of volume. The company holds passporting rights into all EEA states, which is the main reason buyers have approached the shareholders. The sellers want a partner to fund expansion into card acquiring and will consider majority or full sale.",
    sector: "EMI",
    country: "IE",
    jurisdiction: "Central Bank of Ireland",
    licenseType: "Electronic Money Institution authorisation",
    businessStatus: "ACTIVE",
    dealType: "MAJORITY",
    stake: 65,
    price: 13_800_000,
    revenue: 4_600_000,
    ebitda: 1_240_000,
    employees: 29,
    founded: 2017,
    age: 4,
  },
  {
    seller: "northgate",
    title: "Swiss asset manager, FINMA authorised, succession sale",
    summary:
      "FINMA-authorised portfolio manager, CHF 140M under management, founder retiring after 22 years.",
    description:
      "A Zurich portfolio manager authorised by FINMA under the 2020 regime, managing CHF 140M for 60 private clients. The founder is retiring and has no successor inside the firm. Client relationships are long, with an average tenure above nine years, and the two remaining relationship managers are willing to stay. This is a succession sale rather than a distressed one, and the founder will introduce clients personally over a twelve-month handover.",
    sector: "WEALTH",
    country: "CH",
    jurisdiction: "FINMA",
    licenseType: "Portfolio manager authorisation",
    businessStatus: "ACTIVE",
    dealType: "FULL_SALE",
    stake: 100,
    price: 4_900_000,
    revenue: 1_800_000,
    ebitda: 720_000,
    employees: 6,
    founded: 2003,
    age: 37,
  },
  {
    seller: "clearford",
    title: "Netherlands payment institution, cross-border payouts",
    summary: "DNB-licensed PI specialising in payouts to freelancers in 40 countries.",
    description:
      "A Dutch payment institution licensed by De Nederlandsche Bank, specialising in mass payouts to freelancers and contractors in 40 countries. Clients are marketplaces and staffing platforms. Revenue is a fixed fee per payout plus FX margin, and volume has been stable for two years after fast early growth. The seller is a founder-led group consolidating into one entity in Lithuania and is selling the Dutch structure as a whole.",
    sector: "PAYMENT",
    country: "NL",
    jurisdiction: "De Nederlandsche Bank",
    licenseType: "Payment Institution licence",
    businessStatus: "ACTIVE",
    dealType: "FULL_SALE",
    stake: 100,
    price: 6_700_000,
    revenue: 3_300_000,
    ebitda: 810_000,
    employees: 21,
    founded: 2018,
    age: 26,
  },
  {
    seller: "verdant",
    title: "Crypto exchange, high volume, thin documentation",
    summary: "Exchange with reported volume and a large user base. Seller has not supplied audited figures.",
    description:
      "An exchange the seller describes as high volume with a large user base. Financial statements have not been supplied, the registration referenced in the listing could not be confirmed with the named regulator, and the seller declined to name the custody arrangement. Listed here as submitted.",
    sector: "CRYPTO",
    country: "KY",
    jurisdiction: "",
    licenseType: "",
    businessStatus: "ACTIVE",
    dealType: "FULL_SALE",
    stake: 100,
    price: 22_000_000,
    revenue: 9_000_000,
    ebitda: 8_500_000,
    employees: 5,
    founded: 2024,
    status: "SUSPENDED",
    reason:
      "Financial statements not provided after two requests, and the regulator named in the listing has no record of the entity.",
    age: 7,
  },
  {
    seller: "baltic",
    title: "Latvian EMI, under offer",
    summary: "EMI licence with an operating SME account business. Exclusivity granted to a buyer until March.",
    description:
      "An EMI with 1,200 SME accounts in the Baltics. The shareholders granted exclusivity to a buyer after a competitive process, and the listing stays visible so the market can see the outcome. Enquiries are recorded for the backup list in case exclusivity lapses.",
    sector: "EMI",
    country: "LT",
    jurisdiction: "Bank of Lithuania",
    licenseType: "Electronic Money Institution licence",
    businessStatus: "ACTIVE",
    dealType: "FULL_SALE",
    stake: 100,
    price: 6_200_000,
    revenue: 2_600_000,
    ebitda: 690_000,
    employees: 22,
    founded: 2019,
    status: "UNDER_OFFER",
    age: 48,
  },
  {
    seller: "meridian",
    title: "Cyprus payment institution, sold",
    summary: "Completed transaction, kept visible as a reference point on pricing.",
    description:
      "A Cyprus payment institution acquired by a strategic buyer in a full sale. Kept on the platform so buyers can see what comparable assets have cleared at.",
    sector: "PAYMENT",
    country: "CY",
    jurisdiction: "Central Bank of Cyprus",
    licenseType: "Payment Institution licence",
    businessStatus: "ACTIVE",
    dealType: "FULL_SALE",
    stake: 100,
    price: 3_400_000,
    revenue: 1_600_000,
    ebitda: 430_000,
    employees: 13,
    founded: 2017,
    status: "SOLD",
    age: 92,
  },
  {
    seller: "harbourpoint",
    title: "Singapore MPI licence holder",
    summary: "MAS Major Payment Institution licence covering cross-border transfer and merchant acquisition.",
    description:
      "A Major Payment Institution licensed by the Monetary Authority of Singapore, holding permissions for cross-border money transfer and merchant acquisition. The business runs a corridor between Singapore and South Asia with a small but loyal corporate client base. The holding company is exiting APAC payments.",
    sector: "PAYMENT",
    country: "SG",
    jurisdiction: "Monetary Authority of Singapore",
    licenseType: "Major Payment Institution licence",
    businessStatus: "ACTIVE",
    dealType: "FULL_SALE",
    stake: 100,
    price: 9_800_000,
    revenue: 4_100_000,
    ebitda: 1_100_000,
    employees: 26,
    founded: 2018,
    age: 2,
  },
  {
    seller: "sable",
    title: "Canadian MSB with FINTRAC registration",
    summary: "Registered MSB running remittance corridors to the Philippines and Nigeria.",
    description:
      "A FINTRAC-registered money services business running remittance corridors from Canada to the Philippines and Nigeria, with 14,000 active senders. Distribution is a mix of an app and four physical locations in Toronto. The owners want to exit after eleven years and will hand over agent relationships and the compliance programme.",
    sector: "PAYMENT",
    country: "CA",
    jurisdiction: "FINTRAC",
    licenseType: "Money Services Business registration",
    businessStatus: "ACTIVE",
    dealType: "FULL_SALE",
    stake: 100,
    price: 2_800_000,
    revenue: 1_900_000,
    ebitda: 470_000,
    employees: 15,
    founded: 2014,
    age: 13,
  },
  {
    seller: "northgate",
    title: "Draft: German factoring business",
    summary: "Draft listing, financials still being compiled by the seller.",
    description: "Not yet published. The seller is compiling three years of audited figures.",
    sector: "LENDING",
    country: "DE",
    jurisdiction: "BaFin",
    licenseType: "Factoring registration",
    businessStatus: "ACTIVE",
    dealType: "FULL_SALE",
    stake: 100,
    price: 0,
    revenue: 2_200_000,
    ebitda: 0,
    employees: 11,
    founded: 2015,
    status: "DRAFT",
    age: 1,
  },
  {
    seller: "quarry",
    title: "Australian AFSL holder, general advice authorisation",
    summary: "AFSL with general advice and dealing authorisations, small advisory client base.",
    description:
      "An Australian Financial Services Licence holder with general advice and dealing authorisations. The advisory client base is small and the value in the deal is the licence itself, which suits a buyer wanting to launch a product in Australia without a two-year application. Responsible managers are willing to stay for the transition period ASIC expects.",
    sector: "WEALTH",
    country: "AU",
    jurisdiction: "ASIC",
    licenseType: "Australian Financial Services Licence",
    businessStatus: "LICENSE_ONLY",
    dealType: "FULL_SALE",
    stake: 100,
    price: 1_400_000,
    revenue: 120_000,
    ebitda: 0,
    employees: 2,
    founded: 2016,
    age: 35,
  },
  {
    seller: "clearford",
    title: "Czech crypto exchange registration, operating desk",
    summary: "Registered crypto trading company with an OTC desk serving Czech and Slovak clients.",
    description:
      "A registered crypto trading company running an OTC desk for Czech and Slovak clients, mostly small corporates converting treasury. Volume is EUR 2M a month at a spread that has held steady. The registration is a trade licence rather than a full authorisation, and the MiCA transition has not been started, which a buyer should price in.",
    sector: "CRYPTO",
    country: "CZ",
    jurisdiction: "Czech Trade Licensing Office",
    licenseType: "Crypto trading registration",
    businessStatus: "ACTIVE",
    dealType: "FULL_SALE",
    stake: 100,
    price: 1_100_000,
    revenue: 620_000,
    ebitda: 190_000,
    employees: 5,
    founded: 2021,
    age: 10,
  },
  {
    seller: "verdant",
    title: "Bulgarian lending platform, licence and book",
    summary: "Consumer lender with a BGN 9M book and its own origination platform.",
    description:
      "A Bulgarian consumer lender with a BGN 9M performing book and an in-house origination platform. Loans are small and short, average BGN 900 over six months, and the default rate has held near 6%, which is priced into the yield. The owner is selling both the licence and the book together, and will not split them.",
    sector: "LENDING",
    country: "BG",
    jurisdiction: "Bulgarian National Bank",
    licenseType: "Non-bank financial institution registration",
    businessStatus: "ACTIVE",
    dealType: "FULL_SALE",
    stake: 100,
    price: 3_600_000,
    revenue: 2_100_000,
    ebitda: 640_000,
    employees: 22,
    founded: 2016,
    age: 18,
  },
];

const MANAGERS = [
  { name: "Olena Tkachuk", email: "olena@n5deal.com" },
  { name: "Michael Reyes", email: "michael@n5deal.com" },
];

function seed() {
  // Order matters: children before parents, so foreign keys stay satisfied.
  db.delete(messages).run();
  db.delete(conversations).run();
  db.delete(savedAssets).run();
  db.delete(moderationLog).run();
  db.delete(assets).run();
  db.delete(buyerProfiles).run();
  db.delete(sellerProfiles).run();
  db.delete(sessions).run();
  db.delete(users).run();

  const sellerIds = new Map<string, string>();
  SELLERS.forEach((s, i) => {
    const id = newId();
    sellerIds.set(s.key, id);
    db.insert(users)
      .values({
        id,
        email: s.email,
        name: s.name,
        role: "SELLER",
        status: "ACTIVE",
        createdAt: daysAgo(400 - i * 20),
      })
      .run();
    db.insert(sellerProfiles)
      .values({
        userId: id,
        company: s.company,
        country: s.country,
        website: s.website,
        about: s.about,
        verified: s.verified,
        dealsClosed: s.dealsClosed,
      })
      .run();
  });

  const buyerIds: string[] = [];
  BUYERS.forEach((b, i) => {
    const id = newId();
    buyerIds.push(id);
    db.insert(users)
      .values({
        id,
        email: b.email,
        name: b.name,
        role: "BUYER",
        status: "ACTIVE",
        createdAt: daysAgo(300 - i * 12),
      })
      .run();
    db.insert(buyerProfiles)
      .values({
        userId: id,
        headline: b.headline,
        about: b.about,
        country: b.country,
        investorType: b.investorType,
        ticketMinCents: usd(b.ticketMin),
        ticketMaxCents: usd(b.ticketMax),
        sectors: JSON.stringify(b.sectors),
        jurisdictions: JSON.stringify(b.jurisdictions),
        dealTypes: JSON.stringify(b.dealTypes),
        timeline: b.timeline,
        proofOfFunds: b.proofOfFunds,
        listedInDirectory: b.listed ?? true,
      })
      .run();
  });

  const managerIds = MANAGERS.map((m, i) => {
    const id = newId();
    db.insert(users)
      .values({
        id,
        email: m.email,
        name: m.name,
        role: "MANAGER",
        status: "ACTIVE",
        createdAt: daysAgo(500 + i),
      })
      .run();
    return id;
  });

  const assetIds: string[] = [];
  ASSETS.forEach((a, i) => {
    const id = newId();
    assetIds.push(id);
    db.insert(assets)
      .values({
        id,
        reference: `N5-${1200 + i * 37}`,
        sellerId: sellerIds.get(a.seller)!,
        title: a.title,
        summary: a.summary,
        description: a.description,
        sector: a.sector,
        country: a.country,
        jurisdiction: a.jurisdiction,
        licenseType: a.licenseType,
        businessStatus: a.businessStatus,
        dealType: a.dealType,
        stakeOffered: a.stake,
        askingPriceCents: usd(a.price),
        revenueCents: usd(a.revenue),
        ebitdaCents: usd(a.ebitda),
        employees: a.employees,
        foundedYear: a.founded,
        status: a.status ?? "PUBLISHED",
        statusReason: a.reason ?? null,
        views: Math.floor(rand() * 480) + 20,
        createdAt: daysAgo(a.age),
        updatedAt: daysAgo(Math.max(0, a.age - 1)),
      })
      .run();
  });

  // A suspended buyer account, so the moderation views have a real case to show.
  const spamBuyerId = buyerIds[buyerIds.length - 1];
  const spamReason =
    "Mandate contains no verifiable detail, and the account contacted 40 sellers with an identical message in one day.";
  db.update(users)
    .set({ status: "SUSPENDED", statusReason: spamReason, statusChangedAt: daysAgo(2) })
    .where(eq(users.id, spamBuyerId))
    .run();

  db.insert(moderationLog)
    .values([
      {
        id: newId(),
        actorId: managerIds[0],
        targetType: "USER",
        targetId: spamBuyerId,
        targetLabel: BUYERS[BUYERS.length - 1].name,
        action: "SUSPEND",
        reason: spamReason,
        createdAt: daysAgo(2),
      },
      {
        id: newId(),
        actorId: managerIds[1],
        targetType: "ASSET",
        targetId: assetIds[ASSETS.findIndex((a) => a.status === "SUSPENDED")],
        targetLabel: ASSETS.find((a) => a.status === "SUSPENDED")!.title,
        action: "UNLIST_ASSET",
        reason: ASSETS.find((a) => a.status === "SUSPENDED")!.reason!,
        createdAt: daysAgo(6),
      },
    ])
    .run();

  // Saved assets give the buyer dashboard something to show on first load.
  const savedPairs: Array<[number, number]> = [
    [0, 0],
    [0, 18],
    [0, 16],
    [4, 0],
    [4, 19],
    [1, 2],
    [1, 7],
    [8, 18],
    [8, 21],
    [5, 1],
    [5, 9],
  ];
  for (const [b, a] of savedPairs) {
    db.insert(savedAssets)
      .values({ buyerId: buyerIds[b], assetId: assetIds[a], createdAt: daysAgo(Math.floor(rand() * 20)) })
      .run();
  }

  const threads: Array<{
    buyer: number;
    asset: number;
    startedBy: "BUYER" | "SELLER";
    turns: string[];
    age: number;
  }> = [
    {
      buyer: 0,
      asset: 0,
      startedBy: "BUYER",
      age: 5,
      turns: [
        "We run a payments group in DACH and this licence fits a corridor we are opening in Q2. Two questions before we go further: is the SEPA Instant connection direct or through the partner bank, and would the MLRO stay through the change of control?",
        "The SEPA Instant connection runs through the partner bank, and the contract novates to a buyer on the same terms. Our MLRO has said she will stay for at least twelve months, and her fit-and-proper approval carries over. I can share the partner bank agreement under NDA today.",
        "That works. Send the NDA and we will have our counsel turn it around this week. We would also want the last two supervisory letters if there are any.",
      ],
    },
    {
      buyer: 8,
      asset: 18,
      startedBy: "BUYER",
      age: 3,
      turns: [
        "Atlas Bridge has bought four payment institutions since 2022 and we integrate onto one platform. The Irish EMI is interesting for the passporting. Is the seller open to a full sale rather than the 65% listed?",
        "The shareholders would consider it, but the price expectation goes up because two of them intended to roll over. Give me a range and I will put it to them this week.",
      ],
    },
    {
      buyer: 4,
      asset: 5,
      startedBy: "SELLER",
      age: 8,
      turns: [
        "Your mandate mentions crypto with a real licence and no retail leverage, which is exactly what this MFSA-licensed brokerage is. The owners want a partner with distribution rather than a clean exit. Worth a call?",
        "Yes. Send the MiCA transition file first. If the application is behind schedule that changes the price for us, and I would rather know before we spend time on it.",
        "Understood. The file is with external counsel and I will have it to you tomorrow with the current timeline.",
      ],
    },
    {
      buyer: 5,
      asset: 1,
      startedBy: "BUYER",
      age: 1,
      turns: [
        "Interested in the clean Lithuanian EMI. I buy shells and build on them, so the lack of trading history is a plus for me. Is 1.1M cash, closing in six weeks, something the seller would look at?",
      ],
    },
    {
      buyer: 10,
      asset: 17,
      startedBy: "BUYER",
      age: 12,
      turns: [
        "We are a Brazilian group and this would be our first European banking licence. The minority structure is a problem for us. Would the shareholders reconsider if we came in at a control premium?",
        "They will not sell control. The capital increase is for a trade finance plan they intend to run themselves. If a minority position works for you, I can arrange a call with the chairman.",
        "Let me take it back to our board. A minority is not what we set out to do but the asset is the right size.",
      ],
    },
    {
      buyer: 7,
      asset: 7,
      startedBy: "SELLER",
      age: 4,
      turns: [
        "You buy performing consumer books in CEE. This German lender has a EUR 34M book at 2.1% default across three vintages, sold with the scoring model and the servicing team. Forward-flow funding renews annually.",
        "Germany is outside our core but the vintage data is good. Send the loan tape and the forward-flow contract and I will run it past our credit committee.",
      ],
    },
    {
      buyer: 3,
      asset: 3,
      startedBy: "BUYER",
      age: 9,
      turns: [
        "I am a search fund buyer looking for one business to run myself. The agent book fits the size but I need to understand the principal relationship. If the principal firm terminates, what happens to the merchants?",
        "The agency agreement has a twelve-month notice period and the merchants contract with the agent, not the principal. In practice a new principal would take them on. I can introduce you to two brokers who have moved books before.",
      ],
    },
    {
      buyer: 11,
      asset: 14,
      startedBy: "BUYER",
      age: 6,
      turns: [
        "We consolidate US MTL portfolios. 31 states is a good footprint. Are New York and California both in the set, and are all bonds current?",
        "New York is in, California is not. Bonds are current in every state and the last examination closed with no findings. Happy to share the state-by-state schedule.",
        "Without California the price needs to come down. Send the schedule and I will mark up what we would pay.",
      ],
    },
  ];

  for (const thread of threads) {
    const assetId = assetIds[thread.asset];
    const sellerKey = ASSETS[thread.asset].seller;
    const sellerId = sellerIds.get(sellerKey)!;
    const buyerId = buyerIds[thread.buyer];
    const conversationId = newId();

    db.insert(conversations)
      .values({
        id: conversationId,
        assetId,
        buyerId,
        sellerId,
        startedBy: thread.startedBy,
        createdAt: daysAgo(thread.age),
        lastMessageAt: daysAgo(thread.age - (thread.turns.length - 1) * 0.4),
      })
      .run();

    thread.turns.forEach((body, index) => {
      const fromInitiator = index % 2 === 0;
      const senderIsBuyer = thread.startedBy === "BUYER" ? fromInitiator : !fromInitiator;
      db.insert(messages)
        .values({
          id: newId(),
          conversationId,
          senderId: senderIsBuyer ? buyerId : sellerId,
          body,
          createdAt: daysAgo(thread.age - index * 0.4),
          // Leave the newest inbound message unread so the inbox shows a badge.
          readAt: index === thread.turns.length - 1 ? null : daysAgo(thread.age - index * 0.4 - 0.1),
        })
        .run();
    });
  }

  const counts = {
    users: SELLERS.length + BUYERS.length + MANAGERS.length,
    assets: ASSETS.length,
    conversations: threads.length,
    messages: threads.reduce((n, t) => n + t.turns.length, 0),
  };
  console.log(
    `Seeded ${counts.users} users, ${counts.assets} assets, ${counts.conversations} conversations, ${counts.messages} messages.`,
  );
  console.log("Sign in from /login with any seeded account.");
}

seed();
