# Code Patterns & Conventions

This document outlines the coding patterns, conventions, and best practices used throughout the Renovatr codebase. Following these patterns will help maintain consistency and make the codebase easier to understand and maintain.

## Table of Contents
- [File Structure](#file-structure)
- [Naming Conventions](#naming-conventions)
- [Error Handling](#error-handling)
- [Type Safety](#type-safety)
- [API Patterns](#api-patterns)
- [Testing Patterns](#testing-patterns)
- [React Patterns](#react-patterns)

---

## File Structure

```
src/
├── components/       # React components (UI)
├── services/         # Business logic, API calls, data operations
├── utils/            # Utility functions, helpers, type guards
├── types.ts          # Shared TypeScript types
├── test/             # Test files (mirror src structure)
│   └── utils/        # Test utilities and mocks
└── middleware/       # Express middleware
```

### File Naming
- **Components**: PascalCase (e.g., `ChatWindow.tsx`, `PropertySetup.tsx`)
- **Services**: camelCase (e.g., `authService.ts`, `projectService.ts`)
- **Utils**: camelCase (e.g., `logger.ts`, `typeGuards.ts`)
- **Types**: camelCase (e.g., `types.ts`)
- **Tests**: `*.test.ts` or `*.spec.ts`

---

## Naming Conventions

### Variables & Functions
- Use **camelCase** for variables and functions
- Use **PascalCase** for React components and classes
- Use **UPPER_SNAKE_CASE** for constants
- Prefix boolean variables with `is`, `has`, `can`, `should` (e.g., `isLoading`, `hasError`)

### API Endpoints
- Use RESTful conventions: `/api/projects`, `/api/projects/:id`, `/api/projects/:id/tasks`
- Use HTTP methods correctly: GET (read), POST (create), PUT (update), DELETE (delete)

### Type Definitions
- Use PascalCase for types and interfaces
- Prefix interfaces with `I` only if necessary for clarity (we don't do this currently)
- Use descriptive names: `Task`, `Project`, `User` not `Data`, `Item`, `Obj`

---

## Error Handling

### Custom Error Classes
Always use custom error classes from `utils/errors.ts`:

```typescript
import { AuthError, ValidationError, NotFoundError } from '../utils/errors';

// Authentication errors
throw new AuthError('Invalid credentials');

// Validation errors
throw new ValidationError('Email is required', 'email');

// Not found errors
throw new NotFoundError('Project', projectId);
```

### Error Handling Pattern
```typescript
try {
    const result = await someAsyncOperation();
    return result;
} catch (error) {
    logger.error('Operation failed', error, { context });
    throw new AppError('User-friendly message', 'ERROR_CODE');
}
```

### API Error Responses
Always return consistent error responses:
```typescript
res.status(400).json({ 
    error: 'Validation failed', 
    details: error.errors 
});
```

---

## Type Safety

### Type Guards
Use type guards from `utils/typeGuards.ts` for runtime type checking:

```typescript
import { isTask, isUser, assertNotNull } from '../utils/typeGuards';

if (isTask(data)) {
    // TypeScript now knows data is a Task
    console.log(data.title);
}

assertNotNull(project, 'Project is required');
// TypeScript now knows project is not null
```

### Avoid `any`
- Never use `any` unless absolutely necessary
- Use `unknown` and type guards for dynamic data
- Use generic types where appropriate: `<T>`, `<K extends keyof T>`

### Null Safety
```typescript
// Good: Use optional chaining and nullish coalescing
const name = user?.profile?.name ?? 'Anonymous';

// Good: Use type guards
if (user && isUser(user)) {
    // Type-safe access
}
```

---

## API Patterns

### Service Layer Pattern
All data operations go through service modules:

```typescript
// services/projectService.ts
export const getProjectsForUser = async (userId: string): Promise<Project[]> => {
    if (USE_SERVER_API) {
        return await apiGetProjects(); // Uses authenticated API
    }
    // Legacy client-side code
    return await supabase.from('projects').select('*');
};
```

### API Client Pattern
Use the `apiClient` for all server-side API calls:

```typescript
import { apiGetProjects, apiCreateProject } from './services/apiClient';

// All requests automatically include JWT authentication
const projects = await apiGetProjects();
```

### Request Validation
Always validate incoming requests:

```typescript
// server.js
app.post('/api/projects', 
    verifyAuth,                              // Authentication check
    validateRequest(propertySchema),         // Request validation
    async (req, res) => {
        // req.validated contains validated data
    }
);
```

---

## Testing Patterns

### Test Structure
```typescript
describe('Service Name', () => {
    describe('functionName', () => {
        it('should do something specific', async () => {
            // Arrange
            const input = createMockData();
            
            // Act
            const result = await functionName(input);
            
            // Assert
            expect(result).toEqual(expected);
        });
    });
});
```

### Test Utilities
Use test helpers from `test/utils/testHelpers.ts`:

```typescript
import { createMockTask, createMockProject, mockFetchSuccess } from './utils/testHelpers';

const mockTask = createMockTask({ title: 'Test Task' });
const mockProject = createMockProject({ tasks: [mockTask] });
```

### Mocking
```typescript
// Mock external dependencies
vi.mock('../services/supabaseClient', () => ({
    supabase: {
        auth: {
            getSession: vi.fn(),
        },
    },
}));

// Reset mocks between tests
beforeEach(() => {
    vi.clearAllMocks();
});
```

---

## React Patterns

### Component Structure
```typescript
// 1. Imports
import React, { useState, useEffect } from 'react';

// 2. Types/Interfaces
interface Props {
    userId: string;
    onUpdate?: () => void;
}

// 3. Constants (if any)
const DEFAULT_VALUE = 'something';

// 4. Component
export const MyComponent: React.FC<Props> = ({ userId, onUpdate }) => {
    // 5. State
    const [isLoading, setIsLoading] = useState(false);
    
    // 6. Effects
    useEffect(() => {
        // Effect logic
    }, [userId]);
    
    // 7. Handlers
    const handleClick = () => {
        // Handler logic
    };
    
    // 8. Render
    return <div>...</div>;
};
```

### Custom Hooks
Extract reusable logic into custom hooks:

```typescript
// hooks/useProjects.ts
export const useProjects = (userId: string) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        projectService.getProjectsForUser(userId)
            .then(setProjects)
            .finally(() => setIsLoading(false));
    }, [userId]);
    
    return { projects, isLoading };
};
```

### State Management
- Use `useState` for local component state
- Use `useMemo` for expensive computations
- Use `useCallback` for event handlers passed to children
- Consider context for shared state across multiple components

---

## Documentation

### JSDoc Comments
All public functions should have JSDoc comments:

```typescript
/**
 * Fetches all projects for the currently authenticated user.
 * 
 * @param {string} userId - The user's unique identifier
 * @returns {Promise<Project[]>} Array of user's projects
 * @throws {Error} If authentication fails or API request fails
 * 
 * @example
 * ```typescript
 * const projects = await getProjectsForUser(userId);
 * console.log(`Found ${projects.length} projects`);
 * ```
 */
export const getProjectsForUser = async (userId: string): Promise<Project[]> => {
    // Implementation
};
```

### Inline Comments
Use comments to explain **why**, not **what**:

```typescript
// Good: Explains reasoning
// Use Flash for simple queries (97% cheaper than Pro)
const model = 'gemini-2.5-flash';

// Bad: States the obvious
// Set model to flash
const model = 'gemini-2.5-flash';
```

---

## Security Patterns

### Authentication
- Always verify authentication on protected endpoints
- Use JWT tokens from Supabase Auth
- Never expose service role keys to client

### Input Validation
- Validate all user input with Zod schemas
- Sanitize data before database operations
- Validate file uploads (type, size)

### Error Messages
- Don't expose internal errors to users
- Log detailed errors server-side
- Return generic error messages to clients

---

## Performance Patterns

### API Optimization
- Use Flash model for simple queries, Pro for complex
- Limit chat history to recent messages (last 10-15)
- Debounce expensive operations

### React Optimization
- Use `useMemo` for expensive computations
- Use `useCallback` for stable function references
- Avoid unnecessary re-renders with proper dependency arrays

---

## Common Patterns

### Feature Flags
```typescript
const USE_SERVER_API = true; // Feature flag

if (USE_SERVER_API) {
    // New implementation
} else {
    // Legacy implementation
}
```

### Async/Await
Always use async/await over promise chains:

```typescript
// Good
try {
    const result = await someAsyncOperation();
    return result;
} catch (error) {
    handleError(error);
}

// Avoid
someAsyncOperation()
    .then(result => {
        // Handle result
    })
    .catch(error => {
        // Handle error
    });
```

---

## Questions?

If you're unsure about a pattern, check:
1. Existing code in the codebase
2. This documentation
3. TypeScript/React best practices
4. Ask the team

Remember: **Consistency is more important than perfection.** Follow existing patterns even if you have a "better" idea - we can refactor later if needed.

