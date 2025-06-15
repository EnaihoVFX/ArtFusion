import React, { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { sharedStorage } from '@/lib/sharedStorage'

interface TestHelperProps {
  sessionId: string
}

export default function TestHelper({ sessionId }: TestHelperProps) {
  const { publicKey } = useWallet()
  const [sessionState, setSessionState] = useState<any>(null)

  const loadSessionState = async () => {
    const state = await sharedStorage.getSessionState(sessionId)
    setSessionState(state)
  }

  const clearSession = async () => {
    if (confirm('Are you sure you want to clear this session?')) {
      try {
        await fetch(`/api/session/${sessionId}`, { method: 'DELETE' })
        await loadSessionState()
      } catch (error) {
        console.error('Error clearing session:', error)
      }
    }
  }

  const addTestParticipant = async () => {
    const testAddress = `test_${Date.now()}`
    await sharedStorage.addParticipant(sessionId, testAddress)
    await loadSessionState()
  }

  const startGame = async () => {
    await sharedStorage.startGame(sessionId)
    await loadSessionState()
  }

  const forceSync = async () => {
    // Force refresh the session state
    await loadSessionState()
    // Trigger a page reload to ensure all clients sync
    window.location.reload()
  }

  if (!publicKey) return null

  const currentUserAddress = publicKey.toBase58()
  const isHost = sessionState ? sharedStorage.isHost(sessionState, currentUserAddress) : false

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg max-w-sm z-50">
      <h3 className="font-bold mb-2">🧪 Test Helper (Shared)</h3>
      
      <div className="text-xs space-y-1 mb-3">
        <div>Session: {sessionId}</div>
        <div>Phase: {sessionState?.sessionPhase || 'loading...'}</div>
        <div>Players: {sessionState?.participants?.length || 0}</div>
        <div>Host: {sessionState?.lobbyState?.hostAddress?.slice(0, 6)}...</div>
        <div>You: {currentUserAddress.slice(0, 6)}...</div>
        <div className={isHost ? 'text-green-400' : 'text-gray-400'}>
          {isHost ? '👑 You are host' : 'You are not host'}
        </div>
      </div>

      {/* Participant List */}
      {sessionState?.participants && sessionState.participants.length > 0 && (
        <div className="mb-3 text-xs">
          <div className="font-semibold mb-1">Participants:</div>
          {sessionState.participants.map((p: any, i: number) => (
            <div key={p.address} className="flex justify-between">
              <span className={p.address === currentUserAddress ? 'text-blue-400' : 'text-white'}>
                {p.address === currentUserAddress ? 'You' : `Player ${i + 1}`}
              </span>
              <span className="text-gray-400">
                {p.address === sessionState.lobbyState.hostAddress ? '👑' : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <button
          onClick={loadSessionState}
          className="w-full px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
        >
          Refresh State
        </button>
        
        <button
          onClick={addTestParticipant}
          className="w-full px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
        >
          Add Test Player
        </button>
        
        <button
          onClick={startGame}
          className="w-full px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
        >
          Start Game
        </button>
        
        <button
          onClick={forceSync}
          className="w-full px-2 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
        >
          Force Sync
        </button>
        
        <button
          onClick={clearSession}
          className="w-full px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
        >
          Clear Session
        </button>
      </div>

      <div className="mt-3 text-xs">
        <div className="font-semibold mb-1">Shared Storage Test:</div>
        <ol className="list-decimal list-inside space-y-1">
          <li>Open new tab/window</li>
          <li>Connect different wallet</li>
          <li>Go to same session URL</li>
          <li>Check Test Helper for participants</li>
          <li>Click "Start Game" in lobby</li>
        </ol>
      </div>
    </div>
  )
} 