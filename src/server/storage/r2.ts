import { AwsClient } from "aws4fetch";

/**
 * Cloudflare R2 storage for supporting documents, spoken to through its
 * S3-compatible API. The credentials are scoped to one bucket.
 */

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

function readConfig(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

/** True when document storage has been set up for this deployment. */
export function isStorageConfigured(): boolean {
  return readConfig() !== null;
}

let cached: { config: R2Config; client: AwsClient } | null = null;

function client() {
  const config = readConfig();
  if (!config) throw new Error("Document storage is not configured");
  if (!cached || cached.config.accessKeyId !== config.accessKeyId) {
    cached = {
      config,
      client: new AwsClient({
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        service: "s3",
        region: "auto",
      }),
    };
  }
  return cached;
}

function objectUrl(config: R2Config, key: string) {
  const path = key.split("/").map(encodeURIComponent).join("/");
  return `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${path}`;
}

export async function putObject(
  key: string,
  body: ArrayBuffer,
  contentType: string
): Promise<void> {
  const { config, client: aws } = client();
  const res = await aws.fetch(objectUrl(config, key), {
    method: "PUT",
    body,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) {
    throw new Error(`R2 upload failed with ${res.status}`);
  }
}

export async function deleteObject(key: string): Promise<void> {
  const { config, client: aws } = client();
  const res = await aws.fetch(objectUrl(config, key), { method: "DELETE" });
  // 404 means it is already gone, which is what we wanted.
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 delete failed with ${res.status}`);
  }
}

export async function getObject(key: string): Promise<Response> {
  const { config, client: aws } = client();
  return aws.fetch(objectUrl(config, key), { method: "GET" });
}
