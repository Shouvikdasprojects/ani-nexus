import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

import mongoose from 'mongoose';
import {
  connectDatabase,
  getCharacterModel,
  getVault1BCharacterModel,
  getStaffModel,
  getVault1BStaffModel,
  getMangaModel,
  getVault2BMangaModel,
  getVaultLogicalMB,
  getSecondaryConnection,
  getVault1BConnection,
} from '../config/database.js';

/**
 * Safely syncs updated schema indexes (dropping wasteful unused $text, non-sparse null malId,
 * name.full_1, voiceActors.language_1 indexes) AND removes strictly empty 0-doc ghost collections.
 * Preserves 100% of actual documents across all vaults.
 */
async function optimizeIndexesAndGhostCollections() {
  console.log('===============================================================');
  console.log('🧹 AniNexus Index Optimizer & Ghost Collection Cleaner');
  console.log('===============================================================\n');

  await connectDatabase();

  const v1Before = await getVaultLogicalMB(mongoose.connection);
  const v1bBefore = await getVaultLogicalMB(getVault1BConnection());
  const v2Before = await getVaultLogicalMB(getSecondaryConnection());

  console.log(`📊 Before Optimization -> V1: ${v1Before.toFixed(2)} MB | V1B: ${v1bBefore.toFixed(2)} MB | V2: ${v2Before.toFixed(2)} MB\n`);

  const syncTargets = [
    { name: 'Vault 1 Characters', model: getCharacterModel() },
    { name: 'Vault 1B Characters', model: getVault1BCharacterModel() },
    { name: 'Vault 1 Staff', model: getStaffModel() },
    { name: 'Vault 1B Staff', model: getVault1BStaffModel() },
    { name: 'Vault 2 Manga', model: getMangaModel() },
    { name: 'Vault 2B Manga', model: getVault2BMangaModel() },
  ];

  for (const target of syncTargets) {
    if (!target.model) continue;
    try {
      const dropped = await target.model.syncIndexes();
      console.log(`✅ [${target.name}] Indexes synced cleanly. Dropped obsolete indexes:`, dropped);
    } catch (err: any) {
      console.warn(`⚠️ [${target.name}] syncIndexes warning:`, err.message);
    }
  }

  // Safely drop ONLY strictly empty (0-doc) ghost collections on Vault 1 and Vault 2
  const ghostChecks: Array<{ vault: string; conn: any; cols: string[] }> = [
    { vault: 'Vault 1', conn: mongoose.connection, cols: ['schedulesnapshots', 'news', 'mangas'] },
    { vault: 'Vault 2', conn: getSecondaryConnection(), cols: ['awards', 'schedulesnapshots', 'characters', 'staffs', 'franchises'] },
  ];

  for (const item of ghostChecks) {
    if (!item.conn?.db) continue;
    const existingCols = (await item.conn.db.listCollections().toArray()).map((c: any) => c.name);
    for (const colName of item.cols) {
      if (!existingCols.includes(colName)) continue;
      const count = await item.conn.db.collection(colName).countDocuments();
      if (count === 0) {
        await item.conn.db.dropCollection(colName);
        console.log(`🗑️  [${item.vault}] Dropped empty 0-doc ghost collection: ${colName}`);
      } else {
        console.log(`⏭️  [${item.vault}] Kept non-empty collection: ${colName} (${count} docs)`);
      }
    }
  }

  const v1After = await getVaultLogicalMB(mongoose.connection);
  const v1bAfter = await getVaultLogicalMB(getVault1BConnection());
  const v2After = await getVaultLogicalMB(getSecondaryConnection());

  console.log('\n===============================================================');
  console.log(`📊 After Optimization -> V1: ${v1After.toFixed(2)} MB (Saved ${(v1Before - v1After).toFixed(2)} MB)`);
  console.log(`📊 V1B: ${v1bAfter.toFixed(2)} MB (Saved ${(v1bBefore - v1bAfter).toFixed(2)} MB)`);
  console.log(`📊 V2:  ${v2After.toFixed(2)} MB (Saved ${(v2Before - v2After).toFixed(2)} MB)`);
  console.log('===============================================================\n');

  process.exit(0);
}

optimizeIndexesAndGhostCollections().catch((err) => {
  console.error('❌ Index optimization failed:', err);
  process.exit(1);
});
