import express from 'express';
import { CalendarService } from '../services/calendar-service';
import { CanonicalEvent } from '../types/event';
import { z } from 'zod';

const router = express.Router();
const calendarService = new CalendarService();

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startTime: z.string(),
  endTime: z.string().optional(),
  location: z.object({
    name: z.string().optional(),
    address: z.string().optional(),
    placeId: z.string().optional(),
    coordinates: z.object({
      lat: z.number(),
      lng: z.number()
    }).optional()
  }).nullable().optional(), // Allow null or undefined
  timezone: z.string(),
  source: z.enum(['flyer', 'url', 'text', 'email']),
  sourceMetadata: z.any().optional(), // Allow sourceMetadata
  travelBufferMinutes: z.number().optional(),
  conflicts: z.any().optional() // Allow conflicts (will be ignored on save)
}).passthrough(); // Allow extra fields

router.post('/', async (req, res, next) => {
  try {
    // Validate request body
    const validated = eventSchema.parse(req.body);
    const event = validated as CanonicalEvent;

    // Create event in calendar
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    const result = await calendarService.createEvent(calendarId, event);

    res.json({
      success: true,
      eventId: result.id,
      htmlLink: result.htmlLink,
      message: 'Event created successfully'
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.errors);
      return res.status(400).json({ 
        error: 'Invalid event data', 
        details: error.errors,
        received: Object.keys(req.body)
      });
    }
    next(error);
  }
});

export { router as saveRouter };

