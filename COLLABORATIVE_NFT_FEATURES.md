# Collaborative NFT Ownership & Marketplace Features

## Overview
ArtFusion now supports collaborative NFT ownership and a basic marketplace where users can buy, sell, and trade NFTs with multiple stakeholders.

## Collaborative Ownership Features

### 1. Multi-Stakeholder NFTs
- NFTs can be owned by multiple collaborators
- Each collaborator has a defined stake percentage
- Total stakes must equal 100%
- Roles include: creator, collaborator, owner

### 2. Revenue Sharing
- When an NFT is sold, revenue is distributed among collaborators
- Distribution is based on stake percentages
- All collaborators must approve major decisions

### 3. Ownership Management
- Collaborative ownership is stored in Redis and local file fallback
- Ownership can be transferred between collaborators
- New collaborators can be added with stake redistribution

## Marketplace Features

### 1. NFT Listing
- NFT owners can list their NFTs for sale
- Set custom prices in SOL
- Only owners and collaborators can list NFTs

### 2. NFT Purchasing
- Users can purchase NFTs with SOL
- Automatic ownership transfer upon purchase
- Revenue distribution to previous owners

### 3. Like & Valuation System
- Users can like NFTs to increase their valuation
- Valuation affects trending and discovery
- Simple formula: valuation = likes × 10

## API Endpoints

### NFT Management
- `POST /api/mint-nft` - Mint new NFT with collaborators
- `GET /api/nfts` - Get all NFTs
- `GET /api/nfts/[mintAddress]` - Get specific NFT details

### Marketplace Actions
- `POST /api/nfts/[mintAddress]/like` - Like an NFT
- `POST /api/nfts/[mintAddress]/list` - List NFT for sale
- `POST /api/nfts/[mintAddress]/buy` - Purchase an NFT

## Data Structure

### NFT Object
```typescript
{
  mintAddress: string
  title: string
  image: string
  collaborators: Collaborator[]
  isCollaborative: boolean
  isForSale: boolean
  price: number
  owner: string
  likes: number
  valuation: number
  createdAt: string
}
```

### Collaborator Object
```typescript
{
  address: string
  stake: number
  role: string
}
```

## Usage Examples

### Minting Collaborative NFT
```javascript
const response = await fetch('/api/mint-nft', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    image: base64Image,
    title: 'Collaborative Artwork',
    collaborators: [
      { address: 'wallet1', stake: 60, role: 'creator' },
      { address: 'wallet2', stake: 40, role: 'collaborator' }
    ]
  })
})
```

### Listing NFT for Sale
```javascript
const response = await fetch(`/api/nfts/${mintAddress}/list`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    price: 0.5,
    sellerAddress: 'wallet1'
  })
})
```

### Purchasing NFT
```javascript
const response = await fetch(`/api/nfts/${mintAddress}/buy`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    buyerAddress: 'wallet3',
    price: 0.5
  })
})
```

## Future Enhancements

1. **Smart Contract Integration**: Move ownership logic to Solana smart contracts
2. **Royalty Distribution**: Automatic royalty payments to collaborators
3. **Voting System**: Collaborative decision-making for NFT actions
4. **Stake Trading**: Allow collaborators to trade their stakes
5. **Auction System**: Support for NFT auctions with collaborative bidding

## Security Considerations

- All ownership changes require proper authorization
- Revenue distribution is calculated server-side
- Transaction signatures are validated
- Fallback storage ensures data persistence 