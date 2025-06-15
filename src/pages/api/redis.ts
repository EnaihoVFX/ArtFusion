import type { NextApiRequest, NextApiResponse } from 'next'
import { getCanvasState, updateCanvasState, addParticipant, getParticipants, removeParticipant, cleanupRedisConnections } from '@/lib/redis'
import { Redis } from 'ioredis'

// Initialize Redis
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { action, sessionId } = req.query

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'Invalid session ID' })
    }

    switch (action) {
      case 'getCanvasState':
        const state = await getCanvasState(sessionId)
        return res.status(200).json({ state })

      case 'updateCanvasState':
        const { imageUrl } = req.body
        if (!imageUrl) {
          return res.status(400).json({ error: 'Image URL is required' })
        }
        await updateCanvasState(sessionId, imageUrl)
        return res.status(200).json({ success: true })

      case 'addParticipant':
        const { address } = req.body
        if (!address) {
          return res.status(400).json({ error: 'Address is required' })
        }
        await addParticipant(sessionId, address)
        return res.status(200).json({ success: true })

      case 'getParticipants':
        const participants = await getParticipants(sessionId)
        return res.status(200).json({ participants })

      case 'removeParticipant':
        const { removeAddress } = req.body
        if (!removeAddress) {
          return res.status(400).json({ error: 'Address is required' })
        }
        await removeParticipant(sessionId, removeAddress)
        return res.status(200).json({ success: true })

      case 'savePrompt':
        const { prompt, address: promptAddress } = req.body
        if (!prompt || !promptAddress) {
          console.log('Missing prompt or address:', { prompt, promptAddress })
          return res.status(400).json({ error: 'Prompt and address are required' })
        }
        console.log('Saving prompt:', { prompt, promptAddress, sessionId })
        
        try {
          await redis.hset(`session:${sessionId}:prompts`, promptAddress, JSON.stringify({
            prompt,
            locked: false
          }))
          return res.status(200).json({ success: true })
        } catch (error) {
          console.error('Error saving prompt:', error)
          return res.status(500).json({ error: 'Failed to save prompt' })
        }

      case 'lockPrompt':
        const { address: lockAddress } = req.body
        if (!lockAddress) {
          console.log('Missing address for locking')
          return res.status(400).json({ error: 'Address is required' })
        }
        console.log('Locking prompt for address:', lockAddress)
        
        try {
          const promptData = await redis.hget(`session:${sessionId}:prompts`, lockAddress)
          if (!promptData) {
            console.log('No prompt found for address:', lockAddress)
            return res.status(404).json({ error: 'No prompt found for this address' })
          }
          
          const promptObj = JSON.parse(promptData)
          promptObj.locked = true
          await redis.hset(`session:${sessionId}:prompts`, lockAddress, JSON.stringify(promptObj))
          return res.status(200).json({ success: true })
        } catch (error) {
          console.error('Error locking prompt:', error)
          return res.status(500).json({ error: 'Failed to lock prompt' })
        }

      case 'getPrompts':
        console.log('Getting prompts for session:', sessionId)
        const prompts = await redis.hgetall(`session:${sessionId}:prompts`)
        console.log('Raw prompts from Redis:', prompts)
        
        // If no prompts exist yet, initialize with empty object
        if (!prompts || Object.keys(prompts).length === 0) {
          console.log('No prompts found, initializing empty prompts')
          return res.status(200).json({ prompts: {} })
        }
        
        const parsedPrompts = Object.entries(prompts).reduce((acc, [address, data]) => {
          acc[address] = JSON.parse(data)
          return acc
        }, {} as Record<string, any>)
        console.log('Parsed prompts:', parsedPrompts)
        return res.status(200).json({ prompts: parsedPrompts })

      default:
        return res.status(400).json({ error: 'Invalid action' })
    }
  } catch (error) {
    console.error('Redis API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  } finally {
    await cleanupRedisConnections()
  }
} 