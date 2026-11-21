import mongoose, { Connection, Model } from 'mongoose';
import { config } from './index.js';
import { FranchiseSchema, IFranchise, Franchise } from '../models/Franchise.js';
import { CharacterSchema, ICharacter, Character } from '../models/Character.js';
import { StaffSchema, IStaff, Staff } from '../models/Staff.js';

let secondaryConnection: Connection | null = null;
let SecondaryFranchise: Model<IFranchise> | null = null;
let SecondaryCharacter: Model<ICharacter> | null = null;
let SecondaryStaff: Model<IStaff> | null = null;

export async function connectDatabase(): Promise<typeof mongoose> {
  if (!config.mongodb.uri) {
    throw new Error('MONGODB_URI is not set in environment configuration.');
  }

  mongoose.connection.on('connected', () => {
    console.log('🔥 MongoDB Atlas Primary Vault (AniNexus Alpha) Connected Successfully!');
  });

  mongoose.connection.on('error', (err) => {
    console.error('⚠️ Primary MongoDB Connection Error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ Primary MongoDB Disconnected. Awaiting reconnection...');
  });

  const primaryConn = await mongoose.connect(config.mongodb.uri, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4,
  });

  if (config.mongodb.secondaryUri) {
    try {
      secondaryConnection = mongoose.createConnection(config.mongodb.secondaryUri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        family: 4,
      });

      secondaryConnection.on('connected', () => {
        console.log('🏛️ MongoDB Atlas Secondary Vault (AniNexus Beta - 1024MB Dual Vault) Connected Successfully!');
      });

      secondaryConnection.on('error', (err) => {
        console.warn('⚠️ Secondary MongoDB Connection Warning:', err.message);
      });

      SecondaryFranchise = secondaryConnection.model<IFranchise>('Franchise', FranchiseSchema);
      SecondaryCharacter = secondaryConnection.model<ICharacter>('Character', CharacterSchema);
      SecondaryStaff = secondaryConnection.model<IStaff>('Staff', StaffSchema);
    } catch (err: any) {
      console.warn('Could not initialize secondary database connection:', err.message);
    }
  }

  return primaryConn;
}

export function getSecondaryConnection(): Connection | null {
  return secondaryConnection;
}

export function getSecondaryFranchiseModel(): Model<IFranchise> | null {
  return SecondaryFranchise;
}

export function getCharacterModel(): Model<ICharacter> {
  return SecondaryCharacter || Character;
}

export function getStaffModel(): Model<IStaff> {
  return SecondaryStaff || Staff;
}
