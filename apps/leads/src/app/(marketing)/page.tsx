import { Hero } from "./_sections/hero";
import { SocialProofBar } from "./_sections/social-proof-bar";
import { ProblemSolution } from "./_sections/problem-solution";
import { HowItWorks } from "./_sections/how-it-works";
import { FeaturesBento } from "./_sections/features-bento";
import { PricingTeaser } from "./_sections/pricing-teaser";
import { CtaFinal } from "./_sections/cta-final";

/** ISR: Re-render every hour, serve from CDN between revalidations */
export const revalidate = 3600;

export default function LandingPage() {
  return (
    <>
      <Hero />
      <SocialProofBar />
      <ProblemSolution />
      <HowItWorks />
      <FeaturesBento />
      <PricingTeaser />
      <CtaFinal />
    </>
  );
}
