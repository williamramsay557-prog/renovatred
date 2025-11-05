import express from 'express';
import cors from 'cors';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const app = express();
const PORT = 3000;

// Initialize server-side Supabase client with service role key
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// For serverless (Vercel), don't exit immediately - check on first request instead
const isServerless = process.env.VERCEL === '1' || !process.env.NODE_ENV || process.env.NODE_ENV === 'production';

let supabaseServer;
if (supabaseUrl && supabaseServiceKey) {
    // Configure Supabase client for serverless
    // Note: We use Promise.race with timeouts at the query level instead of fetch-level timeouts
    // because Supabase's internal fetch handling can be complex
    supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        },
        // Connection timeout handled at query level with Promise.race
        db: {
            schema: 'public'
        }
    });
    console.log('Supabase client initialized successfully');
} else {
    if (!isServerless) {
        // Only exit in development/non-serverless environments
        console.error('ERROR: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
        process.exit(1);
    } else {
        console.warn('WARNING: Supabase credentials not available at startup (may be set in Vercel env vars)');
    }
}

// Validate required environment variables
if (!process.env.GEMINI_API_KEY && !isServerless) {
    console.error('ERROR: GEMINI_API_KEY is not set. Please add it to your environment variables.');
    process.exit(1);
}

// ============================================================================
// CONSTANTS
// ============================================================================
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 20;
// Note: REQUEST_TIMEOUT removed - Vercel handles timeouts at platform level (10s free, 30s pro)
const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB

// Rate limiting
const requestCounts = new Map();

function rateLimitMiddleware(req, res, next) {
    const identifier = req.ip || 'unknown';
    const now = Date.now();
    const record = requestCounts.get(identifier);

    if (!record || now > record.resetTime) {
        requestCounts.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return next();
    }

    if (record.count >= MAX_REQUESTS) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    record.count++;
    next();
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Note: Request timeout middleware removed for serverless compatibility
// Vercel handles timeouts at the platform level (10s free, 30s pro)
// We cannot use req.setTimeout() in serverless environments

// CORS configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? process.env.ALLOWED_ORIGINS?.split(',') || [] 
        : ['http://localhost:5000', 'http://0.0.0.0:5000'],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parser with size limit
app.use(express.json({ limit: `${MAX_PAYLOAD_SIZE / 1024 / 1024}mb` }));

// Rate limiting
app.use(rateLimitMiddleware);

// SECURITY: Image validation function
const validateImageUpload = (imageData) => {
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    
    if (!imageData || typeof imageData !== 'string') {
        throw new Error('Invalid image data');
    }
    
    // Extract MIME type from data URL
    const matches = imageData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        throw new Error('Invalid image format - must be base64 data URL');
    }
    
    const mimeType = matches[1];
    const base64Data = matches[2];
    
    // Validate MIME type
    if (!ALLOWED_TYPES.includes(mimeType)) {
        throw new Error(`Unsupported image type: ${mimeType}. Allowed types: ${ALLOWED_TYPES.join(', ')}`);
    }
    
    // Validate file size (estimate from base64)
    const sizeInBytes = (base64Data.length * 3) / 4;
    if (sizeInBytes > MAX_SIZE) {
        throw new Error(`Image too large: ${(sizeInBytes / 1024 / 1024).toFixed(2)}MB. Maximum allowed: 5MB`);
    }
    
    return { mimeType, base64Data, size: sizeInBytes };
};

// Initialize Gemini AI with API key from environment
// Will throw error on first use if not set (better for serverless)
let ai;
if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

// ============================================================================
// AUTHENTICATION & VALIDATION MIDDLEWARE
// ============================================================================

/**
 * JWT Auth Middleware
 * Verifies Supabase access tokens and attaches user to request
 */
const verifyAuth = async (req, res, next) => {
    const authStartTime = Date.now();
    console.log('=== verifyAuth START ===');
    console.log('verifyAuth timestamp:', new Date().toISOString());
    console.log('verifyAuth path:', req.path);
    console.log('verifyAuth method:', req.method);
    
    try {
        // Check if Supabase is configured (lazy check for serverless)
        console.log('verifyAuth: Checking Supabase client...');
        if (!supabaseServer) {
            console.log('verifyAuth: Supabase client not initialized, attempting lazy init...');
            // Try to initialize if we have the env vars now
            if (supabaseUrl && supabaseServiceKey) {
                console.log('verifyAuth: Initializing Supabase client with env vars...');
                supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
                    auth: {
                        autoRefreshToken: false,
                        persistSession: false
                    }
                });
                console.log('verifyAuth: Supabase client initialized lazily');
            } else {
                console.error('verifyAuth: Supabase credentials missing!');
                console.error('verifyAuth: supabaseUrl:', !!supabaseUrl);
                console.error('verifyAuth: supabaseServiceKey:', !!supabaseServiceKey);
                return res.status(500).json({ 
                    error: 'Server configuration error',
                    message: 'Supabase credentials are not configured. Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables in Vercel.'
                });
            }
        } else {
            console.log('verifyAuth: Supabase client already initialized');
        }
        
        const authHeader = req.headers.authorization;
        console.log('verifyAuth: Auth header present:', !!authHeader);
        console.log('verifyAuth: Auth header starts with Bearer:', authHeader?.startsWith('Bearer '));
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.error('verifyAuth: No valid authorization header');
            return res.status(401).json({ error: 'Unauthorized - No valid authorization header' });
        }
        
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        console.log('verifyAuth: Token extracted, length:', token.length);
        console.log('verifyAuth: Token preview:', token.substring(0, 20) + '...');
        
        // Verify JWT using Supabase with timeout
        console.log('verifyAuth: Starting auth.getUser() call...');
        const authStart = Date.now();
        const authPromise = supabaseServer.auth.getUser(token);
        const authTimeout = new Promise((_, reject) => 
            setTimeout(() => {
                console.error('verifyAuth: Auth verification TIMED OUT after 3s');
                reject(new Error('Auth verification timeout after 3 seconds'));
            }, 3000)
        );
        
        let user, error;
        try {
            console.log('verifyAuth: Racing auth promise against timeout...');
            const result = await Promise.race([authPromise, authTimeout]);
            const authTime = Date.now() - authStart;
            user = result.data?.user;
            error = result.error;
            console.log(`verifyAuth: Auth verification completed in ${authTime}ms`);
            console.log('verifyAuth: User found:', !!user);
            console.log('verifyAuth: Auth error:', error?.message || 'none');
        } catch (err) {
            const authTime = Date.now() - authStart;
            console.error(`verifyAuth: Auth timeout or error after ${authTime}ms:`, err);
            console.error('verifyAuth: Error type:', err?.constructor?.name);
            console.error('verifyAuth: Error message:', err?.message);
            return res.status(401).json({ 
                error: 'Authentication failed',
                message: err instanceof Error ? err.message : 'Auth verification timed out'
            });
        }
        
        if (error || !user) {
            console.error('Auth verification failed:', error);
            return res.status(401).json({ 
                error: 'Unauthorized - Invalid or expired token',
                details: error?.message 
            });
        }
        
        // Attach user to request object
        req.user = {
            id: user.id,
            email: user.email,
            token: token
        };
        
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({ 
            error: 'Internal authentication error',
            message: error instanceof Error ? error.message : String(error)
        });
    }
};

