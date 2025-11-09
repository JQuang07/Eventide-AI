# Data Processing Flow - Eventide AI

## Overview

This document explains how Eventide AI processes different input types (images, videos, text, URLs) to extract event information and create calendar events.

---

## High-Level Data Flow

```
User Input
    ↓
Mobile App (HomeScreen)
    ↓
POST /extract → Backend API
    ↓
Input Type Detection
    ├─→ Image Processing
    ├─→ Video Processing
    ├─→ URL Processing
    └─→ Text Processing
    ↓
Gemini AI Extraction
    ↓
Location & Timezone Resolution
    ↓
Conflict Detection
    ↓
Canonical Event Object
    ↓
User Review (ReviewScreen)
    ↓
POST /save → Calendar API
    ↓
Google Calendar Event Created
```

---

## 1. Image Processing Flow

### Input: Camera-captured flyer image (base64)

```
📷 Image (Base64)
    ↓
[Backend: extract.ts]
    ↓
GeminiExtractor.extractFromImage()
    ↓
┌─────────────────────────────────────┐
│  Gemini 2.0 Flash API               │
│  - Multimodal Vision Model          │
│  - Analyzes image pixels            │
│  - Extracts text, dates, locations  │
└─────────────────────────────────────┘
    ↓
Extracted JSON:
{
  title: "Jazz Night",
  date: "2024-03-15",
  time: "20:00:00",
  endTime: "22:00:00",
  location: "Blue Note",
  description: "Live jazz performance"
}
    ↓
[PlacesResolver] → Google Maps Places API
    ↓
[TimeZoneResolver] → Google Maps Time Zone API
    ↓
[CalendarService.checkConflicts()] → Google Calendar API
    ↓
✅ Canonical Event Object
```

### APIs Used:
- **Gemini 2.0 Flash API**: Multimodal vision analysis
- **Google Maps Places API**: Location → Place ID, coordinates, address
- **Google Maps Time Zone API**: Coordinates → Timezone
- **Google Calendar API**: Conflict detection

---

## 2. Video Processing Flow

### Input: Video URL (YouTube, TikTok, Instagram, etc.)

```
🔗 Video URL
    ↓
[Backend: extract.ts]
    ↓
isVideoUrl() → Detects video domains/extensions
    ↓
┌─────────────────────────────────────┐
│  VideoFrameExtractor                 │
│  - Downloads video via FFmpeg       │
│  - Extracts 5 key frames            │
│  - Extracts audio track             │
└─────────────────────────────────────┘
    ↓
    ├─→ Video Frames (Base64 images)
    │       ↓
    │   [GeminiExtractor.extractFromVideoFrames()]
    │       ↓
    │   ┌─────────────────────────────────────┐
    │   │  Gemini 2.0 Flash API               │
    │   │  - Analyzes each frame               │
    │   │  - Extracts visual text/overlays     │
    │   │  - Combines frame analyses          │
    │   └─────────────────────────────────────┘
    │
    └─→ Audio Track (WAV file)
            ↓
        [AudioTranscriber.transcribe()]
            ↓
        ┌─────────────────────────────────────┐
        │  Google Cloud Speech-to-Text API     │
        │  - Converts speech → text            │
        │  - Extracts spoken event details     │
        └─────────────────────────────────────┘
            ↓
        Transcription Text
    ↓
[UrlExpander.expand()] → oEmbed/OpenGraph metadata
    ↓
Combine: Frames + Transcription + Metadata
    ↓
[GeminiExtractor.extractFromText()]
    ↓
┌─────────────────────────────────────┐
│  Gemini 2.0 Flash API               │
│  - Text-based extraction             │
│  - Parses combined information       │
└─────────────────────────────────────┘
    ↓
Extracted Event Data
    ↓
[PlacesResolver] → Google Maps Places API
    ↓
[TimeZoneResolver] → Google Maps Time Zone API
    ↓
[CalendarService.checkConflicts()] → Google Calendar API
    ↓
✅ Canonical Event Object
```

### APIs Used:
- **FFmpeg**: Video download, frame extraction, audio extraction
- **Gemini 2.0 Flash API**: Frame analysis (multimodal) + text extraction
- **Google Cloud Speech-to-Text API**: Audio transcription
- **oEmbed/OpenGraph**: URL metadata extraction
- **Google Maps Places API**: Location resolution
- **Google Maps Time Zone API**: Timezone resolution
- **Google Calendar API**: Conflict detection

---

## 3. URL Processing Flow

### Input: Social media or event URL

