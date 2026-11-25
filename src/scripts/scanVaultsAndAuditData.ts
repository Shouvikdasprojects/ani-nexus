import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

import mongoose from 'mongoose';
import {
  connectDatabase,
  getVaultHealthStatus,
  getSecondaryConnection,
  getVault1BConnection,
  getVault2BConnection,
  getRealtimeConnection,
  getCharacterModel,
  getVault1BCharacterModel,
  getStaffModel,
  getVault1BStaffModel,
  getMangaModel,
  getVault2BMangaModel,
  getNewsModel,
  getScheduleSnapshotModel,
} from '../config/database.js';
import { Franchise } from '../models/Franchise.js';

async function runAudit() {
  console.log('🔍 Initializing Multi-Vault Diagnostic & Integrity Audit...');
  await connectDatabase();

  const v1Conn = mongoose.connection;
  const v1bConn = getVault1BConnection();
  const v2Conn = getSecondaryConnection();
  const v2bConn = getVault2BConnection();
  const v3Conn = getRealtimeConnection();

  const connections = [
    { name: 'Vault 1 (Primary Core Media)', conn: v1Conn },
    { name: 'Vault 1B (Primary Spillover)', conn: v1bConn },
    { name: 'Vault 2 (Reading Archive)', conn: v2Conn },
    { name: 'Vault 2B (Reading Spillover)', conn: v2bConn },
    { name: 'Vault 3 (Real-Time & Telemetry Hub)', conn: v3Conn },
  ];

  const storageReports: any[] = [];

  for (const item of connections) {
    if (!item.conn || !item.conn.db) {
      storageReports.push({
        vault: item.name,
        status: 'Disconnected / Standby',
        storageMB: '0.00',
        dataMB: '0.00',
        indexMB: '0.00',
        collections: [],
      });
      continue;
    }

    try {
      const stats = await item.conn.db.stats();
      const colList = await item.conn.db.listCollections().toArray();
      const collectionsData: any[] = [];

      for (const col of colList) {
        try {
          const colStats = await item.conn.db.command({ collStats: col.name });
          collectionsData.push({
            name: col.name,
            count: colStats.count || 0,
            storageSizeMB: ((colStats.storageSize || 0) / (1024 * 1024)).toFixed(2),
          });
        } catch {
          const count = await item.conn.db.collection(col.name).countDocuments();
          collectionsData.push({
            name: col.name,
            count,
            storageSizeMB: 'N/A',
          });
        }
      }

      storageReports.push({
        vault: item.name,
        status: 'Active & Connected',
        dataMB: ((stats.dataSize || 0) / (1024 * 1024)).toFixed(2),
        storageMB: ((stats.storageSize || 0) / (1024 * 1024)).toFixed(2),
        indexMB: ((stats.indexSize || 0) / (1024 * 1024)).toFixed(2),
        totalUsedMB: (((stats.storageSize || 0) + (stats.indexSize || 0)) / (1024 * 1024)).toFixed(2),
        limitMB: 512,
        usagePercent: (
          ((stats.storageSize || 0) / (512 * 1024 * 1024)) *
          100
        ).toFixed(1),
        collections: collectionsData,
      });
    } catch (err: any) {
      storageReports.push({
        vault: item.name,
        status: `Connected (Stats error: ${err.message})`,
      });
    }
  }

  console.log('\n--- STORAGE AUDIT REPORT ---');
  console.log(JSON.stringify(storageReports, null, 2));

  // ---------------------------------------------------------
  // AUDIT FOR DUMMY / PLACEHOLDER / MOCK DATA
  // ---------------------------------------------------------
  console.log('\n🔎 Commencing Deep Data Integrity Scan for Dummy Data...');

  const dummyRegex = /test|dummy|mock|placeholder|lorem\s*ipsum|sample\s*title/i;

  // 1. Franchise Audit
  const dummyFranchises = await Franchise.find({
    $or: [
      { 'titles.english': dummyRegex },
      { 'titles.romaji': dummyRegex },
      { slug: dummyRegex },
      { slug: { $regex: /^test/i } },
      { 'titles.english': 'Untitled' },
    ],
  }).select('slug titles.english').lean();

  // 2. Manga Audit
  const MangaModel = getMangaModel();
  const dummyManga = await MangaModel.find({
    $or: [
      { 'titles.english': dummyRegex },
      { 'titles.romaji': dummyRegex },
      { slug: dummyRegex },
      { slug: { $regex: /^test/i } },
      { 'titles.english': 'Unknown Manga' },
    ],
  }).select('slug titles.english').limit(20).lean();

  // 3. Characters Audit
  const CharModel = getCharacterModel();
  const dummyChars = await CharModel.find({
    $or: [
      { 'name.full': dummyRegex },
      { 'name.native': dummyRegex },
      { slug: dummyRegex },
      { slug: { $regex: /^test/i } },
    ],
  }).select('slug name.full').limit(20).lean();

  // 4. Staff Audit
  const StaffModel = getStaffModel();
  const dummyStaff = await StaffModel.find({
    $or: [
      { 'name.full': dummyRegex },
      { 'name.native': dummyRegex },
      { slug: dummyRegex },
      { slug: { $regex: /^test/i } },
    ],
  }).select('slug name.full').limit(20).lean();

  // 5. News Audit
  const NewsModel = getNewsModel();
  const dummyNews = await NewsModel.find({
    $or: [
      { title: dummyRegex },
      { slug: dummyRegex },
    ],
  }).select('slug title').lean();

  const auditResults = {
    dummyFranchises: {
      found: dummyFranchises.length,
      items: dummyFranchises,
    },
    dummyManga: {
      found: dummyManga.length,
      items: dummyManga,
    },
    dummyCharacters: {
      found: dummyChars.length,
      items: dummyChars,
    },
    dummyStaff: {
      found: dummyStaff.length,
      items: dummyStaff,
    },
    dummyNews: {
      found: dummyNews.length,
      items: dummyNews,
    },
  };

  console.log('\n--- DUMMY DATA SCAN REPORT ---');
  console.log(JSON.stringify(auditResults, null, 2));

  process.exit(0);
}

runAudit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
