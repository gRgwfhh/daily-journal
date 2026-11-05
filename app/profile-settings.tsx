"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Profile = {
  username: string;
  email: string;
  avatarUrl: string | null;
};

function isProfile(value: unknown): value is Profile {
  return (
    typeof value === "object" &&
    value !== null &&
    "username" in value &&
    typeof value.username === "string" &&
    "email" in value &&
    typeof value.email === "string" &&
    "avatarUrl" in value &&
    (typeof value.avatarUrl === "string" || value.avatarUrl === null)
  );
}

async function getError(response: Response) {
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error(`The server returned an invalid response (HTTP ${response.status}).`);
  }
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
  return result;
}

export default function ProfileSettings({ username }: { username: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/profile", { cache: "no-store" })
      .then(async (response) => {
        const result = await getError(response);
        if (!isProfile(result)) {
          throw new Error("The server returned invalid profile data.");
        }
        if (active) {
          setProfile(result);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setProfileError(error instanceof Error ? error.message : "Could not load your profile.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    setIsChangingPassword(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: form.get("currentPassword"),
          newPassword: form.get("newPassword"),
        }),
      });
      const result = await getError(response);
      if (
        typeof result !== "object" ||
        result === null ||
        !("message" in result) ||
        typeof result.message !== "string"
      ) {
        throw new Error("The server returned an invalid response.");
      }
      setPasswordMessage(result.message);
      window.setTimeout(() => router.replace("/login"), 1200);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Could not change your password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const uploadAvatar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError("");
    setProfileMessage("");
    setIsSavingAvatar(true);
    const formElement = event.currentTarget;
    try {
      const form = new FormData(formElement);
      const response = await fetch("/api/profile", { method: "PATCH", body: form });
      await getError(response);
      setProfile((current) =>
        current ? { ...current, avatarUrl: "/api/profile/avatar" } : current,
      );
      setProfileMessage("Profile picture updated.");
      formElement.reset();
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Could not update your picture.");
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    setProfileError("");
    setProfileMessage("");
    try {
      const response = await fetch("/api/profile", { method: "DELETE" });
      await getError(response);
      setProfile((current) => (current ? { ...current, avatarUrl: null } : current));
      setProfileMessage("Profile picture removed.");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Could not remove your picture.");
    }
  };

  return (
    <main className="profile-page">
      <div className="profile-layout">
        <header className="profile-heading">
          <div>
            <p className="dashboard-eyebrow">YOUR ACCOUNT</p>
            <h1>Profile settings</h1>
            <p>Manage your profile picture and password.</p>
          </div>
          <Link className="profile-back-link" href="/">Back to journal</Link>
        </header>

        <section className="profile-card card" aria-labelledby="profilePictureTitle">
          <h2 id="profilePictureTitle">Profile picture</h2>
          <p>Choose a PNG, JPEG, or WebP image up to 2 MB.</p>
          <div className="profile-avatar-preview">
            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt={`${username}'s profile`} />
            ) : (
              <span aria-label="No profile picture">{username.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <form className="auth-form" onSubmit={uploadAvatar}>
            <label htmlFor="avatar">Upload a new picture</label>
            <input
              id="avatar"
              name="avatar"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              required
            />
            <button type="submit" disabled={isSavingAvatar}>
              {isSavingAvatar ? "Uploading..." : "Save picture"}
            </button>
          </form>
          {profile?.avatarUrl && (
            <button className="profile-secondary-button" type="button" onClick={removeAvatar}>
              Remove picture
            </button>
          )}
          {profileError && <p className="auth-error" role="alert">{profileError}</p>}
          {profileMessage && <p className="profile-success" role="status">{profileMessage}</p>}
        </section>

        <section className="profile-card card" aria-labelledby="accountDetailsTitle">
          <h2 id="accountDetailsTitle">Account details</h2>
          {profile ? (
            <dl className="profile-details">
              <div><dt>Username</dt><dd>{profile.username}</dd></div>
              <div><dt>Email</dt><dd>{profile.email}</dd></div>
            </dl>
          ) : (
            <p>{profileError || "Loading your account details..."}</p>
          )}
        </section>

        <section className="profile-card card" aria-labelledby="changePasswordTitle">
          <h2 id="changePasswordTitle">Change password</h2>
          <p>You’ll need to sign in again after changing your password.</p>
          <form className="auth-form" onSubmit={changePassword}>
            <label htmlFor="currentPassword">Current password</label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              minLength={8}
              maxLength={128}
              required
            />
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
            {passwordError && <p className="auth-error" role="alert">{passwordError}</p>}
            {passwordMessage && <p className="profile-success" role="status">{passwordMessage}</p>}
            <button type="submit" disabled={isChangingPassword}>
              {isChangingPassword ? "Changing..." : "Change password"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
