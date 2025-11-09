# Eventide AI: Agentic Calendar App

**Project**: Eventide AI  
**Status**: ✅ Full Implementation Complete

**Demo Video**: https://www.youtube.com/watch?v=3Ega8s71x74

**Submission Link**: https://devpost.com/software/eventide-ai

Eventide AI transforms any user-shared content (images, videos, URLs, text) into verified Google Calendar events with intelligent extraction, conflict detection, and task management.

---

## ✨ Features

### Core Event Extraction
- **📷 Image Capture**: Capture event flyers with camera
- **🔗 URL Sharing**: Extract events from shared URLs (including social media)
- **📝 Text Input**: Paste or type event details directly
- **🎥 Video Processing**: Extract events from videos with frame analysis and audio transcription

### Intelligent Processing
- **🤖 AI-Powered Extraction**: Gemini multimodal AI extracts title, description, date/time, location
- **📍 Location Resolution**: Automatic location normalization using Google Maps Places API
- **🌍 Timezone Handling**: Automatic timezone resolution
- **⚠️ Conflict Detection**: Real-time conflict checking with visual indicators
- **📝 Smart Summaries**: 25-word event descriptions

### Calendar Management
- **📅 Calendar View**: Month/Week/Day views with event filtering
- **🗑️ Swipe-to-Delete**: Delete events with swipe gestures
- **📜 History**: View and edit all events created through Eventide AI
- **📄 Event Details**: Comprehensive event view with suggested tasks

### Task Management
- **✅ Suggested Tasks**: AI-generated task suggestions based on event details
- **📋 Task List**: View and manage tasks in calendar view
- **✏️ Task Editing**: Edit task title and notes
- **☑️ Task Completion**: Mark tasks as complete
- **🗑️ Task Deletion**: Swipe-to-delete tasks

### User Experience
- **🎨 Modern UI**: Beautiful sunset gradient theme
- **📱 Splash Screen**: Animated splash screen on app launch
- **⏳ Processing Screen**: Real-time progress indicator with stage descriptions
- **✏️ Review & Edit**: Comprehensive event review with editable date/time pickers
- **💾 Optimistic Updates**: Instant UI feedback for all actions

---

## 🛠️ Tech Stack

**Frontend**: Expo (React Native/TypeScript), React Navigation, Custom theme system  
**Backend**: Node.js, Express.js, TypeScript  
**AI & APIs**: Google Gemini API, Google Calendar API, Google Tasks API, Google Maps API, Google Cloud Speech-to-Text  
**Video Processing**: FFmpeg, fluent-ffmpeg, yt-dlp

---

## 📋 Prerequisites

- Node.js 18+
- Google Cloud account (with billing enabled)
- FFmpeg installed: `brew install ffmpeg` (macOS) or equivalent
- yt-dlp installed: `brew install yt-dlp` or `pip install yt-dlp`

---

## 🚀 Quick Setup

### 1. API Keys & Service Account

You'll need to set up:

1. **Gemini API Key**
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create API key
   - Enable Generative Language API in Google Cloud Console

2. **Google Maps API Key**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Enable Places API and Time Zone API
   - Create API key with restrictions

3. **Service Account**
   - Create service account in Google Cloud Console
   - Download JSON key file
   - Enable APIs: Calendar API, Tasks API, Speech-to-Text API
   - Grant "Editor" role or specific API roles

4. **Google Cloud Speech-to-Text**
   - Enable Speech-to-Text API
   - Grant service account access (Editor role works)

### 2. Backend Setup

```bash
cd backend
npm install

# Create .env file
cat > .env << EOF
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_MAPS_API_KEY=your_maps_api_key
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
GOOGLE_CLOUD_PROJECT=your_project_id
PORT=3000
EOF

# Place your service-account-key.json in the backend directory
npm run dev
```

### 3. Mobile App Setup

```bash
cd mobile
npm install

# Update API_BASE_URL in src/config/api.ts
# For physical device: Use your computer's IP address (e.g., http://192.168.1.100:3000)
# For simulator: Use localhost (http://localhost:3000)

npm start
```

### 4. Test APIs

```bash
cd backend
npx ts-node test-all-apis.ts
```

---

## 📱 App Structure

### Main Navigation (Bottom Tabs)
- **Add Tab**: Main input screen for capturing events
- **Calendar Tab**: View events and tasks in calendar format
- **History Tab**: View all events created through Eventide AI

### Additional Screens
- **Splash Screen**: Animated app launch
- **Processing Screen**: Real-time extraction progress
- **Review Screen**: Edit and confirm event details
- **Success Screen**: Event creation confirmation
- **Event Detail Screen**: View event details and suggested tasks

---

## 🔄 How It Works

1. **User Input**: Capture image, share URL, paste text, or provide video link
2. **Processing**: AI extracts event details (title, date, time, location)
3. **Enhancement**: Location and timezone resolution
4. **Conflict Check**: Detects scheduling conflicts
5. **Review**: User edits and confirms event details
6. **Save**: Event saved to Google Calendar
7. **Tasks**: AI suggests related tasks (optional)

### Video Processing
- Downloads video using yt-dlp
- Extracts key frames using FFmpeg
- Transcribes audio using Google Cloud Speech-to-Text
- Analyzes frames and transcription with Gemini
- Combines results for comprehensive extraction

---

## 📊 API Endpoints

**Extraction**
- `POST /extract` - Extract event from image/URL/text/video

**Calendar**
- `POST /save` - Save event to Google Calendar
- `GET /calendar/events` - Get upcoming events
- `GET /calendar/history` - Get Eventide-created events
- `GET /calendar/events/:eventId` - Get event details
- `DELETE /calendar/events/:eventId` - Delete event

**Tasks**
- `POST /tasks/suggest` - Get suggested tasks for event
- `POST /tasks` - Create task
- `GET /tasks` - Get all tasks
- `PATCH /tasks/:taskId` - Update task
- `DELETE /tasks/:taskId` - Delete task

---

## 🎨 UI Features

- **Theme**: Sunset gradient palette with warm tones
- **Animations**: Smooth transitions and fade effects
- **Gestures**: Swipe-to-delete for events and tasks
- **Keyboard**: Smart keyboard avoidance
- **Loading**: Progress indicators and optimistic updates

---

## 🔐 Environment Variables

**Backend (.env)**
```env
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_MAPS_API_KEY=your_maps_api_key
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
GOOGLE_CLOUD_PROJECT=your_project_id
PORT=3000
```

**Mobile (src/config/api.ts)**
- Update `API_BASE_URL` with your backend server address
- For physical device: Use your computer's IP (e.g., `http://192.168.1.100:3000`)
- For simulator: Use `http://localhost:3000`

---

## 📈 Success Metrics

- ✅ 80%+ extraction accuracy
- ✅ <5s end-to-end latency
- ✅ Real-time conflict detection
- ✅ Optimistic UI updates
- ✅ <$0.10 per event (API costs)

---

## 🐛 Known Limitations

- Video processing limited to 10 minutes
- Requires FFmpeg and yt-dlp for video support
- Speech-to-Text requires Google Cloud Speech API enabled
- Network IP must be configured for physical device testing

---

## 📝 Project Structure

```
eventide-ai/
├── backend/
│   ├── src/
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business logic
│   │   └── types/         # TypeScript types
│   └── service-account-key.json
├── mobile/
│   ├── src/
│   │   ├── screens/       # App screens
│   │   ├── services/      # API client
│   │   ├── theme/         # UI theme
│   │   └── config/        # Configuration
│   └── app.json
└── README.md
```

---

**Eventide AI** - Transform any content into calendar events, effortlessly.
