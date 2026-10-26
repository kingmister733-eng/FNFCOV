import JSZip from 'jszip';
import { SerializedFile } from './outputSerializer';

export interface UnpackedFile {
  path: string;
  isText: boolean;
  text?: string;
  data: Uint8Array;
}

export class SafeZip {
  /**
   * Safely unpacks a ZIP archive while guarding against Zip Slip path traversal
   */
  public static async unpackZip(
    zipData: ArrayBuffer | Uint8Array | Blob,
    onProgress?: (percent: number, currentFile: string) => void
  ): Promise<{ files: Map<string, UnpackedFile>; errors: string[] }> {
    const files = new Map<string, UnpackedFile>();
    const errors: string[] = [];

    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(zipData);
    const entries = Object.entries(loadedZip.files).filter(([_, entry]) => !entry.dir);
    const total = entries.length;

    let processed = 0;

    for (const [rawPath, entry] of entries) {
      processed++;
      const sanitizedPath = this.sanitizeZipPath(rawPath);

      if (!sanitizedPath) {
        errors.push(`Rejected unsafe path traversal entry in ZIP: "${rawPath}"`);
        continue;
      }

      if (onProgress) {
        onProgress(Math.round((processed / total) * 50), sanitizedPath);
      }

      const lower = sanitizedPath.toLowerCase();
      const isText =
        lower.endsWith('.json') ||
        lower.endsWith('.txt') ||
        lower.endsWith('.lua') ||
        lower.endsWith('.hx') ||
        lower.endsWith('.hscript') ||
        lower.endsWith('.xml');

      const uint8 = await entry.async('uint8array');
      let text: string | undefined = undefined;

      if (isText) {
        try {
          text = new TextDecoder('utf-8', { fatal: false }).decode(uint8);
        } catch {
          // If decoding fails, keep as binary
        }
      }

      files.set(sanitizedPath, {
        path: sanitizedPath,
        isText,
        text,
        data: uint8,
      });
    }

    return { files, errors };
  }

  /**
   * Pack an array of SerializedFile into a clean ZIP Blob
   */
  public static async packZip(
    files: SerializedFile[],
    onProgress?: (percent: number) => void
  ): Promise<Blob> {
    const zip = new JSZip();

    for (const file of files) {
      const sanitized = this.sanitizeZipPath(file.path);
      if (!sanitized) continue;

      if (typeof file.content === 'string') {
        zip.file(sanitized, file.content);
      } else {
        zip.file(sanitized, file.content);
      }
    }

    return await zip.generateAsync(
      {
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      },
      (metadata) => {
        if (onProgress) onProgress(50 + Math.round(metadata.percent * 0.5));
      }
    );
  }

  /**
   * Prevents Zip Slip vulnerability (e.g. "../../../etc/passwd" or leading slashes)
   */
  public static sanitizeZipPath(rawPath: string): string | null {
    let clean = rawPath.replace(/\\/g, '/');
    clean = clean.replace(/^\/+/, '');

    // Check for path traversal segments
    const parts = clean.split('/');
    const safeParts: string[] = [];

    for (const part of parts) {
      if (part === '.' || part === '') continue;
      if (part === '..') {
        // Zip slip attack!
        return null;
      }
      safeParts.push(part);
    }

    return safeParts.length > 0 ? safeParts.join('/') : null;
  }
}
