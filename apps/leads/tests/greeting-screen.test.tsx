/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { GreetingScreen } from "@/components/chat/greeting-screen";
import { ICP_TAG_CATEGORIES } from "@/lib/icp-tag-colors";
import { CAMPAIGN_TEMPLATES } from "@/lib/campaign-templates";

// ─── Mocks ────────────────────────────────────────────────

const mockSetText = vi.fn();
const mockSend = vi.fn();

vi.mock("@assistant-ui/react", () => {
  const P = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ThreadPrimitive: { Root: P, Viewport: P, ViewportFooter: P },
    ComposerPrimitive: {
      Root: P,
      Input: (props: Record<string, unknown>) => <input {...props} />,
      Send: P,
    },
    useThreadRuntime: () => ({
      composer: { setText: mockSetText, send: mockSend },
      cancelRun: vi.fn(),
    }),
    useMessage: () => ({ content: [] }),
  };
});

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(() => ({
    data: { user: { name: "Martin Paviot" } },
  })),
}));

vi.mock("@/components/chat/agent-chat", () => ({
  useAgentActivity: () => ({ isStreaming: false }),
}));

vi.mock("@phosphor-icons/react", () => {
  const Icon = (props: Record<string, unknown>) => <span {...props} />;
  return {
    Check: Icon,
    Plus: Icon,
    FileText: Icon,
    Coins: Icon,
    UserPlus: Icon,
    Swap: Icon,
    GlobeHemisphereWest: Icon,
    Crown: Icon,
    ChatCircleDots: Icon,
    Rocket: Icon,
    ChartLineUp: Icon,
    Users: Icon,
    Target: Icon,
    Fire: Icon,
  };
});

vi.mock("@phosphor-icons/react/dist/ssr", () => {
  const Icon = (props: Record<string, unknown>) => <span {...props} />;
  return {
    PaperPlaneRight: Icon,
    Stop: Icon,
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/ui/dropdown-menu", () => {
  const P = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    DropdownMenu: P,
    DropdownMenuContent: P,
    DropdownMenuItem: P,
    DropdownMenuTrigger: P,
  };
});

// ─── Test Helpers ─────────────────────────────────────────

const MOCK_DNA = {
  oneLiner: "AI-powered cold email platform for B2B teams",
  targetBuyers: [
    { role: "Head of Sales", sellingAngle: "Automate outbound pipeline" },
    { role: "VP Marketing", sellingAngle: "Increase qualified leads" },
  ],
  differentiators: ["AI-personalized sequences", "Multi-ESP routing", "Built-in A/B testing"],
};

