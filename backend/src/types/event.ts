export interface CanonicalEvent {
  title: string;
  description?: string;
  startTime: string; // ISO8601
  endTime?: string; // ISO8601
  location?: {
    name: string;
    address?: string;
    placeId?: string;
    coordinates?: { lat: number; lng: number };
  };
  timezone: string;
  source: 'flyer' | 'url' | 'text' | 'email';
  sourceMetadata?: {
    imageUrl?: string;
    originalUrl?: string;
    extractedText?: string;
  };
  travelBufferMinutes?: number;
  conflicts?: Array<{ eventId: string; title: string; startTime: string }>;
}

export interface ExtractionRequest {
  type: 'image' | 'url' | 'text';
  data: string; // base64 image, URL string, or text content
  userLocation?: {
    lat: number;
    lng: number;
  };
}

export interface ExtractionResponse {
  event: CanonicalEvent;
  confidence?: number;
  rawExtraction?: any;
}

