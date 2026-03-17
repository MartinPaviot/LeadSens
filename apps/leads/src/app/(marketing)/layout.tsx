import Link from "next/link";
import { MobileNav } from "./_components/mobile-nav";
import { ScrollProgress } from "./_components/scroll-progress";
import { ForceLightTheme } from "./_components/force-light-theme";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Integrations", href: "/#integrations" },
  { label: "Pricing", href: "/pricing" },
];

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col font-[var(--font-dm-sans,var(--font-geist-sans))]">
      <ForceLightTheme />
      <ScrollProgress />
      {/* Navigation */}
      <header className="relative border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-lg"
          >
            <div className="size-7 overflow-hidden rounded-lg">
              <img src="/L.svg" alt="LeadSens" className="size-7" />
            </div>
            LeadSens
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center rounded-full bg-gradient-to-r from-[#17C3B2] via-[#2C6BED] to-[#FF7A3D] px-5 text-sm font-medium text-white transition-all hover:shadow-lg hover:shadow-primary/25"
            >
              Get Started
            </Link>
          </nav>

          {/* Mobile hamburger */}
          <MobileNav links={NAV_LINKS} />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Brand */}
            <div>
              <Link
                href="/"
                className="flex items-center gap-2 font-semibold text-lg mb-3"
              >
                <div className="size-6 overflow-hidden rounded-lg">
                  <img src="/L.svg" alt="LeadSens" className="size-6" />
                </div>
                LeadSens
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI-powered outbound agent. Your tools, your data, our
                orchestration.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="mb-3 text-sm font-semibold">Product</h4>
              <nav className="flex flex-col gap-2">
                <Link
                  href="/#features"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Features
                </Link>
                <Link
                  href="/pricing"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Pricing
                </Link>
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign up
                </Link>
              </nav>
            </div>

            {/* Legal */}
            <div>
              <h4 className="mb-3 text-sm font-semibold">Legal</h4>
              <nav className="flex flex-col gap-2">
                <Link
                  href="/privacy"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Privacy Policy
                </Link>
                <Link
                  href="/terms"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Terms of Service
                </Link>
              </nav>
            </div>
          </div>

          <div className="mt-10 border-t border-border/40 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} LeadSens. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
