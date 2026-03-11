export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = async (
  err: { digest: string } & Error,
  _request: {
    path: string;
    method: string;
    headers: { [key: string]: string };
  },
  _context: { routerKind: string; routePath: string; routeType: string; renderSource: string },
) => {
  // Only capture if Sentry is configured
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  const { captureException } = await import("@sentry/nextjs");
  captureException(err, {
    mechanism: { handled: false },
  });
};
