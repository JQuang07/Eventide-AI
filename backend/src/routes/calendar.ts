import express from 'express';
import { CalendarService } from '../services/calendar-service';

const router = express.Router();
const calendarService = new CalendarService();

/**
 * GET /calendar/events
 * Get upcoming calendar events
 */
router.get('/events', async (req, res, next) => {
  try {
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    const maxResults = parseInt(req.query.maxResults as string) || 50;
    
    const events = await calendarService.getEvents(calendarId, maxResults);
    res.json({ events });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /calendar/history
 * Get past events (history)
 */
router.get('/history', async (req, res, next) => {
  try {
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    const maxResults = parseInt(req.query.maxResults as string) || 100;
    
    const events = await calendarService.getHistory(calendarId, maxResults);
    res.json({ events });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /calendar/events/:eventId
 * Get a single event by ID
 */
router.get('/events/:eventId', async (req, res, next) => {
  try {
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    const { eventId } = req.params;
    
    const event = await calendarService.getEvent(calendarId, eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ event });
  } catch (error: any) {
    next(error);
  }
});

/**
 * DELETE /calendar/events/:eventId
 * Delete an event by ID
 */
router.delete('/events/:eventId', async (req, res, next) => {
  try {
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    const { eventId } = req.params;
    
    const success = await calendarService.deleteEvent(calendarId, eventId);
    
    if (!success) {
      return res.status(404).json({ error: 'Failed to delete event' });
    }
    
    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (error: any) {
    next(error);
  }
});

export { router as calendarRouter };

