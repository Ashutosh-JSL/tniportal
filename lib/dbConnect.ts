import * as sql from 'mssql';
 
 
function getDbConfig(): sql.config {
  const missing: string[] = [];
  if (!process.env.DB_SERVER) missing.push('DB_SERVER');
  if (!process.env.DB_DATABASE) missing.push('DB_DATABASE');
  if (!process.env.DB_USER) missing.push('DB_USER');
  if (!process.env.DB_PASSWORD) missing.push('DB_PASSWORD');

  if (missing.length > 0) {
    throw new Error(
      `Missing required database environment variable(s): ${missing.join(', ')}. Please verify your .env.local file and ensure the dev server has been restarted.`
    );
  }

  return {
    server: process.env.DB_SERVER!,
    database: process.env.DB_DATABASE!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    port: Number(process.env.DB_PORT) || 1433,
    options: {
      encrypt: true,
      trustServerCertificate: true, // Change to false in production with proper SSL
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}
let pool: sql.ConnectionPool | null = null;
 
export async function getConnection(): Promise<sql.ConnectionPool> {
  // If pool exists and is already connected, return it
  if (pool && pool.connected) {
    console.log("Database Already Connected !!!");
    return pool;
  }
 
  // If pool exists and is currently connecting, wait for it
  if (pool && pool.connecting) {
    console.log("Database connection in progress, waiting...");
    return pool;
  }
 
  // Create new pool and connect
  try {
    console.log("Creating new database connection...");
    const config = getDbConfig();
    pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log("Database Connection Successful.");
   
    return pool;
  } catch (err) {
    console.error('Database connection failed:', err);
    pool = null;
    throw err;
  }
}
 
// export default getConnection;
 