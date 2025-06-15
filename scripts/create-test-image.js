const fs = require('fs')
const path = require('path')

// Create a simple SVG image
const svg = `
<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="400" fill="#4a90e2"/>
  <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
    Test NFT
  </text>
</svg>
`

// Save the SVG
const imagePath = path.join(process.cwd(), 'public', 'test-nft.svg')
fs.writeFileSync(imagePath, svg)

console.log('Created test image at:', imagePath) 