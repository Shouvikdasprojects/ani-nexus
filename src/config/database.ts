import mongoose, { Connection, Model } from 'mongoose';
import { config } from './index.js';
import { FranchiseSchema, IFranchise, Franchise } from '../models/Franchise.js';
import { CharacterSchema, ICharacter, Character } from '../models/Character.js';
import { StaffSchema, IStaff, Staff } from '../models/Staff.js';
import { NewsSchema, INews, News } from '../models/News.js';
import { ScheduleSnapshotSchema, IScheduleSnapshot, ScheduleSnapshot } from '../models/ScheduleSnapshot.js';
import { MangaSchema, IManga, Manga } from '../models/Manga.js';

// Connection Handles
let overflowConnection: Connection | null = null;
let vault1bConnection: Connection | null = null;
let vault2bConnection: Connection | null = null;
let realtimeConnection: Connection | null = null;

// Vault 1B: Primary Overflow Models (Anime, Characters, Staff)
let Vault1BFranchise: Model<IFranchise> | null = null;
let Vault1BCharacter: Model<ICharacter> | null = null;
let Vault1BStaff: Model<IStaff> | null = null;

// Vault 2: Reading Archive Models (Manga, Manhwa, Novels)
let OverflowFranchise: Model<IFranchise> | null = null;
let OverflowCharacter: Model<ICharacter> | null = null;
let OverflowStaff: Model<IStaff> | null = null;
let OverflowManga: Model<IManga> | null = null;

// Vault 2B: Reading Overflow Models
let Vault2BManga: Model<IManga> | null = null;

// Vault 3: Real-Time Models (News & Schedule ONLY)
let RealtimeNews: Model<INews> | null = null;
let RealtimeSchedule: Model<IScheduleSnapshot> | null = null;

// Storage Capacity Monitor for Vault 1 (Primary: aninexusapidb2)
let isPrimaryFull = false;
let lastStorageCheck = 0;
const STORAGE_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes
const PRIMARY_CAPACITY_LIMIT_MB = 480; // 480MB threshold (of 512MB limit)

export async function isPrimaryVaultFull(): Promise<boolean> {
  const now = Date.now();
  if (now - lastStorageCheck < STORAGE_CHECK_INTERVAL) {
    return isPrimaryFull;
  }

  try {
    const stats = await mongoose.connection.db?.stats();
    if (stats) {
      // Atlas M0 Free Tier calculates capacity as Logical Data Size + Index Size
      const sizeMB = ((stats.dataSize || 0) + (stats.indexSize || 0)) / (1024 * 1024);
      isPrimaryFull = sizeMB >= PRIMARY_CAPACITY_LIMIT_MB;
      lastStorageCheck = now;
      console.log(`📊 [Storage Monitor] Vault 1 (Primary): ${sizeMB.toFixed(2)} MB / 512 MB (Capacity Full: ${isPrimaryFull})`);
    }
  } catch (err: any) {
    console.warn('⚠️ [Storage Check Warning]:', err.message);
  }

  return isPrimaryFull;
}

