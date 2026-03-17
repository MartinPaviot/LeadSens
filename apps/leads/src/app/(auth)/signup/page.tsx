"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp, signIn } from "@/lib/auth-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { GoogleLogo } from "@/components/icons/google-logo";

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsPending(true);

    await signUp.email(
      {
        name: firstName,
        email,
        password,
        callbackURL: "/chat",
      },
      {
        onSuccess: () => router.push("/chat"),
        onError: (ctx) => {
          toast.error(ctx.error.message ?? "Sign up failed");
          setIsPending(false);
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Get Started</CardTitle>
        <CardDescription>
          Free to start — no credit card required
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6">
          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              signIn.social({ provider: "google", callbackURL: "/chat" })
            }
          >
            <GoogleLogo className="size-5" />
            Continue with Google
          </Button>

          <div className="relative text-center text-sm text-muted-foreground">
            <span className="relative z-10 bg-card px-2">or</span>
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <label htmlFor="firstName" className="text-sm font-medium">
                First name
              </label>
              <Input
                id="firstName"
                type="text"
                placeholder="Martin"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeSlash size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Loading..." : "Get Started Free"}
            </Button>
            <div className="text-center text-sm">
              Already have an account?{" "}
              <Link
                href="/login"
                className="underline underline-offset-4 hover:text-primary"
              >
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
