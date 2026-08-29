export interface LinkedInProfileResponse {
  url: string;
  publicIdentifier: string;
  profileId: string | null;
  entityUrn: string | null;
  name: {
    first: string | null;
    last: string | null;
    full: string | null;
  };
  headline: string | null;
  location: {
    name: string | null;
    country: string | null;
    countryCode: string | null;
    geoUrn: string | null;
  };
  about: string | null;
  profileImage: {
    url: string | null;
    width: number | null;
    height: number | null;
  } | null;
  experience: Experience[];
  education: Education[];
  skills: Skill[];
  certifications: Certification[];
  languages: Language[];
  meta: {
    source: string; // 'dash' or 'graphql'
    partial: boolean; // true if core name exists but sections are missing
    warnings: string[]; // warnings about missing sections
  };
}

export interface Experience {
  title: string | null;
  companyName: string | null;
  companyUrn: string | null;
  companyLogoUrl: string | null;
  employmentType: string | null;
  location: string | null;
  description: string | null;
  current: boolean; // true if no end date
  start: DateInfo | null;
  end: DateInfo | null;
}

export interface Education {
  school: string | null;
  degree: string | null;
  fieldOfStudy: string | null;
  dates: {
    start: DateInfo | null;
    end: DateInfo | null;
  };
  description: string | null;
  logo: string | null;
}

export interface Skill {
  name: string;
  endorsementCount: number;
}

export interface Certification {
  name: string | null;
  issuer: string | null;
  credentialId: string | null;
  credentialUrl: string | null;
  issued: DateInfo | null;
  expires: DateInfo | null;
}

export interface Language {
  name: string;
  proficiency: string | null;
}

export interface DateInfo {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface VoyagerResponse {
  data: any;
  included: any[];
}

export interface LinkedInHttpResponse {
  ok: boolean;
  status: number;
  url: string;
  headers: { get(name: string): string | null };
  json(): Promise<any>;
  text(): Promise<string>;
}
