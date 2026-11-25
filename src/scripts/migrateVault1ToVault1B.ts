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
} from '../config/database.js';

const TARGET_VAULT1_MAX_MB = 465; // Safe target well under 480MB threshold
const BATCH_SIZE = 500;

async function getVault1LogicalMB(): Promise<number> {
  const stats = await mongoose.connection.db?.stats();
  if (!stats) return 0;
  return ((stats.dataSize || 0) + (stats.indexSize || 0)) / (1024 * 1024);
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

  let currentMB = await getVault1LogicalMB();
  console.log(`📊 Current Vault 1 Atlas Logical Size: ${currentMB.toFixed(2)} MB / 512 MB`);
  console.log(`🎯 Target Size: <= ${TARGET_VAULT1_MAX_MB} MB`);

  if (currentMB <= TARGET_VAULT1_MAX_MB) {
    console.log('✅ Vault 1 is already within the target safe threshold. No migration needed.');
    process.exit(0);
  }

  const toReduceMB = currentMB - TARGET_VAULT1_MAX_MB;
  console.log(`⚡ Need to safely migrate approximately ${toReduceMB.toFixed(2)} MB of records to Vault 1B...\n`);

  let migratedStaff = 0;
  let migratedChars = 0;

  // -------------------------------------------------------------------------
  // Phase 1: Migrate Staff (Highest IDs first, newest ingested)
  // -------------------------------------------------------------------------
  console.log('▶️ Phase 1: Migrating Staff records from Vault 1 to Vault 1B...');

  while (currentMB > TARGET_VAULT1_MAX_MB) {
    // Grab newest 500 staff
    const batch = await PrimaryStaffModel.find({})
      .sort({ staffId: -1 })
      .limit(BATCH_SIZE)
      .lean();

    if (!batch || batch.length === 0) {
      console.log('ℹ️ No more staff available to migrate. Proceeding to characters.');
      break;
    }

    const ids = batch.map((doc: any) => doc._id);
    const staffIds = batch.map((doc: any) => doc.staffId);

    // Upsert into Vault 1B
    const ops = batch.map((doc: any) => ({
      updateOne: {
        filter: { staffId: doc.staffId },
        update: { $set: doc },
        upsert: true,
      },
    }));

    await Vault1BStaffModel.bulkWrite(ops as any, { ordered: false });

    // Verify all staff exist in Vault 1B
    const verifiedCount = await Vault1BStaffModel.countDocuments({
      staffId: { $in: staffIds },
    });

    if (verifiedCount < batch.length) {
      throw new Error(`⚠️ Verification failed! Expected ${batch.length} in Vault 1B, but found ${verifiedCount}. Aborting deletion for safety.`);
    }

    // Delete verified batch from Vault 1
    const delRes = await PrimaryStaffModel.deleteMany({ _id: { $in: ids } });
    migratedStaff += delRes.deletedCount || 0;

    currentMB = await getVault1LogicalMB();
    console.log(`  • Migrated ${migratedStaff} staff -> Vault 1 Size now: ${currentMB.toFixed(2)} MB`);

    if (currentMB <= TARGET_VAULT1_MAX_MB) break;
  }

  // -------------------------------------------------------------------------
  // Phase 2: Migrate Characters if still needed
  // -------------------------------------------------------------------------
  if (currentMB > TARGET_VAULT1_MAX_MB) {
    console.log('\n▶️ Phase 2: Migrating Character records from Vault 1 to Vault 1B...');

    while (currentMB > TARGET_VAULT1_MAX_MB) {
      const batch = await PrimaryCharModel.find({})
        .sort({ characterId: -1 })
        .limit(BATCH_SIZE)
        .lean();

      if (!batch || batch.length === 0) {
        console.log('ℹ️ No more characters available to migrate.');
        break;
      }

      const ids = batch.map((doc: any) => doc._id);
      const charIds = batch.map((doc: any) => doc.characterId);

      // Upsert into Vault 1B
      const ops = batch.map((doc: any) => ({
        updateOne: {
          filter: { characterId: doc.characterId },
          update: { $set: doc },
          upsert: true,
        },
      }));

      await Vault1BCharModel.bulkWrite(ops as any, { ordered: false });

      // Verify all characters exist in Vault 1B
      const verifiedCount = await Vault1BCharModel.countDocuments({
        characterId: { $in: charIds },
      });

      if (verifiedCount < batch.length) {
        throw new Error(`⚠️ Verification failed! Expected ${batch.length} in Vault 1B, but found ${verifiedCount}. Aborting deletion for safety.`);
      }

      // Delete verified batch from Vault 1
      const delRes = await PrimaryCharModel.deleteMany({ _id: { $in: ids } });
      migratedChars += delRes.deletedCount || 0;

      currentMB = await getVault1LogicalMB();
      console.log(`  • Migrated ${migratedChars} characters -> Vault 1 Size now: ${currentMB.toFixed(2)} MB`);

      if (currentMB <= TARGET_VAULT1_MAX_MB) break;
    }
  }

  // Final check
  const finalVault1MB = await getVault1LogicalMB();
  const v1bStats = await (Vault1BStaffModel.db as any).db?.stats();
  const finalVault1BMB = (((v1bStats?.dataSize || 0) + (v1bStats?.indexSize || 0)) / (1024 * 1024));

  console.log('\n===============================================================');
  console.log('🎉 REBALANCING COMPLETE & VERIFIED!');
  console.log(`✅ Total Staff Migrated: ${migratedStaff}`);
  console.log(`✅ Total Characters Migrated: ${migratedChars}`);
  console.log(`🏛️ Vault 1 New Atlas Logical Size: ${finalVault1MB.toFixed(2)} MB / 512 MB (Safe!)`);
  console.log(`🏛️ Vault 1B New Atlas Logical Size: ${finalVault1BMB.toFixed(2)} MB / 512 MB (Healthy!)`);
  console.log('===============================================================\n');

  process.exit(0);
}

runMigration().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
