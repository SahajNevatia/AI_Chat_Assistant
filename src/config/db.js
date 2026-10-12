import mongoose from 'mongoose';

let memoryServerInstance = null;

export async function connectDB(customUri = null) {
  const primaryUri = customUri || process.env.MONGODB_URI;

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Attempt connection to primary URI if provided
  if (primaryUri && primaryUri !== 'inmemory') {
    try {
      console.log(`[Database] Attempting connection to MongoDB at: ${primaryUri}`);
      const conn = await mongoose.connect(primaryUri, {
        serverSelectionTimeoutMS: 2500, // Quick timeout to fallback if no local mongod
      });
      console.log(`[Database] Successfully connected to MongoDB: ${conn.connection.host}`);
      return conn;
    } catch (err) {
      console.warn(`[Database] Could not connect to primary MongoDB (${err.message}).`);
      
      // If we are in production and explicitly specified a DB, re-throw
      if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_IN_MEMORY_DB) {
        throw err;
      }
      console.log('[Database] Falling back to automated in-memory MongoDB for seamless development/testing...');
    }
  }

  // Fallback to in-memory MongoDB
  try {
    const path = await import('path');
    const fs = await import('fs');
    const localCachePath = path.resolve(import.meta.dirname, '../../node_modules/.cache/mongodb-memory-server');
    if (fs.existsSync(localCachePath)) {
      process.env.MONGOMS_DOWNLOAD_DIR = localCachePath;
    }

    const { MongoMemoryServer } = await import('mongodb-memory-server');
    if (!memoryServerInstance) {
      memoryServerInstance = await MongoMemoryServer.create();
    }
    const memUri = memoryServerInstance.getUri();
    console.log(`[Database] Starting in-memory MongoDB instance at ${memUri}`);
    const conn = await mongoose.connect(memUri);
    console.log('[Database] Successfully connected to in-memory MongoDB.');
    return conn;
  } catch (memErr) {
    console.error('[Database] Failed to start in-memory MongoDB:', memErr.message);
    throw memErr;
  }
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServerInstance) {
    await memoryServerInstance.stop();
    memoryServerInstance = null;
  }
}