// ============================================================================
// REQUEST VALIDATION SCHEMAS
// ============================================================================

const roomSchema = z.object({
    name: z.string().min(1).max(100),
    photos: z.array(z.string()).optional().default([]),
    id: z.string().uuid().optional(),
    aiSummary: z.string().optional()
});

const propertySchema = z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(200),
    rooms: z.array(roomSchema),
    visionStatement: z.string().optional(),
    projectChatHistory: z.array(z.any()).optional()
});

const taskSchema = z.object({
    id: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    title: z.string().min(1).max(300),
    room: z.string().min(1).max(100),
    status: z.string().optional(),
    priority: z.string().optional(),
    description: z.string().optional(),
    chatHistory: z.array(z.any()).optional(),
    guide: z.array(z.any()).optional(),
    safety: z.array(z.any()).optional(),
    materials: z.array(z.any()).optional(),
    tools: z.array(z.any()).optional(),
    cost: z.number().optional(),
    time: z.string().optional(),
    hiringInfo: z.any().optional(),
    hasBeenOpened: z.boolean().optional(),
    isComplete: z.boolean().optional()
});

const imageUploadSchema = z.object({
    dataUrl: z.string().regex(/^data:image\/(jpeg|png|webp|gif);base64,/),
    fileNamePrefix: z.string().min(1).max(50)
});

/**
 * Validation middleware factory
 * Creates middleware to validate request body against a Zod schema
 */
const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            const validated = schema.parse(req.body);
            req.validated = validated;
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                console.error('Validation error:', error.errors);
                const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
                return res.status(400).json({ 
                    error: 'Validation failed', 
                    message: errorMessage,
                    details: error.errors 
                });
            }
            console.error('Request validation error:', error);
            return res.status(400).json({ 
                error: 'Invalid request body', 
                message: error.message || 'Invalid request' 
            });
        }
    };
};

// Health check endpoint - no auth required
app.get('/health', (req, res) => {
    console.log('=== /health endpoint called ===');
    console.log('Health check timestamp:', new Date().toISOString());
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: {
            VERCEL: process.env.VERCEL,
            NODE_ENV: process.env.NODE_ENV,
            hasSupabaseUrl: !!supabaseUrl,
            hasSupabaseKey: !!supabaseServiceKey,
            supabaseClientInitialized: !!supabaseServer
        }
    });
});

// Test endpoint - no auth, just to verify serverless function works
app.get('/api/test', (req, res) => {
    console.log('=== /api/test endpoint called ===');
    console.log('Test endpoint timestamp:', new Date().toISOString());
    res.json({ 
        message: 'Serverless function is working',
        timestamp: new Date().toISOString()
    });
});

// ============================================================================
// SECURE API ENDPOINTS (Phase 2)
// ============================================================================

// --- Project CRUD Operations ---

/**
 * GET /api/projects
 * Fetch all projects for the authenticated user
 */
