# Testing Guide

This guide explains how to write, run, and maintain tests for the Renovatr codebase.

## Table of Contents
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Writing Tests](#writing-tests)
- [Test Utilities](#test-utilities)
- [Mocking](#mocking)
- [Best Practices](#best-practices)

---

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- src/test/authService.test.ts
```

---

## Test Structure

Tests are located in `src/test/` and mirror the source structure:

```
src/
├── services/
│   ├── authService.ts
│   └── apiClient.ts
└── test/
    ├── authService.test.ts
    ├── apiClient.test.ts
    └── utils/
        └── testHelpers.ts
```

### Test File Naming
- Test files end with `.test.ts` or `.spec.ts`
- Test file names match source file names: `authService.ts` → `authService.test.ts`

---

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ServiceName', () => {
    beforeEach(() => {
        // Setup before each test
        vi.clearAllMocks();
    });

    describe('functionName', () => {
        it('should do something specific', async () => {
            // Arrange
            const input = 'test input';
            
            // Act
            const result = await functionName(input);
            
            // Assert
            expect(result).toBe('expected output');
        });

        it('should handle errors gracefully', async () => {
            // Test error handling
            await expect(functionName('invalid')).rejects.toThrow();
        });
    });
});
```

### Test Naming
- Use descriptive test names: "should return user when authenticated"
- Start with "should" to describe expected behavior
- Group related tests with `describe` blocks

### AAA Pattern
Follow Arrange-Act-Assert pattern:

```typescript
it('should fetch user projects', async () => {
    // Arrange: Set up test data and mocks
    const userId = 'user-123';
    const mockProjects = [createMockProject()];
    vi.mocked(apiGetProjects).mockResolvedValue(mockProjects);
    
    // Act: Execute the function being tested
    const result = await getProjectsForUser(userId);
    
    // Assert: Verify the results
    expect(result).toEqual(mockProjects);
    expect(apiGetProjects).toHaveBeenCalled();
});
```

---

## Test Utilities

### Mock Data Creators
Use helper functions from `test/utils/testHelpers.ts`:

```typescript
import { 
    createMockTask,
    createMockProject,
    createMockUser,
    createMockProperty
} from './utils/testHelpers';

const task = createMockTask({ 
    title: 'Custom Task',
    status: TaskStatus.InProgress 
});

const project = createMockProject({ 
    tasks: [task] 
});
```

### Mock Responses
```typescript
import { 
    mockFetchSuccess,
    mockFetchError,
    createMockSupabaseResponse
} from './utils/testHelpers';

// Mock successful fetch
global.fetch = vi.fn().mockResolvedValue(
    mockFetchSuccess({ data: 'result' })
);

// Mock error response
global.fetch = vi.fn().mockResolvedValue(
    mockFetchError(404, 'Not found')
);

// Mock Supabase response
vi.mocked(supabase.from).mockReturnValue({
    select: vi.fn().mockResolvedValue(
        createMockSupabaseResponse(data)
    )
});
```

---

## Mocking

### Mocking Modules
```typescript
// Mock entire module
vi.mock('../services/supabaseClient', () => ({
    supabase: {
        auth: {
            getSession: vi.fn(),
        },
    },
}));

// Partial mock (keep some original functionality)
vi.mock('../services/apiClient', async () => {
    const actual = await vi.importActual('../services/apiClient');
    return {
        ...actual,
        apiGetProjects: vi.fn(),
    };
});
```

### Mocking Global Objects
```typescript
// Mock fetch
global.fetch = vi.fn();

// Mock window
global.window = {
    location: { origin: 'http://localhost' },
} as any;
```

### Resetting Mocks
```typescript
beforeEach(() => {
    // Clear all mocks between tests
    vi.clearAllMocks();
    
    // Reset specific mock implementation
    vi.mocked(fetch).mockReset();
});
```

---

## Testing Async Code

### Promises
```typescript
it('should handle async operations', async () => {
    const promise = asyncFunction();
    await expect(promise).resolves.toBe(expectedValue);
});

it('should handle async errors', async () => {
    const promise = asyncFunction();
    await expect(promise).rejects.toThrow('Error message');
});
```

### Waiting
```typescript
import { wait } from './utils/testHelpers';

it('should update after delay', async () => {
    await wait(100); // Wait 100ms
    expect(component.state).toBe('updated');
});
```

---

## Testing React Components

### Component Testing Setup
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MyComponent } from '../components/MyComponent';

describe('MyComponent', () => {
    it('should render correctly', () => {
        render(<MyComponent userId="123" />);
        expect(screen.getByText('Expected Text')).toBeInTheDocument();
    });

    it('should handle user interaction', async () => {
        const onUpdate = vi.fn();
        render(<MyComponent userId="123" onUpdate={onUpdate} />);
        
        fireEvent.click(screen.getByRole('button'));
        
        await waitFor(() => {
            expect(onUpdate).toHaveBeenCalled();
        });
    });
});
```

---

## Testing API Endpoints

### Integration Tests
For server-side API endpoints, test the full request/response cycle:

```typescript
import request from 'supertest';
import app from '../server';

describe('GET /api/projects', () => {
    it('should return projects for authenticated user', async () => {
        const token = 'valid-jwt-token';
        const response = await request(app)
            .get('/api/projects')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
        
        expect(response.body).toBeInstanceOf(Array);
    });

    it('should return 401 for unauthenticated requests', async () => {
        await request(app)
            .get('/api/projects')
            .expect(401);
    });
});
```

---

## Best Practices

### 1. Test Behavior, Not Implementation
```typescript
// Good: Tests what the function does
it('should return user projects', async () => {
    const projects = await getProjectsForUser(userId);
    expect(projects).toHaveLength(3);
});

// Bad: Tests implementation details
it('should call apiGetProjects', async () => {
    await getProjectsForUser(userId);
    expect(apiGetProjects).toHaveBeenCalled();
});
```

### 2. Keep Tests Independent
Each test should be able to run in isolation:

```typescript
// Good: Each test sets up its own data
beforeEach(() => {
    vi.clearAllMocks();
    setupTestData();
});

// Bad: Tests depend on order or shared state
let sharedState = {};
```

### 3. Test Edge Cases
```typescript
describe('edge cases', () => {
    it('should handle empty arrays', () => {});
    it('should handle null values', () => {});
    it('should handle very large inputs', () => {});
    it('should handle network errors', () => {});
});
```

### 4. Use Descriptive Assertions
```typescript
// Good: Clear what's being tested
expect(result).toEqual(expected);
expect(result.length).toBeGreaterThan(0);

// Bad: Unclear assertions
expect(result).toBeTruthy();
```

### 5. Mock External Dependencies
Always mock external services, APIs, and databases:

```typescript
// Mock Supabase
vi.mock('../services/supabaseClient');

// Mock fetch
global.fetch = vi.fn();

// Mock Gemini API
vi.mock('../services/geminiService');
```

### 6. Test Error Handling
```typescript
it('should handle authentication errors', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await expect(getCurrentUser()).resolves.toBeNull();
});

it('should handle API errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
    });
    await expect(apiGetProjects()).rejects.toThrow();
});
```

---

## Coverage Goals

Aim for:
- **80%+** overall coverage
- **90%+** for critical paths (auth, payments, data operations)
- **70%+** for UI components

Run coverage reports:
```bash
npm test -- --coverage
```

---

## Common Test Patterns

### Testing Hooks
```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useProjects } from '../hooks/useProjects';

it('should fetch projects on mount', async () => {
    const { result } = renderHook(() => useProjects('user-123'));
    
    expect(result.current.isLoading).toBe(true);
    
    await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.projects).toHaveLength(1);
    });
});
```

### Testing Forms
```typescript
it('should validate form input', async () => {
    render(<SignUpForm />);
    
    const emailInput = screen.getByLabelText('Email');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    
    fireEvent.submit(screen.getByRole('form'));
    
    await waitFor(() => {
        expect(screen.getByText('Invalid email')).toBeInTheDocument();
    });
});
```

---

## Debugging Tests

### Run Single Test
```bash
npm test -- -t "test name"
```

### Debug Mode
```typescript
// Add debugger statements
it('should do something', () => {
    debugger; // Pauses execution in debugger
    // ... test code
});
```

### Console Logging
```typescript
it('should do something', () => {
    console.log('Debug info:', data);
    // ... test code
});
```

---

## Questions?

- Check existing tests for examples
- Review this guide
- Ask the team

Happy testing! 🧪

