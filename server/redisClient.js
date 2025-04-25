// redisClient.js
const { createClient } = require('redis');

const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379' // valor por defecto si estás en local
});

redis.on('error', err => console.error('Redis error:', err));

module.exports = redis;
