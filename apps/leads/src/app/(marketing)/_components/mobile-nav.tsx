"use client";

import Link from "next/link";
import { useState } from "react";

interface NavLink {
  label: string;
  href: string;
}

export function MobileNav({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="flex items-center justify-center size-10 rounded-lg md:hidden hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
      >
        {open ? (
          <svg
            className="size-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg
            className="size-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full border-t border-border/40 bg-background px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground py-1"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground py-1"
              onClick={() => setOpen(false)}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center justify-center rounded-full bg-gradient-to-r from-[#17C3B2] via-[#2C6BED] to-[#FF7A3D] text-sm font-medium text-white mt-2"
              onClick={() => setOpen(false)}
            >
              Get Started
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
