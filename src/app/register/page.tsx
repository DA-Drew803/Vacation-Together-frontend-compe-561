"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getCurrentUser, register } from "@/lib/api/auth";
import { getAccessToken } from "@/lib/auth/session";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountName, setAccountName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("vacation-together-theme");
    document.documentElement.dataset.theme = savedTheme === "light" ? "light" : "dark";

    if (getAccessToken()) {
      void getCurrentUser()
        .then((user) => setAccountName(user.display_name))
        .catch(() => setAccountName(null));
    }
  }, []);

  function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("vacation-together-theme", nextTheme);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await register(displayName, email, password);
      setAccountName(user.display_name);
      router.push("/plan");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to create your account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page register-page">
      <header className="login-header">
        <Link href="/" className="login-brand">VACATION TOGETHER</Link>
        <nav className="login-nav" aria-label="Main navigation">
          <Link href="/plan">DESTINATIONS</Link>
          <Link href="/plan">PLAN A TRIP</Link>
          <Link href="/plan">MY TRIP</Link>
          <button className="login-theme-button" type="button" onClick={toggleTheme} aria-label="Toggle color theme">
            <svg className="login-theme-icon login-theme-icon--moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M20.2 15.7A8.5 8.5 0 0 1 8.3 3.8 8.5 8.5 0 1 0 20.2 15.7Z" /></svg>
            <svg className="login-theme-icon login-theme-icon--sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2.2M12 19.8V22M4.93 4.93l1.56 1.56m11.02 11.02 1.56 1.56M2 12h2.2m15.6 0H22M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56" /></svg>
          </button>
          {accountName ? <span className="login-account">{accountName}</span> : <Link className="login-account" href="/login">LOG IN</Link>}
        </nav>
      </header>

      <section className="login-content" aria-labelledby="register-heading">
        <p className="login-eyebrow">ACCOUNT</p>
        <h1 id="register-heading">Create account.</h1>
        <p className="login-description">Start planning better trips with your group.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>YOUR NAME</span>
            <input className="login-input" type="text" autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={120} />
          </label>
          <label>
            <span>EMAIL</span>
            <input className="login-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            <span>PASSWORD</span>
            <input className="login-input" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
          </label>
          <label>
            <span>CONFIRM PASSWORD</span>
            <input className="login-input" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} />
          </label>

          {error && <p role="alert" className="login-error">{error}</p>}

          <button className="login-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "CREATING ACCOUNT…" : "CREATE ACCOUNT"}
          </button>
        </form>

        <p className="login-register">Already have an account? <Link href="/login">Sign in</Link></p>
      </section>
    </main>
  );
}
