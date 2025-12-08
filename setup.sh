#!/bin/bash

echo "===================================="
echo "BennSauce Game - Setup Assistant"
echo "===================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    echo ""
    exit 1
fi

echo "[OK] Node.js is installed"
node --version
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

echo "===================================="
echo "What would you like to do?"
echo "===================================="
echo "1. Start game in Electron (Development)"
echo "2. Build Linux AppImage (for Steam Deck)"
echo "3. Build for all platforms"
echo "4. Exit"
echo ""

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo "Starting game..."
        npm start
        ;;
    2)
        echo ""
        echo "Building Linux AppImage for Steam Deck..."
        npm run build:linux
        echo ""
        echo "Build complete! Check the dist folder."
        echo "Transfer the .AppImage file to your Steam Deck!"
        read -p "Press Enter to continue..."
        ;;
    3)
        echo ""
        echo "Building for all platforms (this may take a while)..."
        npm run build:all
        echo ""
        echo "Build complete! Check the dist folder."
        read -p "Press Enter to continue..."
        ;;
    4)
        exit 0
        ;;
    *)
        echo "Invalid choice!"
        read -p "Press Enter to continue..."
        ;;
esac
