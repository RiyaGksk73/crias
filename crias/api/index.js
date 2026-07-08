// Vercel serverless entry point.
// All /api/* requests are routed here (see vercel.json) and handled by the
// Express app. The app exports itself without calling listen() under Vercel.
module.exports = require('../backend/server.js');
