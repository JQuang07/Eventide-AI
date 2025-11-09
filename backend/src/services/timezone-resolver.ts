import { Client } from '@googlemaps/google-maps-services-js';

const client = new Client({});

export interface TimeZoneResult {
  timeZoneId: string;
  offsetSeconds: number;
}

export class TimeZoneResolver {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️  GOOGLE_MAPS_API_KEY is not set - timezone resolution will fail');
    }
  }

  async resolve(lat: number, lng: number, timestamp?: string): Promise<TimeZoneResult | null> {
    try {
      const time = timestamp ? new Date(timestamp).getTime() / 1000 : Math.floor(Date.now() / 1000);

      const response = await client.timezone({
        params: {
          location: { lat, lng },
          timestamp: time,
          key: this.apiKey
        },
        timeout: 3000
      });

      if (response.data.timeZoneId) {
        return {
          timeZoneId: response.data.timeZoneId,
          offsetSeconds: response.data.rawOffset + (response.data.dstOffset || 0)
        };
      }

      return null;
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.error('❌ Timezone resolution 403 error - Check that:');
        console.error('   1. Time Zone API is enabled in Google Cloud Console');
        console.error('   2. GOOGLE_MAPS_API_KEY is valid and has Time Zone API access');
        console.error('   3. API key restrictions allow Time Zone API');
        console.error(`   Error: ${error.message}`);
      } else {
        console.error('Timezone resolution error:', error.message);
      }
      return null; // Fallback to user's timezone
    }
  }
}