app.get('/api/projects', verifyAuth, async (req, res) => {
    const startTime = Date.now();
    // Log immediately to verify function is called
    console.log('=== GET /api/projects START ===');
    console.log('Timestamp:', new Date().toISOString());
    
    try {
        const userId = req.user.id;
        console.log('[GET /api/projects] Starting request for user:', userId);
        console.log('[GET /api/projects] Supabase configured:', !!supabaseServer);
        console.log('[GET /api/projects] Supabase URL:', supabaseUrl ? `SET (${supabaseUrl.substring(0, 20)}...)` : 'MISSING');
        console.log('[GET /api/projects] Supabase Key:', supabaseServiceKey ? `SET (${supabaseServiceKey.substring(0, 10)}...)` : 'MISSING');
        console.log('[GET /api/projects] Environment check:', {
            VERCEL: process.env.VERCEL,
            NODE_ENV: process.env.NODE_ENV,
            hasSupabaseUrl: !!supabaseUrl,
            hasSupabaseKey: !!supabaseServiceKey
        });
        
        // Check if Supabase is configured
        if (!supabaseServer) {
            console.error('[GET /api/projects] Supabase not configured!');
            return res.status(500).json({ 
                error: 'Server configuration error',
                message: 'Supabase is not configured. Please set environment variables.'
            });
        }
        
        // First, test basic connectivity with a simple query
        console.log('[GET /api/projects] Testing Supabase connectivity...');
        const connectivityTestStart = Date.now();
        try {
            // Simple test query to verify connection works
            const testQuery = supabaseServer
                .from('projects')
                .select('id')
                .limit(1);
            
            const testTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Connectivity test timeout')), 3000)
            );
            
            const testResult = await Promise.race([testQuery, testTimeout]);
            console.log(`[GET /api/projects] Connectivity test passed in ${Date.now() - connectivityTestStart}ms`);
            if (testResult.error) {
                console.error('[GET /api/projects] Connectivity test returned error:', testResult.error);
                console.error('[GET /api/projects] Error details:', JSON.stringify(testResult.error, null, 2));
            }
        } catch (err) {
            console.error('[GET /api/projects] Connectivity test failed:', err);
            throw new Error(`Cannot connect to Supabase: ${err instanceof Error ? err.message : String(err)}`);
        }
        
        // OPTIMIZATION: Fetch projects first without nested data (faster)
        console.log('[GET /api/projects] Starting projects query for user:', userId);
        const projectsQueryStart = Date.now();
        const projectsPromise = supabaseServer
            .from('projects')
            .select('id, user_id, name, vision_statement, project_chat_history')
            .eq('user_id', userId)
            .limit(50); // Limit to prevent huge queries
        
        const projectsTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Projects query timeout after 5s')), 5000)
        );
        
        let projectsData, projectsError;
        try {
            const result = await Promise.race([projectsPromise, projectsTimeout]);
            projectsData = result.data;
            projectsError = result.error;
            
            // Log detailed error if present
            if (projectsError) {
                console.error('[GET /api/projects] Supabase error details:', {
                    message: projectsError.message,
                    details: projectsError.details,
                    hint: projectsError.hint,
                    code: projectsError.code
                });
            }
        } catch (err) {
            console.error('[GET /api/projects] Projects query timeout or error:', err);
            console.error('[GET /api/projects] Error type:', err?.constructor?.name);
            console.error('[GET /api/projects] Error stack:', err?.stack);
            throw err;
        }
        
        if (projectsError) {
            console.error('[GET /api/projects] Supabase projects query error:', projectsError);
            console.error('[GET /api/projects] Full error object:', JSON.stringify(projectsError, null, 2));
            
            // Provide more specific error messages
            let errorMessage = `Database error: ${projectsError.message || projectsError.code || 'Unknown error'}`;
            if (projectsError.code === 'PGRST116') {
                errorMessage = 'No projects found (this is expected for new users)';
            } else if (projectsError.code === 'PGRST301') {
                errorMessage = 'Permission denied - check RLS policies or service role key';
            } else if (projectsError.hint) {
                errorMessage += `\nHint: ${projectsError.hint}`;
            }
            
            throw new Error(errorMessage);
        }
        
        const projectsQueryTime = Date.now() - projectsQueryStart;
        console.log(`[GET /api/projects] Fetched ${projectsData?.length || 0} projects in ${projectsQueryTime}ms`);
        
        if (!projectsData || projectsData.length === 0) {
            console.log('[GET /api/projects] No projects found, returning empty array');
            return res.json([]);
        }
        
        // OPTIMIZATION: Fetch rooms and tasks separately (parallel, faster than nested queries)
        const projectIds = projectsData.map(p => p.id);
        console.log(`[GET /api/projects] Fetching rooms and tasks for ${projectIds.length} projects...`);
        const fetchStart = Date.now();
        
        // Fetch rooms and tasks in parallel with timeouts
        const roomsQuery = supabaseServer
            .from('rooms')
            .select('id, project_id, name, photos, ai_summary')
            .in('project_id', projectIds);
        
        const tasksQuery = supabaseServer
            .from('tasks')
            .select('id, project_id, title, room, status, priority, chat_history, guide, safety, materials, tools, cost, time, hiring_info, has_been_opened')
            .in('project_id', projectIds);
        
        const roomsTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Rooms query timeout after 5s')), 5000)
        );
        
        const tasksTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Tasks query timeout after 5s')), 5000)
        );
        
        const [roomsResult, tasksResult] = await Promise.allSettled([
            Promise.race([roomsQuery, roomsTimeout]),
            Promise.race([tasksQuery, tasksTimeout])
        ]);
        
        const fetchTime = Date.now() - fetchStart;
        console.log(`[GET /api/projects] Fetched rooms and tasks in ${fetchTime}ms`);
        
        // Process rooms result
        let roomsData = [];
        if (roomsResult.status === 'fulfilled') {
            roomsData = roomsResult.value.data || [];
            console.log(`[GET /api/projects] Fetched ${roomsData.length} rooms`);
        } else {
            console.error('[GET /api/projects] Failed to fetch rooms:', roomsResult.reason);
        }
        
        // Process tasks result
        let tasksData = [];
        if (tasksResult.status === 'fulfilled') {
            tasksData = tasksResult.value.data || [];
            console.log(`[GET /api/projects] Fetched ${tasksData.length} tasks`);
        } else {
            console.error('[GET /api/projects] Failed to fetch tasks:', tasksResult.reason);
        }
        
        // Group rooms and tasks by project_id
        const roomsByProject = new Map();
        roomsData.forEach(room => {
            if (!roomsByProject.has(room.project_id)) {
                roomsByProject.set(room.project_id, []);
            }
            roomsByProject.get(room.project_id).push(room);
        });
        
        const tasksByProject = new Map();
        tasksData.forEach(task => {
            if (!tasksByProject.has(task.project_id)) {
                tasksByProject.set(task.project_id, []);
            }
            tasksByProject.get(task.project_id).push(task);
        });
        
        // Transform to match frontend interface
        const projects = projectsData.map(p => ({
            id: p.id,
            userId: p.user_id,
            property: {
                id: p.id,
                name: p.name,
                rooms: (roomsByProject.get(p.id) || []).map(r => ({
                    ...r,
                    aiSummary: r.ai_summary
                })),
                visionStatement: p.vision_statement,
                projectChatHistory: p.project_chat_history || [],
            },
            tasks: (tasksByProject.get(p.id) || []).map(t => ({
                ...t,
                chatHistory: t.chat_history || [],
                hiringInfo: t.hiring_info,
                hasBeenOpened: t.has_been_opened
            })),
            feedPosts: []
        }));
        
        const totalTime = Date.now() - startTime;
        console.log(`Total request time: ${totalTime}ms (projects: ${projectsQueryTime}ms, rooms+tasks: ${fetchTime}ms)`);
        
        res.json(projects);
    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`Error fetching projects (took ${elapsed}ms):`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.status(500).json({ 
            error: 'Failed to fetch projects',
            message: errorMessage,
            timeout: errorMessage.includes('timeout')
        });
    }
});

/**
 * GET /api/projects/:id
 * Fetch a single project by ID (must belong to authenticated user)
 */
app.get('/api/projects/:id', verifyAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const projectId = req.params.id;
        
        const { data, error } = await supabaseServer
            .from('projects')
            .select(`
                id,
                user_id,
                name,
                vision_statement,
                project_chat_history,
                rooms(*),
                tasks(*)
            `)
            .eq('id', projectId)
            .eq('user_id', userId) // Security: ensure user owns project
            .single();
        
        if (error) throw error;
        if (!data) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        const project = {
            id: data.id,
            userId: data.user_id,
            property: {
                id: data.id,
                name: data.name,
                rooms: data.rooms.map(r => ({
                    ...r,
                    aiSummary: r.ai_summary
                })),
                visionStatement: data.vision_statement,
                projectChatHistory: data.project_chat_history,
            },
            tasks: data.tasks.map(t => ({
                ...t,
                chatHistory: t.chat_history,
                hiringInfo: t.hiring_info,
                hasBeenOpened: t.has_been_opened
            })),
            feedPosts: []
        };
        
        res.json(project);
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});

