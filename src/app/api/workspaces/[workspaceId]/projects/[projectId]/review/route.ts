import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceMember } from "@/lib/api-helpers";
import { db } from "@/server/db";
import {
  contentProjects,
  reviewRequests,
  reviewDecisions,
  auditEvents,
} from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

// POST: Request review or submit a decision
export async function POST(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ workspaceId: string; projectId: string }> }
) {
  const { workspaceId, projectId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  const body = await req.json();
  const { action } = body; // "request_review" | "approve" | "request_changes"

  const [project] = await db
    .select()
    .from(contentProjects)
    .where(
      and(
        eq(contentProjects.id, projectId),
        eq(contentProjects.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (action === "request_review") {
    if (!["owner", "admin", "editor"].includes(ctx.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    if (!project.activeDraftVersionId) {
      return NextResponse.json({ error: "No active draft" }, { status: 400 });
    }

    const [request] = await db
      .insert(reviewRequests)
      .values({
        workspaceId,
        contentProjectId: projectId,
        requestedVersionId: project.activeDraftVersionId,
        requestedByUserId: ctx.userId,
        assignedToUserId: body.assigneeId || null,
        status: "open",
      })
      .returning();

    await db
      .update(contentProjects)
      .set({
        status: "ready_for_review",
        currentReviewRequestId: request.id,
        updatedAt: new Date(),
      })
      .where(eq(contentProjects.id, projectId));

    await db.insert(auditEvents).values({
      workspaceId,
      actorUserId: ctx.userId,
      eventKey: "review.requested",
      entityType: "content_project",
      entityId: projectId,
      summary: `Requested review for "${project.title}"`,
    });

    return NextResponse.json(request, { status: 201 });
  }

  if (action === "approve" || action === "request_changes") {
    if (!["owner", "admin", "reviewer"].includes(ctx.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    if (!project.currentReviewRequestId) {
      return NextResponse.json({ error: "No open review request" }, { status: 400 });
    }

    const decision = action === "approve" ? "approved" : "changes_requested";

    const [reviewDecision] = await db
      .insert(reviewDecisions)
      .values({
        reviewRequestId: project.currentReviewRequestId,
        decision,
        decidedByUserId: ctx.userId,
        note: body.note || null,
      })
      .returning();

    await db
      .update(reviewRequests)
      .set({
        status: decision,
        decidedAt: new Date(),
      })
      .where(eq(reviewRequests.id, project.currentReviewRequestId));

    const newProjectStatus =
      decision === "approved" ? "approved" : "changes_requested";

    await db
      .update(contentProjects)
      .set({
        status: newProjectStatus,
        updatedAt: new Date(),
      })
      .where(eq(contentProjects.id, projectId));

    await db.insert(auditEvents).values({
      workspaceId,
      actorUserId: ctx.userId,
      eventKey: `review.${decision}`,
      entityType: "content_project",
      entityId: projectId,
      summary: `${decision === "approved" ? "Approved" : "Requested changes for"} "${project.title}"`,
    });

    return NextResponse.json(reviewDecision, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
