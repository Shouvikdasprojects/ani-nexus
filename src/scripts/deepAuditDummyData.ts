import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

import mongoose from 'mongoose';
import {
  connectDatabase,
  getCharacterModel,
  getStaffModel,
  getMangaModel,
  getNewsModel,
} from '../config/database.js';
import { Franchise } from '../models/Franchise.js';

async function audit() {
  await connectDatabase();

  const MangaModel = getMangaModel();
  const CharModel = getCharacterModel();
  const StaffModel = getStaffModel();
  const NewsModel = getNewsModel();

  console.log('=== AUDITING FOR GENUINE VS DUMMY ENTRIES ===');

  // 1. Franchise Check
  const totalFranchises = await Franchise.countDocuments();
  const emptyFranchiseTitles = await Franchise.countDocuments({
    $and: [
      { 'titles.english': { $in: [null, ''] } },
      { 'titles.romaji': { $in: [null, ''] } },
      { 'titles.primary': { $in: [null, ''] } },
    ]
  });
  const mockFranchises = await Franchise.find({
    slug: { $in: ['test', 'dummy', 'sample', 'placeholder', 'demo'] }
  }).lean();

  // 2. Manga Check
  const totalManga = await MangaModel.countDocuments();
  const emptyMangaTitles = await MangaModel.countDocuments({
    $and: [
      { 'titles.english': { $in: [null, ''] } },
      { 'titles.romaji': { $in: [null, ''] } },
      { 'titles.primary': { $in: [null, ''] } },
    ]
  });
  const mockManga = await MangaModel.find({
    slug: { $in: ['test', 'dummy', 'sample', 'placeholder', 'demo', 'test-manga'] }
  }).lean();

  // 3. Characters Check
  const totalChars = await CharModel.countDocuments();
  const emptyCharNames = await CharModel.countDocuments({
    $and: [
      { 'name.full': { $in: [null, ''] } },
      { 'name.native': { $in: [null, ''] } },
    ]
  });
  const mockChars = await CharModel.find({
    slug: { $in: ['test', 'dummy', 'sample', 'placeholder', 'test-char'] }
  }).lean();

  // 4. Staff Check
  const totalStaff = await StaffModel.countDocuments();
  const emptyStaffNames = await StaffModel.countDocuments({
    $and: [
      { 'name.full': { $in: [null, ''] } },
      { 'name.native': { $in: [null, ''] } },
    ]
  });
  const mockStaff = await StaffModel.find({
    slug: { $in: ['test', 'dummy', 'sample', 'placeholder', 'test-staff'] }
  }).lean();

  // 5. News Check
  const totalNews = await NewsModel.countDocuments();
  const emptyNews = await NewsModel.countDocuments({
    title: { $in: [null, ''] }
  });

  const report = {
    franchises: {
      total: totalFranchises,
      emptyTitles: emptyFranchiseTitles,
      mockEntriesFound: mockFranchises.length,
      sampleMocks: mockFranchises
    },
    manga: {
      total: totalManga,
      emptyTitles: emptyMangaTitles,
      mockEntriesFound: mockManga.length,
      sampleMocks: mockManga
    },
    characters: {
      total: totalChars,
      emptyNames: emptyCharNames,
      mockEntriesFound: mockChars.length,
      sampleMocks: mockChars
    },
    staff: {
      total: totalStaff,
      emptyNames: emptyStaffNames,
      mockEntriesFound: mockStaff.length,
      sampleMocks: mockStaff
    },
    news: {
      total: totalNews,
      emptyTitles: emptyNews
    }
  };

  console.log('___AUDIT_RESULT_START___');
  console.log(JSON.stringify(report, null, 2));
  console.log('___AUDIT_RESULT_END___');

  process.exit(0);
}

audit().catch(e => {
  console.error(e);
  process.exit(1);
});
