import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const writeFile = promisify(fs.writeFile)
const mkdir = promisify(fs.mkdir)

// Ensure the storage directory exists
const STORAGE_DIR = path.join(process.cwd(), 'storage')
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true })
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sessionId, imageData } = req.body

  if (!sessionId || !imageData) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
    const imageBuffer = Buffer.from(base64Data, 'base64')
    const filePath = path.join(STORAGE_DIR, `${sessionId}.png`)
    await writeFile(filePath, imageBuffer)

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error saving canvas state:', error)
    return res.status(500).json({ 
      error: 'Failed to save canvas state',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 