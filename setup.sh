#!/bin/bash

# Planka Monorepo Setup Script for Raspberry Pi
# Act as @Engenheiro de Infra

set -e

echo "🚀 Starting Planka + WhatsApp Bridge Setup..."

# 1. Update and Install Dependencies
echo "Updating packages..."
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl git build-essential

# 2. Add Swap (Crucial for Docker Builds on Pi)
if [ ! -f /swapfile ] && [ $(free -m | awk '/Mem:/ {print $2}') -lt 4000 ]; then
    echo "Memory is less than 4GB. Creating 2GB swap file to prevent OOM during Docker build..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "Swap created!"
else
    echo "Swap file already exists or RAM is sufficient."
fi

# 3. Install Docker (with Compose V2)
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "Docker installed successfully."
else
    echo "Docker already installed."
fi

sudo apt-get install -y docker-compose-plugin

# 4. Create Volume Directories
echo "Creating volume directories..."
mkdir -p ./data/postgres
mkdir -p ./data/planka
mkdir -p ./data/evolution
mkdir -p ./data/whatsapp-session
mkdir -p ./data/backups

# 5. Set Permissions
echo "Setting permissions..."
sudo chown -R $USER:$USER ./data

# 6. Clone Planka Source (if missing)
if [ ! -d "./apps/planka" ]; then
    echo "Cloning Planka source code for custom modifications..."
    git clone https://github.com/plankanban/planka.git apps/planka
fi

# 7. Check Environment File
if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit the .env file with your credentials before running 'docker compose up -d'"
fi

echo "✅ Setup complete! Log out and log back in to apply Docker group changes."
echo "Then run: docker compose up -build -d"
