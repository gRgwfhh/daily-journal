"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PasswordRecoveryForm({
  mode,
  token = "",
}: {
  mode: "request" | "reset";
  token?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const payload =
      mode === "request"
        ? { email: form.get("email") }
        : { token, password: form.get("password") };

    try {
      const response = await fetch(`/api/auth/${mode === "request" ? "forgot-password" : "reset-password"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let result: unknown;
      try {
        result = await response.json();
      } catch {
        throw new Error(`The server returned an invalid response (HTTP ${response.status}).`);
      }
      if (!response.ok) {
        const errorMessage =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "The request could not be completed.";
        throw new Error(errorMessage);
      }
      const successMessage =
        typeof result === "object" &&
        result !== null &&
        "message" in result &&
        typeof result.message === "string"
          ? result.message
          : "The request was completed.";
      setMessage(successMessage);
      if (mode === "reset") {
        window.setTimeout(() => router.replace("/login"), 1400);
      }
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
      <section className="auth-card" aria-labelledby="recoveryTitle">
        <p className="dashboard-eyebrow">DAILY JOURNAL</p>
        <h1 id="recoveryTitle">
          {mode === "request" ? "Reset your password" : "Choose a new password"}
        </h1>
        <p className="auth-description">
          {mode === "request"
            ? "Enter the email address on your account and we’ll send a reset link if it’s registered."
            : "Choose a new password for your account. This link expires after one hour."}
        </p>
        <form className="auth-form" onSubmit={submit}>
          {mode === "request" ? (
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
          ) : (
            <>
              <label htmlFor="password">New password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
            </>
          )}
          {error && <p className="auth-error" role="alert">{error}</p>}
          {message && <p className="profile-success" role="status">{message}</p>}
          <button type="submit" disabled={isSubmitting || (mode === "reset" && !token)}>
            {isSubmitting
              ? "Please wait..."
              : mode === "request"
                ? "Send reset link"
                : "Reset password"}
          </button>
          {mode === "reset" && !token && (
            <p className="auth-error" role="alert">This reset link is invalid or incomplete.</p>
          )}
        </form>
        <p className="auth-switch">
          <Link href="/login">Return to sign in</Link>
        </p>
      </section>
    </main>
  );
}
