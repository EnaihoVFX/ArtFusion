import { NextApiRequest, NextApiResponse } from 'next'
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

interface GenerationRequest {
  sessionId: string
}

interface GenerationResponse {
  success: boolean
  images?: string[]
  combinedPrompt?: string
  error?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<GenerationResponse>) {
  if (req.method === 'GET') {
    const { sessionId } = req.query

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ success: false, error: 'Session ID is required' })
    }

    try {
      // Fetch stored generated images
      const generatedImagesKey = `generated_images:${sessionId}`
      const storedData = await redis.get(generatedImagesKey)
      
      if (!storedData) {
        return res.status(404).json({ success: false, error: 'No generated images found' })
      }

      const parsedData = JSON.parse(storedData)
      
      res.status(200).json({
        success: true,
        images: parsedData.images,
        combinedPrompt: parsedData.combinedPrompt
      })

    } catch (error) {
      console.error('Error fetching generated images:', error)
      res.status(500).json({ success: false, error: 'Failed to fetch generated images' })
    }
    
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const { sessionId } = req.body as GenerationRequest

  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'Session ID is required' })
  }

  // Check if generation is already in progress for this session
  const generationLockKey = `generation_lock:${sessionId}`
  const isGenerating = await redis.get(generationLockKey)
  
  if (isGenerating) {
    console.log('🚫 GENERATION ALREADY IN PROGRESS:', {
      sessionId,
      timestamp: new Date().toISOString()
    })
    return res.status(409).json({ success: false, error: 'Generation already in progress for this session' })
  }

  // Set generation lock (expires in 10 minutes)
  await redis.setex(generationLockKey, 600, 'generating')

  try {
    console.log('🎨 GENERATING COLLABORATIVE ARTWORK:', {
      sessionId,
      timestamp: new Date().toISOString()
    })

    // Get turn state to find all participants
    const turnStateData = await redis.get(`turn:${sessionId}`)
    if (!turnStateData) {
      return res.status(404).json({ success: false, error: 'Turn state not found' })
    }

    const turnState = JSON.parse(turnStateData)
    const { turnOrder } = turnState

    // Collect all drawings and prompts
    const drawings: string[] = []
    const prompts: string[] = []

    for (const address of turnOrder) {
      const drawingData = await redis.get(`drawing:${sessionId}:${address}`)
      if (drawingData) {
        const drawingTurn = JSON.parse(drawingData)
        if (drawingTurn.drawingData) {
          drawings.push(drawingTurn.drawingData)
        }
        if (drawingTurn.prompt) {
          prompts.push(drawingTurn.prompt)
        }
      }
    }

    console.log('📊 COLLECTED DATA:', {
      sessionId,
      drawingCount: drawings.length,
      promptCount: prompts.length,
      prompts: prompts.map(p => p.slice(0, 30) + '...')
    })

    if (drawings.length === 0) {
      return res.status(400).json({ success: false, error: 'No drawings found' })
    }

    // Combine prompts into a single collaborative prompt
    const combinedPrompt = prompts.join('. ') + '. Create a beautiful collaborative artwork that combines all these elements.'

    // For now, use a simple image generation approach
    // In a real implementation, you would call an AI image generation service
    const generatedImages = await generateCollaborativeImages(drawings, combinedPrompt)

    console.log('✅ GENERATION COMPLETE:', {
      sessionId,
      imageCount: generatedImages.length,
      combinedPrompt: combinedPrompt.slice(0, 100) + '...'
    })

    // Store generated images in Redis for all clients to access
    const generatedImagesKey = `generated_images:${sessionId}`
    await redis.setex(generatedImagesKey, 3600, JSON.stringify({
      images: generatedImages,
      combinedPrompt,
      generatedAt: new Date().toISOString()
    }))

    // Clean up generation lock
    await redis.del(generationLockKey)

    res.status(200).json({
      success: true,
      images: generatedImages,
      combinedPrompt
    })

  } catch (error) {
    console.error('Error generating collaborative artwork:', error)
    
    // Clean up generation lock on error
    await redis.del(generationLockKey)
    
    res.status(500).json({ success: false, error: 'Failed to generate artwork' })
  }
}

async function generateCollaborativeImages(drawings: string[], combinedPrompt: string): Promise<string[]> {
  try {
    console.log('🤖 GENERATING IMAGES WITH PROMPT:', combinedPrompt.slice(0, 100) + '...')

    // Use Replicate for AI image generation
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b", // Stable Diffusion XL
        input: {
          prompt: combinedPrompt,
          width: 1024,
          height: 1024,
          num_outputs: 3,
          scheduler: "K_EULER",
          num_inference_steps: 50,
          guidance_scale: 7.5,
          seed: Math.floor(Math.random() * 1000000)
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Replicate API error: ${response.status}`)
    }

    const prediction = await response.json()
    console.log('🎨 PREDICTION STARTED:', prediction.id)

    // Poll for completion
    let result = null
    let attempts = 0
    const maxAttempts = 60 // 5 minutes max

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds between checks
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        }
      })

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`)
      }

      result = await statusResponse.json()
      console.log('🔄 GENERATION STATUS:', result.status)

      if (result.status === 'succeeded') {
        console.log('✅ GENERATION SUCCEEDED')
        return result.output || []
      } else if (result.status === 'failed') {
        throw new Error(`Generation failed: ${result.error}`)
      }

      attempts++
    }

    throw new Error('Generation timed out')

  } catch (error) {
    console.error('❌ GENERATION ERROR:', error)
    
    // Fallback to placeholder images if Replicate fails
    console.log('🔄 FALLING BACK TO PLACEHOLDER IMAGES')
    return [
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    ]
  }
} 