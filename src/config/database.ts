import mongoose, { Connection, Model } from 'mongoose';
import { config } from './index.js';
import { FranchiseSchema, IFranchise } from '../models/Franchise.js';

let secondaryConnection: Connection | null = null;
let SecondaryFranchise: Model<IFranchise> | null = null;

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