export async function connectDatabase(): Promise<typeof mongoose> {
  const primaryUri = config.mongodb.primaryUri || config.mongodb.uri;
  if (!primaryUri) {
    throw new Error('MONGODB_PRIMARY_URI or MONGODB_URI is not set in configuration.');
  }

  // 1. Connect Vault 1: Primary Core Media Archive (aninexusapidb2)
  mongoose.connection.on('connected', () => {
    console.log('🏛️  [Vault 1: Primary Media Archive] Connected: aninexusapidb2 (Core Catalog: 634+ Franchises, Characters, Staff)');
  });

  mongoose.connection.on('error', (err) => {
    console.error('⚠️ [Vault 1 Error]:', err.message);
  });

  const primaryConn = await mongoose.connect(primaryUri, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4,
  });

  // Initial Storage Check
  isPrimaryVaultFull().catch(() => {});

  // 1B. Connect Vault 1B: Primary Overflow Hub (Anime, Characters & Staff)
  const vault1bUri = config.mongodb.vault1bUri;
  if (vault1bUri && vault1bUri !== primaryUri) {
    try {
      vault1bConnection = mongoose.createConnection(vault1bUri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        family: 4,
      });

      vault1bConnection.on('connected', () => {
        console.log('🏛️  [Vault 1B: Primary Spillover Hub] Connected: cluster0.gxnhnnv (Anime, Character & Staff Overflow ready)');
      });

      vault1bConnection.on('error', (err) => {
        console.warn('⚠️ [Vault 1B Warning]:', err.message);
      });

      await vault1bConnection.asPromise();

      Vault1BFranchise = vault1bConnection.model<IFranchise>('Franchise', FranchiseSchema);
      Vault1BCharacter = vault1bConnection.model<ICharacter>('Character', CharacterSchema);
      Vault1BStaff = vault1bConnection.model<IStaff>('Staff', StaffSchema);
    } catch (err: any) {
      console.warn('⚠️ Could not initialize Vault 1B (Primary Overflow) connection:', err.message);
    }
  }

  // 2. Connect Vault 2: Reading Media Archive (cluster0.mfrvpnh)
  const overflowUri = config.mongodb.overflowUri || config.mongodb.secondaryUri;
  if (overflowUri && overflowUri !== primaryUri) {
    try {
      overflowConnection = mongoose.createConnection(overflowUri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        family: 4,
      });

      overflowConnection.on('connected', () => {
        console.log('🛡️  [Vault 2: Reading Media Archive] Connected: cluster0 (Manga, Manhwa & Light Novels)');
      });

      overflowConnection.on('error', (err) => {
        console.warn('⚠️ [Vault 2 Warning]:', err.message);
      });

      await overflowConnection.asPromise();

      OverflowFranchise = overflowConnection.model<IFranchise>('Franchise', FranchiseSchema);
      OverflowCharacter = overflowConnection.model<ICharacter>('Character', CharacterSchema);
      OverflowStaff = overflowConnection.model<IStaff>('Staff', StaffSchema);
      OverflowManga = overflowConnection.model<IManga>('Manga', MangaSchema);
    } catch (err: any) {
      console.warn('⚠️ Could not initialize Vault 2 (Overflow) connection:', err.message);
    }
  }

  // 2B. Connect Vault 2B: Reading Overflow Hub (Manga, Manhwa & Light Novels)
  const vault2bUri = config.mongodb.vault2bUri;
  if (vault2bUri) {
    try {
      vault2bConnection = mongoose.createConnection(vault2bUri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        family: 4,
      });

      vault2bConnection.on('connected', () => {
        console.log('🛡️  [Vault 2B: Reading Spillover Hub] Connected: (Manga & Novels Overflow ready)');
      });

      vault2bConnection.on('error', (err) => {
        console.warn('⚠️ [Vault 2B Warning]:', err.message);
      });

      await vault2bConnection.asPromise();

      Vault2BManga = vault2bConnection.model<IManga>('Manga', MangaSchema);
    } catch (err: any) {
      console.warn('⚠️ Could not initialize Vault 2B (Reading Overflow) connection:', err.message);
    }
  }

  // 3. Connect Vault 3: Dedicated Real-Time & News/Schedule Hub (cluster0.nwa9aro)
  const realtimeUri = config.mongodb.realtimeUri;
  if (realtimeUri) {
    try {
      realtimeConnection = mongoose.createConnection(realtimeUri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        family: 4,
      });

      realtimeConnection.on('connected', () => {
        console.log('⚡ [Vault 3: Real-Time & News/Schedule Hub] Connected: cluster0.nwa9aro (Dedicated 512MB RSS/TTL Hub)');
      });

      realtimeConnection.on('error', (err) => {
        console.warn('⚠️ [Vault 3 Warning]:', err.message);
      });

      await realtimeConnection.asPromise();

      RealtimeNews = realtimeConnection.model<INews>('News', NewsSchema);
      RealtimeSchedule = realtimeConnection.model<IScheduleSnapshot>('ScheduleSnapshot', ScheduleSnapshotSchema);
    } catch (err: any) {
      console.warn('⚠️ Could not initialize Vault 3 (Real-Time Hub) connection:', err.message);
    }
  }

  return primaryConn;
}

