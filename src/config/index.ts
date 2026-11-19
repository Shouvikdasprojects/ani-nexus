import dns from 'dns';
import dotenv from 'dotenv';

// Force reliable DNS servers for MongoDB SRV and external API resilience
dns.setServers(['8.8.8.8', '1.1.1.1']);
if (dns.setDefaultResultOrder) {
  try {
    dns.setDefaultResultOrder('ipv4first');
  } catch {}
}

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 5055,
  env: process.env.NODE_ENV || 'development',
  mongodb: {
    uri: process.env.MONGODB_URI || '',
  },
  tmdb: {
    apiKey: process.env.TMDB_API_KEY || '',
    readAccessToken: process.env.TMDB_READ_ACCESS_TOKEN || '',
    baseUrl: 'https://api.themoviedb.org/3',
    imageBaseUrl: 'https://image.tmdb.org/t/p/original',
  },
  mal: {
    keysPool: [
      process.env.MAL_KEY_1 || '',
      process.env.MAL_KEY_2 || '',
      process.env.MAL_KEY_3 || '',
      process.env.MAL_KEY_4 || '',
      process.env.MAL_KEY_5 || '',
    ].filter((k) => k.trim().length > 0),
    baseUrl: 'https://api.myanimelist.net/v2',
  },
  anilist: {
    graphqlUrl: 'https://graphql.anilist.co',
  },
  animethemes: {
    baseUrl: 'https://api.animethemes.moe',
  },
};
