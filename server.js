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

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('ERROR: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    process.exit(1);
}

const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Validate required environment variables at startup
if (!process.env.GEMINI_API_KEY) {
    console.error('ERROR: GEMINI_API_KEY is not set. Please add it to your Replit Secrets.');
    process.exit(1);
}

// Rate limiting
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS = 20;

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

// Middleware
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? process.env.ALLOWED_ORIGINS?.split(',') || [] 
        : ['http://localhost:5000', 'http://0.0.0.0:5000'],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Limit payload size to prevent DoS
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
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ============================================================================
// AUTHENTICATION & VALIDATION MIDDLEWARE
// ============================================================================

/**
 * JWT Auth Middleware
 * Verifies Supabase access tokens and attaches user to request
 */
const verifyAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized - No valid authorization header' });
        }
        
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        
        // Verify JWT using Supabase
        const { data: { user }, error } = await supabaseServer.auth.getUser(token);
        
        if (error || !user) {
            console.error('Auth verification failed:', error);
            return res.status(401).json({ error: 'Unauthorized - Invalid or expired token' });
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
        return res.status(500).json({ error: 'Internal authentication error' });
    }
};

// ============================================================================
// REQUEST VALIDATION SCHEMAS
// ============================================================================

const roomSchema = z.object({
    name: z.string().min(1).max(100),
    photos: z.array(z.string().url()).optional().default([]),
    id: z.string().uuid().optional()
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
    projectId: z.string().uuid(),
    title: z.string().min(1).max(300),
    room: z.string().min(1).max(100),
    description: z.string().optional(),
    materials: z.array(z.any()).optional(),
    tools: z.array(z.any()).optional(),
    cost: z.number().optional(),
    safetyWarnings: z.array(z.string()).optional(),
    chatHistory: z.array(z.any()).optional(),
    isComplete: z.boolean().optional(),
    hiringInfo: z.any().optional(),
    hasBeenOpened: z.boolean().optional()
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
                return res.status(400).json({ 
                    error: 'Validation failed', 
                    details: error.errors 
                });
            }
            return res.status(400).json({ error: 'Invalid request body' });
        }
    };
};

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
    try {
        const userId = req.user.id;
        
        const { data: projectsData, error } = await supabaseServer
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
            .eq('user_id', userId);
        
        if (error) throw error;
        
        // Transform to match frontend interface
        const projects = projectsData.map(p => ({
            id: p.id,
            userId: p.user_id,
            property: {
                id: p.id,
                name: p.name,
                rooms: p.rooms.map(r => ({
                    ...r,
                    aiSummary: r.ai_summary
                })),
                visionStatement: p.vision_statement,
                projectChatHistory: p.project_chat_history,
            },
            tasks: p.tasks.map(t => ({
                ...t,
                chatHistory: t.chat_history,
                hiringInfo: t.hiring_info,
                hasBeenOpened: t.has_been_opened
            })),
            feedPosts: []
        }));
        
        res.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
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
app.post('/api/projects', verifyAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { property } = req.body;
        
        if (!property || !property.name) {
            return res.status(400).json({ error: 'Property name is required' });
        }
        
        // Create project
        const { data: projectData, error: projectError } = await supabaseServer
            .from('projects')
            .insert({
                user_id: userId,
                name: property.name,
                vision_statement: property.visionStatement || '',
                project_chat_history: property.projectChatHistory || []
            })
            .select()
            .single();
        
        if (projectError) throw projectError;
        
        // Create rooms if provided
        if (property.rooms && property.rooms.length > 0) {
            const roomsToInsert = property.rooms.map(room => ({
                project_id: projectData.id,
                name: room.name,
                photos: room.photos || []
            }));
            
            const { error: roomsError } = await supabaseServer
                .from('rooms')
                .insert(roomsToInsert);
            
            if (roomsError) throw roomsError;
        }
        
        res.status(201).json({ projectId: projectData.id });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

/**
 * PUT /api/projects/:id
 * Update an existing project
 */
app.put('/api/projects/:id', verifyAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const projectId = req.params.id;
        const { property } = req.body;
        
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
app.post('/api/projects/:projectId/tasks', verifyAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const projectId = req.params.projectId;
        const { task } = req.body;
        
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
app.put('/api/tasks/:taskId', verifyAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const taskId = req.params.taskId;
        const { task } = req.body;
        
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
app.post('/api/projects/:projectId/rooms', verifyAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const projectId = req.params.projectId;
        const { roomName } = req.body;
        
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
app.post('/api/rooms/:roomId/photos', verifyAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const roomId = req.params.roomId;
        const { photoUrl } = req.body;
        
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
app.post('/api/upload', verifyAuth, async (req, res) => {
    try {
        const { dataUrl, fileNamePrefix } = req.body;
        
        if (!dataUrl || !fileNamePrefix) {
            return res.status(400).json({ error: 'dataUrl and fileNamePrefix are required' });
        }
        
        // Validate image
        const { mimeType, base64Data } = validateImageUpload(dataUrl);
        
        // Convert base64 to buffer
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Determine file extension
        const ext = mimeType.split('/')[1];
        const fileName = `${fileNamePrefix}-${Date.now()}.${ext}`;
        const filePath = `public/${fileName}`;
        
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
    const model = 'gemini-2.5-flash';
    const context = `The user is starting a new task: "${taskTitle}" in the room: "${taskRoom}" for their project: "${property.name}". Their overall vision is: "${property.visionStatement || 'Not defined yet'}". 
    Your job is to write a friendly, engaging first message for the task-specific chat window. Ask one or two clarifying questions to help them get started. For example, ask about the current state of the room, their desired outcome, or their skill level. Keep it brief and encouraging.`;

    const response = await ai.models.generateContent({ model, contents: context });
    return { role: 'model', parts: [{ text: response.text }] };
};

const generateProjectSummary = async (property, tasks) => {
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

    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text;
};

const generateVisionStatement = async (history) => {
    // COST OPTIMIZATION: Use Flash for vision statements (simple extraction)
    const model = 'gemini-2.5-flash';
    
    // COST OPTIMIZATION: Only use last 8 messages for vision extraction
    const recentHistory = history.slice(-8);
    const prompt = `Analyze the following conversation between a user and an AI assistant about a home renovation project. Based on the user's messages, distill their goals and desired aesthetic into a single, inspiring "Vision Statement" sentence. The statement should be concise and capture the essence of what the user wants to achieve. Return only the vision statement text, without any additional formatting or explanation.`;
    
    const contents = recentHistory.map(msg => ({ role: msg.role, parts: msg.parts }));
    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text.trim().replace(/"/g, "");
};

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server running on http://0.0.0.0:${PORT}`);
});
