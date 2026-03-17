"use client";

interface GreetingLoaderProps {
  logoSrc: string;
  logoAlt: string;
}

export function GreetingLoader({ logoSrc, logoAlt }: GreetingLoaderProps) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="text-center space-y-4">
        {/* Logo */}
        <div className="flex justify-center motion-safe:animate-[fade-in-up_0.3s_ease-out]">
          <div className="size-10 rounded-xl overflow-hidden bg-white shadow-sm">
            <img src={logoSrc} alt={logoAlt} className="size-10 block" />
          </div>
        </div>
        {/* Typing dots */}
        <div className="flex items-center justify-center gap-1 motion-safe:animate-[fade-in-up_0.4s_ease-out_200ms_both]">
          <span className="size-2 rounded-full bg-muted-foreground/40 typing-dot" />
          <span className="size-2 rounded-full bg-muted-foreground/40 typing-dot [animation-delay:150ms]" />
          <span className="size-2 rounded-full bg-muted-foreground/40 typing-dot [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
