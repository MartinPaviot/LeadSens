import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - LeadSens",
  description: "How LeadSens handles your data",
};

export default function PrivacyPage() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <h1 className="mb-2 text-3xl font-bold tracking-tight md:text-4xl">
          Privacy Policy
        </h1>
        <p className="mb-12 text-sm text-muted-foreground">
          Last updated: March 10, 2026
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold">1. Introduction</h2>
            <p className="text-muted-foreground">
              LeadSens (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is an AI-powered B2B
              prospecting platform. This Privacy Policy explains how we collect,
              use, store, and protect your personal data when you use our service
              at leadsens.com (the &quot;Service&quot;).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Data We Collect</h2>
            <p className="text-muted-foreground">
              <strong>Account data:</strong> Name, email address, hashed password
              when you create an account.
            </p>
            <p className="text-muted-foreground">
              <strong>Integration credentials:</strong> API keys you provide to
              connect third-party tools (Instantly, Apollo, ZeroBounce, etc.).
              These are encrypted with AES-256-GCM before storage.
            </p>
            <p className="text-muted-foreground">
              <strong>Lead data:</strong> Contact information (names, emails, job
              titles, company data) sourced through your connected tools.
            </p>
            <p className="text-muted-foreground">
              <strong>Usage data:</strong> Chat messages, campaign configurations,
              and LLM interactions to provide and improve the Service.
            </p>
            <p className="text-muted-foreground">
              <strong>Automatically collected:</strong> IP address, browser type,
              and timestamps for security and analytics.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. How We Use Your Data</h2>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>To provide, maintain, and improve the Service</li>
              <li>To process your prospecting campaigns (sourcing, enrichment, email drafting)</li>
              <li>To communicate with you about your account and the Service</li>
              <li>To detect and prevent fraud, abuse, or security incidents</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Data Processing</h2>
            <p className="text-muted-foreground">
              We use third-party AI models (Mistral AI) to process your prompts
              and lead data for ICP parsing, scoring, enrichment summarization,
              and email drafting. Your data is sent to these providers only as
              necessary to deliver the Service. We do not use your data to train
              AI models.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Data Storage & Security</h2>
            <p className="text-muted-foreground">
              Your data is stored in PostgreSQL databases hosted on secure cloud
              infrastructure. All API keys and sensitive credentials are encrypted
              at rest using AES-256-GCM. We use HTTPS for all data in transit.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Data Sharing</h2>
            <p className="text-muted-foreground">
              We do not sell your personal data. We share data only with:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>
                <strong>Third-party tools you connect:</strong> When you connect
                Instantly, Apollo, or other tools, we send data to those services
                on your behalf using your API keys.
              </li>
              <li>
                <strong>AI providers:</strong> Mistral AI processes chat messages
                and lead data to generate responses and email content.
              </li>
              <li>
                <strong>Infrastructure providers:</strong> Hosting, database, and
                monitoring services that process data on our behalf under strict
                confidentiality agreements.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Your Rights (GDPR)</h2>
            <p className="text-muted-foreground">
              If you are in the European Economic Area, you have the right to:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Access your personal data</li>
              <li>Rectify inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your data in a portable format</li>
              <li>Object to or restrict processing</li>
              <li>Withdraw consent at any time</li>
            </ul>
            <p className="text-muted-foreground">
              To exercise these rights, contact us at privacy@leadsens.com.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Data Retention</h2>
            <p className="text-muted-foreground">
              We retain your data for as long as your account is active. When you
              delete your account, we delete your personal data within 30 days,
              except where we are required to retain it by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Cookies</h2>
            <p className="text-muted-foreground">
              We use essential cookies for authentication (session tokens). We do
              not use tracking cookies or third-party advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Changes</h2>
            <p className="text-muted-foreground">
              We may update this policy from time to time. We will notify you of
              significant changes via email or an in-app notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">11. Contact</h2>
            <p className="text-muted-foreground">
              For questions about this policy or your data, contact us at{" "}
              <a
                href="mailto:privacy@leadsens.com"
                className="text-primary underline underline-offset-4"
              >
                privacy@leadsens.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
