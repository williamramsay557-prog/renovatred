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
    
    // Vercel rewrites /api/* to /api, stripping the path
    // We need to reconstruct the original path from req.url or headers
    let expressPath = req.url;
    
    // If req.url is just '/' or doesn't start with /api, reconstruct it
    if (!expressPath || expressPath === '/' || !expressPath.startsWith('/api')) {
        // Check if we can get the path from the original URL
        // Vercel might preserve it in req.url, or we need to reconstruct
        const vercelPath = req.headers['x-vercel-function-path'];
        if (vercelPath && vercelPath !== 'api') {
            // x-vercel-function-path might be just 'api' or the full path
            expressPath = vercelPath.startsWith('/') ? vercelPath : `/${vercelPath}`;
            if (!expressPath.startsWith('/api')) {
                expressPath = `/api${expressPath}`;
            }
        } else {
            // Try to extract from referer or reconstruct from URL
            // If req.url has the full path, use it
            if (req.url && req.url !== '/') {
                expressPath = req.url.startsWith('/api') ? req.url : `/api${req.url}`;
            } else {
                // Last resort: check if there's a way to get the original path
                // For now, we'll need to handle this case-by-case
                console.warn('Could not determine path, using req.url as-is');
                expressPath = req.url || '/';
            }
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
