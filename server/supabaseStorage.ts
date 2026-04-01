import type { Response as ExpressResponse } from "express";
import crypto from "node:crypto";

const DEFAULT_BUCKET = "app";
const DEFAULT_PRIVATE_PREFIX = "private";
const DEFAULT_PUBLIC_PREFIX = "public";
const UPLOAD_TOKEN_TTL_MS = 15 * 60 * 1000;

export interface StorageObjectRef {
  bucketName: string;
  objectName: string;
}

function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  if (!url) {
    throw new Error("SUPABASE_URL is not configured");
  }
  return url;
}

function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return key;
}

function getUploadTokenSecret(): string {
  return process.env.SESSION_SECRET || getSupabaseServiceRoleKey();
}

export function getDefaultStorageBucket(): string {
  return (
    process.env.SUPABASE_STORAGE_BUCKET ||
    process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ||
    DEFAULT_BUCKET
  );
}

export function getPrivateStoragePrefix(): string {
  return process.env.SUPABASE_PRIVATE_STORAGE_PREFIX || DEFAULT_PRIVATE_PREFIX;
}

export function getPublicStoragePrefix(): string {
  return process.env.SUPABASE_PUBLIC_STORAGE_PREFIX || DEFAULT_PUBLIC_PREFIX;
}

export function getDefaultPrivateObjectDir(): string {
  return `/${getDefaultStorageBucket()}/${getPrivateStoragePrefix()}`;
}

export function getDefaultPublicSearchPaths(): string[] {
  return [`/${getDefaultStorageBucket()}/${getPublicStoragePrefix()}`];
}

export function parseStoragePath(path: string): StorageObjectRef {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("Invalid storage path");
  }

  return {
    bucketName: parts[0],
    objectName: parts.slice(1).join("/"),
  };
}

export function formatStoragePath(ref: StorageObjectRef): string {
  return `/${ref.bucketName}/${ref.objectName}`;
}

export function buildPrivateStorageObjectPath(relativePath: string): string {
  const cleaned = relativePath.replace(/^\/+/, "");
  return `${getDefaultPrivateObjectDir()}/${cleaned}`;
}

async function supabaseStorageFetch(
  path: string,
  init: RequestInit = {},
): Promise<globalThis.Response> {
  const response = await fetch(`${getSupabaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getSupabaseServiceRoleKey()}`,
      apikey: getSupabaseServiceRoleKey(),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Supabase Storage request failed (${response.status}): ${text || response.statusText}`);
  }

  return response;
}

export async function uploadStorageObject(
  objectPath: string,
  body: Buffer | Uint8Array | ArrayBuffer | string,
  contentType = "application/octet-stream",
  upsert = false,
): Promise<void> {
  const ref = parseStoragePath(objectPath);
  await supabaseStorageFetch(`/storage/v1/object/${ref.bucketName}/${ref.objectName}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "x-upsert": String(upsert),
    },
    body: body as BodyInit,
  });
}

export async function deleteStorageObject(objectPath: string): Promise<void> {
  const ref = parseStoragePath(objectPath);
  await supabaseStorageFetch(`/storage/v1/object/${ref.bucketName}/${ref.objectName}`, {
    method: "DELETE",
  });
}

export async function getStorageObject(
  objectPath: string,
): Promise<{ buffer: Buffer; contentType: string | null; contentLength: string | null }> {
  const ref = parseStoragePath(objectPath);
  const response = await supabaseStorageFetch(
    `/storage/v1/object/authenticated/${ref.bucketName}/${ref.objectName}`,
    { method: "GET" },
  );
  const arrayBuffer = await response.arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get("content-type"),
    contentLength: response.headers.get("content-length"),
  };
}

export async function storageObjectExists(objectPath: string): Promise<boolean> {
  try {
    await getStorageObject(objectPath);
    return true;
  } catch {
    return false;
  }
}

export async function streamStorageObjectToResponse(
  objectPath: string,
  res: ExpressResponse,
  cacheControl = "private, max-age=3600",
): Promise<void> {
  const { buffer, contentType, contentLength } = await getStorageObject(objectPath);
  res.set({
    "Content-Type": contentType || "application/octet-stream",
    "Content-Length": contentLength || String(buffer.length),
    "Cache-Control": cacheControl,
  });
  res.send(buffer);
}

interface UploadTokenPayload {
  objectPath: string;
  expiresAt: number;
}

function signPayload(payload: string): string {
  return crypto
    .createHmac("sha256", getUploadTokenSecret())
    .update(payload)
    .digest("hex");
}

export function createSignedUploadToken(objectPath: string): string {
  const payload: UploadTokenPayload = {
    objectPath,
    expiresAt: Date.now() + UPLOAD_TOKEN_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySignedUploadToken(token: string): UploadTokenPayload {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Invalid upload token");
  }

  const expected = signPayload(encodedPayload);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("Invalid upload token signature");
  }

  const payload = JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8"),
  ) as UploadTokenPayload;

  if (!payload.objectPath || !payload.expiresAt || payload.expiresAt < Date.now()) {
    throw new Error("Upload token expired");
  }

  return payload;
}

export function buildSignedUploadUrl(objectPath: string): string {
  const token = createSignedUploadToken(objectPath);
  return `/api/uploads/direct?token=${encodeURIComponent(token)}`;
}

const ACL_PREFIX = ".acl";

function getAclPath(objectPath: string): string {
  const ref = parseStoragePath(objectPath);
  return formatStoragePath({
    bucketName: ref.bucketName,
    objectName: `${ACL_PREFIX}/${ref.objectName}.json`,
  });
}

export async function writeObjectAclPolicy(objectPath: string, aclPolicy: unknown): Promise<void> {
  await uploadStorageObject(
    getAclPath(objectPath),
    Buffer.from(JSON.stringify(aclPolicy), "utf8"),
    "application/json",
    true,
  );
}

export async function readObjectAclPolicy<T>(objectPath: string): Promise<T | null> {
  try {
    const { buffer } = await getStorageObject(getAclPath(objectPath));
    return JSON.parse(buffer.toString("utf8")) as T;
  } catch {
    return null;
  }
}
