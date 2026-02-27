#!/bin/bash

# Planka Monorepo Setup Script for Raspberry Pi
# Act as @Engenheiro de Infra

set -e

echo "🚀 Starting Planka + WhatsApp Bridge Setup..."

# 1. Update and Install Dependencies
echo "Updating packages..."
sudo apt-get update
sudo apt-get install -y curl git build-essential ca-certificates

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

# 3. Install Docker (Specific for Raspberry Pi Bookworm as tested by user)
if ! command -v docker &> /dev/null; then
    echo "Installing Docker (RPi Bookworm configuration)..."
    sudo rm -f /etc/apt/sources.list.d/docker.list
    sudo install -m 0755 -d /etc/apt/keyrings
    sudo curl -fsSL https://download.docker.com/linux/raspbian/gpg -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc

    echo "deb [arch=armhf signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/raspbian bookworm stable" | sudo tee /etc/apt/sources.list.d/docker.list

    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker $USER
    echo "Docker installed successfully."
else
    echo "Docker already installed."
fi

# 4. Create Volume Directories
echo "Creating volume directories..."
mkdir -p ./data/postgres
mkdir -p ./data/planka
mkdir -p ./data/whatsapp-session
mkdir -p ./data/backups
touch ./data/whatsapp-contacts.json

# 5. Set Permissions
echo "Setting permissions..."
sudo chown -R $USER:$USER ./data

# 6. Clone Planka Source (if missing)
if [ ! -d "./apps/planka" ]; then
    echo "Cloning Planka source code for custom modifications..."
    git clone https://github.com/plankanban/planka.git apps/planka
fi

# 7. Automatic Environment Configuration
echo "⚙️ Configuring environment variables..."
if [ ! -f .env ]; then
    cp .env.example .env

    # Detect Local IP address
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    if [ -z "$LOCAL_IP" ]; then
        LOCAL_IP="localhost"
    fi
    
    # Generate Random Secret Key
    RANDOM_SECRET=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32)

    # Apply automatic settings
    sed -i "s|BASE_URL=.*|BASE_URL=http://${LOCAL_IP}:3001|g" .env
    sed -i "s|PLANKA_SECRET_KEY=.*|PLANKA_SECRET_KEY=${RANDOM_SECRET}|g" .env
    
    echo "✅ .env pre-configured with IP: ${LOCAL_IP}"
    echo "✅ Secret Key generated automatically."
else
    echo "ℹ️ .env file already exists. Skipping auto-config."
fi

echo "✅ Setup complete! Log out and log back in to apply Docker group changes."
echo "Then run: docker compose up --build -d"
echo ""
echo "------------------------------------------------------------------"
echo "CREDENCIAIS PADRÃO CONFIGURADAS:"
echo "E-mail: admin@example.com"
echo "Senha: password"
echo "Acesse em: http://${LOCAL_IP}:3001"
echo "------------------------------------------------------------------"
