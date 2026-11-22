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
let realtimeConnection: Connection | null = null;

// Vault 2: Overflow & Reading Models
let OverflowFranchise: Model<IFranchise> | null = null;
let OverflowCharacter: Model<ICharacter> | null = null;
let OverflowStaff: Model<IStaff> | null = null;
let OverflowManga: Model<IManga> | null = null;

// Vault 3: Real-Time Models
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
      const sizeMB = (stats.storageSize || stats.dataSize || 0) / (1024 * 1024);
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

  // 2. Connect Vault 2: Overflow Media Archive (cluster0.mfrvpnh)
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
        console.log('🛡️  [Vault 2: Overflow Media Archive] Connected: cluster0 (512MB Auto-Spillover Storage ready)');
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

export function getRealtimeConnection(): Connection | null {
  return realtimeConnection;
}

export function getSecondaryFranchiseModel(): Model<IFranchise> | null {
  return OverflowFranchise;
}

export function getCharacterModel(): Model<ICharacter> {
  return Character;
}

export function getStaffModel(): Model<IStaff> {
  return Staff;
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

/**
 * Returns the target model to write new franchises to.
 * Automatically spills over to Vault 2 (Overflow) if Vault 1 is full!
 */
export async function getTargetFranchiseWriteModel(): Promise<Model<IFranchise>> {
  const isFull = await isPrimaryVaultFull();
  if (isFull && OverflowFranchise) {
    console.log('⚠️ [Multi-Vault Routing] Primary Vault full (>=480MB). Directing save to Vault 2 (Overflow)!');
    return OverflowFranchise;
  }
  return Franchise;
}

/**
 * Returns real-time connectivity status across all database vaults.
 */
export function getVaultHealthStatus() {
  const readyStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return {
    vault1Primary: readyStates[mongoose.connection.readyState] || 'unknown',
    vault2Overflow: overflowConnection ? (readyStates[overflowConnection.readyState] || 'unknown') : 'standby',
    vault3Realtime: realtimeConnection ? (readyStates[realtimeConnection.readyState] || 'unknown') : 'standby',
  };
}
