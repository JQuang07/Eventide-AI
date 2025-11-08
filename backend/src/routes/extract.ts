import express from 'express';
import { GeminiExtractor } from '../services/gemini-extractor';
import { PlacesResolver } from '../services/places-resolver';
import { TimeZoneResolver } from '../services/timezone-resolver';
import { UrlExpander } from '../services/url-expander';
import { CalendarService } from '../services/calendar-service';
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
    if (type === 'image') {
      extracted = await geminiExtractor.extractFromImage(data);
      sourceMetadata.imageUrl = data.substring(0, 100); // Store reference
    } else if (type === 'url') {
      const metadata = await urlExpander.expand(data);
      sourceMetadata.originalUrl = data;
      sourceMetadata.imageUrl = metadata.imageUrl;
      
      // Combine URL metadata with text extraction
      const textToExtract = `${metadata.title || ''} ${metadata.description || ''} ${data}`;
      extracted = await geminiExtractor.extractFromText(textToExtract);
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
    const startTime = `${extracted.date}T${extracted.time}`;
    const endTime = extracted.time ? undefined : undefined; // Will default to +1h in calendar service

    const event: CanonicalEvent = {
      title: extracted.title,
      description: extracted.description,
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

export { router as extractRouter };

