import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceRole } from "@/lib/api-helpers";
import { checkWords, type WordCheckParagraph } from "@/server/ai/word-check";
import { loadReferenceText } from "@/server/documents/reference";
import { findWorkspaceVideo } from "@/server/services/queries";

type Params = { params: Promise<{ workspaceId: string; videoId: string }> };

const MAX_PARAGRAPHS = 3000;
const MAX_TOTAL_CHARS = 400_000;

/**
 * Compares the transcript as it stands on the page (edits included) with the
 * service's sermon and bulletin. Read-only: it suggests, the person decides.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { workspaceId, videoId } = await params;
  const ctx = await requireApiWorkspaceRole(workspaceId, "edit", "You need editing access to check the words.");
  if ("error" in ctx) return ctx.error;

  if (!(await findWorkspaceVideo(workspaceId, videoId))) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const raw: unknown = body?.paragraphs;
  if (!Array.isArray(raw) || raw.length > MAX_PARAGRAPHS) {
    return NextResponse.json({ error: "Send the transcript paragraphs." }, { status: 400 });
  }
  const paragraphs: WordCheckParagraph[] = [];
  let total = 0;
  for (const p of raw) {
    if (!p || typeof p.id !== "string" || typeof p.text !== "string") {
      return NextResponse.json({ error: "Send the transcript paragraphs." }, { status: 400 });
    }
    total += p.text.length;
    paragraphs.push({ id: p.id.slice(0, 64), text: p.text });
  }
  if (total > MAX_TOTAL_CHARS) {
    return NextResponse.json({ error: "This transcript is too long to check." }, { status: 400 });
  }

  const reference = await loadReferenceText(workspaceId, videoId);
  if (!reference.text) {
    return NextResponse.json({ suggestions: [], documentCount: 0 });
  }

  try {
    const suggestions = await checkWords(paragraphs, reference.text);
    return NextResponse.json({ suggestions, documentCount: reference.documentCount });
  } catch (err) {
    console.error("[word-check] failed", err);
    return NextResponse.json(
      { error: "We couldn't compare the words with your documents. Try again." },
      { status: 502 }
    );
  }
}
