import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Ensure .env is loaded
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ GEMINI_API_KEY is not set in environment variables!');
  throw new Error('GEMINI_API_KEY is required. Check your .env file.');
}

const genAI = new GoogleGenerativeAI(apiKey);

export interface ExtractedEvent {
  title: string;
  description?: string;
  date: string; // ISO8601 date
  time?: string; // ISO8601 time (optional for all-day events)
  endTime?: string; // ISO8601 time (optional end time)
  location?: string;
}

export class GeminiExtractor {
  private model: any;

  constructor() {
    // Use gemini-2.0-flash (available model from API)
    // Model names need to match exactly what's available
    this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  async extractFromImage(imageBase64: string): Promise<ExtractedEvent> {
    const prompt = `Extract event information from this image. Return a JSON object with:
- title (string, required): Event title
- description (string, optional): Brief event summary in 25 words or less. Summarize key details about the event.
- date (ISO8601 date, required): Event date (e.g., "2024-03-15")
- time (ISO8601 time, optional): Event start time (e.g., "20:00:00" or "08:00:00"). If no specific time is mentioned, omit this field or set to null.
- endTime (ISO8601 time, optional): Event end time (e.g., "22:00:00" or "10:00:00"). Look for phrases like "until", "ends at", "finishes at", or time ranges like "8pm-10pm". If no end time is mentioned, omit this field.
- location (string, optional): Event location/venue

CRITICAL DATE RESOLUTION:
- Today's date is: ${new Date().toISOString().split('T')[0]} (${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})
- If you see "Tuesday Nov 18" or "Nov 18" or "November 18", determine the correct year:
  * If the month/day is in the future relative to today, use the current year
  * If the month/day has passed this year, use next year
  * For "Tuesday Nov 18", find the Tuesday that falls on November 18th
- For relative dates (e.g., "tomorrow", "next Friday"), resolve to absolute date based on today's date
- If you see "opening on Tuesday Nov 18" or "starts Tuesday Nov 18", the event date is November 18th (all-day event if no time specified)

If no specific start time is mentioned in the image, do NOT include a time field or set it to null - this will create an all-day event.
If you see a time range (e.g., "8pm-10pm" or "20:00-22:00"), extract both start and end times.
IMPORTANT: The description must be a concise summary of 25 words maximum.
Return ONLY valid JSON, no markdown formatting.`;

    try {
      const imagePart = {
        inlineData: {
          data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
          mimeType: 'image/jpeg'
        }
      };

      const result = await this.model.generateContent([prompt, imagePart]);
      const response = result.response;
      const text = response.text();
      
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const extracted = JSON.parse(jsonMatch[0]);
      return this.validateAndNormalize(extracted);
    } catch (error: any) {
      console.error('Gemini extraction error:', error);
      throw new Error(`Extraction failed: ${error.message}`);
    }
  }

  async extractFromText(text: string): Promise<ExtractedEvent> {
    const prompt = `Extract event information from this text. Return a JSON object with:
- title (string, required): Event title
- description (string, optional): Brief event summary in 25 words or less. Summarize key details about the event.
- date (ISO8601 date, required): Event date (e.g., "2024-03-15")
- time (ISO8601 time, optional): Event start time (e.g., "20:00:00" or "08:00:00"). If no specific time is mentioned, omit this field or set to null.
- endTime (ISO8601 time, optional): Event end time (e.g., "22:00:00" or "10:00:00"). Look for phrases like "until", "ends at", "finishes at", "from X to Y", or time ranges like "8pm-10pm". If no end time is mentioned, omit this field.
- location (string, optional): Event location/venue

CRITICAL DATE RESOLUTION:
- Today's date is: ${new Date().toISOString().split('T')[0]} (${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})
- If you see "Tuesday Nov 18" or "Nov 18" or "November 18", determine the correct year:
  * If the month/day is in the future relative to today, use the current year
  * If the month/day has passed this year, use next year
  * For "Tuesday Nov 18", find the Tuesday that falls on November 18th
  * CRITICAL: If text says "Nov 18", the date is 2024-11-18 (or 2025-11-18), NOT 2024-11-17
- For relative dates (e.g., "tomorrow", "next Friday"), resolve to absolute date based on today's date
- If you see "opening on Tuesday Nov 18" or "starts Tuesday Nov 18", the event date is November 18th (all-day event if no time specified)
- IMPORTANT: "opening on" or "starts" with a date means the event is on that date, not the day before
- DO NOT subtract days from dates - if you see "Nov 18", use "2024-11-18" (or appropriate year), never "2024-11-17"

If no specific start time is mentioned in the text, do NOT include a time field or set it to null - this will create an all-day event.
If you see a time range (e.g., "8pm-10pm", "20:00-22:00", "from 8pm to 10pm"), extract both start and end times.
IMPORTANT: The description must be a concise summary of 25 words maximum.
Return ONLY valid JSON, no markdown formatting.

Text to extract from:
${text}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const extracted = JSON.parse(jsonMatch[0]);
      console.log(`[GeminiExtractor] Extracted from text - date: ${extracted.date}, time: ${extracted.time || 'null (all-day)'}`);
      const normalized = this.validateAndNormalize(extracted);
      console.log(`[GeminiExtractor] After normalization - date: ${normalized.date}, time: ${normalized.time || 'null (all-day)'}`);
      return normalized;
    } catch (error: any) {
      console.error('Gemini extraction error:', error);
      throw new Error(`Extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract event information from multiple video frames
   * Analyzes all frames and combines the results
   */
  async extractFromVideoFrames(frames: string[]): Promise<ExtractedEvent> {
    try {
      console.log(`[GeminiExtractor] Analyzing ${frames.length} video frames...`);
      
      // Analyze each frame
      const analyses = await Promise.all(
        frames.map(async (frame, index) => {
          const prompt = `Analyze this video frame (frame ${index + 1} of ${frames.length}) and extract ALL event information you can see. Look carefully at ALL text, graphics, and visual elements.

EXTRACT:
- Event title or name (look for large text, headlines, event names - this is CRITICAL)
- Date (look for dates in any format: "Dec 30", "12/30/2025", "December 30, 2025", etc.) - ONLY if clearly visible or can be reasonably inferred from contextual clues (e.g., "tomorrow", "next Friday", "Nov 18"). DO NOT default to today's date if no date is visible. If no date is visible or inferable, set to null.
- Start time (only if a specific time is visible like "8pm", "20:00", "8:00 PM")
- End time (look for: "until", "ends at", time ranges like "8pm-10pm", "from 8pm to 10pm")
- Location (venue name, address, city, place name)
- Brief summary (25 words max) of key event details
- ALL text visible in the frame (read everything carefully)
- Event type (concert, conference, workshop, festival, etc.)

CRITICAL INSTRUCTIONS:
- The "title" field is REQUIRED if you see ANY event-related text. Extract the main event name/title even if partial.
- Only include "time" if a SPECIFIC start time is visible (not just a date). If only date is shown, set "time" to null.
- For "endTime": ONLY extract if you see an end time or time range. DO NOT use the date as endTime. If you see "2025-12-30" that's a DATE, not a time.
- Look at ALL text overlays, graphics, captions, and visual elements - event info can be anywhere.
- If you see ANY event-related information, set "hasEventInfo" to true.

CRITICAL DATE RESOLUTION:
- Today's date is: ${new Date().toISOString().split('T')[0]} (${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})
- If you see "Tuesday Nov 18" or "Nov 18" or "November 18", determine the correct year:
  * If the month/day is in the future relative to today, use the current year
  * If the month/day has passed this year, use next year
  * For "Tuesday Nov 18", find the Tuesday that falls on November 18th
  * CRITICAL: If text says "Nov 18", the date is 2024-11-18 (or 2025-11-18), NOT 2024-11-17
- For relative dates (e.g., "tomorrow", "next Friday"), resolve to absolute date based on today's date
- If you see "opening on Tuesday Nov 18" or "starts Tuesday Nov 18", the event date is November 18th (all-day event if no time specified)
- IMPORTANT: "opening on" or "starts" with a date means the event is on that date, not the day before
- DO NOT subtract days from dates - if you see "Nov 18", use "2024-11-18" (or appropriate year), never "2024-11-17"
- CRITICAL: If you cannot see a date or reasonably infer it from context, set date to null. DO NOT default to today's date.

Format your response as JSON:
{
  "title": "event title or null (REQUIRED if event info exists)",
  "date": "date if visible or null (format: YYYY-MM-DD, DO NOT guess)",
  "time": "start time if visible or null (format: HH:MM:SS, only if specific time shown)",
  "endTime": "end time if visible or null (format: HH:MM:SS, NOT a date - only if end time or range shown)",
  "location": "location if visible or null",
  "description": "brief summary (25 words max) if visible or null",
  "text": "ALL text visible in the frame",
  "hasEventInfo": true or false
}`;

          try {
            const imagePart = {
              inlineData: {
                data: frame.replace(/^data:image\/\w+;base64,/, ''),
                mimeType: 'image/jpeg'
              }
            };

            const result = await this.model.generateContent([prompt, imagePart]);
            const response = result.response;
            const text = response.text();
            
            // Try to parse JSON response
            try {
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                  ...parsed,
                  rawText: text
                };
              }
            } catch (e) {
              // If JSON parsing fails, extract text manually
            }
            
            return {
              text: text,
              hasEventInfo: text.toLowerCase().includes('event') || 
                           text.toLowerCase().includes('date') ||
                           text.toLowerCase().includes('time'),
              rawText: text
            };
          } catch (error: any) {
            console.warn(`[GeminiExtractor] Error analyzing frame ${index + 1}:`, error.message);
            return {
              hasEventInfo: false,
              rawText: ''
            };
          }
        })
      );

      // Combine all frame analyses
      const combined = this.combineFrameAnalyses(analyses);
      
      // Validate and normalize the combined result
      // If validation fails, return a partial result that can be used with text extraction
      try {
        return this.validateAndNormalize(combined);
      } catch (validationError: any) {
        // If validation fails (e.g., missing title or date), return partial data
        // The extract route will fall back to text extraction with this partial data
        console.warn('[GeminiExtractor] Validation failed, returning partial result:', validationError.message);
        
        // Try to extract title from raw text if not found
        let extractedTitle = combined.title;
        if (!extractedTitle) {
          const allText = analyses.map(a => a.rawText || a.text || '').join(' ');
          // Look for common event title patterns
          const titleMatch = allText.match(/(?:title|event|name)[:\s]+([^\n,]+)/i) ||
                           allText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
          if (titleMatch) {
            extractedTitle = titleMatch[1]?.trim() || '';
          }
        }
        
        return {
          title: extractedTitle || 'Untitled Event',
          description: combined.description,
          date: combined.date || '', // Will be caught by extract route and trigger fallback
          time: combined.time,
          endTime: combined.endTime,
          location: combined.location
        };
      }
    } catch (error: any) {
      console.error('[GeminiExtractor] Error extracting from video frames:', error.message);
      throw new Error(`Failed to extract from video frames: ${error.message}`);
    }
  }

