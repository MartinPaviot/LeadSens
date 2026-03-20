# Auth.md — Elevay Authentication Specification

> **Last updated:** February 2026
> **Purpose:** Complete reference to reproduce the exact signup/signin flow, UI, and auth architecture.

---

## 1. Architecture Overview

### Stack

| Component | Implementation |
|-----------|---------------|
| **Auth library** | Better Auth (`better-auth`) |
| **Database adapter** | Prisma adapter for PostgreSQL |
| **OAuth providers** | GitHub, Google |
| **Email/password** | Built-in, with auto sign-in after signup |
| **Subscriptions** | Polar (`@polar-sh/better-auth`) — customer created on signup |
| **Forms** | React Hook Form + Zod validation |
| **UI** | shadcn/ui (Card, Form, Input, Button) |
| **Toasts** | sonner |
| **Session** | Cookie-based (`better-auth.session_token`) + DB-backed |

### Auth Flow Diagram

```
                      /login                              /signup
                        │                                    │
                   requireUnauth()                      (no guard)
                        │                                    │
                   ┌────┴────┐                         ┌─────┴─────┐
                   │LoginForm│                         │RegisterForm│
                   └────┬────┘                         └─────┬─────┘
                        │                                    │
        ┌───────────────┼───────────────┐    ┌───────────────┼───────────────┐
        │               │               │    │               │               │
   GitHub OAuth    Google OAuth   Email/Pass  GitHub OAuth  Google OAuth  Email/Pass
        │               │               │    │               │               │
        └───────────────┼───────────────┘    └───────────────┼───────────────┘
                        │                                    │
                        ▼                                    ▼
               authClient.signIn.*                  authClient.signUp.email()
                        │                                    │
                        ▼                                    ▼
               POST /api/auth/*              POST /api/auth/* + Polar customer
                        │                                    │
                        ▼                                    ▼
              Session created (DB + cookie)        Session created + auto sign-in
                        │                                    │
                        └──────────────┬─────────────────────┘
                                       ▼
                                 router.push("/")
                                       │
                                       ▼
                                  /agents (dashboard)
```

---

## 2. Auth Layout

**File:** `apps/web/src/features/auth/components/auth-layout.tsx`

Wraps both `/login` and `/signup` pages.

```tsx
<div className="bg-muted flex min-h-svh flex-col justify-center items-center gap-6 p-6 md:p-10">
  <div className="flex w-full max-w-sm flex-col gap-6">
    <Link href="/" className="flex items-center gap-2 self-center font-medium">
      <Image alt="Elevay" src="/logos/logo.svg" width={30} height={30} />
      Elevay
    </Link>
    {children}
  </div>
</div>
```

### Layout Properties

| Property | Value |
|----------|-------|
| Background | `bg-muted` |
| Min height | `min-h-svh` (full viewport) |
| Alignment | `flex-col justify-center items-center` (centered) |
| Padding | `p-6` mobile, `md:p-10` desktop |
| Content max width | `max-w-sm` (384px) |
| Gap | `gap-6` (24px) |
| Logo | `/logos/logo.svg`, 30x30px |
| Brand text | "Elevay", `font-medium`, self-centered |

### Visual Layout

```
+--------------------------------------------------+
|                    bg-muted                       |
|                                                   |
|              [logo 30x30] Elevay                  |
|                                                   |
|         +--- max-w-sm (384px) ---+                |
|         |                         |                |
|         |   +------ Card ------+  |                |
|         |   |  Welcome back    |  |                |
|         |   |  Login to cont.  |  |                |
|         |   |                  |  |                |
|         |   | [GitHub icon] Continue with GitHub   |
|         |   | [Google icon] Continue with Google    |
|         |   |                  |  |                |
|         |   |  Email           |  |                |
|         |   |  [m@example.com] |  |                |
|         |   |                  |  |                |
|         |   |  Password        |  |                |
|         |   |  [********]      |  |                |
|         |   |                  |  |                |
|         |   |  [    Login    ] |  |                |
|         |   |                  |  |                |
|         |   | Don't have an account? Sign up       |
|         |   +------------------+  |                |
|         |                         |                |
|         +-------------------------+                |
|                                                   |
+--------------------------------------------------+
```

