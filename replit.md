# Renovatr App

## Overview
Renovatr is a UK-focused DIY home renovation planning application. It helps users plan renovation projects with AI-powered task breakdown, cost estimation, material lists, and safety guidance powered by Google Gemini AI.

## Recent Changes (October 30, 2025)
- **Migrated from Vercel to Replit**: Converted Vercel Edge Functions to Node.js Express backend
- **Architecture Update**: Separated client and server for improved security
- **Backend Server**: Created `server.js` with Express to handle `/api/gemini` endpoint on port 3000
- **Frontend Configuration**: Updated Vite config to bind to `0.0.0.0:5000` and proxy API requests to backend
- **Workflow Setup**: Configured concurrent execution of frontend and backend servers
- **Security**: API keys now properly stored in Replit Secrets and only used server-side

## Project Architecture

### Frontend (Port 5000)
- **Framework**: React 18 + TypeScript + Vite
- **UI Components**: Located in `src/components/`
  - `Auth.tsx` - User authentication
  - `PropertySetup.tsx` - Project initialization
  - `ChatWindow.tsx` - AI chat interface
  - `RoomProgress.tsx` - Task tracking and progress
  - `LandingPage.tsx` - Marketing/landing page
- **Services**: Located in `src/services/`
  - `supabaseClient.ts` - Database connection (Supabase)
  - `geminiService.ts` - API calls to backend
  - `authService.ts` - Authentication logic
  - `projectService.ts` - Project management

### Backend (Port 3000)
- **Framework**: Express.js (Node.js)
- **File**: `server.js`
- **Endpoints**:
  - `POST /api/gemini` - Main AI processing endpoint
  - `GET /health` - Health check
- **AI Actions**:
  - `generateTaskDetails` - Creates detailed task plans with materials, tools, costs
  - `getTaskChatResponse` - Chat responses for specific tasks
  - `getProjectChatResponse` - Project-level chat with task suggestions
  - `generateGuidingTaskIntroduction` - Initial task chat message
  - `generateProjectSummary` - Project overview generation
  - `generateVisionStatement` - Extracts user's renovation vision

### Database
- **Service**: Supabase (PostgreSQL)
- **Purpose**: User authentication, project storage, task management

## Environment Variables
Required secrets (configured in Replit Secrets):
- `GEMINI_API_KEY` - Google Gemini AI API key
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous/public key

**Important**: The application is configured to use Replit Secrets. The server validates that `GEMINI_API_KEY` is present at startup and will exit with an error if missing. A `.env.example` file is provided for reference.

## Running the Application
The workflow runs both servers concurrently:
```bash
npm run server & npm run dev
```

- Backend: http://localhost:3000
- Frontend: http://localhost:5000 (public-facing)

## Key Features
1. **AI-Powered Planning**: Uses Gemini 2.5 Pro for detailed task breakdown
2. **UK-Specific**: Materials and costs in GBP, Amazon.co.uk affiliate links
3. **Safety-First**: Generates safety warnings and PPE requirements
4. **Professional Advice**: Recommends when to hire certified professionals
5. **Chat Interface**: Conversational planning with AI assistance
6. **Progress Tracking**: Task completion, material checklist, tool inventory

## Technology Stack
- React 18 + TypeScript
- Vite (build tool)
- Express.js (backend server)
- Google Gemini AI (2.5 Pro & Flash)
- Supabase (auth + database)
- UUID for ID generation

## File Structure
```
├── src/
│   ├── components/     # React components
│   ├── services/       # API and service layers
│   ├── App.tsx        # Main app component
│   ├── types.ts       # TypeScript type definitions
│   └── index.tsx      # Entry point
├── server.js          # Express backend server
├── vite.config.ts     # Vite configuration
├── package.json       # Dependencies and scripts
└── replit.md         # This file
```

## Security Notes
- API keys are stored server-side only (never exposed to client)
- Supabase anon key is safe for client-side use (public key)
- Backend validates all requests before processing
- CORS enabled for local development
