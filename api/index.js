/**
 * Vercel Serverless Function Entry Point
 * 
 * This wraps the Express app to work as a Vercel serverless function.
 */

import serverless from 'serverless-http';
import app from '../server.js';

// Export as serverless function
export default serverless(app);