---

## 3. Login Page

**Route:** `/login`
**Page:** `apps/web/src/app/(auth)/login/page.tsx`
**Component:** `apps/web/src/features/auth/components/login-form.tsx`

### Route Guard

```typescript
const Page = async () => {
  await requireUnauth(); // Redirects to "/" if already logged in
  return <LoginForm />;
};
```

### Validation Schema

```typescript
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
```

### Component Structure

```
div (flex flex-col gap-6)
└── Card
    ├── CardHeader (text-center)
    │   ├── CardTitle → "Welcome back"
    │   └── CardDescription → "Login to continue"
    ├── CardContent
    │   └── Form (react-hook-form)
    │       └── form
    │           └── div (grid gap-6)
    │               ├── div (flex flex-col gap-4) — OAuth buttons
    │               │   ├── Button (outline, w-full) → "Continue with GitHub"
    │               │   │   └── Image (github.svg, 20x20)
    │               │   └── Button (outline, w-full) → "Continue with Google"
    │               │       └── Image (google.svg, 20x20)
    │               ├── div (grid gap-6) — Email/password fields
    │               │   ├── FormField "email"
    │               │   │   ├── FormLabel → "Email"
    │               │   │   ├── Input (type="email", placeholder="m@example.com")
    │               │   │   └── FormMessage
    │               │   ├── FormField "password"
    │               │   │   ├── FormLabel → "Password"
    │               │   │   ├── Input (type="password", placeholder="********")
    │               │   │   └── FormMessage
    │               │   └── Button (submit, w-full) → "Login"
    │               └── div (text-center text-sm)
    │                   └── "Don't have an account? Sign up" (Link → /signup)
```

### OAuth Flow

```typescript
const signInGithub = async () => {
  await authClient.signIn.social(
    { provider: "github" },
    {
      onSuccess: () => router.push("/"),
      onError: () => toast.error("Something went wrong"),
    }
  );
};

const signInGoogle = async () => {
  await authClient.signIn.social(
    { provider: "google" },
    {
      onSuccess: () => router.push("/"),
      onError: () => toast.error("Something went wrong"),
    }
  );
};
```

### Email/Password Flow

```typescript
const onSubmit = async (values: LoginFormValues) => {
  await authClient.signIn.email(
    {
      email: values.email,
      password: values.password,
      callbackURL: "/",
    },
    {
      onSuccess: () => router.push("/"),
      onError: (ctx) => toast.error(ctx.error.message),
    }
  );
};
```

### UI Details

| Element | Style |
|---------|-------|
| OAuth buttons | `variant="outline" className="w-full"`, disabled when `isPending` |
| OAuth icons | `Image` from `next/image`, 20x20, from `/logos/github.svg` and `/logos/google.svg` |
| Submit button | default variant, `className="w-full"`, disabled when `isPending` |
| Switch link | `text-center text-sm`, Link with `underline underline-offset-4` |

---

## 4. Signup Page

**Route:** `/signup`
**Page:** `apps/web/src/app/(auth)/signup/page.tsx`
**Component:** `apps/web/src/features/auth/components/register-form.tsx`

### Route Guard

None — signup page has no `requireUnauth()` guard (unlike login).

### Validation Schema

```typescript
const registerSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});
```

### Component Structure

Same layout as LoginForm with these differences:

| | Login | Signup |
|---|-------|--------|
| **Title** | "Welcome back" | "Get Started" |
| **Description** | "Login to continue" | "Create your account to get started" |
| **Fields** | email, password | email, password, **confirmPassword** |
| **Submit label** | "Login" | "Sign up" |
| **Switch text** | "Don't have an account? Sign up" | "Already have an account? Login" |
| **Switch link** | `/signup` | `/login` |

### Signup Flow

```typescript
const onSubmit = async (values: RegisterFormValues) => {
  await authClient.signUp.email(
    {
      name: values.email,      // Uses email as display name
      email: values.email,
      password: values.password,
      callbackURL: "/",
    },
    {
      onSuccess: () => router.push("/"),
      onError: (ctx) => toast.error(ctx.error.message),
    }
  );
};
```

