import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

/**
 * Server-side guard — redirects to /login if not authenticated.
 * Use in server components / page.tsx files.
 */
export async function requireAuth() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/login");
  }
  return session;
}

/**
 * Server-side guard — redirects to / if already authenticated.
 * Use on login/signup pages.
 */
export async function requireUnauth() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (session) {
    redirect("/");
  }
}
