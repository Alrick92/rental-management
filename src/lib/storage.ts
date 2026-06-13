import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

export async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export async function saveFile(
  buffer: Buffer,
  originalFilename: string,
): Promise<{ storageKey: string; sizeBytes: number }> {
  await ensureUploadDir();

  const ext = path.extname(originalFilename);
  const storageKey = `${uuidv4()}${ext}`;
  const filePath = path.join(UPLOAD_DIR, storageKey);

  await fs.writeFile(filePath, buffer);

  return { storageKey, sizeBytes: buffer.length };
}

export async function readFile(storageKey: string): Promise<Buffer> {
  const filePath = path.join(UPLOAD_DIR, storageKey);
  return fs.readFile(filePath);
}

export async function deleteFile(storageKey: string): Promise<void> {
  const filePath = path.join(UPLOAD_DIR, storageKey);
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
