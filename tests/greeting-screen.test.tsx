/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { GreetingScreen } from "@/components/chat/greeting-screen";
import { ICP_TAG_CATEGORIES } from "@/lib/icp-tag-colors";

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

vi.mock("@phosphor-icons/react", () => ({
  Check: (props: Record<string, unknown>) => <span data-testid="check-icon" {...props} />,
}));

vi.mock("@phosphor-icons/react/dist/ssr", () => ({
  PaperPlaneRight: (props: Record<string, unknown>) => <span {...props} />,
  Stop: (props: Record<string, unknown>) => <span {...props} />,
}));

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
      expect(screen.getByText(/connect your tools/)).toBeTruthy();
    });

    expect(screen.queryByText("Instantly")).toBeNull();
  });

  it("adapts greeting copy when no integrations connected", async () => {
    render(<GreetingScreen isStreaming={false} integrations={[]} />);

    await vi.waitFor(() => {
      expect(
        screen.getByText(/connect your tools in Settings > Integrations/)
      ).toBeTruthy();
    });

    expect(screen.queryByText(/your tools are connected/)).toBeNull();
  });

  it("shows first name from session", async () => {
    render(<GreetingScreen isStreaming={false} integrations={[{ type: "INSTANTLY", status: "ACTIVE" }]} />);

    await vi.waitFor(() => {
      expect(screen.getByText(/Hello Martin/)).toBeTruthy();
    });
  });

  it("click on example fills composer text via setText()", async () => {
    render(<GreetingScreen isStreaming={false} integrations={[]} />);

    const exampleButton = await vi.waitFor(() => {
      const btn = screen.getByRole("button", { name: /VP Sales in B2B SaaS/ });
      return btn;
    });

    fireEvent.click(exampleButton);

    expect(mockSetText).toHaveBeenCalledWith(
      "VP Sales in B2B SaaS, US + UK, 50 to 500 employees, revenue > $10M"
    );
  });

  it("renders all 5 parsed tag categories", async () => {
    render(<GreetingScreen isStreaming={false} integrations={[]} />);

    await vi.waitFor(() => {
      expect(screen.getByText("VP Sales")).toBeTruthy();
    });

    expect(screen.getByText("B2B SaaS")).toBeTruthy();
    expect(screen.getByText("US + UK")).toBeTruthy();
    expect(screen.getByText("50 to 500 employees")).toBeTruthy();
    expect(screen.getByText("> $10M")).toBeTruthy();

    // Legend labels
    for (const cat of Object.values(ICP_TAG_CATEGORIES)) {
      expect(screen.getByText(cat.label)).toBeTruthy();
    }
  });
});
