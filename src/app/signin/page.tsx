import { signIn } from "@/server/auth";

export default function SignInPage() {
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
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/app" });
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
