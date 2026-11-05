"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = { mode: "login" | "register" };

export default function AuthForm({ mode }: Props) {
  const router = useRouter();
  const isRegistration = mode === "register";
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => {
        if (active && response.ok) {
          router.replace("/");
        }
      })
      .catch(() => {
        if (active) {
          setError("Could not check your sign-in status. Please try again.");
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      username: form.get("username"),
      ...(isRegistration ? { email: form.get("email") } : {}),
      password: form.get("password"),
    };
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "The request could not be completed.";
        throw new Error(message);
      }
      router.push("/");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The request could not be completed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="authTitle">
        <p className="dashboard-eyebrow">DAILY JOURNAL</p>
        <h1 id="authTitle">{isRegistration ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-description">
          {isRegistration
            ? "Create a private journal for your hobbies, memorable moments, and sleep."
            : "Sign in to continue to your personal journal."}
        </p>
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            minLength={3}
            maxLength={32}
            pattern="[A-Za-z0-9_-]{3,32}"
            title="Use 3-32 letters, numbers, underscores, or hyphens."
            required
          />
          {isRegistration && (
            <>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
              />
            </>
          )}
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isRegistration ? "new-password" : "current-password"}
            minLength={8}
            maxLength={128}
            required
          />
          {isRegistration && (
            <p className="auth-hint">
              Your email can be used to recover your password.
            </p>
          )}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Please wait..."
              : isRegistration
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
        <p className="auth-switch">
          {isRegistration ? "Already have an account?" : "New here?"}{" "}
          <Link href={isRegistration ? "/login" : "/register"}>
            {isRegistration ? "Sign in" : "Create an account"}
          </Link>
        </p>
        {!isRegistration && (
          <p className="auth-switch">
            <Link href="/forgot-password">Forgot your password?</Link>
          </p>
        )}
      </section>
    </main>
  );
}