**Post-signup:** Better Auth auto-signs in (`autoSignIn: true`), Polar customer is created (`createCustomerOnSignUp: true`), user is redirected to `/`.

---

## 5. Server-Side Auth Configuration

**File:** `apps/web/src/lib/auth.ts`

```typescript
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { checkout, polar, portal } from "@polar-sh/better-auth";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    autoSignIn: true,    // Auto sign-in after signup
  },

  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },

  plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,   // Auto-create Polar customer
      use: [
        checkout({
          products: [{
            productId: "1e2fd6e9-2c86-4a45-b638-69274a2a5d76",
            slug: "Pro",
          }],
          successUrl: process.env.POLAR_SUCCESS_URL,
          authenticatedUsersOnly: true,
        }),
        portal(),
      ],
    }),
  ],
});
```

### Environment Variables Required

```
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
POLAR_ACCESS_TOKEN=
POLAR_SUCCESS_URL=
NEXT_PUBLIC_APP_URL=          # Used by auth client (default: http://localhost:3000)
```

---

## 6. Client-Side Auth

**File:** `apps/web/src/lib/auth-client.ts`

```typescript
import { polarClient } from "@polar-sh/better-auth/client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  plugins: [polarClient()],
});

export const { useSession } = authClient;
```

### Available Methods

| Method | Purpose |
|--------|---------|
| `authClient.signIn.email({ email, password, callbackURL })` | Email/password login |
| `authClient.signUp.email({ name, email, password, callbackURL })` | Email/password signup |
| `authClient.signIn.social({ provider })` | OAuth login (GitHub/Google) |
| `authClient.signOut({ fetchOptions })` | Sign out |
| `authClient.checkout({ slug })` | Polar subscription checkout |
| `useSession()` | React hook for session data |

### Session Data Shape

