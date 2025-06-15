import { Redis } from 'ioredis'

// Only create Redis connection on the server side
const isServer = typeof window === 'undefined'

// Flag to track if Redis is available
let isRedisAvailable = false

// Create a function to get a new Redis connection
function createRedisConnection() {
  if (!isServer) {
    throw new Error('Redis can only be used on the server side')
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
  
  console.log('🔗 Creating Redis connection with URL:', redisUrl.replace(/:[^:@]*@/, ':****@'))
  
  const redis = new Redis(redisUrl, {
    // Enable offline queue to handle connection issues
    enableOfflineQueue: true,
    // Retry connection attempts
    maxRetriesPerRequest: 3,
    // Increase connection timeout
    connectTimeout: 10000,
    // Command timeout
    commandTimeout: 5000,
    // Remove TLS configuration for Upstash compatibility
    tls: undefined,
    // Enable reconnection
    retryStrategy: (times) => {
      console.log(`🔄 Redis retry attempt ${times}`)
      if (times > 5) {
        console.error('❌ Redis connection failed after 5 attempts')
        isRedisAvailable = false
        return null // Stop retrying after 5 attempts
      }
      return Math.min(times * 200, 2000)
    }
  })

  // Handle Redis connection events
  redis.on('error', (err) => {
    console.error('❌ Redis connection error:', err.message)
    console.error('Redis error details:', {
      code: (err as any).code,
      errno: (err as any).errno,
      syscall: (err as any).syscall,
      address: (err as any).address,
      port: (err as any).port
    })
    isRedisAvailable = false
  })

  redis.on('connect', () => {
    console.log('✅ Redis connected successfully')
    isRedisAvailable = true
  })

  redis.on('reconnecting', () => {
    console.log('🔄 Redis reconnecting...')
    isRedisAvailable = false
  })

  redis.on('ready', () => {
    console.log('✅ Redis is ready')
    isRedisAvailable = true
  })

  return redis
}

// Create a connection pool
const connections = new Map<string, Redis>()

// Get or create a Redis connection
function getRedisConnection(key: string = 'default'): Redis {
  if (!isServer) {
    throw new Error('Redis can only be used on the server side')
  }

  if (!connections.has(key)) {
    connections.set(key, createRedisConnection())
  }
  return connections.get(key)!
}

// Helper function to handle Redis operations with fallback
async function withRedisFallback<T>(
  redisOperation: () => Promise<T>,
  fallbackOperation: () => T
): Promise<T> {
  if (!isRedisAvailable) {
    return fallbackOperation()
  }

  try {
    return await redisOperation()
  } catch (error) {
    console.error('Redis operation failed, using fallback:', error)
    return fallbackOperation()
  }
}

export async function getCanvasState(sessionId: string): Promise<string | null> {
  if (!isServer) {
    throw new Error('Redis can only be used on the server side')
  }

  return withRedisFallback(
    async () => {
      const redis = getRedisConnection(`canvas:${sessionId}`)
      return await redis.get(`canvas:${sessionId}`)
    },
    () => {
      // Fallback to reading from a local file or other storage
      return null
    }
  )
}

export async function updateCanvasState(sessionId: string, imageUrl: string): Promise<void> {
  if (!isServer) {
    throw new Error('Redis can only be used on the server side')
  }

  await withRedisFallback(
    async () => {
      const redis = getRedisConnection(`canvas:${sessionId}`)
      await redis.set(`canvas:${sessionId}`, imageUrl)
    },
    () => {
      // Fallback to writing to a local file or other storage
      console.log('Using fallback storage for canvas state')
    }
  )
}

export async function addParticipant(sessionId: string, address: string): Promise<void> {
  if (!isServer) {
    throw new Error('Redis can only be used on the server side')
  }

  await withRedisFallback(
    async () => {
      const redis = getRedisConnection(`session:${sessionId}`)
      await redis.sadd(`session:${sessionId}:participants`, address)
    },
    () => {
      // Fallback to local storage
      console.log('Using fallback storage for participants')
    }
  )
}

export async function getParticipants(sessionId: string): Promise<string[]> {
  if (!isServer) {
    throw new Error('Redis can only be used on the server side')
  }

  return withRedisFallback(
    async () => {
      const redis = getRedisConnection(`session:${sessionId}`)
      return await redis.smembers(`session:${sessionId}:participants`)
    },
    () => {
      // Fallback to empty array
      return []
    }
  )
}

export async function removeParticipant(sessionId: string, address: string): Promise<void> {
  if (!isServer) {
    throw new Error('Redis can only be used on the server side')
  }

  await withRedisFallback(
    async () => {
      const redis = getRedisConnection(`session:${sessionId}`)
      await redis.srem(`session:${sessionId}:participants`, address)
    },
    () => {
      // Fallback to local storage
      console.log('Using fallback storage for participants')
    }
  )
}

// Cleanup function to close connections
export async function cleanupRedisConnections(): Promise<void> {
  if (!isServer) {
    return
  }
  for (const [key, connection] of connections.entries()) {
    try {
      await connection.quit()
      connections.delete(key)
    } catch (error) {
      console.error(`Error closing Redis connection ${key}:`, error)
    }
  }
}

// Only export default connection on server side
export default isServer ? getRedisConnection() : null 