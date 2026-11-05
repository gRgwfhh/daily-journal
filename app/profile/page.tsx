import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ProfileSettings from "@/app/profile-settings";

export default function ProfilePage() {
  return (
    <Suspense fallback={<main className="auth-page">Loading your profile...</main>}>
      <AuthenticatedProfile />
    </Suspense>
  );
}

async function AuthenticatedProfile() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return <ProfileSettings username={user.username} />;
}