export function getSecondaryConnection(): Connection | null {
  return overflowConnection;
}

export function getVault1BConnection(): Connection | null {
  return vault1bConnection;
}

export function getVault2BConnection(): Connection | null {
  return vault2bConnection;
}

export function getRealtimeConnection(): Connection | null {
  return realtimeConnection;
}

export function getSecondaryFranchiseModel(): Model<IFranchise> | null {
  return OverflowFranchise;
}

export function getCharacterModel(): Model<ICharacter> {
  return Character;
}

export function getVault1BCharacterModel(): Model<ICharacter> | null {
  return Vault1BCharacter;
}

export function getStaffModel(): Model<IStaff> {
  return Staff;
}

export function getVault1BStaffModel(): Model<IStaff> | null {
  return Vault1BStaff;
}

export function getNewsModel(): Model<INews> {
  return RealtimeNews || News;
}

export function getScheduleSnapshotModel(): Model<IScheduleSnapshot> {
  return RealtimeSchedule || ScheduleSnapshot;
}

export function getMangaModel(): Model<IManga> {
  return OverflowManga || (Manga as Model<IManga>);
}

export function getVault2BMangaModel(): Model<IManga> | null {
  return Vault2BManga;
}

let isVault2FullFlag = false;
let lastVault2Check = 0;
export async function isVault2Full(): Promise<boolean> {
  const now = Date.now();
  if (now - lastVault2Check < STORAGE_CHECK_INTERVAL) {
    return isVault2FullFlag;
  }
  try {
    if (overflowConnection?.db) {
      const stats = await overflowConnection.db.stats();
      if (stats) {
        const sizeMB = ((stats.dataSize || 0) + (stats.indexSize || 0)) / (1024 * 1024);
        isVault2FullFlag = sizeMB >= PRIMARY_CAPACITY_LIMIT_MB;
        lastVault2Check = now;
      }
    }
  } catch {}
  return isVault2FullFlag;
}

export async function getTargetMangaWriteModel(): Promise<Model<IManga>> {
  const isFull = await isVault2Full();
  if (isFull && Vault2BManga) {
    console.log('⚠️ [Multi-Vault Routing] Vault 2 full (>=480MB). Directing save to Vault 2B (Reading Spillover)!');
    return Vault2BManga;
  }
  return OverflowManga || (Manga as Model<IManga>);
}

/**
 * Returns the target model to write new franchises to.
 * Automatically spills over to Vault 1B if Vault 1 is full!
 */
export async function getTargetFranchiseWriteModel(): Promise<Model<IFranchise>> {
  const isFull = await isPrimaryVaultFull();
  if (isFull && Vault1BFranchise) {
    console.log('⚠️ [Multi-Vault Routing] Vault 1 full (>=480MB). Directing save to Vault 1B (Spillover)!');
    return Vault1BFranchise;
  }
  return Franchise;
}

export async function getTargetCharacterWriteModel(): Promise<Model<ICharacter>> {
  const isFull = await isPrimaryVaultFull();
  if (isFull && Vault1BCharacter) {
    return Vault1BCharacter;
  }
  return Character;
}

export async function getTargetStaffWriteModel(): Promise<Model<IStaff>> {
  const isFull = await isPrimaryVaultFull();
  if (isFull && Vault1BStaff) {
    return Vault1BStaff;
  }
  return Staff;
}

/**
 * Returns real-time connectivity status across all database vaults.
 */
export function getVaultHealthStatus() {
  const readyStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return {
    vault1Primary: readyStates[mongoose.connection.readyState] || 'unknown',
    vault1bOverflow: vault1bConnection ? (readyStates[vault1bConnection.readyState] || 'unknown') : 'standby',
    vault2Reading: overflowConnection ? (readyStates[overflowConnection.readyState] || 'unknown') : 'standby',
    vault2bOverflow: vault2bConnection ? (readyStates[vault2bConnection.readyState] || 'unknown') : 'standby',
    vault3Realtime: realtimeConnection ? (readyStates[realtimeConnection.readyState] || 'unknown') : 'standby',
  };
}
