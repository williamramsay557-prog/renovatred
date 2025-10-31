# Development Setup Guide

This guide will help you set up the Renovatr codebase for development.

## Prerequisites

- **Node.js** 18+ and npm
- **Supabase Account** (free tier works)
- **Google Gemini API Key** (from Google AI Studio)
- **Git** (for version control)

## Initial Setup

### 1. Clone and Install

```bash
# Clone the repository (if using git)
git clone <repository-url>
cd renovatred

# Install dependencies
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory (see `ENV_SETUP.md` for details):

```bash
# Required
GEMINI_API_KEY=your-gemini-api-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5000
```

### 3. Supabase Setup

Follow the instructions in `README-SUPABASE.md` (if it exists) or:

1. Create a new Supabase project
2. Run the SQL migrations to set up tables
3. Configure storage bucket named "images"
4. Set up Row Level Security (RLS) policies

### 4. Verify Setup

```bash
# Check that dependencies installed correctly
npm list --depth=0

# Verify TypeScript compilation
npm run build

# Run tests
npm test
```

## Development Workflow

### Starting the Development Servers

```bash
# Start both frontend and backend
npm start

# Or run separately:
npm run dev      # Frontend (port 5000)
npm run server   # Backend (port 3000)
```

The application will be available at:
- **Frontend**: http://localhost:5000
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm test -- --coverage
```

## Project Structure

```
renovatred/
├── src/
│   ├── components/      # React components
│   ├── services/        # Business logic & API calls
│   ├── utils/           # Utilities, helpers, type guards
│   ├── middleware/      # Express middleware
│   ├── test/            # Test files
│   ├── types.ts         # TypeScript type definitions
│   ├── App.tsx          # Main React component
│   └── index.tsx        # React entry point
├── server.js            # Express backend server
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite build configuration
└── vitest.config.ts     # Test configuration
```

## Common Tasks

### Adding a New Feature

1. Create feature branch: `git checkout -b feature/my-feature`
2. Add types in `src/types.ts` (if needed)
3. Add service functions in `src/services/`
4. Add React components in `src/components/`
5. Write tests in `src/test/`
6. Update documentation if needed

### Adding a New API Endpoint

1. Add route in `server.js`
2. Add validation schema (Zod)
3. Add authentication middleware
4. Implement handler function
5. Add client function in `src/services/apiClient.ts`
6. Write tests

### Debugging

**Frontend Debugging:**
- Use React DevTools browser extension
- Check browser console for errors
- Use `console.log` or debugger statements
- Check Network tab for API calls

**Backend Debugging:**
- Check server console output
- Use `console.log` in `server.js`
- Check API responses in Network tab
- Verify authentication tokens

**Common Issues:**
- **"Not authenticated"**: Check Supabase session
- **CORS errors**: Verify CORS settings in `server.js`
- **Type errors**: Run `npm run build` to see TypeScript errors
- **Test failures**: Check mock setup and test data

## Development Tips

### Hot Reload
Both frontend and backend support hot reload:
- Frontend: Automatically reloads on file changes
- Backend: Restart required (can use `nodemon` for auto-restart)

### TypeScript
- Use TypeScript for all new files
- Run `npm run build` regularly to catch type errors
- Use type guards from `utils/typeGuards.ts` for runtime checks

### Code Style
- Follow patterns in `CODE_PATTERNS.md`
- Use Prettier for formatting (configured)
- Follow ESLint rules
- Add JSDoc comments to public functions

### Git Workflow
```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/my-feature
```

### Commit Messages
Use conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `test:` Tests
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

## Testing Strategy

1. **Unit Tests**: Test individual functions/services
2. **Integration Tests**: Test API endpoints
3. **Component Tests**: Test React components
4. **E2E Tests**: (Optional) Full user flows

See `TESTING_GUIDE.md` for detailed testing instructions.

## Performance

### Frontend
- Use React DevTools Profiler to identify slow components
- Check bundle size: `npm run build` shows sizes
- Use `useMemo` and `useCallback` appropriately

### Backend
- Monitor API response times
- Check Gemini API usage (cost optimization)
- Use rate limiting to prevent abuse

## Resources

- **Documentation**:
  - `README.md` - Project overview
  - `CODE_PATTERNS.md` - Coding conventions
  - `TESTING_GUIDE.md` - Testing guide
  - `ENV_SETUP.md` - Environment variables
  - `NEXT_STEPS.md` - Roadmap and next steps

- **External Docs**:
  - [React Docs](https://react.dev)
  - [TypeScript Docs](https://www.typescriptlang.org/docs/)
  - [Supabase Docs](https://supabase.com/docs)
  - [Gemini API Docs](https://ai.google.dev/docs)
  - [Vitest Docs](https://vitest.dev)

## Getting Help

1. Check existing documentation
2. Search codebase for similar patterns
3. Check GitHub issues (if applicable)
4. Ask the team

## Next Steps

After setup, check:
- [ ] All tests passing
- [ ] Application runs locally
- [ ] Can create/login user
- [ ] Can create a project
- [ ] API endpoints respond correctly

Then proceed with `NEXT_STEPS.md` for development roadmap.

