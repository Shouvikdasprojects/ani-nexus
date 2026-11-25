import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

import mongoose, { Model } from 'mongoose';
import {
  connectDatabase,
  getCharacterModel,
  getVault1BCharacterModel,
  getStaffModel,
  getVault1BStaffModel,
  getVault1BFranchiseModel,
  getSecondaryFranchiseModel,
} from '../config/database.js';
import { Franchise } from '../models/Franchise.js';

const TARGET_VAULT1_MAX_MB = 455; // Comfortably below 480MB & 512MB, while keeping >=450MB spillover active
const BATCH_SIZE = 500;

async function getVault1LogicalMB(): Promise<number> {
  const stats = await mongoose.connection.db?.stats();
  if (!stats) return 0;
  return ((stats.dataSize || 0) + (stats.indexSize || 0)) / (1024 * 1024);
}

/**
 * Shared batch migration helper: copies highest-ID docs to Vault 1B, verifies count, then deletes from Vault 1.
 */
async function migrateCollectionToVault1B<T>(params: {
  label: string;
  primaryModel: Model<T>;
  targetModel: Model<T>;
  idField: string;
  targetMaxMB: number;
}): Promise<{ migrated: number; currentMB: number }> {
  const { label, primaryModel, targetModel, idField, targetMaxMB } = params;
  let migrated = 0;
  let currentMB = await getVault1LogicalMB();

  console.log(`\n▶️ Migrating ${label} from Vault 1 to Vault 1B (target <= ${targetMaxMB} MB)...`);

  while (currentMB > targetMaxMB) {
    const batch = await primaryModel
      .find({})
      .sort({ [idField]: -1 } as any)
      .limit(BATCH_SIZE)
      .lean();

    if (!batch || batch.length === 0) {
      console.log(`ℹ️ No more ${label} available to migrate.`);
      break;
    }

    const mongoIds = batch.map((doc: any) => doc._id);
    const domainIds = batch.map((doc: any) => doc[idField]);

    const ops = batch.map((doc: any) => {
      const { _id, ...docWithoutId } = doc;
      return {
        updateOne: {
          filter: { [idField]: doc[idField] },
          update: { $set: docWithoutId },
          upsert: true,
        },
      };
    });

    await targetModel.bulkWrite(ops as any, { ordered: false });

    const verifiedCount = await targetModel.countDocuments({
      [idField]: { $in: domainIds },
    } as any);

    if (verifiedCount < batch.length) {
      throw new Error(
        `⚠️ Verification failed for ${label}! Expected ${batch.length} in Vault 1B, found ${verifiedCount}. Aborting delete.`
      );
    }

    const delRes = await primaryModel.deleteMany({ _id: { $in: mongoIds } } as any);
    migrated += delRes.deletedCount || 0;

    await new Promise((r) => setTimeout(r, 100));
    currentMB = await getVault1LogicalMB();
    console.log(`  • Migrated ${migrated} ${label} -> Vault 1 Size now: ${currentMB.toFixed(2)} MB`);
  }

  return { migrated, currentMB };
}

/**
 * Phase 0: Consolidate any stray anime franchises from Vault 2 (Reading Archive) into Vault 1B.
 */
async function consolidateStrayVault2Franchises(): Promise<number> {
  const SecFranchise = getSecondaryFranchiseModel();
  const Vault1BFranchise = getVault1BFranchiseModel();
  if (!SecFranchise || !Vault1BFranchise) return 0;

  const strayDocs = await SecFranchise.find({}).lean();
  if (!strayDocs.length) return 0;

  console.log(`\n🧹 Phase 0: Consolidating ${strayDocs.length} anime franchises from Vault 2 into Vault 1B...`);
  let moved = 0;

  for (const doc of strayDocs as any[]) {
    const existsInV1 = await Franchise.exists({ slug: doc.slug });
    if (!existsInV1) {
      const { _id, ...cleanDoc } = doc;
      await Vault1BFranchise.findOneAndUpdate(
        { slug: doc.slug },
        { $set: cleanDoc },
        { upsert: true }
      );
      const verified = await Vault1BFranchise.exists({ slug: doc.slug });
      if (!verified) {
        throw new Error(`Verification failed moving stray franchise '${doc.slug}' to Vault 1B!`);
      }
      moved++;
    }
    await SecFranchise.deleteOne({ _id: doc._id });
  }

  console.log(`  ✅ Consolidated ${moved} unique franchises to Vault 1B and cleaned ${strayDocs.length} entries from Vault 2.`);
  return moved;
}

async function runMigration() {
  console.log('===============================================================');
  console.log('📦 Vault 1 -> Vault 1B Precision Data Rebalancer');
  console.log('===============================================================\n');

  await connectDatabase();

  const PrimaryCharModel = getCharacterModel();
  const Vault1BCharModel = getVault1BCharacterModel();
  const PrimaryStaffModel = getStaffModel();
  const Vault1BStaffModel = getVault1BStaffModel();

  if (!Vault1BCharModel || !Vault1BStaffModel) {
    throw new Error('Vault 1B models could not be initialized. Please check MONGODB_VAULT1B_URI.');
  }

  const movedFranchises = await consolidateStrayVault2Franchises();

  let currentMB = await getVault1LogicalMB();
  console.log(`\n📊 Current Vault 1 Atlas Logical Size: ${currentMB.toFixed(2)} MB / 512 MB`);
  console.log(`🎯 Target Size: <= ${TARGET_VAULT1_MAX_MB} MB`);

  let migratedStaff = 0;
  let migratedChars = 0;

  if (currentMB > TARGET_VAULT1_MAX_MB) {
    const staffRes = await migrateCollectionToVault1B({
      label: 'staff',
      primaryModel: PrimaryStaffModel,
      targetModel: Vault1BStaffModel,
      idField: 'staffId',
      targetMaxMB: TARGET_VAULT1_MAX_MB,
    });
    migratedStaff = staffRes.migrated;
    currentMB = staffRes.currentMB;
  }

  if (currentMB > TARGET_VAULT1_MAX_MB) {
    const charRes = await migrateCollectionToVault1B({
      label: 'characters',
      primaryModel: PrimaryCharModel,
      targetModel: Vault1BCharModel,
      idField: 'characterId',
      targetMaxMB: TARGET_VAULT1_MAX_MB,
    });
    migratedChars = charRes.migrated;
    currentMB = charRes.currentMB;
  }

  const finalVault1MB = await getVault1LogicalMB();
  const v1bStats = await (Vault1BStaffModel.db as any).db?.stats();
  const finalVault1BMB = ((v1bStats?.dataSize || 0) + (v1bStats?.indexSize || 0)) / (1024 * 1024);

  console.log('\n===============================================================');
  console.log('🎉 REBALANCING COMPLETE & VERIFIED!');
  console.log(`✅ Stray Vault 2 Franchises Consolidated to Vault 1B: ${movedFranchises}`);
  console.log(`✅ Total Staff Migrated: ${migratedStaff}`);
  console.log(`✅ Total Characters Migrated: ${migratedChars}`);
  console.log(`🏛️ Vault 1 New Atlas Logical Size: ${finalVault1MB.toFixed(2)} MB / 512 MB`);
  console.log(`🏛️ Vault 1B New Atlas Logical Size: ${finalVault1BMB.toFixed(2)} MB / 512 MB`);
  console.log('===============================================================\n');

  process.exit(0);
}

runMigration().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
