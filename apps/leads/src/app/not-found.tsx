import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found.</p>
      <Link
        href="/"
        className="text-sm font-medium text-primary underline underline-offset-4 hover:no-underline"
      >
        Go home
      </Link>
    </div>
  );
}
