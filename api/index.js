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
            const serverModule = await import('../server.js');
            app = serverModule.default;
            console.log(`=== server.js imported in ${Date.now() - startTime}ms ===`);
            
            // Create handler
            handler = serverless(app, {
                binary: ['image/*', 'application/pdf'],
            });
            console.log('=== Serverless handler created ===');
        } catch (error) {
            console.error('=== ERROR loading server.js ===');
            console.error(error);
            throw error;
        }
    }
    return handler;
}

// Export handler that lazy loads on first request
export default async function(req, res) {
    console.log('=== Request received, getting handler ===');
    const handlerInstance = await getHandler();
    console.log('=== Handler obtained, calling it ===');
    return handlerInstance(req, res);
};