/**
 * POST /api/projects
 * Create a new project
 */
app.post('/api/projects', verifyAuth, validateRequest(z.object({ property: propertySchema })), async (req, res) => {
    const startTime = Date.now();
    // Log immediately to verify function is called
    console.log('=== POST /api/projects START ===');
    console.log('Timestamp:', new Date().toISOString());
    
    try {
        const userId = req.user.id;
        const { property } = req.validated;
        
        console.log('[POST /api/projects] Starting request for user:', userId);
        console.log('[POST /api/projects] Supabase configured:', !!supabaseServer);
        console.log('[POST /api/projects] Environment check:', {
            VERCEL: process.env.VERCEL,
            NODE_ENV: process.env.NODE_ENV,
            hasSupabaseUrl: !!supabaseUrl,
            hasSupabaseKey: !!supabaseServiceKey
        });
        
        // Check if Supabase is configured
        if (!supabaseServer) {
            console.error('[POST /api/projects] Supabase not configured!');
            return res.status(500).json({ 
                error: 'Server configuration error',
                message: 'Supabase is not configured. Please set environment variables.'
            });
        }
        
        // Ensure projectChatHistory is properly formatted
        const projectChatHistory = Array.isArray(property.projectChatHistory) 
            ? property.projectChatHistory 
            : [];
        
        console.log('[POST /api/projects] Creating project:', {
            userId,
            name: property.name,
            roomsCount: property.rooms?.length || 0,
            chatHistoryLength: projectChatHistory.length
        });
        
        // Create project with timeout protection
        console.log('[POST /api/projects] Inserting project into database...');
        const projectInsertStart = Date.now();
        const projectPromise = supabaseServer
            .from('projects')
            .insert({
                user_id: userId,
                name: property.name,
                vision_statement: property.visionStatement || '',
                project_chat_history: projectChatHistory
            })
            .select()
            .single();
        
        const projectTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Project creation timeout after 5s')), 5000)
        );
        
        let projectData, projectError;
        try {
            const result = await Promise.race([projectPromise, projectTimeout]);
            projectData = result.data;
            projectError = result.error;
            
            // Log detailed error if present
            if (projectError) {
                console.error('[POST /api/projects] Supabase error details:', {
                    message: projectError.message,
                    details: projectError.details,
                    hint: projectError.hint,
                    code: projectError.code
                });
                console.error('[POST /api/projects] Full error object:', JSON.stringify(projectError, null, 2));
            }
        } catch (err) {
            console.error('[POST /api/projects] Project creation timeout or error:', err);
            console.error('[POST /api/projects] Error type:', err?.constructor?.name);
            console.error('[POST /api/projects] Error stack:', err?.stack);
            throw err;
        }
        
        if (projectError) {
            console.error('[POST /api/projects] Supabase error creating project:', projectError);
            
            // Provide more specific error messages
            let errorMessage = `Database error: ${projectError.message || projectError.code || 'Unknown database error'}`;
            if (projectError.code === '23505') {
                errorMessage = 'Project name already exists (duplicate key violation)';
            } else if (projectError.code === 'PGRST301') {
                errorMessage = 'Permission denied - check RLS policies or service role key';
            } else if (projectError.code === '23503') {
                errorMessage = 'Foreign key violation - check user_id exists';
            } else if (projectError.hint) {
                errorMessage += `\nHint: ${projectError.hint}`;
            }
            
            throw new Error(errorMessage);
        }
        
        const projectInsertTime = Date.now() - projectInsertStart;
        console.log(`Project created in ${projectInsertTime}ms`);
        
        // Create rooms if provided (with timeout protection)
        if (property.rooms && property.rooms.length > 0) {
            const roomsToInsert = property.rooms.map(room => ({
                project_id: projectData.id,
                name: room.name,
                photos: Array.isArray(room.photos) ? room.photos : []
            }));
            
            console.log('Inserting rooms:', roomsToInsert.length);
            
            const roomsInsertStart = Date.now();
            const roomsPromise = supabaseServer
                .from('rooms')
                .insert(roomsToInsert);
            
            const roomsTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Rooms creation timeout')), 5000)
            );
            
            let roomsError;
            try {
                const result = await Promise.race([roomsPromise, roomsTimeout]);
                roomsError = result.error;
            } catch (err) {
                console.error('Rooms creation timeout or error:', err);
                throw err;
            }
            
            if (roomsError) {
                console.error('Supabase error creating rooms:', roomsError);
                throw new Error(`Database error creating rooms: ${roomsError.message || roomsError.code || 'Unknown database error'}`);
            }
            
            const roomsInsertTime = Date.now() - roomsInsertStart;
            console.log(`Rooms created in ${roomsInsertTime}ms`);
        }
        
        const totalTime = Date.now() - startTime;
        console.log(`Project creation completed in ${totalTime}ms`);
        
        res.status(201).json({ projectId: projectData.id });
    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`Error creating project (took ${elapsed}ms):`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorDetails = error instanceof Error ? error.stack : undefined;
        
        // Log full error details for debugging
        console.error('Full error details:', {
            message: errorMessage,
            stack: errorDetails,
            error: error
        });
        
        // Return detailed error (safe for production - these are Supabase/database errors)
        res.status(500).json({ 
            error: 'Failed to create project',
            message: errorMessage,
            timeout: errorMessage.includes('timeout'),
            details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
        });
    }
});

/**
 * PUT /api/projects/:id
 * Update an existing project
 */
