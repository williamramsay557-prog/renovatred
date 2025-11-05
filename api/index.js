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

// Export as serverless function
// Vercel will handle the routing based on vercel.json rewrites
export default serverless(app, {
    // Disable request timeout handling (Vercel handles this)
    binary: ['image/*', 'application/pdf'],
});
