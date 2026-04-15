import { signIn } from "@/server/auth";
import { sanitizeLocalRedirectPath } from "@/lib/security";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string | string[];
    auth_error?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const callbackUrl = Array.isArray(params.callbackUrl)
    ? params.callbackUrl[0]
    : params.callbackUrl;
  const authError = Array.isArray(params.auth_error)
    ? params.auth_error[0]
    : params.auth_error;
  const redirectTo = sanitizeLocalRedirectPath(callbackUrl, "/app");

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with Google to get started. You can connect your
            YouTube channel later in Settings.
          </p>
        </div>
        {authError === "access_denied" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Google sign-in was canceled. You can try again whenever you&apos;re ready.
          </div>
        )}
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-accent"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}