app.put('/api/projects/:id', verifyAuth, validateRequest(z.object({ property: propertySchema })), async (req, res) => {
    try {
        const userId = req.user.id;
        const projectId = req.params.id;
        const { property } = req.validated;
        
        // Verify ownership
        const { data: existing, error: checkError } = await supabaseServer
            .from('projects')
            .select('user_id')
            .eq('id', projectId)
            .single();
        
        if (checkError || !existing || existing.user_id !== userId) {
            return res.status(403).json({ error: 'Forbidden - not your project' });
        }
        
        // Update project
        const { error } = await supabaseServer
            .from('projects')
            .update({
                name: property.name,
                vision_statement: property.visionStatement,
                project_chat_history: property.projectChatHistory
            })
            .eq('id', projectId);
        
        if (error) throw error;
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

/**
 * DELETE /api/projects/:id
 * Delete a project
 */
app.delete('/api/projects/:id', verifyAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const projectId = req.params.id;
        
        // Verify ownership
        const { data: existing, error: checkError } = await supabaseServer
            .from('projects')
            .select('user_id')
            .eq('id', projectId)
            .single();
        
        if (checkError || !existing || existing.user_id !== userId) {
            return res.status(403).json({ error: 'Forbidden - not your project' });
        }
        
        // Delete project (cascade should handle rooms/tasks)
        const { error } = await supabaseServer
            .from('projects')
            .delete()
            .eq('id', projectId);
        
        if (error) throw error;
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// --- Task Operations ---

/**
 * POST /api/projects/:projectId/tasks
 * Create a new task for a project
 */
app.post('/api/projects/:projectId/tasks', verifyAuth, validateRequest(z.object({ task: taskSchema })), async (req, res) => {
    try {
        const userId = req.user.id;
        const projectId = req.params.projectId;
        const { task } = req.validated;
        
        // Verify ownership of project
        const { data: project, error: projectError } = await supabaseServer
            .from('projects')
            .select('user_id, rooms(id, name)')
            .eq('id', projectId)
            .single();
        
        if (projectError || !project || project.user_id !== userId) {
            return res.status(403).json({ error: 'Forbidden - not your project' });
        }
        
        // Find room ID by name
        const room = project.rooms.find(r => r.name === task.room);
        
        // Insert task
        const { error } = await supabaseServer
            .from('tasks')
            .insert({
                project_id: projectId,
                room_id: room?.id,
                title: task.title,
                room: task.room,
                status: task.status || 'pending',
                priority: task.priority || 'medium',
                chat_history: task.chatHistory || [],
                guide: task.guide || [],
                safety: task.safety || [],
                materials: task.materials || [],
                tools: task.tools || [],
                cost: task.cost || 0,
                time: task.time || '',
                hiring_info: task.hiringInfo || null,
                has_been_opened: task.hasBeenOpened || false
            });
        
        if (error) throw error;
        
        res.status(201).json({ success: true });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

/**
 * PUT /api/tasks/:taskId
 * Update a task
 */
app.put('/api/tasks/:taskId', verifyAuth, validateRequest(z.object({ task: taskSchema })), async (req, res) => {
    try {
        const userId = req.user.id;
        const taskId = req.params.taskId;
        const { task } = req.validated;
        
        // Verify ownership via project
        const { data: taskData, error: taskError } = await supabaseServer
            .from('tasks')
            .select('project_id, projects(user_id)')
            .eq('id', taskId)
            .single();
        
        if (taskError || !taskData || taskData.projects.user_id !== userId) {
            return res.status(403).json({ error: 'Forbidden - not your task' });
        }
        
        // Update task
        const { error } = await supabaseServer
            .from('tasks')
            .update({
                status: task.status,
                priority: task.priority,
                chat_history: task.chatHistory,
                guide: task.guide,
                safety: task.safety,
                materials: task.materials,
                tools: task.tools,
                cost: task.cost,
                time: task.time,
                hiring_info: task.hiringInfo,
                has_been_opened: task.hasBeenOpened
            })
            .eq('id', taskId);
        
        if (error) throw error;
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

/**
 * DELETE /api/tasks/:taskId
 * Delete a task
 */
app.delete('/api/tasks/:taskId', verifyAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const taskId = req.params.taskId;
        
        // Verify ownership via project
        const { data: taskData, error: taskError } = await supabaseServer
            .from('tasks')
            .select('project_id, projects(user_id)')
            .eq('id', taskId)
            .single();
        
        if (taskError || !taskData || taskData.projects.user_id !== userId) {
            return res.status(403).json({ error: 'Forbidden - not your task' });
        }
        
        // Delete task
        const { error } = await supabaseServer
            .from('tasks')
            .delete()
            .eq('id', taskId);
        
        if (error) throw error;
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

// --- Room Operations ---

/**
 * POST /api/projects/:projectId/rooms
 * Create a new room for a project
 */
app.post('/api/projects/:projectId/rooms', verifyAuth, validateRequest(z.object({ roomName: z.string().min(1).max(100) })), async (req, res) => {
    try {
        const userId = req.user.id;
        const projectId = req.params.projectId;
        const { roomName } = req.validated;
        
        // Verify ownership
        const { data: project, error: projectError } = await supabaseServer
            .from('projects')
            .select('user_id')
            .eq('id', projectId)
            .single();
        
        if (projectError || !project || project.user_id !== userId) {
            return res.status(403).json({ error: 'Forbidden - not your project' });
        }
        
        // Create room
        const { error } = await supabaseServer
            .from('rooms')
            .insert({
                project_id: projectId,
                name: roomName,
                photos: []
            });
        
        if (error) throw error;
        
        res.status(201).json({ success: true });
    } catch (error) {
        console.error('Error creating room:', error);
        res.status(500).json({ error: 'Failed to create room' });
    }
});

/**
 * DELETE /api/rooms/:roomId
 * Delete a room
 */
app.delete('/api/rooms/:roomId', verifyAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const roomId = req.params.roomId;
        
        // Verify ownership via project
        const { data: roomData, error: roomError } = await supabaseServer
            .from('rooms')
            .select('project_id, projects(user_id)')
            .eq('id', roomId)
            .single();
        
        if (roomError || !roomData || roomData.projects.user_id !== userId) {
            return res.status(403).json({ error: 'Forbidden - not your room' });
        }
        
        // Delete room
        const { error } = await supabaseServer
            .from('rooms')
            .delete()
            .eq('id', roomId);
        
        if (error) throw error;
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting room:', error);
        res.status(500).json({ error: 'Failed to delete room' });
    }
});

/**
 * POST /api/rooms/:roomId/photos
 * Add a photo to a room (expects image uploaded via /api/upload first)
 */
app.post('/api/rooms/:roomId/photos', verifyAuth, validateRequest(z.object({ photoUrl: z.string().url() })), async (req, res) => {
    try {
        const userId = req.user.id;
        const roomId = req.params.roomId;
        const { photoUrl } = req.validated;
        
        // Verify ownership and get current photos
        const { data: roomData, error: roomError } = await supabaseServer
            .from('rooms')
            .select('photos, project_id, projects(user_id)')
            .eq('id', roomId)
            .single();
        
        if (roomError || !roomData || roomData.projects.user_id !== userId) {
            return res.status(403).json({ error: 'Forbidden - not your room' });
        }
        
        // Add photo to array
        const newPhotos = [...roomData.photos, photoUrl];
        const { error } = await supabaseServer
            .from('rooms')
            .update({ photos: newPhotos })
            .eq('id', roomId);
        
        if (error) throw error;
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding photo to room:', error);
        res.status(500).json({ error: 'Failed to add photo' });
    }
});

// --- Image Upload ---

/**
 * POST /api/upload
 * Upload an image to Supabase Storage (server-side)
 */
app.post('/api/upload', verifyAuth, validateRequest(imageUploadSchema), async (req, res) => {
    try {
        const userId = req.user.id;
        const { dataUrl, fileNamePrefix } = req.validated;
        
        // Validate image
        const { mimeType, base64Data } = validateImageUpload(dataUrl);
        
        // Convert base64 to buffer
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Determine file extension
        // Use user-based folder structure: public/{userId}/filename
        const ext = mimeType.split('/')[1];
        const fileName = `${fileNamePrefix}-${Date.now()}.${ext}`;
        const filePath = `public/${userId}/${fileName}`;
        
        // Upload to Supabase Storage
        const { error: uploadError } = await supabaseServer.storage
            .from('images')
            .upload(filePath, buffer, {
                contentType: mimeType,
                cacheControl: '3600',
                upsert: false
            });
        
        if (uploadError) throw uploadError;
        
        // Get public URL
        const { data } = supabaseServer.storage
            .from('images')
            .getPublicUrl(filePath);
        
        res.json({ publicUrl: data.publicUrl });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ error: error.message || 'Failed to upload image' });
    }
});

// SECURITY: Enhanced input validation middleware
const validateGeminiRequest = (req, res, next) => {
    const { action, payload } = req.body;
    
    if (!action || typeof action !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid action' });
    }
    
    if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'Missing or invalid payload' });
    }
    
    // Validate payload size to prevent DoS
    const payloadSize = JSON.stringify(payload).length;
    if (payloadSize > 1024 * 1024) { // 1MB limit
        return res.status(413).json({ error: 'Payload too large' });
    }
    
    // Validate action is allowed
    const allowedActions = [
        'generateTaskDetails',
        'getTaskChatResponse', 
        'getProjectChatResponse',
        'generateGuidingTaskIntroduction',
        'generateProjectSummary',
        'generateVisionStatement'
    ];
    
    if (!allowedActions.includes(action)) {
        return res.status(400).json({ error: `Invalid action: ${action}` });
    }
    
    next();
};

// Input validation helper with type checking (legacy - kept for compatibility)
function validatePayload(action, payload) {
    if (!payload || typeof payload !== 'object') {
        return 'Invalid payload format';
    }

    switch (action) {
        case 'generateTaskDetails':
        case 'getTaskChatResponse':
            if (!payload.task || typeof payload.task !== 'object') {
                return 'Invalid or missing task object';
            }
            if (!payload.property || typeof payload.property !== 'object') {
                return 'Invalid or missing property object';
            }
            if (action === 'getTaskChatResponse') {
                if (!Array.isArray(payload.history)) {
                    return 'History must be an array';
                }
            }
            break;
        case 'getProjectChatResponse':
            if (!Array.isArray(payload.history)) {
                return 'History must be an array';
            }
            if (!payload.property || typeof payload.property !== 'object') {
                return 'Invalid or missing property object';
            }
            if (!Array.isArray(payload.tasks)) {
                return 'Tasks must be an array';
            }
            break;
        case 'generateGuidingTaskIntroduction':
            if (!payload.taskTitle || typeof payload.taskTitle !== 'string') {
                return 'Invalid or missing taskTitle';
            }
            if (!payload.taskRoom || typeof payload.taskRoom !== 'string') {
                return 'Invalid or missing taskRoom';
            }
            if (!payload.property || typeof payload.property !== 'object') {
                return 'Invalid or missing property object';
            }
            break;
        case 'generateProjectSummary':
            if (!payload.property || typeof payload.property !== 'object') {
                return 'Invalid or missing property object';
            }
            if (!Array.isArray(payload.tasks)) {
                return 'Tasks must be an array';
            }
            break;
        case 'generateVisionStatement':
            if (!Array.isArray(payload.history)) {
                return 'History must be an array';
            }
            break;
    }
    return null;
}

// Main Gemini API endpoint with enhanced security
app.post('/api/gemini', validateGeminiRequest, async (req, res) => {
    try {
        const { action, payload } = req.body;
        
        // SECURITY: Validate images in payload if present
        if (payload.task && payload.task.chatHistory) {
            for (const msg of payload.task.chatHistory) {
                for (const part of msg.parts || []) {
                    if (part.inlineData) {
                        const dataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                        validateImageUpload(dataUrl); // Throws if invalid
                    }
                }
            }
        }
        
        if (payload.history) {
            for (const msg of payload.history) {
                for (const part of msg.parts || []) {
                    if (part.inlineData) {
                        const dataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                        validateImageUpload(dataUrl); // Throws if invalid
                    }
                }
            }
        }
        
        if (!action || !payload) {
            return res.status(400).json({ error: 'Missing action or payload' });
        }

        const validationError = validatePayload(action, payload);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        let result;

        switch (action) {
            case 'generateTaskDetails':
                result = await generateTaskDetails(payload.task, payload.property);
                break;
            case 'getTaskChatResponse':
                result = await getTaskChatResponse(payload.task, payload.history, payload.property);
                break;
            case 'getProjectChatResponse':
                result = await getProjectChatResponse(payload.history, payload.property, payload.tasks);
                break;
            case 'generateGuidingTaskIntroduction':
                result = await generateGuidingTaskIntroduction(payload.taskTitle, payload.taskRoom, payload.property);
                break;
            case 'generateProjectSummary':
                result = await generateProjectSummary(payload.property, payload.tasks);
                break;
            case 'generateVisionStatement':
                result = await generateVisionStatement(payload.history);
                break;
            default:
                return res.status(400).json({ error: `Invalid action: ${action}` });
        }

        res.json(result);
    } catch (error) {
        console.error('Error in /api/gemini:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        res.status(500).json({ error: `An internal server error occurred: ${errorMessage}` });
    }
});

// --- AI Service Functions ---

const generateTaskDetails = async (task, property) => {
    // Check if Gemini AI is initialized
    if (!ai) {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY environment variable is not set. Please configure it in Vercel environment variables.');
        }
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    
    // COST OPTIMIZATION: Use Pro for detailed plan generation (required for structured output)
    // Flash doesn't support structured JSON output reliably, so Pro is necessary here
    const model = 'gemini-2.5-pro';
    
    // COST OPTIMIZATION: Limit chat history to last 10 messages to reduce token usage
    const recentHistory = task.chatHistory ? task.chatHistory.slice(-10) : [];
    const taskForPrompt = { ...task, chatHistory: recentHistory };
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            guide: { type: Type.ARRAY, description: "A detailed, step-by-step checklist for completing the task.", items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, completed: { type: Type.BOOLEAN, default: false } }, required: ['text', 'completed'] } },
            materials: { type: Type.ARRAY, description: "A list of materials needed, with estimated costs and shopping links.", items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, cost: { type: Type.NUMBER, description: "Estimated cost in GBP (£)" }, link: { type: Type.STRING, description: "A UK-specific shopping link, preferably from Amazon.co.uk." }, completed: { type: Type.BOOLEAN, default: false } }, required: ['text', 'completed'] } },
            tools: { type: Type.ARRAY, description: "A list of tools required, with links for purchasing if needed.", items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, cost: { type: Type.NUMBER, description: "Estimated cost in GBP (£) if the user needs to buy it." }, link: { type: Type.STRING, description: "A UK-specific shopping link, preferably from Amazon.co.uk." }, owned: { type: Type.BOOLEAN, default: false } }, required: ['text', 'owned'] } },
            safety: { type: Type.ARRAY, description: "Crucial safety warnings and required personal protective equipment (PPE).", items: { type: Type.STRING } },
            cost: { type: Type.STRING, description: "A brief, one-sentence summary of the total estimated cost." },
            time: { type: Type.STRING, description: "A realistic time estimate for a single person to complete the task (e.g., '4-6 hours', '2 days')." },
            hiringInfo: { type: Type.STRING, description: "Advice on when to hire a professional for this task, including what qualifications to look for (e.g., 'NICEIC certified electrician'). This should be a well-reasoned paragraph." }
        },
    };

    const systemInstruction = `You are an expert DIY and home renovation assistant for a UK-based user. Your role is to take a user's request from a chat conversation about a specific task and generate a complete, structured plan for them.

    **CONTEXT:**
    - Project: ${property.name}
    - Room: ${task.room}
    - The user wants a plan for the task: "${task.title}"
    - The user's vision for the project is: "${property.visionStatement || 'Not specified'}"

    **YOUR TASK:**
    Analyze the provided chat history for the task. Based on the user's questions, goals, and skill level mentioned, generate a comprehensive and actionable plan.
    
    **NOTE:** You're seeing the last 10 messages of conversation to focus on recent context and reduce costs.

    **RULES:**
    1.  **Be Thorough:** Provide detailed steps in the 'guide'. Don't assume prior knowledge.
    2.  **Be UK-Specific:** Recommend materials and tools from UK suppliers. Costs must be in GBP (£). Links should point to amazon.co.uk where possible.
    3.  **Safety First:** The 'safety' section is non-negotiable. Always include relevant warnings and PPE.
    4.  **Realistic Estimates:** Provide practical cost and time estimates.
    5.  **Honest Advice:** Use the 'hiringInfo' section to advise the user when a task is too complex, dangerous, or requires certified professionals (e.g., gas, complex electrics).
    6.  **Affiliate Links:** For every shopping link you generate, create a search link on amazon.co.uk. For example, for "wood primer", the link should be "https://www.amazon.co.uk/s?k=wood+primer".
    7.  **JSON Output:** You MUST return ONLY a valid JSON object that conforms to the provided schema. Do not include any explanatory text or markdown formatting.`;

    const contents = taskForPrompt.chatHistory.map(msg => ({ role: msg.role, parts: msg.parts }));

    const response = await ai.models.generateContent({ model, contents, config: { systemInstruction, responseMimeType: "application/json", responseSchema: schema } });
    let jsonText = response.text.trim();
    const parsedJson = JSON.parse(jsonText);

    const addAffiliateTag = (link) => link ? `${link}&tag=RENOVATR-21` : undefined;
    if (parsedJson.materials) {
        parsedJson.materials.forEach((item) => {
            item.link = addAffiliateTag(item.link);
        });
    }
    if (parsedJson.tools) {
        parsedJson.tools.forEach((item) => {
            item.link = addAffiliateTag(item.link);
        });
    }
        
    return parsedJson;
};

