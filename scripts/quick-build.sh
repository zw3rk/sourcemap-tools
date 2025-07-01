#!/bin/bash

echo "Quick build script for Source Map Visualizer"
echo "==========================================="

# Check if we're in nix shell
if [ -z "$IN_NIX_SHELL" ]; then
    echo "Please run this inside nix shell (run 'nix develop' first)"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build the extension
echo "Building extension..."
npm run compile

echo "Build complete! The extension is ready to use."