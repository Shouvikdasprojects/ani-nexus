import { getCharacterModel, getStaffModel } from '../config/database.js';
import { ICharacter } from '../models/Character.js';
import { IStaff, ISocialLink } from '../models/Staff.js';

class CharacterStaffService {
  private anilistUrl = 'https://graphql.anilist.co';

  /**
   * Helper to slugify names
   */
  public slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Extract physical facts & attributes (Height, Birthday, Blood Type, Age) from markdown description
   */
  public parseCharacterPhysicalDetails(rawDesc: string | null | undefined, raw: any) {
    const desc = rawDesc || '';
    let height: string | null = null;
    let birthday: string | null = null;
    let age: string | null = raw.age ? String(raw.age) : null;
    let bloodType: string | null = raw.bloodType || null;
    let gender: string | null = raw.gender || null;

    // Height regex e.g. "Height: 179 cm (5'10")" or "**Height:** 179cm"
    const heightMatch = desc.match(/(?:Height|Tall):\s*([^\n\r]+)/i);
    if (heightMatch) {
      height = heightMatch[1].replace(/<[^>]*>/g, '').trim();
    }

    // Birthday fallback regex
    if (!birthday) {
      if (raw.dateOfBirth?.year || raw.dateOfBirth?.month) {
        const m = raw.dateOfBirth.month ? String(raw.dateOfBirth.month).padStart(2, '0') : null;
        const d = raw.dateOfBirth.day ? String(raw.dateOfBirth.day).padStart(2, '0') : null;
        const y = raw.dateOfBirth.year || null;
        birthday = y ? (m && d ? `${y}-${m}-${d}` : `${y}`) : (m && d ? `${m}-${d}` : null);
      } else {
        const bdayMatch = desc.match(/(?:Birthday|Birth Date|Born):\s*([^\n\r]+)/i);
        if (bdayMatch) birthday = bdayMatch[1].replace(/<[^>]*>/g, '').trim();
      }
    }

    // Age regex fallback
    if (!age) {
      const ageMatch = desc.match(/(?:Age):\s*([^\n\r]+)/i);
      if (ageMatch) age = ageMatch[1].replace(/<[^>]*>/g, '').trim();
    }

    // Blood type regex fallback
    if (!bloodType) {
      const bloodMatch = desc.match(/(?:Blood Type):\s*([^\n\r]+)/i);
      if (bloodMatch) bloodType = bloodMatch[1].replace(/<[^>]*>/g, '').trim();
    }

    // Gender fallback
    if (!gender) {
      const genderMatch = desc.match(/(?:Gender):\s*([^\n\r]+)/i);
      if (genderMatch) gender = genderMatch[1].replace(/<[^>]*>/g, '').trim();
    }

    return {
      height,
      birthday,
      age,
      bloodType,
      gender,
      about: desc,
    };
  }

  /**
   * Parse verified social & agency links from staff descriptions
   */
  public parseStaffSocials(description: string | null | undefined): ISocialLink[] {
    if (!description) return [];
    const socials: ISocialLink[] = [];
    const seenUrls = new Set<string>();

    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/gi;
    let match;

    while ((match = linkRegex.exec(description)) !== null) {
      const label = (match[1] || '').trim();
      const url = (match[2] || match[3] || '').trim();

      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      let platform = 'Official Website';
      const lowUrl = url.toLowerCase();

      if (lowUrl.includes('twitter.com') || lowUrl.includes('x.com')) platform = 'Twitter (X)';
      else if (lowUrl.includes('instagram.com')) platform = 'Instagram';
      else if (lowUrl.includes('youtube.com')) platform = 'YouTube';
      else if (lowUrl.includes('ameblo.jp') || lowUrl.includes('blog')) platform = 'Blog';
      else if (lowUrl.includes('bsky.app')) platform = 'Bluesky';
      else if (lowUrl.includes('ja.wikipedia.org')) platform = 'Wiki (jp)';
      else if (lowUrl.includes('en.wikipedia.org')) platform = 'Wiki (en)';
      else if (lowUrl.includes('facebook.com')) platform = 'Facebook';
      else if (lowUrl.includes('anison.info')) platform = 'Anison';
      else if (label) platform = label;

      socials.push({ platform, url });
    }

    return socials;
  }