const getTaskChatResponse = async (task, history, property) => {
    // Check if Gemini AI is initialized
    if (!ai) {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY environment variable is not set.');
        }
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    
    // COST OPTIMIZATION: Use Flash by default (97% cheaper), Pro only when generating detailed plans
    const needsDetailedPlan = history.length > 5 && !task.materials;
    const model = needsDetailedPlan ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    
    // COST OPTIMIZATION: Limit to last 15 messages for task chat
    const recentHistory = history.slice(-15);
    const contents = recentHistory.map(msg => ({ role: msg.role, parts: msg.parts }));
    
    const systemInstruction = `You are a friendly and encouraging DIY expert providing advice for a UK user.
    - Project: ${property.name}
    - Room: ${task.room}
    - Task: "${task.title}"
    Your goal is to answer the user's questions about this specific task. If you have enough information to create a full plan, respond with the user's answer and then include the special command "[GENERATE_PLAN]". If the user provides a significant update or change, you can use the command "[UPDATE_PLAN]" followed by a JSON object of the fields to update, e.g., "[UPDATE_PLAN] { "cost": "£150-£200" }". Otherwise, just provide a helpful, conversational response.`;
    
    const response = await ai.models.generateContent({ model, contents, config: { systemInstruction } });
    return { role: 'model', parts: [{ text: response.text }] };
};

