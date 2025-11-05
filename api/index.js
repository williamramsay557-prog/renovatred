/**
 * Vercel Serverless Function Entry Point
 * 
 * This file wraps the Express app for Vercel serverless functions.
 * Keep this simple - serverless-http handles everything internally.
 */

import app from '../server.js';
import serverless from 'serverless-http';

// Log when module is loaded
console.log('=== api/index.js loaded ===');
console.log('Timestamp:', new Date().toISOString());

// Wrap the Express app with serverless-http
// serverless-http returns a function that handles (req, res) => Promise
const handler = serverless(app, {
    binary: ['image/*', 'application/pdf'],
});

console.log('=== Serverless handler created ===');

// Export the handler
export default handler;
