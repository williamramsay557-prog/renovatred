/**
 * Vercel Serverless Function Entry Point
 * 
 * Vercel supports Express apps directly, but we need to handle the routing correctly.
 * The Express app is already set up with /api/* routes, so we just export it.
 */

import app from '../server.js';

// For Vercel, we can use serverless-http OR export the app directly
// Using serverless-http for better compatibility
import serverless from 'serverless-http';

// Log when the serverless function is initialized
console.log('=== Serverless function initializing ===');
console.log('Timestamp:', new Date().toISOString());
console.log('Environment:', {
    VERCEL: process.env.VERCEL,
    NODE_ENV: process.env.NODE_ENV
});

// Wrap the Express app with serverless-http
const handler = serverless(app, {
    // Disable request timeout handling (Vercel handles this)
    binary: ['image/*', 'application/pdf'],
});

// Add request logging wrapper
export default async (req, res) => {
    const requestStart = Date.now();
    console.log('=== Serverless function request received ===');
    console.log('Request timestamp:', new Date().toISOString());
    console.log('Request method:', req.method);
    console.log('Request path:', req.url);
    console.log('Request headers:', {
        'content-type': req.headers['content-type'],
        'authorization': req.headers['authorization'] ? 'PRESENT' : 'MISSING'
    });
    
    try {
        const result = await handler(req, res);
        const requestTime = Date.now() - requestStart;
        console.log(`=== Serverless function completed in ${requestTime}ms ===`);
        return result;
    } catch (error) {
        const requestTime = Date.now() - requestStart;
        console.error(`=== Serverless function error after ${requestTime}ms ===`);
        console.error('Error:', error);
        console.error('Error stack:', error?.stack);
        throw error;
    }
};
