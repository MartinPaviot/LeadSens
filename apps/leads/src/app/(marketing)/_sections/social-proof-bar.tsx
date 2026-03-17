/**
 * T2-04: Social proof bar with better visibility.
 * Added "Trusted by teams using" label, increased opacity, hover pause.
 */
"use client";

import { LOGO_INTEGRATIONS } from "../_data/integrations";

export function SocialProofBar() {
  // Double the logos for seamless infinite scroll
  const logos = [...LOGO_INTEGRATIONS, ...LOGO_INTEGRATIONS];

  return (
    <section className="border-b border-border/40 py-8 overflow-hidden">
      <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground/60 mb-6">
        Orchestrates your favorite tools
      </p>
      <div className="relative group/scroll">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

        <div className="flex items-center gap-12 scroll-logos group-hover/scroll:[animation-play-state:paused]">
          {logos.map((integration, i) => (
            <img
              key={`${integration.name}-${i}`}
              src={integration.logo}
              alt={integration.name}
              className="h-8 w-auto opacity-50 grayscale transition-all hover:opacity-100 hover:grayscale-0 shrink-0"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
