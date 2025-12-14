require("dotenv").config();
const mysql = require("mysql2");

// Fail fast if required DB config is missing
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
  throw new Error("Missing required database environment variables. Check DB_HOST, DB_USER, DB_PASSWORD, DB_NAME");
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
  // Enable automatic reconnection to prevent crashes on transient DB failures
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Handle pool errors gracefully to prevent server crashes
pool.on('error', (err) => {
  console.error('Database pool error:', err);
  // Don't throw - allow server to continue and retry connections
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.warn('Database connection lost. Pool will attempt to reconnect.');
  }
});

module.exports = pool.promise();