```
🔗 URL (Instagram, TikTok, Twitter, etc.)
    ↓
[Backend: extract.ts]
    ↓
[UrlExpander.expand()]
    ↓
┌─────────────────────────────────────┐
│  URL Expansion Process               │
│                                      │
│  1. Check for oEmbed endpoint        │
│     - Instagram: api.instagram.com   │
│     - Twitter: publish.twitter.com   │
│     - TikTok: tiktok.com/oembed      │
│                                      │
│  2. Fallback: Fetch HTML            │
│     - Parse OpenGraph tags           │
│     - Extract <meta> tags            │
└─────────────────────────────────────┘
    ↓
Metadata:
{
  title: "Event Title",
  description: "Event description",
  imageUrl: "thumbnail.jpg"
}
    ↓
[Check if video URL]
    ↓
    ├─→ Video? → Follow Video Processing Flow
    │
    └─→ Not Video? → Text Extraction
            ↓
        [GeminiExtractor.extractFromText()]
            ↓
        ┌─────────────────────────────────────┐
        │  Gemini 2.0 Flash API               │
        │  - Text-based extraction             │
        │  - Parses metadata + URL content     │
        └─────────────────────────────────────┘
            ↓
        Extracted Event Data
            ↓
        [PlacesResolver] → Google Maps Places API
            ↓
        [TimeZoneResolver] → Google Maps Time Zone API
            ↓
        [CalendarService.checkConflicts()] → Google Calendar API
            ↓
        ✅ Canonical Event Object
```

### APIs Used:
- **oEmbed APIs**: Platform-specific metadata (Instagram, Twitter, TikTok)
- **HTTP Fetch**: HTML parsing for OpenGraph tags
- **Gemini 2.0 Flash API**: Text extraction from metadata
- **Google Maps Places API**: Location resolution
- **Google Maps Time Zone API**: Timezone resolution
- **Google Calendar API**: Conflict detection

---

## 4. Text Processing Flow

### Input: Pasted text or email content

```
📝 Text Input
    ↓
[Backend: extract.ts]
    ↓
[GeminiExtractor.extractFromText()]
    ↓
┌─────────────────────────────────────┐
│  Gemini 2.0 Flash API               │
│  - Natural language processing      │
│  - Date/time parsing                │
│  - Relative date resolution         │
│    ("tomorrow" → "2024-03-16")      │
│  - Event information extraction     │
└─────────────────────────────────────┘
    ↓
Extracted JSON:
{
  title: "Team Meeting",
  date: "2024-03-16",
  time: "14:00:00",
  location: "Conference Room A"
}
    ↓
[PlacesResolver] → Google Maps Places API
    ↓
[TimeZoneResolver] → Google Maps Time Zone API
    ↓
[CalendarService.checkConflicts()] → Google Calendar API
    ↓
✅ Canonical Event Object
```

### APIs Used:
- **Gemini 2.0 Flash API**: Natural language understanding and extraction
- **Google Maps Places API**: Location resolution
- **Google Maps Time Zone API**: Timezone resolution
- **Google Calendar API**: Conflict detection

---

## 5. Post-Extraction Processing

### All Input Types Converge Here

```
Canonical Event Object
    ↓
┌─────────────────────────────────────┐
│  Location Resolution                │
│  [PlacesResolver]                  │
│  - Input: "Blue Note"               │
│  - API: Google Maps Places API     │
│  - Output:                          │
│    {                                │
│      placeId: "ChIJ...",           │
│      address: "131 W 3rd St...",    │
│      coordinates: {lat, lng}        │
│    }                                │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Timezone Resolution                │
│  [TimeZoneResolver]                 │
│  - Input: {lat, lng}                │
│  - API: Google Maps Time Zone API   │
│  - Output: "America/New_York"       │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Conflict Detection                 │
│  [CalendarService.checkConflicts()] │
│  - API: Google Calendar API         │
│  - Checks ±2 hour window            │
│  - Returns overlapping events       │
└─────────────────────────────────────┘
    ↓
Final Canonical Event:
{
  title: "Jazz Night",
  description: "Live jazz performance",
  startTime: "2024-03-15T20:00:00",
  endTime: "2024-03-15T22:00:00",
  location: {
    name: "Blue Note",
    address: "131 W 3rd St, New York, NY",
    placeId: "ChIJ...",
    coordinates: {lat: 40.7306, lng: -73.9986}
  },
  timezone: "America/New_York",
  source: "flyer" | "url" | "text",
  conflicts: [...]
}
    ↓
📱 Mobile App (ReviewScreen)
    ↓
User Reviews/Edits
    ↓
POST /save
    ↓
┌─────────────────────────────────────┐
│  Calendar Event Creation            │
│  [CalendarService.createEvent()]    │
│  - API: Google Calendar API         │
│  - Converts to Calendar format      │
│  - Handles all-day vs timed events  │
└─────────────────────────────────────┘
    ↓
✅ Google Calendar Event Created
```

---

## 6. Complete End-to-End Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INPUT                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Image   │  │  Video   │  │   URL    │  │   Text   │        │
│  │ (Flyer)  │  │   URL    │  │ (Social) │  │  (Paste) │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    MOBILE APP (HomeScreen)                       │
│                    POST /extract                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND API (extract.ts)                      │
│                    Input Type Detection                          │
└─────────────────────────────────────────────────────────────────┘
        ↓              ↓              ↓              ↓
    ┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐
    │Image │      │Video │      │ URL  │      │Text  │
    └──────┘      └──────┘      └──────┘      └──────┘
        ↓              ↓              ↓              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    GEMINI 2.0 FLASH API                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Vision Mode  │  │ Frame Mode  │  │  Text Mode   │          │
