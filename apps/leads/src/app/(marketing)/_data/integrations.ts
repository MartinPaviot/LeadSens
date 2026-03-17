export interface IntegrationItem {
  name: string;
  logo: string | null;
  category: "esp" | "leads" | "verification" | "crm" | "scheduling" | "notifications" | "export";
}

// Pareto 80/20: only tools essential for the LeadSens pipeline.
export const INTEGRATIONS: IntegrationItem[] = [
  // ESP (G2: Instantly 3,951 · Outreach 3,534 · Reply.io 1,527 · Lemlist 1,272 · Smartlead fastest-growing)
  { name: "Instantly", logo: "/instantly.svg", category: "esp" },
  { name: "Lemlist", logo: "/logos/lemlist.png", category: "esp" },
  { name: "Smartlead", logo: "/smartlead.svg", category: "esp" },
  { name: "Reply.io", logo: "/logos/reply-io.png", category: "esp" },
  { name: "Outreach", logo: "/logos/outreach.png", category: "esp" },
  // Lead DB (G2: Apollo 9,344 · ZoomInfo 9,033 · Seamless.AI 5,297 · Lusha 1,611)
  { name: "Apollo", logo: "/apollo.svg", category: "leads" },
  { name: "ZoomInfo", logo: "/logos/zoominfo.png", category: "leads" },
  { name: "Seamless.AI", logo: "/logos/seamless-ai.png", category: "leads" },
  { name: "Lusha", logo: "/logos/lusha.png", category: "leads" },
  // Verification (ZeroBounce: 100K+ clients · MillionVerifier: 70K+)
  { name: "ZeroBounce", logo: "/logos/zerobounce.png", category: "verification" },
  { name: "MillionVerifier", logo: "/logos/millionverifier.png", category: "verification" },
  // CRM (G2: Salesforce 25,471 · HubSpot 13,549 · Pipedrive 2,946)
  { name: "HubSpot", logo: "/hubspot.svg", category: "crm" },
  { name: "Salesforce", logo: "/salesforce.svg", category: "crm" },
  { name: "Pipedrive", logo: "/logos/pipedrive.png", category: "crm" },
  // Scheduling (Calendly: 26.5% market, 20M users)
  { name: "Calendly", logo: "/logos/calendly.png", category: "scheduling" },
  // Notifications (Slack: 42M DAU)
  { name: "Slack", logo: "/logos/slack.png", category: "notifications" },
  // Export (CSV for Sheets/Excel, Airtable, Notion)
  { name: "CSV", logo: "/logos/google-sheets.png", category: "export" },
  { name: "Airtable", logo: "/logos/airtable.png", category: "export" },
  { name: "Notion", logo: "/logos/notion.png", category: "export" },
];

export const CATEGORY_LABELS: Record<IntegrationItem["category"], string> = {
  esp: "Email Sending",
  leads: "Lead Database",
  verification: "Verification",
  crm: "CRM",
  scheduling: "Scheduling",
  notifications: "Notifications",
  export: "Export",
};

/** Only integrations with logos */
export const LOGO_INTEGRATIONS = INTEGRATIONS.filter(
  (i): i is IntegrationItem & { logo: string } => i.logo !== null
);
