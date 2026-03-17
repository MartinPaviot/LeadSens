"use client";

import { useScrollReveal } from "../_hooks/use-scroll-reveal";

interface SectionWrapperProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
  /** Delay stagger index for animation (multiplied by 100ms) */
  stagger?: number;
}

export function SectionWrapper({
  children,
  id,
  className = "",
  stagger = 0,
}: SectionWrapperProps) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section
      ref={ref}
      id={id}
      className={`${id ? "scroll-mt-20" : ""} ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${stagger * 100}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${stagger * 100}ms`,
      }}
    >
      {children}
    </section>
  );
}
