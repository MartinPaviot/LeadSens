import type { ICP_TAG_CATEGORIES } from "./icp-tag-colors";

type ParsedTag = { text: string; category: keyof typeof ICP_TAG_CATEGORIES };

export interface CampaignTemplate {
  id: string;
  title: string;
  icon: string;
  icpText: string;
  tags: ParsedTag[];
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "funded",
    title: "Recently funded companies",
    icon: "Coins",
    icpText:
      "VP Sales or Head of Growth at B2B SaaS companies that raised Series A-B in the last 6 months, 20-200 employees",
    tags: [
      { text: "VP Sales", category: "role" },
      { text: "B2B SaaS", category: "industry" },
      { text: "Series A-B", category: "revenue" },
    ],
  },
  {
    id: "hiring",
    title: "Hiring SDRs right now",
    icon: "UserPlus",
    icpText:
      "Sales Director at companies actively hiring SDRs or BDRs, 50-500 employees, US",
    tags: [
      { text: "Sales Director", category: "role" },
      { text: "50-500 employees", category: "size" },
      { text: "US", category: "geo" },
    ],
  },
  {
    id: "competitor",
    title: "Using a competitor tool",
    icon: "Swap",
    icpText:
      "Head of Marketing using [competitor name], B2B companies, 100-1000 employees",
    tags: [
      { text: "Head of Marketing", category: "role" },
      { text: "B2B", category: "industry" },
      { text: "100-1000 employees", category: "size" },
    ],
  },
  {
    id: "expansion",
    title: "New market expansion",
    icon: "GlobeHemisphereWest",
    icpText:
      "CEO or COO at companies that recently opened offices in US or Europe, 50-300 employees",
    tags: [
      { text: "CEO / COO", category: "role" },
      { text: "US or Europe", category: "geo" },
      { text: "50-300 employees", category: "size" },
    ],
  },
  {
    id: "decision-makers",
    title: "Decision makers at scale",
    icon: "Crown",
    icpText:
      "VP Engineering or CTO at B2B SaaS, 50-500 employees, $5M-$50M revenue",
    tags: [
      { text: "VP Eng / CTO", category: "role" },
      { text: "B2B SaaS", category: "industry" },
      { text: "$5M-$50M", category: "revenue" },
    ],
  },
];
