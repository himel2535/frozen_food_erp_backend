import { v2 as cloudinary } from 'cloudinary';

const IMAGE_PUBLIC_ID_PAIRS = [
  ['imageUrl', 'imagePublicId'],
  ['attachmentUrl', 'attachmentPublicId'],
  ['evidenceImageUrl', 'evidenceImagePublicId'],
  ['logoUrl', 'logoPublicId'],
] as const;

let configured = false;
let missingEnvLogged = false;

function ensureCloudinaryConfig(): boolean {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) {
    if (!missingEnvLogged) {
      missingEnvLogged = true;
      console.warn(
        '[cloudinary] Destroy skipped: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the API server.',
      );
    }
    return false;
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
    configured = true;
  }
  return true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && !(value instanceof Date),
  );
}

/** Destroy a Cloudinary asset. Never throws — Save/update must not wait or fail. */
export function destroyCloudinaryImage(publicId: string | undefined | null): void {
  const id = String(publicId ?? '').trim();
  if (!id) return;
  if (!ensureCloudinaryConfig()) return;
  void cloudinary.uploader.destroy(id).catch((err: unknown) => {
    console.error('[cloudinary] destroy failed', id, err);
  });
}

function collectReplacedPublicIds(
  previous: unknown,
  next: unknown,
  into: Set<string>,
): void {
  if (!isPlainObject(previous) || !isPlainObject(next)) return;

  for (const [urlKey, idKey] of IMAGE_PUBLIC_ID_PAIRS) {
    const prevId = String(previous[idKey] ?? '').trim();
    if (!prevId) continue;
    const prevUrl = String(previous[urlKey] ?? '');
    const nextUrl = String(next[urlKey] ?? '');
    if (nextUrl === prevUrl) continue;
    into.add(prevId);
  }

  for (const key of Object.keys(previous)) {
    if (key === 'items') continue;
    collectReplacedPublicIds(previous[key], next[key], into);
  }
}

function collectAllPublicIds(doc: unknown, into: Set<string>): void {
  if (!isPlainObject(doc)) return;

  for (const [, idKey] of IMAGE_PUBLIC_ID_PAIRS) {
    const id = String(doc[idKey] ?? '').trim();
    if (id) into.add(id);
  }

  for (const key of Object.keys(doc)) {
    if (key === 'items') continue;
    const value = doc[key];
    if (isPlainObject(value)) collectAllPublicIds(value, into);
  }
}

/** After a successful update: destroy previous assets whose URL actually changed (including cleared). */
export function scheduleReplacedCloudinaryDeletes(
  previous: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
): void {
  if (!previous || !next) return;
  const ids = new Set<string>();
  collectReplacedPublicIds(previous, next, ids);
  for (const id of ids) destroyCloudinaryImage(id);
}

/** After a successful document delete: destroy every stored Cloudinary public id. */
export function scheduleRemovedCloudinaryDeletes(
  doc: Record<string, unknown> | null | undefined,
): void {
  if (!doc) return;
  const ids = new Set<string>();
  collectAllPublicIds(doc, ids);
  for (const id of ids) destroyCloudinaryImage(id);
}
