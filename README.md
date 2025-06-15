# ArtFusion - Collaborative NFT Creation Platform

A decentralized platform for collaborative art creation and NFT minting on Solana blockchain.

## Features

- **Collaborative Drawing**: Turn-based drawing system where multiple artists contribute to a single artwork
- **AI Generation**: Uses Replicate's Stable Diffusion XL to generate final collaborative artworks
- **Voting System**: Participants vote on the best generated version
- **NFT Minting**: Mint collaborative artworks as NFTs with equal ownership distribution
- **Solana Integration**: Built on Solana blockchain with wallet integration
- **Real-time Updates**: Live collaboration with real-time canvas updates
- **Marketplace**: View and trade collaborative NFTs

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Blockchain**: Solana, Metaplex
- **AI**: Replicate (Stable Diffusion XL)
- **Database**: Redis
- **Deployment**: Vercel

## Prerequisites

- Node.js 18+ 
- Redis instance (local or cloud)
- Solana wallet (Phantom, Solflare, etc.)
- Replicate API key (for AI generation)

## Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd artfusion
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file:
   ```env
   REDIS_URL=redis://localhost:6379
   REPLICATE_API_TOKEN=your_replicate_api_token_here
   ```

4. **Start Redis**
   ```bash
   # If using Docker
   docker run -d -p 6379:6379 redis:alpine
   
   # Or install Redis locally
   brew install redis  # macOS
   redis-server
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:3000`

## Vercel Deployment

### 1. Prepare for Deployment

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Set up Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Connect your GitHub account
   - Import your repository

### 2. Environment Variables in Vercel

Add these environment variables in your Vercel dashboard:

- `REDIS_URL`: Your Redis instance URL (e.g., `redis://username:password@host:port`)
- `REPLICATE_API_TOKEN`: Your Replicate API token

### 3. Deploy

Vercel will automatically deploy your app on every push to the main branch.

## Usage

### Creating a Session

1. Connect your Solana wallet
2. Click "Create New Session"
3. Share the session link with collaborators

### Collaborating

1. Join a session using the shared link
2. Wait for your turn to draw
3. Add your contribution and prompt
4. Lock your turn when finished

### Voting and Minting

1. Vote on the generated artwork variations
2. The host can mint the winning artwork as an NFT
3. All contributors receive equal ownership

## API Endpoints

- `POST /api/participants/[sessionId]` - Manage session participants
- `POST /api/turns/[sessionId]` - Manage turn state
- `POST /api/generate/collaborative` - Generate AI artwork
- `POST /api/vote/[sessionId]` - Submit votes
- `POST /api/mint-nft` - Mint collaborative NFT

## Project Structure

```
src/
├── components/          # React components
├── lib/                # Utility libraries
├── pages/              # Next.js pages and API routes
│   ├── api/           # API endpoints
│   ├── game/          # Game session pages
│   └── marketplace/   # NFT marketplace
└── storage/           # Local file storage
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please open an issue on GitHub. 