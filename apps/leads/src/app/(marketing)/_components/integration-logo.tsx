interface IntegrationLogoProps {
  name: string;
  logo: string | null;
  size?: number;
  className?: string;
}

const INITIAL_COLORS: Record<string, string> = {
  L: "#0d9488",
  J: "#ea580c",
  M: "#7c3aed",
  Z: "#2563eb",
};

export function IntegrationLogo({
  name,
  logo,
  size = 32,
  className = "",
}: IntegrationLogoProps) {
  if (logo) {
    return (
      <img
        src={logo}
        alt={name}
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
      />
    );
  }

  const initial = name[0].toUpperCase();
  const bgColor = INITIAL_COLORS[initial] ?? "#6b7280";

  return (
    <div
      className={`shrink-0 rounded-lg flex items-center justify-center text-white font-semibold ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: bgColor,
        fontSize: size * 0.4,
      }}
    >
      {initial}
    </div>
  );
}
