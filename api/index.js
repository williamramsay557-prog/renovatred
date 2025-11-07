/**
 * Vercel Serverless Function Entry Point
 * 
 * This file wraps the Express app for Vercel serverless functions.
 * IMPORTANT: Lazy load the server to avoid blocking during module initialization
 */

import serverless from 'serverless-http';

// Log when module is loaded
console.log('=== api/index.js module loaded ===');
console.log('Timestamp:', new Date().toISOString());

// Lazy load the Express app - don't import it until first request
let app;
let handler;

async function getHandler() {
    if (!handler) {
        console.log('=== Lazy loading server.js ===');
        const startTime = Date.now();
        
        try {
            // Dynamically import to avoid blocking
            console.log('Step 1: Starting dynamic import of server.js...');
            const serverModule = await import('../server.js');
            console.log('Step 2: server.js module imported successfully');
            
            console.log('Step 3: Extracting app from module...');
            app = serverModule.default;
            console.log('Step 4: App extracted, type:', typeof app);
            console.log('Step 5: App has get method:', typeof app?.get === 'function');
            
            if (!app) {
                throw new Error('server.js did not export an app. Check export default app;');
            }
            
            console.log(`=== server.js imported in ${Date.now() - startTime}ms ===`);
            
            // Create handler
            // Configure serverless-http to handle Vercel's path rewriting
            console.log('Step 6: Creating serverless handler...');
            handler = serverless(app, {
                binary: ['image/*', 'application/pdf'],
                requestPath: (req) => {
                    // Use req.url which should contain the full path
                    // Log to verify this function is being called
                    const path = req.url || req.path || '/';
                    console.log('[serverless-http requestPath] Called with req.url:', req.url);
                    console.log('[serverless-http requestPath] Called with req.path:', req.path);
                    console.log('[serverless-http requestPath] Returning path:', path);
                    return path;
                }
            });
            console.log('=== Serverless handler created ===');
        } catch (error) {
            console.error('=== ERROR loading server.js ===');
            console.error('Error type:', error?.constructor?.name);
            console.error('Error message:', error?.message);
            console.error('Error stack:', error?.stack);
            console.error('Full error object:', error);
            throw error;
        }
    }
    return handler;
}

// Export handler that lazy loads on first request
export default async function(req, res) {
    console.log('=== Request received ===');
    console.log('Request method:', req.method);
    console.log('Original req.url:', req.url);
    console.log('Original req.path:', req.path);
    console.log('x-vercel-function-path header:', req.headers['x-vercel-function-path']);
    
    // Vercel rewrites /api/* to /api, but the original path is in the request
    // We need to get the original path from the request URL or headers
    // The original request URL should be in req.url or we can reconstruct it
    
    // Get the original path - Vercel should preserve it in req.url
    // If not, try to get it from headers or reconstruct
    let expressPath = req.url;
    
    // Check if we have the full path already
    if (expressPath && expressPath.startsWith('/api')) {
        // We have the full path, use it
        console.log('Using req.url as Express path:', expressPath);
    } else {
        // Need to reconstruct - Vercel rewrote /api/test-express to /api
        // The original path might be in the query string or headers
        // Try to get from x-vercel-function-path or reconstruct from referer
        const originalUrl = req.headers['x-vercel-original-url'] || 
                           req.headers['referer'] || 
                           req.url;
        
        // Extract path from URL if it's a full URL
        if (originalUrl && originalUrl.includes('/api/')) {
            const urlObj = new URL(originalUrl, 'https://example.com');
            expressPath = urlObj.pathname;
            console.log('Reconstructed path from URL:', expressPath);
        } else if (req.url && req.url !== '/') {
            // Use req.url and ensure it has /api prefix
            expressPath = req.url.startsWith('/api') ? req.url : `/api${req.url}`;
            console.log('Using req.url with /api prefix:', expressPath);
        } else {
            // Last resort: use the path from the original request
            // This should be in the query or we need to parse it differently
            console.warn('Could not determine path from req.url:', req.url);
            console.warn('Headers:', Object.keys(req.headers));
            expressPath = req.url || '/api';
        }
    }
    
    console.log('Final Express path:', expressPath);
    
    // CRITICAL: Modify the request object BEFORE serverless-http processes it
    // serverless-http reads these properties when creating the Express request
    Object.defineProperty(req, 'url', {
        value: expressPath,
        writable: true,
        configurable: true
    });
    Object.defineProperty(req, 'path', {
        value: expressPath,
        writable: true,
        configurable: true
    });
    Object.defineProperty(req, 'originalUrl', {
        value: expressPath,
        writable: true,
        configurable: true
    });
    
    console.log('Modified req.url:', req.url);
    console.log('Modified req.path:', req.path);
    
    try {
        console.log('Step 1: Getting handler...');
        const handlerInstance = await getHandler();
        console.log('Step 2: Handler obtained, calling it...');
        console.log('Step 3: Handler type:', typeof handlerInstance);
        
        // serverless-http returns a promise - await it
        const result = await handlerInstance(req, res);
        console.log('Step 4: Handler completed, result:', result);
        return result;
    } catch (error) {
        console.error('=== FATAL ERROR in request handler ===');
        console.error('Error type:', error?.constructor?.name);
        console.error('Error message:', error?.message);
        console.error('Error stack:', error?.stack);
        
        // Return error response
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Server initialization failed',
                message: error?.message || 'Unknown error',
                details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
            });
        }
    }
};
