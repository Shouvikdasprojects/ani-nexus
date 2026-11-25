import { Model } from 'mongoose';

function getNestedValue(obj: any, dotPath: string): any {
  if (!obj || !dotPath) return undefined;
  const parts = dotPath.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined) return undefined;
    if (Array.isArray(curr) && /^\d+$/.test(part)) {
      curr = curr[Number(part)];
    } else if (Array.isArray(curr)) {
      // Handle array path lookups like timeline.year in MongoDB
      curr = curr[0]?.[part];
    } else {
      curr = curr[part];
    }
  }
  return curr;
}

function compareBySortSpec(a: any, b: any, sort?: Record<string, any>): number {
  if (!sort) return 0;
  for (const [field, dir] of Object.entries(sort)) {
    if (dir && typeof dir === 'object' && '$meta' in dir) {
      const va = a.textScore ?? 0;
      const vb = b.textScore ?? 0;
      if (va !== vb) return vb - va;
      continue;
    }
    const order = dir === 1 || dir === 'asc' ? 1 : -1;
    const va = getNestedValue(a, field);
    const vb = getNestedValue(b, field);

    if (va === vb) continue;
    if (va === null || va === undefined) return 1; // push nulls/missing last
    if (vb === null || vb === undefined) return -1;

    if (typeof va === 'number' && typeof vb === 'number') {
      return va < vb ? -1 * order : 1 * order;
    }
    const sa = String(va).toLowerCase();
    const sb = String(vb).toLowerCase();
    if (sa !== sb) {
      return sa < sb ? -1 * order : 1 * order;
    }
  }
  return 0;
}

/**
 * Find the first matching document sequentially across ordered vaults.
 */
export async function findOneAcrossVaults<T>(
  models: Model<T>[],
  filter: any,
  projection?: any
): Promise<any | null> {
  for (const model of models) {
    try {
      const doc = projection
        ? await model.findOne(filter, projection).lean()
        : await model.findOne(filter).lean();
      if (doc) return doc;
    } catch (err: any) {
      console.warn('[Multi-Vault Lookup Warning]:', err.message);
    }
  }
  return null;
}

/**
 * Check if a matching document exists in any connected vault.
 */
export async function existsAcrossVaults<T>(
  models: Model<T>[],
  filter: any
): Promise<boolean> {
  for (const model of models) {
    try {
      const exists = await model.exists(filter);
      if (exists) return true;
    } catch (err: any) {
      console.warn('[Multi-Vault Exists Warning]:', err.message);
    }
  }
  return false;
}

/**
 * Sum matching document counts across all active vaults.
 */
export async function countAcrossVaults<T>(
  models: Model<T>[],
  filter: any = {}
): Promise<number> {
  const counts = await Promise.all(
    models.map((m) => m.countDocuments(filter).catch(() => 0))
  );
  return counts.reduce((acc, c) => acc + c, 0);
}

export interface MergedQueryOptions {
  filter: any;
  projection?: any;
  sort?: Record<string, any>;
  skip?: number;
  limit?: number;
  dedupeKey: string;
}

/**
 * Fetch paginated, sorted, deduplicated results seamlessly across multiple vaults.
 * Uses zero-overhead single-vault query when only one vault holds matching data.
 */
export async function findMergedAcrossVaults<T>(
  models: Model<T>[],
  options: MergedQueryOptions
): Promise<{ total: number; results: any[] }> {
  const { filter, projection, sort, skip = 0, limit = 20, dedupeKey } = options;

  const perVaultCounts = await Promise.all(
    models.map((m) => m.countDocuments(filter).catch(() => 0))
  );

  const activeEntries = models
    .map((model, idx) => ({ model, count: perVaultCounts[idx] }))
    .filter((entry) => entry.count > 0);

  if (activeEntries.length === 0) {
    return { total: 0, results: [] };
  }

  // Fast path when matching docs only live in one vault
  if (activeEntries.length === 1) {
    const { model, count } = activeEntries[0];
    let q = model.find(filter, projection);
    if (sort) q = q.sort(sort);
    const results = await q.skip(skip).limit(limit).lean();
    return { total: count, results };
  }

  // Multi-vault fan-out: pull top (skip + limit) from each active vault, merge & slice
  const fetchLimit = skip + limit;
  const vaultSlices = await Promise.all(
    activeEntries.map(async ({ model }) => {
      try {
        let q = model.find(filter, projection);
        if (sort) q = q.sort(sort);
        return await q.limit(fetchLimit).lean();
      } catch (err: any) {
        console.warn('[Multi-Vault Merge Warning]:', err.message);
        return [];
      }
    })
  );

  const seen = new Set<string>();
  const merged: any[] = [];

  for (const slice of vaultSlices) {
    for (const doc of slice) {
      const key = String((doc as any)[dedupeKey] ?? (doc as any)._id);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(doc);
      }
    }
  }

  if (sort) {
    merged.sort((a, b) => compareBySortSpec(a, b, sort));
  }

  const total = activeEntries.reduce((acc, e) => acc + e.count, 0);
  return {
    total,
    results: merged.slice(skip, skip + limit),
  };
}

/**
 * Fetch all matching documents across vaults without pagination (for series cast/staff/adaptations).
 */
export async function findUnpaginatedMergedAcrossVaults<T>(
  models: Model<T>[],
  options: Omit<MergedQueryOptions, 'skip' | 'limit'>
): Promise<any[]> {
  const { filter, projection, sort, dedupeKey } = options;

  const vaultDocs = await Promise.all(
    models.map(async (model) => {
      try {
        let q = model.find(filter, projection);
        if (sort) q = q.sort(sort);
        return await q.lean();
      } catch (err: any) {
        console.warn('[Multi-Vault Unpaginated Merge Warning]:', err.message);
        return [];
      }
    })
  );

  const seen = new Set<string>();
  const merged: any[] = [];

  for (const docs of vaultDocs) {
    for (const doc of docs) {
      const key = String((doc as any)[dedupeKey] ?? (doc as any)._id);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(doc);
      }
    }
  }

  if (sort) {
    merged.sort((a, b) => compareBySortSpec(a, b, sort));
  }

  return merged;
}
