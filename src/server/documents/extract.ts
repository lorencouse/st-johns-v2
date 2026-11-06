import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import { getOpenAIClient, MODEL } from "@/server/ai/openai";
import type { DocumentFormat } from "@/lib/documents";

/** Enough for a long sermon and a full bulletin, without bloating the row. */
const MAX_TEXT_CHARS = 200_000;

function tidy(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

function textEncoding(head: Uint8Array): string {
  if (head[0] === 0xff && head[1] === 0xfe) return "utf-16le";
  if (head[0] === 0xfe && head[1] === 0xff) return "utf-16be";
  return "utf-8";
}

async function readPhoto(bytes: ArrayBuffer, contentType: string): Promise<string> {
  const base64 = Buffer.from(bytes).toString("base64");
  const response = await getOpenAIClient().chat.completions.create({
    model: MODEL,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "This is a photo of a church document, such as a printed service " +
              "bulletin or sermon notes. Write out all of its text exactly as it " +
              "appears, in reading order, keeping line breaks between sections. " +
              "Do not summarise, correct or add anything. If there is no readable " +
              "text, reply with nothing.",
          },
          {
            type: "image_url",
            image_url: { url: `data:${contentType};base64,${base64}` },
          },
        ],
      },
    ],
  });
  return response.choices[0]?.message?.content ?? "";
}

/**
 * Reads the words out of an uploaded file. PDF, Word and text files are read
 * directly; photos go to the AI model, which costs a little per image.
 * Returns null when nothing readable came out.
 */
export async function extractDocumentText(
  bytes: ArrayBuffer,
  format: DocumentFormat,
  contentType: string
): Promise<string | null> {
  let text = "";
  switch (format) {
    case "pdf": {
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const result = await extractText(pdf, { mergePages: true });
      text = Array.isArray(result.text) ? result.text.join("\n\n") : result.text;
      break;
    }
    case "docx": {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      text = result.value;
      break;
    }
    case "text":
      text = new TextDecoder(textEncoding(new Uint8Array(bytes))).decode(bytes);
      break;
    case "image":
      text = await readPhoto(bytes, contentType);
      break;
  }
  const cleaned = tidy(text);
  return cleaned.length > 0 ? cleaned : null;
}