│  │ (Images)     │  │ (Videos)    │  │ (Text/URL)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  Extracts: title, date, time, endTime, location, description    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              ADDITIONAL PROCESSING (if needed)                   │
│  ┌──────────────────┐  ┌──────────────────┐                       │
│  │ Video Frames    │  │ Audio Transcribe│                       │
│  │ (FFmpeg)        │  │ (Speech-to-Text)│                       │
│  └──────────────────┘  └──────────────────┘                       │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ URL Expansion   │  │ Places Resolution│                     │
│  │ (oEmbed/OG)     │  │ (Maps Places API)│                     │
│  └──────────────────┘  └──────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    ENRICHMENT SERVICES                           │
│  ┌──────────────────────┐  ┌──────────────────────┐              │
│  │ PlacesResolver      │  │ TimeZoneResolver    │              │
│  │ → Maps Places API   │  │ → Maps Time Zone API│              │
│  │ → Place ID, Address │  │ → Timezone ID      │              │
│  └──────────────────────┘  └──────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    CONFLICT DETECTION                            │
│              CalendarService.checkConflicts()                    │
│                    → Google Calendar API                         │
│              Checks existing events in ±2 hour window          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              CANONICAL EVENT OBJECT                              │
│  {                                                               │
│    title, description, startTime, endTime,                      │
│    location: {name, address, placeId, coordinates},            │
│    timezone, source, conflicts                                   │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              MOBILE APP (ReviewScreen)                           │
│              User can review and edit all fields                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    POST /save                                    │
│              CalendarService.createEvent()                      │
│                    → Google Calendar API                        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              ✅ EVENT CREATED IN GOOGLE CALENDAR                 │
│              Returns: eventId, htmlLink                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. API Summary Table

| Service | API Used | Purpose | Input | Output |
|---------|----------|---------|-------|--------|
| **Image Extraction** | Gemini 2.0 Flash | Vision analysis | Base64 image | JSON: title, date, time, location |
| **Video Frame Extraction** | FFmpeg | Frame extraction | Video URL | Base64 frames |
| **Video Audio Transcription** | Google Cloud Speech-to-Text | Speech → text | Audio WAV file | Transcription text |
| **Video Frame Analysis** | Gemini 2.0 Flash | Frame analysis | Base64 frames | Event data from visuals |
| **Text Extraction** | Gemini 2.0 Flash | NLP extraction | Text string | JSON: title, date, time, location |
| **URL Expansion** | oEmbed/OpenGraph | Metadata extraction | URL | title, description, imageUrl |
| **Location Resolution** | Google Maps Places API | Place lookup | Location string | Place ID, address, coordinates |
| **Timezone Resolution** | Google Maps Time Zone API | Timezone lookup | Coordinates | Timezone ID |
| **Conflict Detection** | Google Calendar API | Event overlap check | startTime, endTime | Conflicting events array |
| **Event Creation** | Google Calendar API | Create calendar event | Canonical Event | Event ID, HTML link |

---

## 8. Data Transformation Pipeline

```
Raw Input
    ↓
┌─────────────────────────────────────┐
│  Type-Specific Processing           │
│  (Image/Video/URL/Text)             │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Gemini AI Extraction               │
│  → Structured JSON                  │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Validation & Normalization          │
│  - Date format: ISO8601              │
│  - Time format: HH:MM:SS             │
│  - Required fields check             │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Enrichment                         │
│  - Location → Place details         │
│  - Coordinates → Timezone           │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Conflict Check                     │
│  - Query calendar                    │
│  - Detect overlaps                   │
└─────────────────────────────────────┘
    ↓
Canonical Event Object
    ↓
┌─────────────────────────────────────┐
│  User Review & Edit                 │
│  (Mobile App)                       │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Calendar Format Conversion         │
│  - All-day vs timed                 │
│  - Timezone handling                │
└─────────────────────────────────────┘
    ↓
Google Calendar Event Format
    ↓
✅ Saved to Calendar
```

---

## 9. Key Processing Features

### **Intelligent Date/Time Parsing**
- Relative dates: "tomorrow" → absolute date
- Time ranges: "8pm-10pm" → startTime + endTime
- All-day detection: No time specified → all-day event

### **Location Intelligence**
- Fuzzy matching: "Blue Note" → "Blue Note Jazz Club, 131 W 3rd St"
- Place ID storage for Google Calendar integration
- Coordinate-based timezone resolution

### **Conflict Detection**
- ±2 hour window check
- Handles both timed and all-day events
- Visual warning in UI

### **Error Handling**
- Graceful fallbacks at each step
- Partial data extraction (if some fields missing)
- User can fill in missing fields manually

---

## 10. Performance Optimizations

1. **Caching**: Places API results cached for 24 hours
2. **Parallel Processing**: Video frames analyzed in parallel
3. **Timeout Management**: 10s timeout for API calls
4. **Video Limits**: Max 10 minutes, optimized frame extraction
5. **Image Compression**: Base64 images optimized before sending

---

This flow ensures robust, accurate event extraction from any input type while maintaining high performance and user experience.

