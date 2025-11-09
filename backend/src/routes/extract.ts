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
    const { type, data } = req.body;

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
                  return { title: '', date: '', description: '', location: '' } as any;
                }) as Promise<any>
              : Promise.resolve({ title: '', date: '', description: '', location: '' } as any),
            
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
                return { title: '', date: '', description: '', location: '' } as any;
              })(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Description parsing timeout')), 10000)
              )
            ]).catch(err => {
              console.warn('[Extract] Description parsing failed or timed out:', err.message);
              return { title: '', date: '', description: '', location: '' } as any;
            }) as Promise<any>
          ]);
          
          console.log(`[Extract] Stage 2 complete - Frame analysis: ${frameAnalyses.title ? '✓' : '✗'}, Transcription: ${transcription.length} chars, Description: ${descriptionAnalysis.title ? '✓' : '✗'}`);
          
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
          
          // If frame analysis has complete info, use it directly
          if (frameAnalyses.title && frameAnalyses.date) {
            extracted = frameAnalyses;
            console.log('[Extract] Using frame analysis (complete)');
          } else if (descriptionAnalysis.title && descriptionAnalysis.date) {
            extracted = descriptionAnalysis;
            // For all-day events, ignore endTime with time component
            if (!extracted.time && extracted.endTime) {
              console.log('[Extract] All-day event detected, removing endTime with time component');
              extracted.endTime = undefined;
            }
            console.log('[Extract] Using description analysis (complete)');
          } else {
            // Use combined extraction (frames + transcription + metadata + description)
            console.log('[Extract] Using combined extraction (all sources)');
            extracted = await geminiExtractor.extractFromText(combinedText);
            // For all-day events, ignore endTime with time component
            if (!extracted.time && extracted.endTime) {
              console.log('[Extract] All-day event detected, removing endTime with time component');
              extracted.endTime = undefined;
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

    // Step 2: Resolve location
    let location: any = null;
    let timezone = 'America/Los_Angeles'; // Default fallback

    if (extracted.location && extracted.location.trim()) {
      try {
        const placeResult = await placesResolver.resolve(extracted.location);
        if (placeResult) {
          location = {
            name: placeResult.name || extracted.location,
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
        } else {
          // Location string exists but couldn't resolve - use raw string
          location = {
            name: extracted.location
          };
        }
      } catch (error) {
        // If resolution fails, just use the raw location string
        location = {
          name: extracted.location
        };
      }
    }
    // If no location extracted, location stays null (which is fine)

    // Step 3: Build canonical event
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
    let finalDescription = extracted.description || '';
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
      title: extracted.title,
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

