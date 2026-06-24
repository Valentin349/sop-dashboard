import { redirect } from "next/navigation";

import { getCurrentUser, hasAccess } from "@/lib/auth/session";
import { LoginForm, NoAccessCard } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user && hasAccess(user.role)) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      {user ? <NoAccessCard email={user.email ?? "This account"} /> : <LoginForm />}
    </main>
  );
}
