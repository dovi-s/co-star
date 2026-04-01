import { Response } from "express";
import { randomUUID } from "crypto";
import type { StorageObjectRef } from "../../supabaseStorage";
import {
  buildSignedUploadUrl,
  formatStoragePath,
  getDefaultPrivateObjectDir,
  getDefaultPublicSearchPaths,
  parseStoragePath,
  storageObjectExists,
  streamStorageObjectToResponse,
} from "../../supabaseStorage";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

export const objectStorageClient = {
  bucket(bucketName: string) {
    return {
      file(objectName: string): StorageObjectRef {
        return { bucketName, objectName };
      },
    };
  },
};

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const configured = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0),
      ),
    );

    return configured.length > 0 ? configured : getDefaultPublicSearchPaths();
  }

  getPrivateObjectDir(): string {
    return process.env.PRIVATE_OBJECT_DIR || getDefaultPrivateObjectDir();
  }

  async searchPublicObject(filePath: string): Promise<StorageObjectRef | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      if (await storageObjectExists(fullPath)) {
        return parseStoragePath(fullPath);
      }
    }

    return null;
  }

  async downloadObject(
    file: StorageObjectRef,
    res: Response,
    cacheTtlSec = 3600,
  ) {
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === "public";
    const cacheControl = `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`;
    await streamStorageObjectToResponse(formatStoragePath(file), res, cacheControl);
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const objectId = randomUUID();
    const objectPath = `${this.getPrivateObjectDir()}/uploads/${objectId}`;
    return buildSignedUploadUrl(objectPath);
  }

  async getObjectEntityFile(objectPath: string): Promise<StorageObjectRef> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }

    const objectEntityPath = `${entityDir}${entityId}`;
    const objectRef = parseStoragePath(objectEntityPath);
    if (!(await storageObjectExists(objectEntityPath))) {
      throw new ObjectNotFoundError();
    }

    return objectRef;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("/api/uploads/direct?token=")) {
      return rawPath;
    }

    const url = new URL(rawPath, "http://localhost");
    const token = url.searchParams.get("token");
    if (!token) {
      return rawPath;
    }

    try {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[0], "base64url").toString("utf8"),
      ) as { objectPath?: string };

      const objectPath = payload.objectPath || "";
      let objectEntityDir = this.getPrivateObjectDir();
      if (!objectEntityDir.endsWith("/")) {
        objectEntityDir = `${objectEntityDir}/`;
      }

      if (!objectPath.startsWith(objectEntityDir)) {
        return objectPath || rawPath;
      }

      const entityId = objectPath.slice(objectEntityDir.length);
      return `/objects/${entityId}`;
    } catch {
      return rawPath;
    }
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: StorageObjectRef;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}
