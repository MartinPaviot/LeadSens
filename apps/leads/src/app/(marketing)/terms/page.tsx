import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - LeadSens",
  description: "Terms and conditions for using LeadSens",
};

export default function TermsPage() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <h1 className="mb-2 text-3xl font-bold tracking-tight md:text-4xl">
          Terms of Service
        </h1>
        <p className="mb-12 text-sm text-muted-foreground">
          Last updated: March 10, 2026
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using LeadSens (&quot;the Service&quot;), you agree to
              be bound by these Terms of Service. If you do not agree, do not use
              the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Description of Service</h2>
            <p className="text-muted-foreground">
              LeadSens is an AI-powered B2B prospecting platform that helps you
              source leads, enrich contact data, draft personalized emails, and
              manage outbound campaigns through your own connected tools
              (Instantly, Apollo, ZeroBounce, etc.).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Account Registration</h2>
            <p className="text-muted-foreground">
              You must provide accurate information when creating an account. You
              are responsible for maintaining the security of your account
              credentials. You must notify us immediately of any unauthorized use
              of your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Acceptable Use</h2>
            <p className="text-muted-foreground">You agree not to:</p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>
                Send unsolicited bulk email (spam) in violation of CAN-SPAM, GDPR,
                or other applicable laws
              </li>
              <li>
                Use the Service to harass, threaten, or send abusive content to any
                person
              </li>
              <li>
                Attempt to gain unauthorized access to the Service or other users&apos;
                data
              </li>
              <li>
                Use the Service to violate any applicable law or regulation
              </li>
              <li>
                Reverse engineer, decompile, or disassemble the Service
              </li>
              <li>
                Resell or sublicense the Service without written permission
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Your Data & Integrations</h2>
            <p className="text-muted-foreground">
              You retain ownership of all data you provide to the Service,
              including lead data, campaign content, and API credentials. You are
              responsible for ensuring you have the right to use the data you
              provide and that your outbound campaigns comply with applicable email
              marketing laws.
            </p>
            <p className="text-muted-foreground">
              When you connect third-party tools (Instantly, Apollo, etc.), you
              authorize LeadSens to interact with those services on your behalf
              using your credentials. LeadSens is not responsible for the actions or
              policies of third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. AI-Generated Content</h2>
            <p className="text-muted-foreground">
              LeadSens uses AI models to generate email content, lead scores, and
              other outputs. While we strive for high quality, AI-generated content
              may contain errors. You are responsible for reviewing all content
              before it is sent to recipients.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Billing & Payment</h2>
            <p className="text-muted-foreground">
              Paid plans are billed monthly. Prices are in USD and do not include
              applicable taxes. You may cancel at any time; access continues until
              the end of the billing period. We reserve the right to change pricing
              with 30 days&apos; notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Service Availability</h2>
            <p className="text-muted-foreground">
              We strive for high availability but do not guarantee uninterrupted
              service. We may perform maintenance that temporarily affects
              availability. We are not liable for downtime caused by third-party
              services you connect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              To the maximum extent permitted by law, LeadSens is not liable for
              any indirect, incidental, special, or consequential damages arising
              from your use of the Service. Our total liability is limited to the
              amount you paid for the Service in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">10. Termination</h2>
            <p className="text-muted-foreground">
              We may suspend or terminate your account if you violate these Terms.
              You may delete your account at any time. Upon termination, your data
              will be deleted according to our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">11. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We may update these Terms from time to time. We will notify you of
              material changes via email or an in-app notice. Continued use of the
              Service after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">12. Governing Law</h2>
            <p className="text-muted-foreground">
              These Terms are governed by the laws of France. Any disputes will be
              resolved in the courts of Paris, France.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">13. Contact</h2>
            <p className="text-muted-foreground">
              For questions about these Terms, contact us at{" "}
              <a
                href="mailto:legal@leadsens.com"
                className="text-primary underline underline-offset-4"
              >
                legal@leadsens.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
