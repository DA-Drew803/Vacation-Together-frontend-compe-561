"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/Context/auth-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeAuthRedirect } from "@/lib/auth/redirect";

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(
      "vacation-together-theme",
    );

    if (savedTheme === "dark" || savedTheme === "light") {
      document.documentElement.dataset.theme = savedTheme;
    } else {
      document.documentElement.dataset.theme = "dark";
    }
  }, []);

  function toggleTheme() {
    const nextTheme =
      document.documentElement.dataset.theme === "dark"
        ? "light"
        : "dark";

    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(
      "vacation-together-theme",
      nextTheme,
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);

      const next = new URLSearchParams(
        window.location.search,
      ).get("next");

      router.push(safeAuthRedirect(next));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to sign in.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <header className="login-header">
        <Link href="/" className="login-brand">
          VACATION TOGETHER
        </Link>

        <nav
          className="login-nav"
          aria-label="Main navigation"
        >
          <Link href="/plan">DESTINATIONS</Link>
          <Link href="/trips">PLAN A TRIP</Link>
          <Link href="/my-trips">MY TRIP</Link>
          <Link href="/#about">ABOUT</Link>

          <button
            className="login-theme-button"
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
          >
            <svg
              className="login-theme-icon login-theme-icon--moon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <path d="M20.2 15.7A8.5 8.5 0 0 1 8.3 3.8 8.5 8.5 0 1 0 20.2 15.7Z" />
            </svg>

            <svg
              className="login-theme-icon login-theme-icon--sun"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3.5" />
              <path d="M12 2v2.2M12 19.8V22M4.93 4.93l1.56 1.56m11.02 11.02 1.56 1.56M2 12h2.2m15.6 0H22M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56" />
            </svg>
          </button>

          {user ? (
            <span
              className="login-account"
              aria-label={`Signed in as ${user.display_name}`}
            >
              {user.display_name}
            </span>
          ) : (
            <Link
              className="login-account"
              href="/login"
            >
              LOG IN
            </Link>
          )}
        </nav>
      </header>

      <section
        className="login-content"
        aria-labelledby="login-heading"
      >
        <p className="login-eyebrow">ACCOUNT</p>

        <h1 id="login-heading">Welcome back.</h1>

        <p className="login-description">
          Sign in to plan, vote, and approve trips with your
          group.
        </p>

        <Card className="login-card">
          <CardContent className="login-card-content">
        <form className="login-form" onSubmit={handleSubmit}>
          <Label>
            <span>EMAIL</span>

            <Input
              className="login-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              required
            />
          </Label>

          <Label>
            <span>PASSWORD</span>

            <Input
              className="login-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              required
            />
          </Label>

          {error && (
            <Alert role="alert" className="login-error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            className="login-submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "SIGNING IN…"
              : "SIGN IN"}
          </Button>
        </form>

        <p className="login-register">
          New here?{" "}
          <Link href="/register">
            Create an account
          </Link>
        </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
