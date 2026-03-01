"use client";

export function GreetingLoader() {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="text-center space-y-4">
        {/* Avatar */}
        <div className="relative mx-auto w-fit motion-safe:animate-[fade-in-up_0.5s_ease-out]">
          <div className="size-16 rounded-2xl overflow-hidden">
            <img src="/L.svg" alt="LeadSens" className="size-16" />
          </div>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 blur-xl opacity-25 -z-10 scale-150" />
        </div>

        {/* Agent name */}
        <p className="text-sm font-medium text-muted-foreground motion-safe:animate-[fade-in-up_0.5s_ease-out_100ms_both]">
          LeadSens
        </p>

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
