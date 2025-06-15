import React from 'react'

interface Collaborator {
  address: string
  stake: number
  role: string
}

interface CollaborativeOwnershipProps {
  collaborators: Collaborator[]
  isCollaborative: boolean
  totalStake?: number
}

const CollaborativeOwnership: React.FC<CollaborativeOwnershipProps> = ({
  collaborators,
  isCollaborative,
  totalStake = 100
}) => {
  if (!isCollaborative || !collaborators || collaborators.length === 0) {
    return null
  }

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold text-purple-800 mb-2">
        🎨 Collaborative Ownership
      </h3>
      <div className="space-y-2">
        {collaborators.map((collaborator, index) => (
          <div key={index} className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-purple-700">
                {collaborator.role === 'creator' ? '👑' : '🤝'} {collaborator.role}
              </span>
              <span className="text-xs text-gray-600">
                {collaborator.address.slice(0, 8)}...{collaborator.address.slice(-6)}
              </span>
            </div>
            <span className="text-sm font-bold text-purple-800">
              {collaborator.stake}%
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-purple-200">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total Stake:</span>
          <span className="font-semibold text-purple-800">{totalStake}%</span>
        </div>
      </div>
    </div>
  )
}

export default CollaborativeOwnership 