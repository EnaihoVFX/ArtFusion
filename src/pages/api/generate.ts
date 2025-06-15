import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import Replicate from 'replicate'

const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)
const mkdir = promisify(fs.mkdir)

// Ensure the storage directory exists
const STORAGE_DIR = path.join(process.cwd(), 'storage')
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true })
}

// Server-side storage functions
const serverStorage = {
  getCanvasState: async (sessionId: string): Promise<string | null> => {
    try {
      const filePath = path.join(STORAGE_DIR, `${sessionId}.png`)
      if (!fs.existsSync(filePath)) {
        return null
      }
      const imageBuffer = await readFile(filePath)
      return `data:image/png;base64,${imageBuffer.toString('base64')}`
    } catch (error) {
      console.error('Error reading canvas state:', error)
      return null
    }
  },

  updateCanvasState: async (sessionId: string, imageData: string): Promise<void> => {
    try {
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
      const imageBuffer = Buffer.from(base64Data, 'base64')
      const filePath = path.join(STORAGE_DIR, `${sessionId}.png`)
      await writeFile(filePath, imageBuffer)
    } catch (error) {
      console.error('Error updating canvas state:', error)
      throw error
    }
  }
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { prompt, image, address, sessionId } = req.body

    if (!prompt || !image || !sessionId) {
      return res.status(400).json({ error: 'Missing required fields: prompt, image, sessionId' })
    }

    // Convert base64 image to buffer
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
    const imageBuffer = Buffer.from(base64Data, 'base64')

    // Create a prompt that explicitly prevents backgrounds
    const enhancedPrompt = `photorealistic ${prompt}, ultra realistic, high detail, professional photography, natural lighting, sharp focus, 8k resolution, masterpiece, award winning photography, same composition as sketch, exact same shape and position, isolated object, no background, transparent background, studio lighting, product photography, white background, clean background`
    
    // Very aggressive negative prompt to prevent backgrounds
    const negativePrompt = "cartoon, anime, drawing, sketch, illustration, painting, watercolor, oil painting, digital art, artistic, abstract, blurry, low quality, pixelated, distorted, deformed, ugly, bad anatomy, multiple objects, extra objects, additional items, duplicate objects, background, scene, landscape, environment, sky, clouds, trees, buildings, people, animals, park, city, nature, fake, artificial, plastic, toy, miniature, unrealistic, fantasy, magical, fictional, ground, floor, surface, texture, grass, dirt, sand, water, ocean, sea, mountain, hill, valley, forest, jungle, desert, snow, ice, rock formation, cave, wall, floor, ceiling, room, interior, exterior, outdoor, indoor, environment, setting, location, place, area, region, space, atmosphere, lighting, shadow, reflection, mirror, glass, metal, wood, stone, brick, concrete, asphalt, road, path, street, building, house, structure, architecture"

    // Use a model better suited for sketch-to-realistic conversion
    const output = await replicate.run(
      "stability-ai/stable-diffusion-2-1:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
      {
        input: {
          prompt: enhancedPrompt,
          image: `data:image/png;base64,${base64Data}`,
          num_outputs: 4, // Generate 4 options
          scheduler: "K_EULER",
          num_inference_steps: 50, // Higher for better quality
          guidance_scale: 15, // Higher for better prompt following
          strength: 0.7, // Higher strength to better follow the prompt
          negative_prompt: negativePrompt
        }
      }
    )

    if (!output || !Array.isArray(output) || output.length === 0) {
      throw new Error('No image generated')
    }

    return res.status(200).json({ 
      images: output, // Return all 4 images
      loading: false,
      debug: {
        prompt: enhancedPrompt,
        steps: 50,
        strength: 0.7
      }
    })

  } catch (error) {
    console.error('Error in generation process:', error)
    
    return res.status(500).json({ 
      error: 'Failed to enhance image',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 