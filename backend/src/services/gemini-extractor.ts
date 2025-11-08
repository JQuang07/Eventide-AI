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
  time: string; // ISO8601 time
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
- description (string, optional): Event description
- date (ISO8601 date, required): Event date (e.g., "2024-03-15")
- time (ISO8601 time, required): Event time (e.g., "20:00:00" or "08:00:00")
- location (string, optional): Event location/venue

If date/time is relative (e.g., "tomorrow", "next Friday"), resolve to absolute date based on today's date: ${new Date().toISOString().split('T')[0]}.
If time is missing, use "12:00:00" as default.
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
- description (string, optional): Event description
- date (ISO8601 date, required): Event date (e.g., "2024-03-15")
- time (ISO8601 time, required): Event time (e.g., "20:00:00" or "08:00:00")
- location (string, optional): Event location/venue

If date/time is relative (e.g., "tomorrow", "next Friday"), resolve to absolute date based on today's date: ${new Date().toISOString().split('T')[0]}.
If time is missing, use "12:00:00" as default.
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
      return this.validateAndNormalize(extracted);
    } catch (error: any) {
      console.error('Gemini extraction error:', error);
      throw new Error(`Extraction failed: ${error.message}`);
    }
  }

  private validateAndNormalize(extracted: any): ExtractedEvent {
    // Validate required fields
    if (!extracted.title) {
      throw new Error('Title is required');
    }
    if (!extracted.date) {
      throw new Error('Date is required');
    }
    if (!extracted.time) {
      extracted.time = '12:00:00';
    }

    // Normalize date format
    const date = new Date(extracted.date);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format');
    }
    extracted.date = date.toISOString().split('T')[0];

    // Normalize time format (ensure HH:MM:SS)
    if (!extracted.time.includes(':')) {
      throw new Error('Invalid time format');
    }
    const timeParts = extracted.time.split(':');
    if (timeParts.length === 2) {
      extracted.time = `${timeParts[0]}:${timeParts[1]}:00`;
    }

    return {
      title: extracted.title.trim(),
      description: extracted.description?.trim(),
      date: extracted.date,
      time: extracted.time,
      location: extracted.location?.trim()
    };
  }
}

