import express from 'express';
import { GeminiExtractor } from '../services/gemini-extractor';
import { PlacesResolver } from '../services/places-resolver';
import { TimeZoneResolver } from '../services/timezone-resolver';
import { UrlExpander } from '../services/url-expander';
import { CalendarService } from '../services/calendar-service';
import { VideoFrameExtractor } from '../services/video-frame-extractor';
import { AudioTranscriber } from '../services/audio-transcriber';
import { QRCodeExtractor } from '../services/qr-code-extractor';
import { CanonicalEvent } from '../types/event';

const router = express.Router();
const geminiExtractor = new GeminiExtractor();
const placesResolver = new PlacesResolver();
const timezoneResolver = new TimeZoneResolver();
const urlExpander = new UrlExpander();
const calendarService = new CalendarService();

router.post('/', async (req, res, next) => {
  try {
    const { type, data, userLocation } = req.body;

    if (!type || !data) {
      return res.status(400).json({ error: 'Missing type or data' });
    }

    let extracted: any;
    let sourceMetadata: any = {};

    // Step 1: Extract event info based on input type
    let qrCodeUrl: string | null = null;
    
    if (type === 'image') {
      // Extract QR code from image (in parallel with Gemini extraction for better performance)
      const qrCodeExtractor = new QRCodeExtractor();
      const [qrCodeResult, extractedResult] = await Promise.all([
        qrCodeExtractor.extractFromBase64(data).catch(err => {
          console.warn('[Extract] QR code extraction failed:', err.message);
          return null;
        }),
        geminiExtractor.extractFromImage(data)
      ]);
      
      qrCodeUrl = qrCodeResult;
      extracted = extractedResult;
      sourceMetadata.imageUrl = data.substring(0, 100); // Store reference
      if (qrCodeUrl) {
        sourceMetadata.qrCodeUrl = qrCodeUrl;
        console.log(`[Extract] QR code found in image: ${qrCodeUrl}`);
      }
    } else if (type === 'url') {
      // Stage 1: Parse metadata/description in parallel with video extraction
      const metadataPromise = urlExpander.expand(data);
      sourceMetadata.originalUrl = data;
      
      // Check if URL is a video
      const isVideo = isVideoUrl(data);
      
      if (isVideo) {
        try {
          console.log('[Extract] Detected video URL, processing in stages...');
          const videoFrameExtractor = new VideoFrameExtractor();
          const audioTranscriber = new AudioTranscriber();
          
          // Stage 1: Extract frames, audio, and metadata ALL IN PARALLEL
          console.log('[Extract] Stage 1: Extracting frames, audio, and metadata in parallel...');
          const [videoResult, metadata] = await Promise.all([
            videoFrameExtractor.extractFrames(data, 5, true), // Extract both frames and audio
            metadataPromise
          ]);
          
          sourceMetadata.imageUrl = metadata.imageUrl;
          sourceMetadata.videoFramesExtracted = videoResult.frames.length;
          sourceMetadata.hasAudio = !!videoResult.audioPath;
          
          // Extract QR codes from video frames
          if (videoResult.frames.length > 0) {
            console.log(`[Extract] Attempting QR code extraction from ${Math.min(3, videoResult.frames.length)} video frames...`);
            const qrCodeExtractor = new QRCodeExtractor();
            // Try to extract QR code from first few frames
            for (let i = 0; i < Math.min(3, videoResult.frames.length); i++) {
              const frame = videoResult.frames[i];
              console.log(`[Extract] Checking frame ${i + 1} for QR code...`);
              const frameQrCode = await qrCodeExtractor.extractFromBase64(frame.base64).catch(err => {
                console.warn(`[Extract] QR code extraction failed for frame ${i + 1}:`, err.message);
                return null;
              });
              if (frameQrCode) {
                qrCodeUrl = frameQrCode;
                sourceMetadata.qrCodeUrl = qrCodeUrl;
                console.log(`[Extract] ✓ Found QR code in video frame ${i + 1}: ${qrCodeUrl}`);
                break; // Use first QR code found
              }
            }
            if (!qrCodeUrl) {
              console.log(`[Extract] No QR code found in video frames`);
            }
          }
          
          // Stage 2: Process ALL 3 sources IN PARALLEL (frames, audio, description)
          console.log('[Extract] Stage 2: Processing frames, audio, and description in parallel...');
          const [frameAnalyses, transcription, descriptionAnalysis] = await Promise.all([
            // Analyze frames with Gemini Vision (with timeout)
            videoResult.frames.length > 0
              ? Promise.race([
                  geminiExtractor.extractFromVideoFrames(videoResult.frames.map(f => f.base64)),
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Frame analysis timeout')), 15000)
                  )
                ]).catch(err => {
                  console.warn('[Extract] Frame analysis failed or timed out:', err.message);
                  return { title: '', date: '', description: '', location: '', eventType: '', venueType: '' } as any;
                }) as Promise<any>
              : Promise.resolve({ title: '', date: '', description: '', location: '', eventType: '', venueType: '' } as any),
            
            // Transcribe audio (first 2 minutes, fast) with timeout
            videoResult.audioPath
              ? Promise.race([
                  audioTranscriber.transcribe(videoResult.audioPath)
                    .then(t => {
                      // Clean up audio file after transcription
                      if (videoResult.audioPath) {
                        videoFrameExtractor.cleanupAudio(videoResult.audioPath).catch(() => {});
                      }
                      return t;
                    }),
                  new Promise<string>((_, reject) => 
                    setTimeout(() => reject(new Error('Transcription timeout')), 20000)
                  )
                ]).catch(err => {
                  console.warn('[Extract] Audio transcription failed or timed out:', err.message);
                  // Clean up audio file on timeout
                  if (videoResult.audioPath) {
                    videoFrameExtractor.cleanupAudio(videoResult.audioPath).catch(() => {});
                  }
                  return '';
                })
              : Promise.resolve(''),
            
            // Parse description/metadata (with timeout)
            Promise.race([
              (async () => {
                const descText = `${metadata.title || ''} ${metadata.description || ''}`.trim();
                if (descText) {
                  return await geminiExtractor.extractFromText(descText);
                }
                return { title: '', date: '', description: '', location: '', eventType: '', venueType: '' } as any;
              })(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Description parsing timeout')), 10000)
              )
            ]).catch(err => {
              console.warn('[Extract] Description parsing failed or timed out:', err.message);
              return { title: '', date: '', description: '', location: '', eventType: '', venueType: '' } as any;
            }) as Promise<any>
          ]);
          
          console.log(`[Extract] Stage 2 complete - Frame analysis: ${frameAnalyses.title ? '✓' : '✗'}, Transcription: ${transcription.length} chars, Description: ${descriptionAnalysis.title ? '✓' : '✗'}`);
          console.log(`[Extract] Frame analysis details - title: ${frameAnalyses.title || 'NONE'}, date: ${frameAnalyses.date || 'NONE'}, eventType: ${frameAnalyses.eventType || 'NONE'}, venueType: ${frameAnalyses.venueType || 'NONE'}`);
          console.log(`[Extract] Description analysis details - title: ${descriptionAnalysis.title || 'NONE'}, date: ${descriptionAnalysis.date || 'NONE'}, eventType: ${descriptionAnalysis.eventType || 'NONE'}, venueType: ${descriptionAnalysis.venueType || 'NONE'}`);
          
          sourceMetadata.transcription = transcription ? transcription.substring(0, 500) : undefined;
          sourceMetadata.frameAnalyses = {
            title: frameAnalyses.title,
            date: frameAnalyses.date,
            time: frameAnalyses.time,
            location: frameAnalyses.location
          };
          
          // Stage 3: Combine all sources and extract
          console.log('[Extract] Stage 3: Combining all sources and extracting final event...');
          const combinedText = [
            metadata.title || '',
            metadata.description || '',
            transcription,
            frameAnalyses.title || '',
            frameAnalyses.date || '',
            frameAnalyses.time || '',
            frameAnalyses.location || '',
            frameAnalyses.description || '',
            descriptionAnalysis.title || '',
            descriptionAnalysis.date || '',
            descriptionAnalysis.time || '',
            descriptionAnalysis.location || '',
            descriptionAnalysis.description || '',
            data
          ].filter(Boolean).join(' ');
          
          // Prioritize frame analysis if it has complete info (title + date)
          // Frame analysis is more likely to have eventType/venueType for videos
          if (frameAnalyses.title && frameAnalyses.date) {
            extracted = frameAnalyses;
            console.log('[Extract] Using frame analysis (complete)');
            console.log(`[Extract] Frame analysis eventType: ${frameAnalyses.eventType || 'NOT SET'}, venueType: ${frameAnalyses.venueType || 'NOT SET'}`);
            
            // Merge in any missing fields from description analysis (but don't override eventType/venueType)
            if (descriptionAnalysis.title && descriptionAnalysis.date) {
              if (!extracted.description && descriptionAnalysis.description) {
                extracted.description = descriptionAnalysis.description;
              }
              if (!extracted.time && descriptionAnalysis.time) {
                extracted.time = descriptionAnalysis.time;
              }
              if (!extracted.endTime && descriptionAnalysis.endTime) {
                extracted.endTime = descriptionAnalysis.endTime;
              }
            }
          } else if (descriptionAnalysis.title && descriptionAnalysis.date) {
            extracted = descriptionAnalysis;
            // For all-day events, ignore endTime with time component
            if (!extracted.time && extracted.endTime) {
              console.log('[Extract] All-day event detected, removing endTime with time component');
              extracted.endTime = undefined;
            }
            console.log('[Extract] Using description analysis (complete)');
            console.log(`[Extract] Description analysis eventType: ${descriptionAnalysis.eventType || 'NOT SET'}, venueType: ${descriptionAnalysis.venueType || 'NOT SET'}`);
            
            // Try to get eventType/venueType from frame analysis even if it's incomplete
            if (frameAnalyses.eventType && !extracted.eventType) {
              extracted.eventType = frameAnalyses.eventType;
              console.log(`[Extract] Preserved eventType from frame analysis: ${extracted.eventType}`);
            }
            if (frameAnalyses.venueType && !extracted.venueType) {
              extracted.venueType = frameAnalyses.venueType;
              console.log(`[Extract] Preserved venueType from frame analysis: ${extracted.venueType}`);
            }
          } else {
            // Use combined extraction (frames + transcription + metadata + description)
            console.log('[Extract] Using combined extraction (all sources)');
            extracted = await geminiExtractor.extractFromText(combinedText);
            // For all-day events, ignore endTime with time component
            if (!extracted.time && extracted.endTime) {
              console.log('[Extract] All-day event detected, removing endTime with time component');
              extracted.endTime = undefined;
            }
            console.log(`[Extract] Combined extraction eventType: ${extracted.eventType || 'NOT SET'}, venueType: ${extracted.venueType || 'NOT SET'}`);
            
            // Try to get eventType/venueType from frame analysis
            if (frameAnalyses.eventType && !extracted.eventType) {
              extracted.eventType = frameAnalyses.eventType;
              console.log(`[Extract] Preserved eventType from frame analysis: ${extracted.eventType}`);
            }
            if (frameAnalyses.venueType && !extracted.venueType) {
              extracted.venueType = frameAnalyses.venueType;
              console.log(`[Extract] Preserved venueType from frame analysis: ${extracted.venueType}`);
            }
          }
        } catch (error: any) {
          console.error('[Extract] Video extraction failed:', error.message);
          // Fall back to metadata-only extraction
          const metadata = await metadataPromise;
          const textToExtract = `${metadata.title || ''} ${metadata.description || ''} ${data}`;
          extracted = await geminiExtractor.extractFromText(textToExtract);
        }
      } else {
        // Not a video URL, use standard text extraction
        const metadata = await metadataPromise;
        sourceMetadata.imageUrl = metadata.imageUrl;
        const textToExtract = `${metadata.title || ''} ${metadata.description || ''} ${data}`;
        extracted = await geminiExtractor.extractFromText(textToExtract);
      }
    } else if (type === 'text') {
      extracted = await geminiExtractor.extractFromText(data);
      sourceMetadata.extractedText = data.substring(0, 500);
    } else {
      return res.status(400).json({ error: 'Invalid type. Must be image, url, or text' });
    }

    // Step 2: Resolve location with context awareness
    let location: any = null;
    let timezone = 'America/Los_Angeles'; // Default fallback

    // Get user location from request body (sent from mobile app)
    const userLocationCoords: { lat: number; lng: number } | null = userLocation 
      ? { lat: userLocation.lat, lng: userLocation.lng }
      : null;

    // Debug: Log extracted values
    console.log(`[Extract] Extracted eventType: ${extracted.eventType || 'NOT SET'}`);
    console.log(`[Extract] Extracted venueType: ${extracted.venueType || 'NOT SET'}`);
    console.log(`[Extract] Extracted location: ${extracted.location || 'NOT SET'}`);

    if (extracted.location && extracted.location.trim()) {
      // Explicit location mentioned - check if it contains an address
      const locationStr = extracted.location.trim();
      
      // Check if location string looks like an address (contains numbers, street indicators, etc.)
      const hasAddressPattern = /\d+/.test(locationStr) && (
        /\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|circle|ct|plaza|pl)\b/i.test(locationStr) ||
        /,\s*[A-Z]{2}\s*\d{5}/.test(locationStr) || // City, ST ZIP pattern
        /\d+\s+[A-Za-z]+/.test(locationStr) // Number followed by street name
      );
      
      if (hasAddressPattern) {
        // Location contains an explicit address - use it as source of truth
        console.log(`[Extract] Location contains explicit address: "${locationStr}"`);
        try {
          // Try to resolve the address to get coordinates and placeId
          const placeResult = await placesResolver.resolve(locationStr);
          if (placeResult) {
            location = {
              name: placeResult.name || locationStr.split(',')[0].trim(), // Extract name if available, otherwise first part
              address: placeResult.formattedAddress || locationStr, // Use formatted address or original
              placeId: placeResult.placeId,
              coordinates: placeResult.location
            };

            // Resolve timezone from coordinates
            const tzResult = await timezoneResolver.resolve(
              placeResult.location.lat,
              placeResult.location.lng
            );
            if (tzResult) {
              timezone = tzResult.timeZoneId;
            }
            console.log(`[Extract] ✓ Resolved address: ${location.name} at ${location.address}`);
          } else {
            // Address couldn't be resolved, but use it as-is since it's explicit
            location = {
              name: locationStr.split(',')[0].trim(),
              address: locationStr
            };
            console.log(`[Extract] Using explicit address as-is: ${locationStr}`);
          }
        } catch (error) {
          // If resolution fails, use the address as-is since it's explicit
          location = {
            name: locationStr.split(',')[0].trim(),
            address: locationStr
          };
          console.log(`[Extract] Using explicit address as-is (resolution failed): ${locationStr}`);
        }
      } else {
        // Location is just a name (no explicit address) - try to resolve it
        console.log(`[Extract] Location is a name (no explicit address): "${locationStr}"`);
        try {
          const placeResult = await placesResolver.resolve(locationStr);
          if (placeResult) {
            location = {
              name: placeResult.name || locationStr,
              address: placeResult.formattedAddress,
              placeId: placeResult.placeId,
              coordinates: placeResult.location
            };

            // Resolve timezone from coordinates
            const tzResult = await timezoneResolver.resolve(
              placeResult.location.lat,
              placeResult.location.lng
            );
            if (tzResult) {
              timezone = tzResult.timeZoneId;
            }
            console.log(`[Extract] ✓ Resolved name to location: ${location.name} at ${location.address}`);
          } else {
            // Name couldn't be resolved - use raw string
            location = {
              name: locationStr
            };
            console.log(`[Extract] Could not resolve name, using as-is: ${locationStr}`);
          }
        } catch (error) {
          // If resolution fails, just use the raw location string
          location = {
            name: locationStr
          };
          console.log(`[Extract] Error resolving name, using as-is: ${locationStr}`);
        }
      }
    } else {
      // No explicit location - try to infer from event type or venue type
      let venueTypeToSearch = extracted.venueType?.trim();
      
      // Fallback: if eventType is set but venueType is missing, infer venueType
      if (!venueTypeToSearch && extracted.eventType) {
        const eventTypeLower = extracted.eventType.toLowerCase();
        if (eventTypeLower.includes('movie') || eventTypeLower.includes('film') || eventTypeLower.includes('cinema')) {
          venueTypeToSearch = 'movie theater';
          console.log(`[Extract] Inferred venueType 'movie theater' from eventType '${extracted.eventType}'`);
        } else if (eventTypeLower.includes('concert') || eventTypeLower.includes('music')) {
          venueTypeToSearch = 'concert hall';
          console.log(`[Extract] Inferred venueType 'concert hall' from eventType '${extracted.eventType}'`);
        } else if (eventTypeLower.includes('sport')) {
          venueTypeToSearch = 'stadium';
          console.log(`[Extract] Inferred venueType 'stadium' from eventType '${extracted.eventType}'`);
        } else if (eventTypeLower.includes('restaurant') || eventTypeLower.includes('dining')) {
          venueTypeToSearch = 'restaurant';
          console.log(`[Extract] Inferred venueType 'restaurant' from eventType '${extracted.eventType}'`);
        }
      }
      
      if (venueTypeToSearch) {
        // No explicit location, but we know the venue type
        console.log(`[Extract] No explicit location, but venue type is: ${venueTypeToSearch}`);
        console.log(`[Extract] Event type: ${extracted.eventType || 'not set'}`);
        console.log(`[Extract] Title: ${extracted.title || 'not set'}`);
        
        // First, try to resolve the title as a specific venue name
        // This is especially important for restaurants where the title might be the restaurant name
        let resolvedFromTitle = false;
        if (extracted.title && extracted.title.trim()) {
          // For restaurants and venues, the title is often the venue name
          // Try to resolve it as a place first
          console.log(`[Extract] Attempting to resolve title "${extracted.title}" as a specific venue...`);
          try {
            const titlePlaceResult = await placesResolver.resolve(extracted.title);
            if (titlePlaceResult) {
              // Check if the resolved place matches the venue type
              // For restaurants, we can be more lenient - if we found a place, use it
              // The Google Places API will return appropriate results
              location = {
                name: titlePlaceResult.name || extracted.title,
                address: titlePlaceResult.formattedAddress,
                placeId: titlePlaceResult.placeId,
                coordinates: titlePlaceResult.location
              };

              // Resolve timezone from coordinates
              const tzResult = await timezoneResolver.resolve(
                titlePlaceResult.location.lat,
                titlePlaceResult.location.lng
              );
              if (tzResult) {
                timezone = tzResult.timeZoneId;
              }

              console.log(`[Extract] ✓ Resolved title as specific venue: ${location.name} at ${location.address}`);
              resolvedFromTitle = true;
            } else {
              console.log(`[Extract] Could not resolve title "${extracted.title}" as a specific venue`);
            }
          } catch (error: any) {
            console.log(`[Extract] Error resolving title as venue: ${error.message}`);
          }
        }
        
        // If we couldn't resolve from title, fall back to finding a nearby venue
        if (!resolvedFromTitle) {
          console.log(`[Extract] User location: ${userLocationCoords ? `${userLocationCoords.lat}, ${userLocationCoords.lng}` : 'not provided (using default)'}`);
          console.log(`[Extract] Falling back to finding nearby ${venueTypeToSearch}`);
          
          try {
            const nearbyVenue = await placesResolver.findNearbyVenue(venueTypeToSearch, userLocationCoords);
            if (nearbyVenue) {
              location = {
                name: nearbyVenue.name,
                address: nearbyVenue.formattedAddress,
                placeId: nearbyVenue.placeId,
                coordinates: nearbyVenue.location
              };

              // Resolve timezone from coordinates
              const tzResult = await timezoneResolver.resolve(
                nearbyVenue.location.lat,
                nearbyVenue.location.lng
              );
              if (tzResult) {
                timezone = tzResult.timeZoneId;
              }

              console.log(`[Extract] ✓ Found nearby venue: ${location.name} at ${location.address}`);
            } else {
              console.log(`[Extract] ✗ Could not find nearby ${venueTypeToSearch}`);
            }
          } catch (error: any) {
            console.error(`[Extract] Error finding nearby venue: ${error.message}`);
          }
        }
      } else {
        console.log(`[Extract] No location, eventType, or venueType - cannot infer location`);
      }
    }
    // If no location extracted, location stays null (which is fine)

    // Step 3: Build canonical event
    // Use extracted title and description as-is - let Gemini do the reasoning
    const finalTitle = extracted.title || 'Untitled Event';
    let finalDescription = extracted.description || '';
    // If date is empty, use today as placeholder (user will need to edit)
    const eventDate = extracted.date && extracted.date.trim() !== '' 
      ? extracted.date 
      : new Date().toISOString().split('T')[0];
    
    // If time is provided, use dateTime format; otherwise use date format for all-day event
    console.log(`[Extract] Building event - extracted date: ${extracted.date || 'empty (using today as placeholder)'}, time: ${extracted.time || 'null (all-day)'}`);
    const startTime = extracted.time 
      ? `${eventDate}T${extracted.time}` 
      : eventDate; // All-day event uses just the date (YYYY-MM-DD)
    
    // Handle endTime: if extracted.endTime exists, use it; otherwise calculate based on event type
    let endTime: string | undefined;
    if (extracted.time) {
      // Timed event: use extracted endTime if available, otherwise undefined (will default to +1h in calendar service)
      if (extracted.endTime) {
        endTime = `${eventDate}T${extracted.endTime}`;
      }
    } else {
      // All-day event: end date is next day (date-only, no time)
      // Ignore any extracted.endTime that has a time component
      endTime = getNextDay(eventDate);
      console.log(`[Extract] All-day event - start: ${startTime}, end: ${endTime} (date-only, no time)`);
    }

    // Add QR code link to description if found
    if (qrCodeUrl) {
      // Format as clickable HTML link for Google Calendar
      const qrCodeLink = `<a href="${qrCodeUrl}">${qrCodeUrl}</a>`;
      if (finalDescription) {
        finalDescription += `\n\n🔗 QR Code: ${qrCodeLink}`;
      } else {
        finalDescription = `🔗 QR Code: ${qrCodeLink}`;
      }
    }
    
    const event: CanonicalEvent = {
      title: finalTitle,
      description: finalDescription,
      startTime,
      endTime,
      location,
      timezone,
      source: type === 'image' ? 'flyer' : type === 'url' ? 'url' : 'text',
      sourceMetadata
    };

    // Step 4: Check for conflicts
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    const conflicts = await calendarService.checkConflicts(
      calendarId,
      startTime,
      endTime || startTime
    );
    event.conflicts = conflicts;

    res.json({ event, confidence: 0.8 }); // TODO: Calculate actual confidence
  } catch (error: any) {
    next(error);
  }
});

/**
 * Get the next day for all-day event end date
 */
function getNextDay(dateString: string): string {
  // Parse date string directly to avoid timezone issues
  // dateString is in format YYYY-MM-DD
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day + 1); // month is 0-indexed, add 1 day
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

/**
 * Check if URL is a video URL
 */
function isVideoUrl(url: string): boolean {
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];
  const videoDomains = ['youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com', 'tiktok.com'];
  
  const lowerUrl = url.toLowerCase();
  
  // Check file extension
  if (videoExtensions.some(ext => lowerUrl.includes(ext))) {
    return true;
  }
  
  // Check video hosting domains
  if (videoDomains.some(domain => lowerUrl.includes(domain))) {
    return true;
  }
  
  return false;
}

export { router as extractRouter };

