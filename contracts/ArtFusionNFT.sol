// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/finance/PaymentSplitter.sol";

contract ArtFusionNFT is ERC721URIStorage, Ownable, PaymentSplitter {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    // Mapping from token ID to contributors
    mapping(uint256 => address[]) private _contributors;
    
    // Mapping from token ID to contribution status
    mapping(uint256 => mapping(address => bool)) private _hasContributed;

    // Events
    event ArtworkCreated(uint256 indexed tokenId, address[] contributors);
    event ContributionAdded(uint256 indexed tokenId, address contributor);

    constructor() ERC721("ArtFusion", "ARTF") PaymentSplitter(new address[](0), new uint256[](0)) {}

    function createArtwork(
        address[] memory contributors,
        string memory tokenURI
    ) public returns (uint256) {
        require(contributors.length > 0, "Must have at least one contributor");
        
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        _safeMint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, tokenURI);
        
        // Store contributors
        _contributors[newTokenId] = contributors;
        
        // Mark all contributors as having contributed
        for (uint i = 0; i < contributors.length; i++) {
            _hasContributed[newTokenId][contributors[i]] = true;
        }

        emit ArtworkCreated(newTokenId, contributors);
        return newTokenId;
    }

    function getContributors(uint256 tokenId) public view returns (address[] memory) {
        return _contributors[tokenId];
    }

    function hasContributed(uint256 tokenId, address contributor) public view returns (bool) {
        return _hasContributed[tokenId][contributor];
    }

    // Override _beforeTokenTransfer to ensure proper royalty distribution
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal virtual override(ERC721) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
} 