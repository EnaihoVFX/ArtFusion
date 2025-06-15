import React, { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { participantManager } from '@/lib/participantManager'
import { turnManager } from '@/lib/turnManager'

interface GameLobbyProps {
  sessionId: string
  onGameStart: () => Promise<void>
  participants: any[]
  isHost: boolean
}

export default function GameLobby({ sessionId, onGameStart, participants, isHost }: GameLobbyProps) {
  const { connected, publicKey } = useWallet()
  const [isStarting, setIsStarting] = useState(false)
  const [participantCount, setParticipantCount] = useState(0)

  useEffect(() => {
    setParticipantCount(participants.length)
  }, [participants])

  const handleStartGame = async () => {
    if (!isHost || participantCount < 2) return

    try {
      setIsStarting(true)
      console.log('🎮 HOST STARTING GAME:', {
        sessionId,
        participantCount,
        timestamp: new Date().toISOString()
      })

      await onGameStart()
      
      console.log('✅ GAME STARTED SUCCESSFULLY')
    } catch (error) {
      console.error('Error starting game:', error)
    } finally {
      setIsStarting(false)
    }
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">ArtFusion</h1>
          <p className="text-xl mb-8">Connect your wallet to join the lobby</p>
          <WalletMultiButton />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <div className="bg-black bg-opacity-30 backdrop-blur-sm border-b border-white border-opacity-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-white">ArtFusion</h1>
              <div className="bg-white bg-opacity-20 rounded-full px-4 py-1">
                <span className="text-white text-sm">Session: {sessionId}</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-white bg-opacity-20 rounded-full px-4 py-1">
                <span className="text-white text-sm">
                  {participantCount} / 2+ Collaborators
                </span>
              </div>
              <WalletMultiButton />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Lobby Status */}
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-8 border border-white border-opacity-20 mb-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Game Lobby</h2>
            <p className="text-white text-opacity-80 text-lg mb-6">
              Waiting for collaborators to join...
            </p>
            
            {/* Progress Indicator */}
            <div className="w-full max-w-md mx-auto mb-6">
              <div className="flex justify-between text-white text-sm mb-2">
                <span>Collaborators</span>
                <span>{participantCount} / 2+</span>
              </div>
              <div className="w-full bg-white bg-opacity-20 rounded-full h-3">
                <div 
                  className="h-3 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((participantCount / 2) * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Start Game Button */}
            {isHost && (
              <button
                onClick={handleStartGame}
                disabled={participantCount < 2 || isStarting}
                className={`px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 ${
                  participantCount >= 2 && !isStarting
                    ? 'bg-gradient-to-r from-green-500 to-blue-500 text-white hover:from-green-600 hover:to-blue-600 transform hover:scale-105'
                    : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                }`}
              >
                {isStarting ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Starting Game...</span>
                  </div>
                ) : (
                  'Start Collaborative Session'
                )}
              </button>
            )}

            {!isHost && (
              <div className="text-white text-opacity-80">
                <p>Waiting for the host to start the game...</p>
              </div>
            )}

            {participantCount < 2 && (
              <p className="text-white text-opacity-60 text-sm mt-4">
                Need at least 2 collaborators to start
              </p>
            )}
          </div>
        </div>

        {/* Participants List */}
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 border border-white border-opacity-20">
          <h3 className="text-xl font-semibold text-white mb-6">Collaborators ({participantCount})</h3>
          
          {participants.length === 0 ? (
            <div className="text-center text-white text-opacity-60 py-8">
              <p>No collaborators yet...</p>
              <p className="text-sm mt-2">Share the session link to invite others</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {participants.map((participant: any, index: number) => (
                <div key={participant.address} className="bg-white bg-opacity-20 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {participant.address === publicKey?.toBase58() ? 'You' : index + 1}
                      </span>
                    </div>
                    <div>
                      <p className={`font-semibold ${
                        participant.address === publicKey?.toBase58() 
                          ? 'text-white' 
                          : 'text-white text-opacity-80'
                      }`}>
                        {participant.address === publicKey?.toBase58() 
                          ? 'You' 
                          : `Collaborator ${index + 1}`}
                      </p>
                      <p className="text-white text-opacity-60 text-sm">
                        {participant.address.slice(0, 6)}...
                      </p>
                      {participant.address === publicKey?.toBase58() && isHost && (
                        <span className="text-yellow-400 text-xs font-medium">Host</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Session Info */}
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 border border-white border-opacity-20 mt-8">
          <h3 className="text-lg font-semibold text-white mb-4">Session Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-white text-opacity-80">
                <strong>Session ID:</strong> {sessionId}
              </p>
              <p className="text-white text-opacity-80">
                <strong>Minimum Players:</strong> 2
              </p>
            </div>
            <div>
              <p className="text-white text-opacity-80">
                <strong>Current Players:</strong> {participantCount}
              </p>
              <p className="text-white text-opacity-80">
                <strong>Host:</strong> {isHost ? 'You' : 'Waiting...'}
              </p>
            </div>
          </div>
          
          {/* Share Link */}
          <div className="mt-4 p-4 bg-white bg-opacity-20 rounded-lg">
            <p className="text-white text-sm mb-2">Share this link to invite collaborators:</p>
            <div className="flex space-x-2">
              <input
                type="text"
                value={`${window.location.origin}/game/${sessionId}`}
                readOnly
                className="flex-1 px-3 py-2 bg-white bg-opacity-20 border border-white border-opacity-30 rounded-lg text-white text-sm"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/game/${sessionId}`)
                }}
                className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors text-sm"
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        {/* Debug Info */}
        <div className="bg-white rounded-lg shadow-xl p-6 mt-8">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Debug Info (Lobby)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p><strong>Session ID:</strong> {sessionId}</p>
              <p><strong>Participants:</strong> {participantCount}</p>
              <p><strong>Is Host:</strong> {isHost ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p><strong>Your Address:</strong> {publicKey?.toBase58().slice(0, 6)}...</p>
              <p><strong>Can Start:</strong> {isHost && participantCount >= 2 ? 'Yes' : 'No'}</p>
              <p><strong>Connected:</strong> {connected ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 