```typescript
const { data: session } = useSession();

// session.user:
{
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 7. API Routes

**File:** `apps/web/src/app/api/auth/[...all]/route.ts`

```typescript
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth);
```

All auth endpoints are handled automatically by Better Auth under `/api/auth/*`:
- `POST /api/auth/sign-in/email` — Email login
- `POST /api/auth/sign-up/email` — Email signup
- `GET /api/auth/sign-in/social` — OAuth redirect
- `GET /api/auth/callback/:provider` — OAuth callback
- `POST /api/auth/sign-out` — Sign out
- `GET /api/auth/session` — Get session

---

## 8. Route Guards

**File:** `apps/web/src/lib/auth-utils.ts`

### `requireAuth()`

Server-side guard — redirects to `/login` if not authenticated.

```typescript
export const requireAuth = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return session;
};
```

### `requireAuthWithWorkspace()`

Server-side guard — requires auth + resolves workspace context (RBAC).

```typescript
export const requireAuthWithWorkspace = async () => {
  const session = await requireAuth();
  const authorization = await resolveWorkspace(session.user.id, await headers());
  return { session, authorization };
};
```

### `requireUnauth()`

Server-side guard — redirects to `/` if already logged in. Used on login page.

```typescript
export const requireUnauth = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/");
};
```

---

## 9. Middleware (Security Layer)

**File:** `apps/web/src/middleware.ts`

Applied to all `/api/*` routes.

### Features

1. **Request ID** — `X-Request-Id` header on every response
2. **CSRF Protection** — Origin header validation on mutations (POST/PUT/PATCH/DELETE)
3. **Security Headers** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`
4. **Rate Limiting** — Per-route rate limits

### CSRF Exempt Paths

```
/api/webhooks/*
/api/auth/*
/api/integrations/*/callback
/api/sentry
/api/monitoring
/api/embed/*
/api/agents/embed/*
/api/unsubscribe/*
/api/agents/webhook/*
```

### Rate Limits

| Route | Type |
|-------|------|
| `/api/auth/*` | IP-based |
| `/api/agents/chat` | Session-based |
| `/api/agents/embed/chat` | IP-based (external) |
| `/api/agents/execute` | Session-based |
| `/api/credentials` | Session-based |

---

## 10. Prisma Auth Models

```prisma
model User {
  id            String    @id
  name          String
  email         String
  emailVerified Boolean   @default(false)
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @default(now()) @updatedAt

  sessions      Session[]
  accounts      Account[]
  workflows     Workflow[]
  credentials   Credential[]
  agents        Agent[]
  integrations  Integration[]
}

model Session {
  id        String   @id
  expiresAt DateTime
  token     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Account {
  id                    String    @id
  accountId             String    // Provider's user ID
  providerId            String    // "github", "google", "credential"
  userId                String
  user                  User      @relation(...)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?   // Hashed, for email/password accounts
  createdAt             DateTime
  updatedAt             DateTime
}

model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime
  updatedAt  DateTime
}
```

---

## 11. Workspace & RBAC

After authentication, the system resolves workspace context for multi-tenant RBAC.

### Workspace Resolution

1. Read `x-workspace-id` header or `elevay-workspace-id` cookie
2. Fallback: user's first workspace membership
3. Return `AuthorizationContext`:

```typescript
interface AuthorizationContext {
  userId: string;
  workspaceId: string;
  workspaceRole: "OWNER" | "ADMIN" | "MEMBER";
  teamMemberships: Array<{
    teamId: string;
    teamName: string;
    role: string;
  }>;
}
```

### API Route Protection

```typescript
export async function withAuthorization(
  req: NextRequest,
  handler: (ctx: AuthorizedContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authorization = await resolveWorkspace(session.user.id, req.headers);
  if (!authorization) {
    return NextResponse.json({ error: "No workspace found." }, { status: 403 });
  }

  return handler({ session: { user: session.user }, authorization, request: req });
}
```

---

## 12. Sign Out

```typescript
await authClient.signOut({
  fetchOptions: {
    onSuccess: () => router.push("/login"),
  },
});
```

Used in the app sidebar dropdown menu.

---

## 13. Subscription Integration (Polar)

- **Polar customer** created automatically on signup (`createCustomerOnSignUp: true`)
- **Checkout** triggered via `authClient.checkout({ slug: "Pro" })`
- **Product:** Pro tier (productId: `1e2fd6e9-2c86-4a45-b638-69274a2a5d76`)
- **Portal:** `portal()` plugin enables self-service subscription management
- **Environment:** sandbox mode during development

---

## 14. Dependencies

```json
{
  "better-auth": "^1.3.28",
  "@polar-sh/better-auth": "^1.1.9",
  "react-hook-form": "^7.65.0",
  "@hookform/resolvers": "^3.x",
  "zod": "^3.24.0",
  "sonner": "^2.0.7"
}
```

### shadcn/ui Components Used

- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`
- `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`
- `Input`
- `Button`

---

## 15. Key Source Files

| File | Role |
|------|------|
| `apps/web/src/lib/auth.ts` | Better Auth server config (providers, plugins) |
| `apps/web/src/lib/auth-client.ts` | Better Auth client + `useSession` hook |
| `apps/web/src/lib/auth-utils.ts` | Route guards (`requireAuth`, `requireUnauth`) |
| `apps/web/src/app/api/auth/[...all]/route.ts` | Catch-all auth API route |
| `apps/web/src/features/auth/components/auth-layout.tsx` | Centered auth page layout |
| `apps/web/src/features/auth/components/login-form.tsx` | Login form (email/pass + OAuth) |
| `apps/web/src/features/auth/components/register-form.tsx` | Signup form (email/pass/confirm + OAuth) |
| `apps/web/src/app/(auth)/login/page.tsx` | Login page (with `requireUnauth`) |
| `apps/web/src/app/(auth)/signup/page.tsx` | Signup page |
| `apps/web/src/app/(auth)/layout.tsx` | Auth route group layout |
| `apps/web/src/middleware.ts` | Security middleware (CSRF, rate limiting, headers) |
| `apps/web/src/lib/authorization/workspace-resolver.ts` | Workspace RBAC resolution |
| `apps/web/src/lib/authorization/with-authorization.ts` | API route auth wrapper |
| `prisma/schema.prisma` | User, Session, Account, Verification models |
