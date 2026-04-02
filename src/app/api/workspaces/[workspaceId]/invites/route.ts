import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceMember } from "@/lib/api-helpers";
import { normalizeEmail } from "@/lib/security";
import { db } from "@/server/db";
import { workspaceInvites } from "@/server/db/schema";
import { randomBytes, createHash } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  if (!["owner", "admin"].includes(ctx.role)) {
    return NextResponse.json(
      { error: "Only owners and admins can invite members" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const email =
    typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const { role } = body;

  if (!email || !role) {
    return NextResponse.json(
      { error: "Email and role are required" },
      { status: 400 }
    );
  }

  if (!["admin", "editor", "reviewer", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const [invite] = await db
    .insert(workspaceInvites)
    .values({
      workspaceId,
      email,
      role,
      tokenHash,
      invitedByUserId: ctx.userId,
      expiresAt,
    })
    .returning();

  return NextResponse.json({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    token,
    inviteUrl: new URL(`/invite/${token}`, req.url).toString(),
    expiresAt: invite.expiresAt.toISOString(),
  });
}
