import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
  accounts,
  workspaceMembers,
} from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { sanitizeLocalRedirectPath, getRequestBaseUrl } from "@/lib/security";
import { enqueueChannelSync } from "@/server/youtube/run-channel-sync";

/**
 * Handles the OAuth callback after the user grants youtube.force-ssl scope.
 * Exchanges the authorization code for tokens, updates the account record,
 * and automatically triggers a channel sync if a workspace context is available.
 */
export async function GET(req: NextRequest) {
  const baseUrl = getRequestBaseUrl(req);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/signin", baseUrl));
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get("youtube-oauth-state")?.value;
  const redirectPath = sanitizeLocalRedirectPath(
    cookieStore.get("youtube-oauth-redirect")?.value,
    "/app"
  );
  const workspaceId =
    cookieStore.get("youtube-oauth-workspace")?.value || null;

  // Clean up cookies
  cookieStore.delete("youtube-oauth-state");
  cookieStore.delete("youtube-oauth-redirect");
  cookieStore.delete("youtube-oauth-workspace");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    console.error("[youtube-callback] OAuth error:", error);
    const url = new URL(redirectPath, baseUrl);
    url.searchParams.set("youtube_error", error);
    return NextResponse.redirect(url);
  }

  if (!code || !state || state !== storedState) {
    console.error("[youtube-callback] Invalid state or missing code");
    const url = new URL(redirectPath, baseUrl);
    url.searchParams.set("youtube_error", "invalid_state");
    return NextResponse.redirect(url);
  }

  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Google OAuth not configured" },
      { status: 500 }
    );
  }

  const callbackUrl = `${baseUrl}/api/auth/youtube-callback`;
  const redirectUrl = new URL(redirectPath, baseUrl);

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[youtube-callback] Token exchange failed:", errText);
      const url = new URL(redirectPath, baseUrl);
      url.searchParams.set("youtube_error", "token_exchange_failed");
      return NextResponse.redirect(url);
    }

    const tokenData = await tokenRes.json();
    const now = Math.floor(Date.now() / 1000);

    // Update the existing Google account record with new tokens and scopes
    await db
      .update(accounts)
      .set({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? undefined,
        expires_at: now + (tokenData.expires_in || 3600),
        scope: tokenData.scope,
        id_token: tokenData.id_token ?? undefined,
        token_type: tokenData.token_type,
      })
      .where(
        and(
          eq(accounts.userId, session.user.id),
          eq(accounts.provider, "google")
        )
      );

    console.log(
      `[youtube-callback] Updated tokens with YouTube scope for user ${session.user.id}`
    );

    // Auto-trigger channel sync if workspace context is available
    if (workspaceId) {
      try {
        const [membership] = await db
          .select({ id: workspaceMembers.id })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspaceId),
              eq(workspaceMembers.userId, session.user.id)
            )
          )
          .limit(1);

        if (!membership) {
          const url = new URL(redirectPath, baseUrl);
          url.searchParams.set("youtube_error", "workspace_access_denied");
          return NextResponse.redirect(url);
        }

        const result = await enqueueChannelSync({
          workspaceId,
          userId: session.user.id,
          inputJson: { autoTriggered: true },
        });

        // Surface the import banner on the destination page
        redirectUrl.searchParams.set("syncRunId", result.runId);

        console.log(
          `[youtube-callback] Enqueued channel sync for workspace ${workspaceId}, run ${result.runId}`
        );
      } catch (syncErr) {
        redirectUrl.searchParams.set("youtube_error", "channel_sync_failed");

        // Don't fail the whole callback if the sync can't be enqueued
        console.error(
          "[youtube-callback] Failed to enqueue channel sync:",
          syncErr
        );
      }
    }

    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error("[youtube-callback] Error:", err);
    const url = new URL(redirectPath, baseUrl);
    url.searchParams.set("youtube_error", "unexpected_error");
    return NextResponse.redirect(url);
  }
}
