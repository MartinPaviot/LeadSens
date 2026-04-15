import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: "https://9a2f7fd446bc056dc55ceffc06f0343f@o4511225718439936.ingest.de.sentry.io/4511225725190224",
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  debug: false,
  enabled: process.env.NODE_ENV === "production",
})