function makeDashboardData(overrides: Record<string, unknown> = {}) {
  return {
    tam: null,
    companyDna: null,
    weekStats: null,
    activeCampaigns: [],
    priorities: [],
    lastCampaign: null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────

describe("GreetingScreen", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders tool pills for ACTIVE integrations only", async () => {
    const integrations = [
      { type: "INSTANTLY", status: "ACTIVE" },
      { type: "HUBSPOT", status: "INACTIVE" },
      { type: "SALESFORCE", status: "ACTIVE" },
    ];

    render(<GreetingScreen isStreaming={false} integrations={integrations} />);

    await vi.waitFor(() => {
      expect(screen.getByText("Instantly")).toBeTruthy();
    });

    expect(screen.getByText("Salesforce")).toBeTruthy();
    expect(screen.queryByText("HubSpot")).toBeNull();
  });

  it("hides Layer 1 when no integrations connected", async () => {
    render(<GreetingScreen isStreaming={false} integrations={[{ type: "INSTANTLY", status: "INACTIVE" }]} />);

    await vi.waitFor(() => {
      expect(screen.getByText(/What's your website URL/)).toBeTruthy();
    });

    expect(screen.queryByText("Instantly")).toBeNull();
  });

  it("adapts greeting copy when no integrations connected", async () => {
    render(<GreetingScreen isStreaming={false} integrations={[]} />);

    await vi.waitFor(() => {
      expect(
        screen.getByText(/What's your website URL/)
      ).toBeTruthy();
    });

    expect(screen.queryByText(/your tools are connected/)).toBeNull();
  });

  it("shows first name from session with time-based greeting", async () => {
    render(<GreetingScreen isStreaming={false} integrations={[{ type: "INSTANTLY", status: "ACTIVE" }]} />);

    await vi.waitFor(() => {
      expect(screen.getByText(/Martin/)).toBeTruthy();
    });
    const greeting = screen.getByText(/Good (morning|afternoon|evening)/);
    expect(greeting).toBeTruthy();
  });

  // ─── Template cards tests (no DNA) ────────────────────

  it("renders 5 template cards when no DNA", async () => {
    render(<GreetingScreen isStreaming={false} integrations={[]} />);

    await vi.waitFor(() => {
      expect(screen.getByText("Start with a template:")).toBeTruthy();
    });

    for (const tpl of CAMPAIGN_TEMPLATES) {
      expect(screen.getByText(tpl.title)).toBeTruthy();
    }
  });

  it("click on template card fills composer text", async () => {
    render(<GreetingScreen isStreaming={false} integrations={[]} />);

    const firstTemplate = CAMPAIGN_TEMPLATES[0];
    const templateButton = await vi.waitFor(() =>
      screen.getByText(firstTemplate.title)
    );

    fireEvent.click(templateButton.closest("button")!);

    expect(mockSetText).toHaveBeenCalledWith(firstTemplate.icpText);
  });

  it("shows legend tags when no DNA", async () => {
    render(<GreetingScreen isStreaming={false} integrations={[]} />);

    await vi.waitFor(() => {
      expect(screen.getByText("Start with a template:")).toBeTruthy();
    });

    for (const cat of Object.values(ICP_TAG_CATEGORIES)) {
      expect(screen.getByText(cat.label)).toBeTruthy();
    }
  });

  // ─── Company DNA tests ───────────────────────────────────

  it("shows Company DNA summary card when DNA exists (no dashboard sections)", async () => {
    render(
      <GreetingScreen
        isStreaming={false}
        integrations={[{ type: "INSTANTLY", status: "ACTIVE" }]}
        dashboardData={makeDashboardData({ companyDna: MOCK_DNA })}
      />
    );

    await vi.waitFor(() => {
      expect(screen.getByText("Your Company DNA")).toBeTruthy();
    });

    expect(screen.getByText(MOCK_DNA.oneLiner)).toBeTruthy();
    expect(screen.getByText("AI-personalized sequences")).toBeTruthy();
    expect(screen.getByText("Multi-ESP routing")).toBeTruthy();
    expect(screen.getByText("Built-in A/B testing")).toBeTruthy();
  });

  it("generates dynamic ICP example from targetBuyers[0]", async () => {
    render(
      <GreetingScreen
        isStreaming={false}
        integrations={[{ type: "INSTANTLY", status: "ACTIVE" }]}
        dashboardData={makeDashboardData({ companyDna: MOCK_DNA })}
      />
    );

    const exampleButton = await vi.waitFor(() =>
      screen.getByRole("button", { name: /Head of Sales/ })
    );
    expect(exampleButton).toBeTruthy();
    expect(exampleButton.textContent).toContain("Automate outbound pipeline");

    fireEvent.click(exampleButton);
    expect(mockSetText).toHaveBeenCalledWith(
      "Head of Sales — Automate outbound pipeline"
    );

    expect(screen.getByText("Based on your DNA:")).toBeTruthy();
    expect(screen.queryByText("Start with a template:")).toBeNull();
  });

  it("shows DNA-aware greeting text when DNA + tools exist", async () => {
    render(
      <GreetingScreen
        isStreaming={false}
        integrations={[{ type: "INSTANTLY", status: "ACTIVE" }]}
        dashboardData={makeDashboardData({ companyDna: MOCK_DNA })}
      />
    );

    await vi.waitFor(() => {
      expect(screen.getByText(/Your tools are connected/)).toBeTruthy();
    });
  });

  it("shows URL-first greeting when tools connected but no DNA", async () => {
    render(
      <GreetingScreen
        isStreaming={false}
        integrations={[{ type: "INSTANTLY", status: "ACTIVE" }]}
        dashboardData={makeDashboardData()}
      />
    );

    await vi.waitFor(() => {
      expect(screen.getByText(/What's your website URL/)).toBeTruthy();
    });
  });

  it("falls back to DNA-based example when DNA has no targetBuyers", async () => {
    const dnaNobuyers = { ...MOCK_DNA, targetBuyers: [] };
    render(
      <GreetingScreen
        isStreaming={false}
        integrations={[]}
        dashboardData={makeDashboardData({ companyDna: dnaNobuyers })}
      />
    );

    await vi.waitFor(() => {
      expect(screen.getByText("Based on your DNA:")).toBeTruthy();
    });
  });

  it("hides DNA summary card when companyDna is null", async () => {
    render(
      <GreetingScreen
        isStreaming={false}
        integrations={[{ type: "INSTANTLY", status: "ACTIVE" }]}
        dashboardData={makeDashboardData()}
      />
    );

    await vi.waitFor(() => {
      expect(screen.getByText("Instantly")).toBeTruthy();
    });
    expect(screen.queryByText("Your Company DNA")).toBeNull();
  });

  // ─── Dashboard sections tests ──────────────────────────

  it("shows TAM section when tam data exists", async () => {
    render(
      <GreetingScreen
        isStreaming={false}
        integrations={[{ type: "INSTANTLY", status: "ACTIVE" }]}
        dashboardData={makeDashboardData({
          companyDna: MOCK_DNA,
          tam: { total: 14247, burningEstimate: 2100, roles: ["VP Sales", "Head of Growth"] },
        })}
      />
    );

    // toLocaleString() output varies by env, match partial
    await vi.waitFor(() => {
      expect(screen.getByText(/14.?247/)).toBeTruthy();
    });

    expect(screen.getByText(/2.?100/)).toBeTruthy();
    expect(screen.getByText("VP Sales")).toBeTruthy();
    expect(screen.getByText("Head of Growth")).toBeTruthy();
  });

  it("shows priorities with action buttons", async () => {
    render(
      <GreetingScreen
        isStreaming={false}
        integrations={[{ type: "INSTANTLY", status: "ACTIVE" }]}
        dashboardData={makeDashboardData({
          companyDna: MOCK_DNA,
          priorities: [
            { type: "replies", label: "3 new replies waiting", action: "Show new replies" },
            { type: "uncommitted", label: "12 Tier A leads uncommitted", action: "Launch campaign with my best leads" },
          ],
        })}
      />
    );

    await vi.waitFor(() => {
      expect(screen.getByText("3 new replies waiting")).toBeTruthy();
    });

    expect(screen.getByText("12 Tier A leads uncommitted")).toBeTruthy();

    // Click priority button dispatches action
    const replyButton = screen.getByText("3 new replies waiting").closest("button")!;
    fireEvent.click(replyButton);
    expect(mockSetText).toHaveBeenCalledWith("Show new replies");
    expect(mockSend).toHaveBeenCalled();
  });

  it("shows week stats section when data exists", async () => {
    render(
      <GreetingScreen
        isStreaming={false}
        integrations={[{ type: "INSTANTLY", status: "ACTIVE" }]}
        dashboardData={makeDashboardData({
          companyDna: MOCK_DNA,
          weekStats: { sent: 450, replied: 23, meetings: 3 },
        })}
      />
    );

    await vi.waitFor(() => {
      expect(screen.getByText("450")).toBeTruthy();
    });

    expect(screen.getByText("23")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });
});