const getProjectChatResponse = async (history, property, tasks) => {
    // Check if Gemini AI is initialized
    if (!ai) {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY environment variable is not set.');
        }
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    
    // COST OPTIMIZATION: Use Flash for most chat, Pro only for complex analysis
    const hasImages = history.some(msg => msg.role === 'user' && msg.parts.some(part => part.inlineData));
    const isComplexQuery = hasImages || tasks.length > 10 || history.length > 15;
    const model = isComplexQuery ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    
    // COST OPTIMIZATION: Limit history to last 10 messages (saves ~70% tokens)
    const recentHistory = history.slice(-10);
    const contents = recentHistory.map(msg => ({ role: msg.role, parts: msg.parts }));
    
    // COST OPTIMIZATION: Simplified task list (only titles, not full objects)
    const existingTasks = tasks.slice(0, 20).map(t => `- ${t.title} (${t.room})`).join('\n');
    
    // Check if user has provided visual context (images) in the conversation
    const userMessages = recentHistory.filter(msg => msg.role === 'user');
    const totalUserText = userMessages.map(msg => 
        msg.parts.filter(p => p.text).map(p => p.text).join(' ')
    ).join(' ');
    const hasDetailedContext = totalUserText.length > 100;
    
    // Count rooms with photos
    const roomsWithPhotos = property.rooms.filter(r => r.photos && r.photos.length > 0);
    const hasRoomPhotos = roomsWithPhotos.length > 0;

    const systemInstruction = `You are a helpful and inspiring project assistant for a UK-based DIY renovator. Your goal is to help them define their vision for their project: "${property.name}".
    
    **PROJECT CONTEXT:**
    - Existing Rooms: ${property.rooms.map(r => r.name).join(', ')}
    - Rooms with photos: ${roomsWithPhotos.length > 0 ? roomsWithPhotos.map(r => r.name).join(', ') : 'None yet'}
    - Existing Tasks: \n${existingTasks || 'None yet'}
    - Images in conversation: ${hasImages ? 'Yes' : 'No'}
    - Detailed descriptions provided: ${hasDetailedContext ? 'Yes' : 'No'}
    
    **CRITICAL RULES FOR TASK SUGGESTIONS:**
    
    1. **GATHER CONTEXT FIRST** - Before suggesting any tasks, you MUST understand the current state of the rooms/areas:
       ${!hasImages && !hasRoomPhotos ? '- ⚠️ NO PHOTOS YET: You should ask the user to share photos of the rooms they want to work on. Photos are more efficient than lengthy descriptions for understanding layout, condition, and style.' : ''}
       ${!hasDetailedContext ? '- ⚠️ LIMITED CONTEXT: Ask clarifying questions about room conditions, user preferences, budget, and skill level before suggesting tasks.' : ''}
    
    2. **WHEN TO REQUEST PHOTOS:**
       - At the start of the conversation if no room photos exist
       - When user mentions wanting to work on a specific room that has no photos
       - When you need to understand current condition, layout, or style
       - Examples: "Could you share a photo of your living room so I can see the current state and suggest specific improvements?"
    
    3. **ONLY SUGGEST TASKS WHEN YOU HAVE SUFFICIENT CONTEXT:**
       - You know the current state of the room (from photos or detailed descriptions)
       - You understand the user's goals and preferences
       - You know their budget range and skill level
       - The task is specific to their actual needs, not generic suggestions
    
    4. **TASK SUGGESTION FORMAT:**
       When you have enough context and want to suggest a specific, actionable task, embed this command:
       [SUGGEST_TASK:{"title": "Task Title", "room": "Room Name"}]
       
       Example: If they show a photo of a tired-looking living room with scuffed walls and say they want it refreshed, you might say:
       "Based on the photo, I can see your living room walls need some attention. The scuff marks and faded paint would really benefit from a fresh coat. [SUGGEST_TASK:{"title": "Repaint living room walls", "room": "Living Room"}]"
    
    5. **BE CONVERSATIONAL & HELPFUL:**
       - Don't be pushy about photos, but explain why they're helpful
       - Ask one or two clarifying questions at a time
       - Show enthusiasm and encouragement
       - Build rapport before jumping into task suggestions
    
    Remember: Generic task suggestions without understanding the user's specific situation are not helpful. Context-aware, personalized suggestions based on photos and conversation are much more valuable.`;

    const response = await ai.models.generateContent({ model, contents, config: { systemInstruction } });
    return { role: 'model', parts: [{ text: response.text }] };
};

