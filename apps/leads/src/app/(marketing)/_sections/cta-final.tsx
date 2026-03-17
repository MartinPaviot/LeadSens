"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CtaFinal() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = email ? `?email=${encodeURIComponent(email)}` : "";
    router.push(`/signup${params}`);
  }

  return (
    <section className="relative overflow-hidden py-24 md:py-32 px-6">
      {/* Full-width mesh background */}
      <div className="absolute inset-0 bg-leadsens-mesh opacity-80" />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/30 to-background" />

      <div className="relative mx-auto max-w-3xl text-center">
        <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-5xl">
          Ready to automate
          <br />
          <span className="gradient-text">your outbound?</span>
        </h2>
        <p className="mb-8 text-lg text-muted-foreground">
          Better cold emails, sent faster, using the tools you already pay for.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row"
        >
          <input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-13 flex-1 rounded-full border border-border/60 bg-background/80 backdrop-blur-sm px-6 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            className="btn-shine inline-flex h-13 items-center justify-center rounded-full font-medium text-white transition-all hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98] bg-gradient-to-r from-[#17C3B2] via-[#2C6BED] to-[#FF7A3D] px-8 text-base"
          >
            Start for free
          </button>
        </form>

        <p className="mt-4 text-xs text-muted-foreground/60">
          No credit card required &middot; Free plan available
        </p>
      </div>
    </section>
  );
}
