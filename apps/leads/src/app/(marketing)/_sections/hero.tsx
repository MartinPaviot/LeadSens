"use client";

import Link from "next/link";
import { GradientCta } from "../_components/gradient-cta";
import { ChatMockup } from "../_components/chat-mockup";
import { CHAT_REPLAY_STEPS } from "../_data/chat-replay-steps";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Mesh background */}
      <div className="absolute inset-0 bg-leadsens-mesh opacity-60" />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-20 md:pb-28 md:pt-28">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div
              className="hero-stagger mb-6 inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/60 backdrop-blur-sm px-4 py-1.5 text-sm text-muted-foreground"
              style={{ animationDelay: "0ms" }}
            >
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              AI-Powered Outbound Agent
            </div>

            <h1
              className="hero-stagger mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
              style={{ animationDelay: "120ms" }}
            >
              Your outbound
              <br />
              <span className="gradient-text">on autopilot</span>
            </h1>

            <p
              className="hero-stagger mb-8 max-w-lg text-lg text-muted-foreground lg:text-xl mx-auto lg:mx-0"
              style={{ animationDelay: "240ms" }}
            >
              Describe your ideal customer. LeadSens sources, scores, enriches,
              and sends personalized sequences &mdash; using your own tools.
            </p>

            <div
              className="hero-stagger flex flex-col items-center gap-4 sm:flex-row lg:justify-start sm:justify-center"
              style={{ animationDelay: "360ms" }}
            >
              <GradientCta href="/signup" size="lg" className="btn-shine">
                Start for free
              </GradientCta>
              <Link
                href="#how-it-works"
                className="inline-flex h-13 items-center rounded-full border border-border/60 bg-background/60 backdrop-blur-sm px-7 text-base font-medium transition-all hover:bg-muted/80"
              >
                See how it works
              </Link>
            </div>

            {/* Trust micro-line */}
            <p
              className="hero-stagger mt-6 text-xs text-muted-foreground/70 text-center lg:text-left"
              style={{ animationDelay: "480ms" }}
            >
              No credit card required · Free plan available
            </p>
          </div>

          {/* Right: Chat mockup */}
          <div
            className="hero-stagger relative"
            style={{ animationDelay: "300ms" }}
          >
            {/* Glow behind mockup */}
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#17C3B2]/20 via-[#2C6BED]/15 to-[#FF7A3D]/20 blur-2xl" />
            <div className="relative">
              <ChatMockup
                steps={CHAT_REPLAY_STEPS}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
