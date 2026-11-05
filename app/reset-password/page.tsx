import { Suspense } from "react";
import PasswordRecoveryForm from "@/app/password-recovery-form";

type Props = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default function ResetPasswordPage(props: Props) {
  return (
    <Suspense fallback={<main className="auth-page">Loading password reset...</main>}>
      <ResetPasswordContent {...props} />
    </Suspense>
  );
}

async function ResetPasswordContent({ searchParams }: Props) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return <PasswordRecoveryForm mode="reset" token={token} />;
}
