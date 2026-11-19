import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Dashboard from "@/app/dashboard-client";

export default function Home() {
  return (
    <Suspense fallback={<main className="auth-page">Loading your journal...</main>}>
      <AuthenticatedDashboard />
    </Suspense>
  );
}

async function AuthenticatedDashboard() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return <Dashboard username={user.username} avatarUrl={user.avatarUrl} />;
}
