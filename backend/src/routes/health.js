const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const start = Date.now();
  let dbHealthy = false;
  let dbLatency = 0;

  try {
    const row = db.queryOne('SELECT 1 as alive');
    dbHealthy = row && row.alive === 1;
    dbLatency = Date.now() - start;
  } catch (err) {
    dbHealthy = false;
  }

  const memory = process.memoryUsage();
  const status = dbHealthy ? 'healthy' : 'degraded';
  const statusCode = dbHealthy ? 200 : 503;

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    version: '1.0.0',
    service: 'expense-tracker-backend',
    database: {
      healthy: dbHealthy,
      type: 'sqlite',
      responseTimeMs: dbLatency
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsageMb: {
        rss: Math.round(memory.rss / (1024 * 1024)),
        heapTotal: Math.round(memory.heapTotal / (1024 * 1024)),
        heapUsed: Math.round(memory.heapUsed / (1024 * 1024))
      }
    }
  });
});

module.exports = router;
