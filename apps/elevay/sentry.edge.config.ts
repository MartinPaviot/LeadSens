import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: "https://9a2f7fd446bc056dc55ceffc06f0343f@o4511225718439936.ingest.de.sentry.io/4511225725190224",
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
})
