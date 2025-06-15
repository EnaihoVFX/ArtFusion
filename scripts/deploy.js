const hre = require("hardhat");

async function main() {
  console.log("Deploying ArtFusion NFT contract...");

  const ArtFusionNFT = await hre.ethers.getContractFactory("ArtFusionNFT");
  const artFusionNFT = await ArtFusionNFT.deploy();

  await artFusionNFT.deployed();

  console.log("ArtFusion NFT deployed to:", artFusionNFT.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 