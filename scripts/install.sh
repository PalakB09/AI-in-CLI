#!/bin/bash

# AI CLI Assistant Installation Script
# This script installs the ai-cli-assistant globally and sets up shell integration

set -e

echo "🤖 Installing AI CLI Assistant..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed. Please install Node.js 16+ first.${NC}"
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="16.0.0"

if ! node -e "process.exit(require('semver').gte('$NODE_VERSION', '$REQUIRED_VERSION') ? 0 : 1)" 2>/dev/null; then
    echo -e "${RED}Error: Node.js $REQUIRED_VERSION or higher is required. Current version: $NODE_VERSION${NC}"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed.${NC}"
    exit 1
fi

echo -e "${BLUE}✓ Node.js version check passed${NC}"

# Install the package globally
echo -e "${BLUE}Installing ai-cli-assistant globally...${NC}"
npm install -g ai-cli-assistant

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Global installation completed${NC}"
else
    echo -e "${RED}Error: Global installation failed${NC}"
    exit 1
fi

# Detect current shell
SHELL_TYPE=""
if [ -n "$ZSH_VERSION" ]; then
    SHELL_TYPE="zsh"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_TYPE="bash"
elif [ -n "$FISH_VERSION" ]; then
    SHELL_TYPE="fish"
else
    SHELL_TYPE=$(basename "$SHELL")
fi

echo -e "${BLUE}Detected shell: $SHELL_TYPE${NC}"

# Install shell integration
echo -e "${BLUE}Setting up shell integration...${NC}"
ai install --shell $SHELL_TYPE

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Shell integration completed${NC}"
else
    echo -e "${YELLOW}Warning: Shell integration failed. You can run 'ai install' manually.${NC}"
fi

# Create wrapper script for CMD (Windows)
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    echo -e "${BLUE}Creating Windows batch file wrapper...${NC}"
    
    AI_CMD_PATH=$(which ai)
    WRAPPER_DIR="$USERPROFILE\\.ai-cli\\bin"
    mkdir -p "$WRAPPER_DIR"
    
    cat > "$WRAPPER_DIR\\ai.bat" << EOF
@echo off
node "$AI_CMD_PATH" %*
EOF
    
    # Add to PATH if not already there
    if [[ ":$PATH:" != *":$WRAPPER_DIR:"* ]]; then
        echo -e "${YELLOW}Adding $WRAPPER_DIR to PATH...${NC}"
        echo "export PATH=\"\$PATH:$WRAPPER_DIR\"" >> "$USERPROFILE\\.bashrc"
        echo "set PATH=%PATH%;$WRAPPER_DIR" >> "$USERPROFILE\\AppData\\Local\\Microsoft\\WindowsApps\\ai.bat"
    fi
    
    echo -e "${GREEN}✓ Windows wrapper created${NC}"
fi

# Verify installation
echo -e "${BLUE}Verifying installation...${NC}"
ai --version

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Installation verified${NC}"
else
    echo -e "${RED}Error: Installation verification failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 AI CLI Assistant installed successfully!${NC}"
echo ""
echo -e "${BLUE}Quick Start:${NC}"
echo "  ai suggest \"list all files in current directory\""
echo "  ai vault list"
echo "  ai debug"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  • Commands are stored in: ~/.ai-cli/"
echo "  • Configure AI key with: export OPENAI_API_KEY=your_key"
echo "  • For help: ai --help"
echo ""
echo -e "${YELLOW}Note: You may need to restart your shell for shell integration to take effect.${NC}"