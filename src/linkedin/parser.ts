import { Normalizer } from './normalizer.js';
import {
  LinkedInProfileResponse,
  Experience,
  Education,
  Skill,
  Certification,
  Language,
  DateInfo
} from './types.js';

export function parseProfile(
  normalizer: Normalizer,
  publicIdentifier: string,
  source: string
): LinkedInProfileResponse {
  const profile = normalizer.findPrimaryProfile(publicIdentifier);
  if (!profile) {
    throw new Error('Could not find primary profile in normalized data');
  }

  const warnings: string[] = [];

  // Basic Info
  const url = `https://www.linkedin.com/in/${publicIdentifier}`;
  const profileId = profile.entityUrn ? profile.entityUrn.split(':').pop() : null;
  const entityUrn = profile.entityUrn || null;

  const firstName = profile.firstName || null;
  const lastName = profile.lastName || null;
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || null;

  const headline = profile.headline || null;

  let about = profile.summary || null;
  // Dash sometimes places 'about' in a different object linked via *profileAbout
  if (!about && profile['*profileAbout']) {
    const aboutObj = normalizer.get(profile['*profileAbout']);
    if (aboutObj && aboutObj.summary) {
      about = aboutObj.summary;
    }
  }

  // Location
  const locationName = profile.locationName || null;
  const countryCode = profile.geoCountryName || null; // Might be in different fields based on graph/dash
  let country = null;
  let geoUrn = profile.geoUrn || null;

  // Image
  let profileImage = null;
  const pictureUrl = profile.picture || profile.profilePicture; // graph or dash
  if (pictureUrl && typeof pictureUrl === 'string') {
     profileImage = { url: pictureUrl, width: null, height: null }; // direct url case
  } else if (pictureUrl && pictureUrl.displayImageReference) {
      // Dash VectorImage handling
      const imgRefUrn = pictureUrl.displayImageReference['*elements']?.[0] || pictureUrl.displayImageReference;
      const imgRef = normalizer.get(imgRefUrn);
      if (imgRef && imgRef.rootUrl && Array.isArray(imgRef.artifacts)) {
          // Find largest artifact
          let largest = imgRef.artifacts[0];
          for (const a of imgRef.artifacts) {
              if (a.width > (largest.width || 0)) {
                  largest = a;
              }
          }
          if (largest) {
              profileImage = {
                  url: `${imgRef.rootUrl}${largest.fileIdentifyingUrlPathSegment}`,
                  width: largest.width,
                  height: largest.height
              };
          }
      }
  } else if (pictureUrl && pictureUrl['displayImage~']) {
      // GraphQL VectorImage handling
      const imgObj = pictureUrl['displayImage~'];
      if (imgObj && imgObj.elements && Array.isArray(imgObj.elements)) {
          let largest = imgObj.elements[0];
          for (const a of imgObj.elements) {
              if (a.data?.['com.linkedin.digitalmedia.mediaartifact.StillImage']?.displaySize?.width > 
                  (largest.data?.['com.linkedin.digitalmedia.mediaartifact.StillImage']?.displaySize?.width || 0)) {
                  largest = a;
              }
          }
          if (largest && largest.identifiers && largest.identifiers[0]) {
              profileImage = {
                  url: largest.identifiers[0].identifier,
                  width: largest.data?.['com.linkedin.digitalmedia.mediaartifact.StillImage']?.displaySize?.width || null,
                  height: largest.data?.['com.linkedin.digitalmedia.mediaartifact.StillImage']?.displaySize?.height || null
              };
          }
      }
  }


  // Helper to resolve lists linked from the profile
  const getLinkedItems = (key: string): any[] => {
    const refs = profile[key] || profile[`*${key}`];
    if (Array.isArray(refs)) {
      return refs.map(urn => normalizer.get(urn)).filter(Boolean);
    }
    // Dash often points to a collection via *profileX => collection => *elements
    if (refs && typeof refs === 'string') {
        const collection = normalizer.get(refs);
        if (collection && Array.isArray(collection['*elements'])) {
            return collection['*elements'].map((urn: string) => normalizer.get(urn)).filter(Boolean);
        }
        if (collection && Array.isArray(collection.elements)) {
            return collection.elements; // GraphQL structure often embeds them
        }
    }
    
    // GraphQL fallback for cards
    if (profile[`${key}View`]) {
      const view = profile[`${key}View`];
      if (view.elements && Array.isArray(view.elements)) {
         return view.elements;
      }
    }
    return [];
  };

  const toDateInfo = (dateObj: any): DateInfo | null => {
    if (!dateObj) return null;
    return {
      year: dateObj.year || null,
      month: dateObj.month || null,
      day: dateObj.day || null
    };
  };

  // Experience
  let rawPositions = getLinkedItems('profilePositionGroups')
  if (rawPositions.length === 0) {
      rawPositions = getLinkedItems('positionGroupView'); // GraphQL
  }
  if (rawPositions.length === 0) {
      rawPositions = getLinkedItems('positions');
  }
  
  const experience: Experience[] = [];
  let experienceMissing = true;

  if (rawPositions.length > 0) {
      experienceMissing = false;
      for (const posGroup of rawPositions) {
          // Dash uses profilePositionGroups -> positions
          let positions = [];
          if (posGroup['*positions']) {
              positions = posGroup['*positions'].map((u: string) => normalizer.get(u)).filter(Boolean);
          } else if (posGroup['profilePositions']) {
              positions = Array.isArray(posGroup['profilePositions']) 
                  ? posGroup['profilePositions'].map((u: string) => normalizer.get(u)).filter(Boolean)
                  : posGroup['profilePositions'].elements; // graphql
          } else if (posGroup.positions) {
              positions = posGroup.positions;
          } else {
             // Single position
             positions = [posGroup];
          }

          for (const pos of positions) {
             experience.push({
                 title: pos.title || null,
                 companyName: pos.companyName || posGroup.name || null,
                 companyUrn: pos.companyUrn || posGroup.entityUrn || null,
                 companyLogoUrl: null, // simplified for now
                 employmentType: pos.employmentType || null,
                 location: pos.locationName || null,
                 description: pos.description || null,
                 current: pos.timePeriod && pos.timePeriod.endDate ? false : true,
                 start: toDateInfo(pos.timePeriod?.startDate),
                 end: toDateInfo(pos.timePeriod?.endDate)
             });
          }
      }
  }

  // Education
  let rawEducation = getLinkedItems('educations');
  if (rawEducation.length === 0) {
     rawEducation = getLinkedItems('educationView');
  }
  const education: Education[] = [];
  let educationMissing = true;
  if (rawEducation.length > 0) {
      educationMissing = false;
      for (const edu of rawEducation) {
          education.push({
              school: edu.schoolName || null,
              degree: edu.degreeName || null,
              fieldOfStudy: edu.fieldOfStudy || null,
              dates: {
                  start: toDateInfo(edu.timePeriod?.startDate),
                  end: toDateInfo(edu.timePeriod?.endDate)
              },
              description: edu.description || null,
              logo: null
          });
      }
  }


  // Skills
  let rawSkills = getLinkedItems('skills');
  if (rawSkills.length === 0) {
     rawSkills = getLinkedItems('skillView');
  }
  const skills: Skill[] = [];
  let skillsMissing = true;
  if (rawSkills.length > 0) {
      skillsMissing = false;
      for (const skill of rawSkills) {
          skills.push({
              name: skill.name || '',
              endorsementCount: skill.endorsementCount || 0
          });
      }
  }


  // Certifications
  let rawCerts = getLinkedItems('certifications');
  if (rawCerts.length === 0) {
     rawCerts = getLinkedItems('certificationView');
  }
  const certifications: Certification[] = [];
  let certsMissing = true;
  if (rawCerts.length > 0) {
      certsMissing = false;
      for (const cert of rawCerts) {
          certifications.push({
              name: cert.name || null,
              issuer: cert.authority || cert.company?.name || null,
              credentialId: cert.number || cert.licenseNumber || null,
              credentialUrl: cert.url || cert.displaySource || null,
              issued: toDateInfo(cert.timePeriod?.startDate),
              expires: toDateInfo(cert.timePeriod?.endDate)
          });
      }
  }


  // Languages
  let rawLanguages = getLinkedItems('languages');
  if (rawLanguages.length === 0) {
     rawLanguages = getLinkedItems('languageView');
  }
  const languages: Language[] = [];
  let languagesMissing = true;
  if (rawLanguages.length > 0) {
      languagesMissing = false;
      for (const lang of rawLanguages) {
          languages.push({
              name: lang.name || '',
              proficiency: lang.proficiency || null
          });
      }
  }

  if (experienceMissing) warnings.push('experience section missing or empty');
  if (educationMissing) warnings.push('education section missing or empty');
  if (skillsMissing) warnings.push('skills section missing or empty');
  if (certsMissing) warnings.push('certifications section missing or empty');
  if (languagesMissing) warnings.push('languages section missing or empty');

  const partial = experienceMissing || educationMissing || skillsMissing;

  return {
    url,
    publicIdentifier,
    profileId,
    entityUrn,
    name: {
      first: firstName,
      last: lastName,
      full: fullName
    },
    headline,
    location: {
      name: locationName,
      country,
      countryCode,
      geoUrn
    },
    about,
    profileImage,
    experience,
    education,
    skills,
    certifications,
    languages,
    meta: {
      source,
      partial,
      warnings
    }
  };
}
