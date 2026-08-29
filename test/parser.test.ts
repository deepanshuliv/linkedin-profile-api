import { describe, it, expect } from 'vitest';
import { Normalizer } from '../src/linkedin/normalizer.js';
import { parseProfile } from '../src/linkedin/parser.js';
import fs from 'fs';
import path from 'path';

describe('Profile Parser', () => {
  it('should parse a full dash profile', () => {
    const rawData = fs.readFileSync(path.join(__dirname, 'fixtures/dash-full.json'), 'utf-8');
    const data = JSON.parse(rawData);

    const normalizer = new Normalizer(data);
    const profile = parseProfile(normalizer, 'testuser', 'dash');

    expect(profile.url).toBe('https://www.linkedin.com/in/testuser');
    expect(profile.publicIdentifier).toBe('testuser');
    expect(profile.name.full).toBe('Test User');
    expect(profile.headline).toBe('Software Engineer at Tech');
    expect(profile.location.name).toBe('San Francisco, CA');
    expect(profile.about).toBe('I am a software engineer.');
    
    // Image resolution
    expect(profile.profileImage).toEqual({
      url: 'https://media.licdn.com/dms/image/profile-pic-400.jpg',
      width: 400,
      height: 400
    });

    // Experience
    expect(profile.experience.length).toBe(1);
    expect(profile.experience[0].title).toBe('Software Engineer');
    expect(profile.experience[0].companyName).toBe('Tech Corp');
    expect(profile.experience[0].current).toBe(true);
    expect(profile.experience[0].start).toEqual({ year: 2020, month: 1, day: null });
    expect(profile.experience[0].end).toBe(null);

    // Education
    expect(profile.education.length).toBe(1);
    expect(profile.education[0].school).toBe('University of Tech');
    expect(profile.education[0].degree).toBe('B.S.');
    expect(profile.education[0].dates.start?.year).toBe(2016);
    expect(profile.education[0].dates.end?.year).toBe(2020);

    // Skills
    expect(profile.skills.length).toBe(1);
    expect(profile.skills[0].name).toBe('JavaScript');
    expect(profile.skills[0].endorsementCount).toBe(10);

    // Certifications
    expect(profile.certifications.length).toBe(1);
    expect(profile.certifications[0].name).toBe('AWS Certified');

    // Languages
    expect(profile.languages.length).toBe(1);
    expect(profile.languages[0].name).toBe('English');
    expect(profile.languages[0].proficiency).toBe('Native');

    // Meta
    expect(profile.meta.partial).toBe(false);
    expect(profile.meta.warnings.length).toBe(0);
  });

  it('should flag partial when sections are missing', () => {
    const rawData = fs.readFileSync(path.join(__dirname, 'fixtures/dash-full.json'), 'utf-8');
    const data = JSON.parse(rawData);
    
    // Remove experience
    data.included[0]['*profilePositionGroups'] = [];

    const normalizer = new Normalizer(data);
    const profile = parseProfile(normalizer, 'testuser', 'dash');

    expect(profile.meta.partial).toBe(true);
    expect(profile.meta.warnings).toContain('experience section missing or empty');
  });

  it('should flag partial when education is missing', () => {
    const rawData = fs.readFileSync(path.join(__dirname, 'fixtures/dash-full.json'), 'utf-8');
    const data = JSON.parse(rawData);
    data.included[0]['*educations'] = [];
    const normalizer = new Normalizer(data);
    const profile = parseProfile(normalizer, 'testuser', 'dash');
    expect(profile.meta.partial).toBe(true);
    expect(profile.meta.warnings).toContain('education section missing or empty');
  });

  it('should flag partial when skills are missing', () => {
    const rawData = fs.readFileSync(path.join(__dirname, 'fixtures/dash-full.json'), 'utf-8');
    const data = JSON.parse(rawData);
    data.included[0]['*skills'] = [];
    const normalizer = new Normalizer(data);
    const profile = parseProfile(normalizer, 'testuser', 'dash');
    expect(profile.meta.partial).toBe(true);
    expect(profile.meta.warnings).toContain('skills section missing or empty');
  });

  it('should not flag partial but add warning when certs are missing', () => {
    const rawData = fs.readFileSync(path.join(__dirname, 'fixtures/dash-full.json'), 'utf-8');
    const data = JSON.parse(rawData);
    data.included[0]['*certifications'] = [];
    const normalizer = new Normalizer(data);
    const profile = parseProfile(normalizer, 'testuser', 'dash');
    expect(profile.meta.partial).toBe(false); // Certs missing doesn't trigger partial
    expect(profile.meta.warnings).toContain('certifications section missing or empty');
  });

  it('should not flag partial but add warning when languages are missing', () => {
    const rawData = fs.readFileSync(path.join(__dirname, 'fixtures/dash-full.json'), 'utf-8');
    const data = JSON.parse(rawData);
    data.included[0]['*languages'] = [];
    const normalizer = new Normalizer(data);
    const profile = parseProfile(normalizer, 'testuser', 'dash');
    expect(profile.meta.partial).toBe(false); // Languages missing doesn't trigger partial
    expect(profile.meta.warnings).toContain('languages section missing or empty');
  });

  it('should handle missing image gracefully', () => {
    const rawData = fs.readFileSync(path.join(__dirname, 'fixtures/dash-full.json'), 'utf-8');
    const data = JSON.parse(rawData);
    delete data.included[0].picture;
    const normalizer = new Normalizer(data);
    const profile = parseProfile(normalizer, 'testuser', 'dash');
    expect(profile.profileImage).toBeNull();
  });

  it('should handle multiple positions and current position', () => {
    const rawData = fs.readFileSync(path.join(__dirname, 'fixtures/dash-full.json'), 'utf-8');
    const data = JSON.parse(rawData);
    
    // Add another position that ended
    data.included.push({
      "$type": "com.linkedin.voyager.dash.identity.profile.Position",
      "entityUrn": "urn:li:fsd_profilePosition:2222",
      "title": "Junior Software Engineer",
      "companyName": "Tech Corp",
      "description": "Coding smaller things",
      "timePeriod": {
        "startDate": { "year": 2018 },
        "endDate": { "year": 2020, "month": 1 }
      }
    });
    // Link it to the group
    data.included[1]['*positions'].push("urn:li:fsd_profilePosition:2222");

    const normalizer = new Normalizer(data);
    const profile = parseProfile(normalizer, 'testuser', 'dash');
    
    expect(profile.experience.length).toBe(2);
    expect(profile.experience[0].title).toBe('Software Engineer');
    expect(profile.experience[0].current).toBe(true);
    expect(profile.experience[1].title).toBe('Junior Software Engineer');
    expect(profile.experience[1].current).toBe(false);
    expect(profile.experience[1].end).toEqual({ year: 2020, month: 1, day: null });
  });
});
