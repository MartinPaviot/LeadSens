import Link from "next/link";

interface GradientCtaProps {
  href: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function GradientCta({
  href,
  children,
  size = "md",
  className = "",
}: GradientCtaProps) {
  const sizeClasses = {
    sm: "h-9 px-5 text-sm",
    md: "h-11 px-7 text-sm",
    lg: "h-13 px-9 text-base",
  };

  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-full font-medium text-white transition-all hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98] bg-gradient-to-r from-[#17C3B2] via-[#2C6BED] to-[#FF7A3D] ${sizeClasses[size]} ${className}`}
    >
      {children}
    </Link>
  );
}
