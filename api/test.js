/**
 * Minimal test endpoint to verify Vercel serverless functions work
 * This bypasses the Express app entirely
 */

export default async function handler(req, res) {
    console.log('=== Minimal test function called ===');
    console.log('Timestamp:', new Date().toISOString());
    
    return res.status(200).json({
        message: 'Minimal serverless function works!',
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.url
    });
}

