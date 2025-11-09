import { Client } from '@googlemaps/google-maps-services-js';

const client = new Client({});

export interface PlaceResult {
  placeId: string;
  formattedAddress: string;
  location: { lat: number; lng: number };
  name?: string;
}

export class PlacesResolver {
  private apiKey: string;
  private cache: Map<string, { result: PlaceResult; timestamp: number }>;
  private cacheTTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    this.cache = new Map();
  }

  async resolve(query: string, regionCode: string = 'US'): Promise<PlaceResult | null> {
    // Check cache
    const cached = this.cache.get(query);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.result;
    }

    try {
      const response = await client.findPlaceFromText({
        params: {
          input: query,
          inputtype: 'textquery',
          fields: ['place_id', 'formatted_address', 'geometry', 'name'],
          key: this.apiKey,
          region: regionCode
        },
        timeout: 5000
      });

      if (response.data.candidates && response.data.candidates.length > 0) {
        const candidate = response.data.candidates[0];
        const result: PlaceResult = {
          placeId: candidate.place_id!,
          formattedAddress: candidate.formatted_address || query,
          location: {
            lat: candidate.geometry!.location.lat,
            lng: candidate.geometry!.location.lng
          },
          name: candidate.name
        };

        // Cache result
        this.cache.set(query, { result, timestamp: Date.now() });
        return result;
      }

      return null;
    } catch (error: any) {
      console.error('Places resolution error:', error.message);
      return null; // Fallback to raw string
    }
  }

  /**
   * Find nearby places of a specific type
   * @param venueType - Type of venue to search for (e.g., "movie theater", "restaurant", "concert hall")
   * @param userLocation - User's location { lat, lng } or null to use a default location
   * @param radius - Search radius in meters (default: 5000 = 5km)
   */
  async findNearbyVenue(
    venueType: string,
    userLocation?: { lat: number; lng: number } | null,
    radius: number = 5000
  ): Promise<PlaceResult | null> {
    try {
      // Default to a central US location if no user location provided
      const location = userLocation || { lat: 37.7749, lng: -122.4194 }; // San Francisco default

      console.log(`[PlacesResolver] Finding nearby ${venueType} near ${location.lat}, ${location.lng}`);

      // Use nearby search to find places of a specific type
      const placeType = this.getPlaceType(venueType);
      const response = await client.placesNearby({
        params: {
          location: `${location.lat},${location.lng}`,
          radius: radius,
          type: placeType, // Map venue type to Google Places type
          key: this.apiKey
        },
        timeout: 5000
      });

      if (response.data.results && response.data.results.length > 0) {
        const place = response.data.results[0];
        
        // Get place details for formatted address
        let formattedAddress = place.vicinity || '';
        if (place.place_id) {
          try {
            const detailsResponse = await client.placeDetails({
              params: {
                place_id: place.place_id,
                fields: ['formatted_address', 'name'],
                key: this.apiKey
              },
              timeout: 3000
            });
            if (detailsResponse.data.result) {
              formattedAddress = detailsResponse.data.result.formatted_address || formattedAddress;
            }
          } catch (detailsError) {
            // If details fetch fails, use vicinity
            console.warn(`[PlacesResolver] Could not fetch place details: ${detailsError}`);
          }
        }
        
        const result: PlaceResult = {
          placeId: place.place_id!,
          formattedAddress: formattedAddress,
          location: {
            lat: place.geometry!.location.lat,
            lng: place.geometry!.location.lng
          },
          name: place.name
        };

        console.log(`[PlacesResolver] Found nearby ${venueType}: ${result.name} at ${result.formattedAddress}`);
        return result;
      }

      console.log(`[PlacesResolver] No nearby ${venueType} found`);
      return null;
    } catch (error: any) {
      console.error(`[PlacesResolver] Error finding nearby ${venueType}:`, error.message);
      return null;
    }
  }

  /**
   * Map venue type to Google Places API type
   */
  private getPlaceType(venueType: string): string | undefined {
    const typeMap: { [key: string]: string } = {
      'movie theater': 'movie_theater',
      'movie': 'movie_theater',
      'cinema': 'movie_theater',
      'movie trailer': 'movie_theater',
      'film': 'movie_theater',
      'restaurant': 'restaurant',
      'concert hall': 'establishment',
      'concert': 'establishment',
      'theater': 'establishment',
      'stadium': 'stadium',
      'sports': 'stadium',
      'conference center': 'establishment',
      'conference': 'establishment',
      'workshop space': 'establishment',
      'workshop': 'establishment',
      'festival': 'establishment',
      'bar': 'bar',
      'cafe': 'cafe',
      'coffee shop': 'cafe',
      'hotel': 'lodging',
      'museum': 'museum',
      'park': 'park',
      'gym': 'gym',
      'fitness': 'gym'
    };

    const lowerType = venueType.toLowerCase();
    for (const [key, value] of Object.entries(typeMap)) {
      if (lowerType.includes(key)) {
        return value;
      }
    }

    return 'establishment'; // Default fallback
  }
}