const generateGuidingTaskIntroduction = async (taskTitle, taskRoom, property) => {
    // Check if Gemini AI is initialized
    if (!ai) {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY environment variable is not set.');
        }
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    
    const model = 'gemini-2.5-flash';
    const prompt = `The user is starting a new task: "${taskTitle}" in the room: "${taskRoom}" for their project: "${property.name}". Their overall vision is: "${property.visionStatement || 'Not defined yet'}". 
    Your job is to write a friendly, engaging first message for the task-specific chat window. Ask one or two clarifying questions to help them get started. For example, ask about the current state of the room, their desired outcome, or their skill level. Keep it brief and encouraging.`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const response = await ai.models.generateContent({ model, contents });
    return { role: 'model', parts: [{ text: response.text }] };
};

const generateProjectSummary = async (property, tasks) => {
    // Check if Gemini AI is initialized
    if (!ai) {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY environment variable is not set.');
        }
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    
    // COST OPTIMIZATION: Always use Flash for summaries (simple task)
    const model = 'gemini-2.5-flash';
    
    // COST OPTIMIZATION: Limit to first 30 tasks to avoid token bloat
    const taskSummary = tasks.slice(0, 30).map(t => `- ${t.title} (${t.status})`).join('\n');
    const prompt = `Based on the following project information, generate a one-paragraph (2-3 sentences) summary.
    - Project: ${property.name}
    - Vision: ${property.visionStatement || 'Not defined yet'}
    - Rooms: ${property.rooms.map(r => r.name).join(', ')}
    - Tasks:\n${taskSummary}
    The summary should be encouraging and reflect the current state of the project.`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const response = await ai.models.generateContent({ model, contents });
    return response.text;
};

const generateVisionStatement = async (history) => {
    // Check if Gemini AI is initialized
    if (!ai) {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY environment variable is not set.');
        }
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    
    // COST OPTIMIZATION: Use Flash for vision statements (simple extraction)
    const model = 'gemini-2.5-flash';
    
    // COST OPTIMIZATION: Only use last 8 messages for vision extraction
    const recentHistory = history.slice(-8);
    const systemInstruction = `Analyze the following conversation between a user and an AI assistant about a home renovation project. Based on the user's messages, distill their goals and desired aesthetic into a single, inspiring "Vision Statement" sentence. The statement should be concise and capture the essence of what the user wants to achieve. Return only the vision statement text, without any additional formatting or explanation.`;
    
    const contents = recentHistory.map(msg => ({ role: msg.role, parts: msg.parts }));
    const response = await ai.models.generateContent({ model, contents, config: { systemInstruction } });
    return response.text.trim().replace(/"/g, "");
};

// Export app for Vercel serverless functions
export default app;

// Only start server if not in serverless environment (for local development)
if (process.env.VERCEL !== '1') {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Backend server running on http://0.0.0.0:${PORT}`);
    });
}
