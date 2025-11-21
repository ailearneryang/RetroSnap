export interface FilterConfig {
  id: string;
  name: string;
  cssFilter: string; // For the HTML preview
  canvasFilter: string; // For the Canvas context
  overlayColor?: string; // Optional color overlay
  vignette?: boolean; // Add vignette effect
  border?: string; // Special border logic (e.g., red border)
}

export interface PolaroidData {
  imageBlob: Blob | null;
  imageUrl: string | null;
  caption: string;
  date: string;
  filterId: string;
}

export enum AppState {
  IDLE = 'IDLE',
  CAMERA = 'CAMERA',
  PROCESSING = 'PROCESSING',
  REVIEW = 'REVIEW',
}

export type CaptionCategory = 'PORTRAIT' | 'SCENERY' | 'FOOD' | 'LIFE' | 'CREATIVE' | 'GENERAL';
