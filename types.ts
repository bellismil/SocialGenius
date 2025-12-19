
export enum Tone {
  PROFESSIONAL = 'Professional',
  WITTY = 'Witty',
  URGENT = 'Urgent',
  INSPIRATIONAL = 'Inspirational',
  CTA = 'Call to Action',
  FRIENDLY = 'Friendly',
  EDUCATIONAL = 'Educational',
  CASUAL = 'Casual'
}

export enum Language {
  ENGLISH = 'English',
  SPANISH = 'Spanish',
  FRENCH = 'French',
  GERMAN = 'German',
  JAPANESE = 'Japanese',
  CHINESE = 'Chinese'
}

export type Platform = 'LinkedIn' | 'Twitter' | 'Instagram' | 'Facebook' | 'Email';

export type ImageSize = '1K' | '2K' | '4K';

export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export interface Feedback {
  rating: 'up' | 'down' | null;
  comment?: string;
}

export interface OnboardingData {
  businessName: string;
  natureOfBusiness: string;
  targetDemographic: string;
  keyLocation: string;
  brandValues: string;
  selectedPlatforms: Platform[];
}

export interface PostResult {
  id: string;
  platform: Platform;
  content: string;
  imageUrl?: string;
  aspectRatio: AspectRatio;
  loading: boolean;
  error?: string;
  feedback?: Feedback;
  suggestedTime?: string;
}

export interface ScheduledPost {
  id: string;
  postId: string;
  platform: Platform;
  content: string;
  imageUrl?: string;
  scheduledAt: string;
}

export interface GenerationConfig {
  idea: string;
  tone: Tone;
  language: Language;
  imageSize: ImageSize;
}

export interface ImageData {
  data: string; // base64
  mimeType: string;
}
