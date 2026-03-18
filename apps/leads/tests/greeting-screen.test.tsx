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
      composer: { setText: mockSetText },
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
      // URL-first onboarding: asks for website URL when no DNA
      expect(screen.getByText(/What's your website URL/)).toBeTruthy();
    });

    expect(screen.queryByText("Instantly")).toBeNull();
  });

  it("adapts greeting copy when no integrations connected", async () => {
    render(<GreetingScreen isStreaming={false} integrations={[]} />);

    await vi.waitFor(() => {
      // URL-first onboarding: asks for website URL when no DNA
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
    // Should show one of "Good morning", "Good afternoon", or "Good evening"
    const greeting = screen.getByText(/Good (morning|afternoon|evening)/);
    expect(greeting).toBeTruthy();
  });

  // ─── Template cards tests (no DNA) ────────────────────

  it("renders 5 template cards when no DNA", async () => {
    render(<GreetingScreen isStreaming={false} integrations={[]} />);

    await vi.waitFor(() => {
      expect(screen.getByText("Start with a template:")).toBeTruthy();
    });

    // All 5 template titles should be visible
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

    // Click the parent button (the template card)
    fireEvent.click(templateButton.closest("button")!);

    expect(mockSetText).toHaveBeenCalledWith(firstTemplate.icpText);
  });

  it("shows 'For example' fallback tags when no DNA", async () => {
    render(<GreetingScreen isStreaming={false} integrations={[]} />);

    await vi.waitFor(() => {
      expect(screen.getByText("Start with a template:")).toBeTruthy();
    });

    // Legend labels still visible
    for (const cat of Object.values(ICP_TAG_CATEGORIES)) {
      expect(screen.getByText(cat.label)).toBeTruthy();
    }
  });

  // ─── Company DNA tests ───────────────────────────────────

  const MOCK_DNA = {
    oneLiner: "AI-powered cold email platform for B2B teams",
    targetBuyers: [
      { role: "Head of Sales", sellingAngle: "Automate outbound pipeline" },
      { role: "VP Marketing", sellingAngle: "Increase qualified leads" },
    ],
    differentiators: ["AI-personalized sequences", "Multi-ESP routing", "Built-in A/B testing"],
    problemsSolved: ["low reply rates on cold outreach"],
  };

  it("shows Company DNA summary card when DNA exists", async () => {
    render(
      <GreetingScreen
        isStreaming={false}
        integrations={[{ type: "INSTANTLY", status: "ACTIVE" }]}
        companyDna={MOCK_DNA}
      />
    );

    await vi.waitFor(() => {
      expect(screen.getByText("Your Company DNA")).toBeTruthy();
    });

    expect(screen.getByText(MOCK_DNA.oneLiner)).toBeTruthy();
    // Shows first 3 differentiators as pills
    expect(screen.getByText("AI-personalized sequences")).toBeTruthy();
    expect(screen.getByText("Multi-ESP routing")).toBeTruthy();
    expect(screen.getByText("Built-in A/B testing")).toBeTruthy();
  });

  it("generates dynamic ICP example from targetBuyers[0]", async () => {
    render(
      <GreetingScreen
        isStreaming={false}
        integrations={[{ type: "INSTANTLY", status: "ACTIVE" }]}
        companyDna={MOCK_DNA}
      />
    );

    // Dynamic example should contain the first buyer's role + sellingAngle
    const exampleButton = await vi.waitFor(() =>
      screen.getByRole("button", { name: /Head of Sales/ })
    );
    expect(exampleButton).toBeTruthy();
    expect(exampleButton.textContent).toContain("Automate outbound pipeline");

    // Click fills composer with dynamic text
    fireEvent.click(exampleButton);
    expect(mockSetText).toHaveBeenCalledWith(
      "Head of Sales — Automate outbound pipeline"
    );

    // Should show "Based on your DNA:" instead of "Start with a template:"
    expect(screen.getByText("Based on your DNA:")).toBeTruthy();
    expect(screen.queryByText("Start with a template:")).toBeNull();
  });

  it("shows DNA-aware greeting text when DNA + tools exist", async () => {
    render(
      <GreetingScreen
        isStreaming={false}
        integrations={[{ type: "INSTANTLY", status: "ACTIVE" }]}
        companyDna={MOCK_DNA}
      />
    );

    await vi.waitFor(() => {
      expect(screen.getByText(/I've analyzed your offer/)).toBeTruthy();
    });
    expect(screen.getByText(/try the suggestion below/)).toBeTruthy();
  });

  it("shows URL-first greeting when tools connected but no DNA", async () => {
    render(
      <GreetingScreen
        isStreaming={false}
        integrations={[{ type: "INSTANTLY", status: "ACTIVE" }]}
        companyDna={null}
      />
    );

    await vi.waitFor(() => {
      // URL-first onboarding: asks for website URL when no DNA, even with tools connected
      expect(screen.getByText(/What's your website URL/)).toBeTruthy();
    });
  });

  it("falls back to templates when DNA has no targetBuyers", async () => {
    const dnaNobuyers = { ...MOCK_DNA, targetBuyers: [] };
    render(
      <GreetingScreen
        isStreaming={false}
        integrations={[]}
        companyDna={dnaNobuyers}
      />
    );

    await vi.waitFor(() => {
      // With DNA but no targetBuyers, hasDna is true (oneLiner exists) → shows DNA-based
      // but exampleText falls back to FALLBACK since no targetBuyers
      expect(screen.getByText("Based on your DNA:")).toBeTruthy();
    });
  });

  it("hides DNA summary card when companyDna is null", async () => {
    render(
      <GreetingScreen
        isStreaming={false}
        integrations={[{ type: "INSTANTLY", status: "ACTIVE" }]}
        companyDna={null}
      />
    );

    await vi.waitFor(() => {
      expect(screen.getByText("Instantly")).toBeTruthy();
    });
    expect(screen.queryByText("Your Company DNA")).toBeNull();
  });
});
