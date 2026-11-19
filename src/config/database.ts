import mongoose from 'mongoose';
import { config } from './index.js';

export async function connectDatabase(): Promise<typeof mongoose> {
  if (!config.mongodb.uri) {
    throw new Error('MONGODB_URI is not set in environment configuration.');
  }

  mongoose.connection.on('connected', () => {
    console.log('🔥 MongoDB Atlas (AniNexus Vault) Connected Successfully!');
  });

  mongoose.connection.on('error', (err) => {
    console.error('⚠️ MongoDB Connection Error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB Disconnected. Awaiting reconnection...');
  });

  return mongoose.connect(config.mongodb.uri, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4,
  });
}