  /**
   * Combine analyses from multiple frames into a single event
   */
  private combineFrameAnalyses(analyses: any[]): any {
    // Filter out frames with no event info
    const validAnalyses = analyses.filter(a => a.hasEventInfo !== false && a.hasEventInfo !== undefined);
    
    if (validAnalyses.length === 0) {
      // If no frames have event info, try to extract from all text combined
      const allText = analyses.map(a => a.rawText || a.text || '').join(' ');
      if (allText.trim()) {
        // Return a basic structure that will be validated
        // Limit description to 25 words
        const words = allText.trim().split(/\s+/);
        const limitedDescription = words.length <= 25 
          ? words.join(' ')
          : words.slice(0, 25).join(' ') + '...';
        
        return {
          title: null,
          date: null,
          time: null,
          endTime: null,
          location: null,
          description: limitedDescription
        };
      }
      throw new Error('No event information found in video frames');
    }

    // Combine fields, prioritizing non-null values
    const combined: any = {
      title: null,
      date: null,
      time: null,
      endTime: null,
      location: null,
      description: null
    };

    for (const analysis of validAnalyses) {
      if (analysis.title && !combined.title) combined.title = analysis.title;
      if (analysis.date && !combined.date) combined.date = analysis.date;
      if (analysis.time && !combined.time) combined.time = analysis.time;
      if (analysis.endTime && !combined.endTime) combined.endTime = analysis.endTime;
      if (analysis.location && !combined.location) combined.location = analysis.location;
      if (analysis.description && !combined.description) {
        combined.description = this.limitDescription(analysis.description);
      }
    }

    // If we have text but no structured fields, try to extract from combined text
    const allText = validAnalyses.map(a => a.rawText || a.text || '').join(' ');
    if (allText && (!combined.title || !combined.date)) {
      // Try to extract title from text if missing
      if (!combined.title) {
        // Look for title patterns in the text
        const titlePatterns = [
          /(?:title|event|name)[:\s]+([^\n,\.]+)/i,
          /"([^"]{10,60})"/, // Text in quotes
          /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,5})/, // Title case phrases
          /([A-Z]{2,}(?:\s+[A-Z]{2,}){0,3})/ // All caps phrases
        ];
        
        for (const pattern of titlePatterns) {
          const match = allText.match(pattern);
          if (match && match[1] && match[1].length > 5 && match[1].length < 100) {
            combined.title = match[1].trim();
            break;
          }
        }
      }
      
      // Use the combined text as description if we don't have structured data
      // Limit to 25 words
      if (!combined.description) {
        const words = allText.trim().split(/\s+/);
        combined.description = words.length <= 25 
          ? words.join(' ')
          : words.slice(0, 25).join(' ') + '...';
      }
    }

    return combined;
  }

  /**
   * Normalize time format to HH:MM:SS
   * Handles various time formats gracefully
   * Detects and rejects date formats (YYYY-MM-DD)
   */
  private normalizeTime(time: string): string {
    if (!time) {
      throw new Error('Invalid time format');
    }
    
    // Remove whitespace
    time = time.trim();
    
    // Check if it's a date format (YYYY-MM-DD or similar) - reject it
    if (/^\d{4}-\d{2}-\d{2}/.test(time) || /^\d{2}\/\d{2}\/\d{4}/.test(time)) {
      throw new Error(`Invalid time format: ${time} (appears to be a date, not a time)`);
    }
    
    // If it's already in HH:MM:SS format, return as is
    if (/^\d{2}:\d{2}:\d{2}$/.test(time)) {
      return time;
    }
    
    // If it's in HH:MM format, add seconds
    if (/^\d{2}:\d{2}$/.test(time)) {
      return `${time}:00`;
    }
    
    // Try to parse other formats (e.g., "8pm", "20:00", etc.)
    // Handle 12-hour format with am/pm
    const amPmMatch = time.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
    if (amPmMatch) {
      let hours = parseInt(amPmMatch[1]);
      const minutes = amPmMatch[2] ? parseInt(amPmMatch[2]) : 0;
      const isPm = amPmMatch[3].toLowerCase() === 'pm';
      
      if (isPm && hours !== 12) hours += 12;
      if (!isPm && hours === 12) hours = 0;
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
    }
    
    // If it includes ':', try to parse it (but not if it looks like a date)
    if (time.includes(':')) {
      const timeParts = time.split(':');
      if (timeParts.length >= 2) {
        // Check if first part is a valid hour (0-23)
        const hours = parseInt(timeParts[0]);
        if (hours >= 0 && hours <= 23) {
          const minutes = parseInt(timeParts[1]);
          if (minutes >= 0 && minutes <= 59) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
          }
        }
      }
    }
    
    // If we can't parse it, throw error
    throw new Error(`Invalid time format: ${time}`);
  }

  /**
   * Limit description to 25 words maximum
   */
  private limitDescription(description?: string): string | undefined {
    if (!description) return undefined;
    const words = description.trim().split(/\s+/);
    if (words.length <= 25) {
      return description.trim();
    }
    return words.slice(0, 25).join(' ') + '...';
  }

  private validateAndNormalize(extracted: any): ExtractedEvent {
    // Validate required fields
    if (!extracted.title) {
      throw new Error('Title is required');
    }
    
    // Date is now optional - if null or empty, leave it empty (user will fill it in)
    let normalizedDate: string | null = null;
    if (extracted.date && extracted.date !== null && extracted.date !== 'null') {
      // Normalize date format (timezone-safe)
      // Parse date string directly to avoid timezone shifts
      let dateStr = extracted.date.trim();
    
      // If it's already in YYYY-MM-DD format, use it directly
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        // Validate the date is valid
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day); // month is 0-indexed
        if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
          normalizedDate = dateStr; // Use as-is, no timezone conversion
        } else {
          throw new Error('Invalid date format');
        }
      } else {
        // Parse other date formats - use local timezone to avoid shifts
        // Try parsing as local date first
        let date: Date;
        
        // Try common date formats
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
          // MM/DD/YYYY format
          const [month, day, year] = dateStr.split('/').map(Number);
          date = new Date(year, month - 1, day);
        } else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
          // YYYY/MM/DD format
          const [year, month, day] = dateStr.split('/').map(Number);
          date = new Date(year, month - 1, day);
        } else {
          // Try standard Date parsing
          date = new Date(dateStr);
        }
        
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date format: ${dateStr}`);
        }
        
        // Extract YYYY-MM-DD using local date components (no timezone conversion)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        normalizedDate = `${year}-${month}-${day}`;
        
        console.log(`[GeminiExtractor] Parsed date "${dateStr}" → "${normalizedDate}"`);
      }
    } else {
      // No date provided - leave it null
      normalizedDate = null;
      console.log(`[GeminiExtractor] No date provided, leaving empty for user to fill`);
    }

    // If time is provided, normalize it; otherwise leave it undefined for all-day event
    if (extracted.time) {
      try {
        extracted.time = this.normalizeTime(extracted.time);
      } catch (error: any) {
        // If time format is invalid, log warning and set to undefined (all-day event)
        console.warn(`[GeminiExtractor] Invalid time format "${extracted.time}", treating as all-day event:`, error.message);
        extracted.time = undefined;
      }
    } else {
      // No time specified - will be treated as all-day event
      extracted.time = undefined;
    }
    
    // Normalize endTime if provided
    if (extracted.endTime) {
      try {
        extracted.endTime = this.normalizeTime(extracted.endTime);
      } catch (error: any) {
        // If endTime format is invalid, log warning and ignore it
        console.warn(`[GeminiExtractor] Invalid endTime format, ignoring:`, error.message);
        extracted.endTime = undefined;
      }
    }

    // If date is null, use empty string - extract route will handle it
    const finalDate = normalizedDate || '';
    
    return {
      title: extracted.title.trim(),
      description: this.limitDescription(extracted.description),
      date: finalDate,
      time: extracted.time, // Can be undefined for all-day events
      endTime: extracted.endTime, // Already normalized above
      location: extracted.location?.trim()
    };
  }
}