  /**
   * Fetch single character from AniList GraphQL with full voice actors and appearances
   */
  public async fetchCharacterFromAniList(characterId: number): Promise<any | null> {
    const query = `
      query ($id: Int) {
        Character(id: $id) {
          id
          name {
            full
            native
            alternative
            alternativeSpoiler
          }
          image {
            large
          }
          description(asHtml: false)
          gender
          dateOfBirth {
            year
            month
            day
          }
          age
          bloodType
          favourites
          media(page: 1, perPage: 25, sort: [POPULARITY_DESC]) {
            pageInfo {
              total
            }
            edges {
              characterRole
              voiceActorRoles(sort: [RELEVANCE]) {
                voiceActor {
                  id
                  name {
                    full
                    native
                  }
                  languageV2
                  image {
                    large
                  }
                  homeTown
                  dateOfBirth { year month day }
                  description(asHtml: false)
                }
              }
              node {
                id
                type
                title {
                  english
                  romaji
                }
                format
                startDate { year }
                coverImage {
                  large
                }
              }
            }
          }
        }
      }
    `;

    try {
      const res = await fetch(this.anilistUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables: { id: characterId } }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) return null;
      const data = (await res.json()) as any;
      return data.data?.Character || null;
    } catch (err: any) {
      console.warn(`[AniList Char Query Error] ID ${characterId}:`, err.message);
      return null;
    }
  }

  /**
   * Fetch single staff/person from AniList GraphQL with full biography & roles
   */
  public async fetchStaffFromAniList(staffId: number): Promise<any | null> {
    const query = `
      query ($id: Int) {
        Staff(id: $id) {
          id
          name {
            full
            native
            alternative
          }
          image {
            large
          }
          description(asHtml: false)
          primaryOccupations
          gender
          dateOfBirth {
            year
            month
            day
          }
          dateOfDeath {
            year
            month
            day
          }
          age
          yearsActive
          homeTown
          bloodType
          favourites
          characterMedia(page: 1, perPage: 25, sort: [POPULARITY_DESC]) {
            edges {
              characterRole
              characters {
                id
                name { full }
                image { large }
              }
              node {
                id
                title { english romaji }
                startDate { year }
                format
              }
            }
          }
          staffMedia(page: 1, perPage: 25, sort: [POPULARITY_DESC]) {
            edges {
              staffRole
              node {
                id
                title { english romaji }
                startDate { year }
                format
              }
            }
          }
        }
      }
    `;

    try {
      const res = await fetch(this.anilistUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables: { id: staffId } }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) return null;
      const data = (await res.json()) as any;
      return data.data?.Staff || null;
    } catch (err: any) {
      console.warn(`[AniList Staff Query Error] ID ${staffId}:`, err.message);
      return null;
    }
  }

  /**
   * Save / Upsert Character into aninexusapidb2
   */
  public async saveCharacter(rawChar: any): Promise<ICharacter | null> {
    const CharacterModel = getCharacterModel();
    const characterId = rawChar.id || rawChar.characterId;
    if (!characterId) return null;

    const fullName = rawChar.name?.full || 'Unknown Character';
    const slug = `${this.slugify(fullName)}-${characterId}`;
    const physical = this.parseCharacterPhysicalDetails(rawChar.description, rawChar);

    // Extract Voice Actors
    const voiceActorsMap = new Map<number, any>();
    const animeAppearances: any[] = [];
    let primaryVoiceActor: any = null;

    if (rawChar.media?.edges && Array.isArray(rawChar.media.edges)) {
      for (const edge of rawChar.media.edges) {
        const mediaNode = edge.node;
        if (!mediaNode) continue;

        if (mediaNode.type === 'ANIME') {
          animeAppearances.push({
            mediaId: mediaNode.id,
            slug: this.slugify(mediaNode.title?.english || mediaNode.title?.romaji || `anime-${mediaNode.id}`),
            title: mediaNode.title?.english || mediaNode.title?.romaji || 'Untitled Anime',
            format: mediaNode.format || 'TV',
            role: edge.characterRole || 'SUPPORTING',
            year: mediaNode.startDate?.year || null,
            image: mediaNode.coverImage?.large || null,
          });
        }

        if (edge.voiceActorRoles && Array.isArray(edge.voiceActorRoles)) {
          for (const vaEdge of edge.voiceActorRoles) {
            const va = vaEdge.voiceActor;
            if (!va || voiceActorsMap.has(va.id)) continue;

            const vaObj = {
              actorId: va.id,
              name: {
                full: va.name?.full || 'Unknown Voice Actor',
                native: va.name?.native || null,
              },
              language: va.languageV2 || 'Japanese',
              image: va.image?.large || null,
              homeTown: va.homeTown || null,
              birthday: va.dateOfBirth?.year ? `${va.dateOfBirth.year}-${va.dateOfBirth.month}-${va.dateOfBirth.day}` : null,
              bio: va.description || null,
            };

            voiceActorsMap.set(va.id, vaObj);

            if (!primaryVoiceActor && vaObj.language === 'Japanese') {
              primaryVoiceActor = vaObj;
            }
          }
        }
      }
    }

    const voiceActors = Array.from(voiceActorsMap.values());
    if (!primaryVoiceActor && voiceActors.length > 0) {
      primaryVoiceActor = voiceActors[0];
    }

    const doc = await CharacterModel.findOneAndUpdate(
      { characterId },
      {
        characterId,
        slug,
        name: {
          full: fullName,
          native: rawChar.name?.native || null,
          alternative: rawChar.name?.alternative || [],
          alternativeSpoiler: rawChar.name?.alternativeSpoiler || [],
        },
        image: rawChar.image?.large || null,
        favourites: rawChar.favourites || 0,
        details: physical,
        primaryVoiceActor,
        voiceActors,
        animeAppearances,
        mediaCount: {
          anime: animeAppearances.length,
          manga: 0,
        },
        lastUpdated: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return doc;
  }

  /**
   * Save / Upsert Staff into aninexusapidb2
   */
  public async saveStaff(rawStaff: any): Promise<IStaff | null> {
    const StaffModel = getStaffModel();
    const staffId = rawStaff.id || rawStaff.staffId;
    if (!staffId) return null;

    const fullName = rawStaff.name?.full || 'Unknown Staff';
    const slug = `${this.slugify(fullName)}-${staffId}`;
    const socials = this.parseStaffSocials(rawStaff.description);

    const dob = rawStaff.dateOfBirth;
    const dobStr = dob?.year ? (dob.month && dob.day ? `${dob.year}-${String(dob.month).padStart(2, '0')}-${String(dob.day).padStart(2, '0')}` : `${dob.year}`) : null;

    const dod = rawStaff.dateOfDeath;
    const dodStr = dod?.year ? (dod.month && dod.day ? `${dod.year}-${String(dod.month).padStart(2, '0')}-${String(dod.day).padStart(2, '0')}` : `${dod.year}`) : null;

    // Roles compilation
    const roles: any[] = [];

    // Voice acting credits
    if (rawStaff.characterMedia?.edges && Array.isArray(rawStaff.characterMedia.edges)) {
      for (const edge of rawStaff.characterMedia.edges) {
        const mediaNode = edge.node;
        const char = edge.characters?.[0] || null;
        if (!mediaNode) continue;

        roles.push({
          mediaId: mediaNode.id,
          slug: this.slugify(mediaNode.title?.english || mediaNode.title?.romaji || `anime-${mediaNode.id}`),
          animeTitle: mediaNode.title?.english || mediaNode.title?.romaji || 'Untitled',
          year: mediaNode.startDate?.year || null,
          format: mediaNode.format || 'TV',
          role: `Voice Actor (${edge.characterRole || 'Character'})`,
          character: char
            ? {
                characterId: char.id,
                name: char.name?.full || null,
                image: char.image?.large || null,
                role: edge.characterRole || 'Main',
              }
            : null,
        });
      }
    }

    // Production staff credits (Director, Music, etc.)
    if (rawStaff.staffMedia?.edges && Array.isArray(rawStaff.staffMedia.edges)) {
      for (const edge of rawStaff.staffMedia.edges) {
        const mediaNode = edge.node;
        if (!mediaNode) continue;

        roles.push({
          mediaId: mediaNode.id,
          slug: this.slugify(mediaNode.title?.english || mediaNode.title?.romaji || `anime-${mediaNode.id}`),
          animeTitle: mediaNode.title?.english || mediaNode.title?.romaji || 'Untitled',
          year: mediaNode.startDate?.year || null,
          format: mediaNode.format || 'TV',
          role: edge.staffRole || 'Production Staff',
          character: null,
        });
      }
    }

    const doc = await StaffModel.findOneAndUpdate(
      { staffId },
      {
        staffId,
        slug,
        name: {
          full: fullName,
          native: rawStaff.name?.native || null,
          alternative: rawStaff.name?.alternative || [],
        },
        image: rawStaff.image?.large || null,
        favourites: rawStaff.favourites || 0,
        details: {
          birth: dobStr,
          death: dodStr,
          age: rawStaff.age || null,
          gender: rawStaff.gender || null,
          homeTown: rawStaff.homeTown || null,
          bloodType: rawStaff.bloodType || null,
          height: null,
          hobbies: null,
          primaryOccupations: rawStaff.primaryOccupations || [],
          yearsActive: rawStaff.yearsActive || [],
          bio: rawStaff.description || null,
        },
        socials,
        roles,
        lastUpdated: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return doc;
  }

  /**
   * Search characters
   */
  public async searchCharacters(q: string, limit: number = 20): Promise<any[]> {
    const CharacterModel = getCharacterModel();
    return CharacterModel.find({
      $or: [
        { 'name.full': { $regex: q, $options: 'i' } },
        { 'name.native': { $regex: q, $options: 'i' } },
        { 'name.alternative': { $regex: q, $options: 'i' } },
        { slug: { $regex: q, $options: 'i' } },
      ],
    })
      .sort({ favourites: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Search staff & voice actors
   */
  public async searchStaff(q: string, limit: number = 20): Promise<any[]> {
    const StaffModel = getStaffModel();
    return StaffModel.find({
      $or: [
        { 'name.full': { $regex: q, $options: 'i' } },
        { 'name.native': { $regex: q, $options: 'i' } },
        { 'name.alternative': { $regex: q, $options: 'i' } },
        { slug: { $regex: q, $options: 'i' } },
      ],
    })
      .sort({ favourites: -1 })
      .limit(limit)
      .lean();
  }
}

export const characterStaffService = new CharacterStaffService();
