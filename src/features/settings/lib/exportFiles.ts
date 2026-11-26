import { Directory, File, Paths } from 'expo-file-system';

/** Export files are named `lifeos-<date>.json` / `lifeos-<date>-csv.zip` in the cache folder. */
export const EXPORT_PREFIX = 'lifeos-';

/**
 * Deletes every Life export left in the cache folder. They hold all of a
 * person's data, so they go after sharing and when an account signs out or is
 * deleted (F25: nothing of a deleted account stays on the phone).
 */
export function clearExportFiles(): number {
  let removed = 0;
  try {
    for (const entry of new Directory(Paths.cache).list()) {
      if (entry instanceof File && entry.name.startsWith(EXPORT_PREFIX)) {
        entry.delete();
        removed++;
      }
    }
  } catch {
    // No cache folder yet: nothing to remove.
  }
  return removed;
}
