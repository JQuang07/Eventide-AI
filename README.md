# CAL-MGR: Agentic Calendar App

**Project Manager**: CAL-MGR  
**Track**: Google Hackathon - Media Mastery + Agentic Intelligence  
**Status**: ✅ MVP Code Complete - Ready for Setup

---

## 🚀 Quick Start

**Want to get running immediately?** → See [QUICK_START.md](./QUICK_START.md)

This repository contains a complete MVP implementation of an agentic calendar app that transforms any user-shared content into verified Google Calendar events.

### 📁 Project Structure

```
cal-mgr/
├── backend/          # Express.js/TypeScript API server
├── mobile/            # Expo React Native app
└── docs/              # Documentation
```

### 📚 Key Documents

**Setup & Configuration:**
- **[QUICK_START.md](./QUICK_START.md)**: Get running in 10 minutes
- **[API_KEYS_SETUP.md](./API_KEYS_SETUP.md)**: Complete API keys guide
- **[WORKFLOW.md](./WORKFLOW.md)**: Tech stack, architecture, and data flows

**Planning & Specs:**
- **[PROJECT_PLAN.md](./PROJECT_PLAN.md)**: MVP scope, architecture, risks, milestones
- **[TOOL_INTERFACES.md](./TOOL_INTERFACES.md)**: ADK tool specifications and I/O shapes
- **[SEQUENCE_DIAGRAMS.md](./SEQUENCE_DIAGRAMS.md)**: End-to-end flow diagrams
- **[TEST_DATASET.md](./TEST_DATASET.md)**: 40 test cases with acceptance criteria
- **[SPRINT_1_P0_ISSUES.md](./SPRINT_1_P0_ISSUES.md)**: First 48-hour sprint plan

---

## Product Summary

**Mission**: Turn "anything the user shares" (flyers, reels/URLs, text, emails) into verified calendar events with conflict checks, travel holds, and optional media assets.

**Core Workflows**:
1. Flyer → Flash Image cleanup → Gemini extraction → Calendar write
2. Share URL → UrlExpand → Gemini extraction → Calendar write
3. Text/Email → Gemini extraction → Calendar write

**Tech Stack**:
- **Frontend**: Expo (React Native/TypeScript)
- **Backend**: Node.js/Express/TypeScript
- **AI Services**: Gemini API (multimodal extraction)
- **APIs**: Google Calendar API, Google Maps API (Places, Timezone)
- **Infrastructure**: Google Cloud Platform

See [WORKFLOW.md](./WORKFLOW.md) for detailed tech stack and architecture.

---

## Sprint 1 Status

**Goal**: Core extraction + Calendar write (48h)  
**Issues**: 12 P0 issues defined  
**Next Actions**:
1. Set up backend Express server
2. Integrate Vertex AI Agent Engine
3. Build mobile input screens

See [SPRINT_1_P0_ISSUES.md](./SPRINT_1_P0_ISSUES.md) for full breakdown.

---

## Architecture

```
Mobile App (Expo)
    ↓
Backend API (Express)
    ↓
Vertex AI Agent Engine
    ↓
ADK Tools (Calendar, Places, TimeZone, Directions, UrlExpand, Media)
```

**Data Flow**: Input → Extraction → Resolution → Conflict Check → User Review → Calendar Write

---

## Getting Started (Developer)

### Prerequisites
- Node.js 18+
- Google Cloud account (with billing enabled)
- API keys (see [API_KEYS_SETUP.md](./API_KEYS_SETUP.md))

### Setup Steps

1. **Configure API Keys**
   ```bash
   # See API_KEYS_SETUP.md for detailed instructions
   # You'll need: Gemini API key, Google Maps API key, Service Account JSON
   ```

2. **Set Up Backend**
   ```bash
   cd backend
   npm install
   # Create .env file with your API keys (see .env.example)
   npm run dev
   ```

3. **Set Up Mobile App**
   ```bash
   cd mobile
   npm install
   npm start
   ```

**Full instructions**: See [QUICK_START.md](./QUICK_START.md)

---

## Success Metrics (MVP)

- 80%+ extraction accuracy (title, date, time, location)
- <5s end-to-end latency (image → review screen)
- Zero ToS violations
- <$0.10 per event (API costs)

---

## Contact & Questions

For scope questions, architecture decisions, or sprint planning, refer to CAL-MGR (this system).

**Operating Principle**: Be decisive, concrete, and action-oriented. Produce artifacts immediately.

# AIATL
