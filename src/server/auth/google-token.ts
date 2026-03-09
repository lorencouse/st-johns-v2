import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

const REFRESH_BUFFER_SEC = 300;

export async function getGoogleAccessToken(
  userId: string
): Promise<string | null> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "google")))
    .limit(1);

  if (!account?.access_token) return null;

  if (!account.scope?.includes("youtube.readonly")) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (account.expires_at && account.expires_at > now + REFRESH_BUFFER_SEC) {
    return account.access_token;
  }

  if (!account.refresh_token) return null;

  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: account.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      console.error(
        `[google-token] Refresh failed (${res.status}):`,
        await res.text()
      );
      return null;
    }

    const data = await res.json();
    const newAccessToken: string = data.access_token;
    const expiresIn: number = data.expires_in;

    await db
      .update(accounts)
      .set({
        access_token: newAccessToken,
        expires_at: now + expiresIn,
      })
      .where(
        and(eq(accounts.userId, userId), eq(accounts.provider, "google"))
      );

    console.log(`[google-token] Refreshed token for user ${userId}`);
    return newAccessToken;
  } catch (err) {
    console.error("[google-token] Refresh error:", err);
    return null;
  }
}
