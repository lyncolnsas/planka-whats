#!/bin/bash

# ==============================================================================
# SCRIPT DE REINICIALIZAÇÃO TOTAL (FACTORY RESET)
# Objetivo: Limpar TUDO e deixar pronto para uma nova instalação limpa.
# ==============================================================================

RED='\033[0;31m'
NC='\033[0m'

echo -e "${RED}⚠️  AVISO: Isso irá apagar TODOS os cards, configurações e sessões do WhatsApp!${NC}"
read -p "Deseja realmente ZERAR o sistema? (s/N): " confirm

if [[ $confirm != [sS] ]]; then
    echo "Operação abortada."
    exit 1
fi

echo "🧹 Iniciando limpeza nuclear..."

# 3. DESINSTALAR BLOQUEADORES (Apache/Nginx que roubam a porta 80)
echo "🔓 Removendo permanentemente Apache e Nginx para liberar o sistema..."
sudo systemctl stop apache2 2>/dev/null || true
sudo systemctl disable apache2 2>/dev/null || true
sudo apt-get purge -y apache2 apache2-utils apache2-bin apache2.2-common 2>/dev/null || true

sudo systemctl stop nginx 2>/dev/null || true
sudo systemctl disable nginx 2>/dev/null || true
sudo apt-get purge -y nginx nginx-common nginx-full 2>/dev/null || true

# Limpa dependências órfãs
sudo apt-get autoremove -y
sudo apt-get autoclean

# 1. Parar containers e remover volumes
if command -v docker &> /dev/null; then
    sudo docker compose down -v --remove-orphans 2>/dev/null || true
    sudo docker system prune -af --volumes 2>/dev/null || true
fi

# 2. Remover arquivos e pastas
sudo rm -rf ./data
sudo rm -f .env
sudo rm -rf node_modules
sudo rm -rf apps/bridge-api/dist
sudo rm -rf apps/bridge-api/node_modules
sudo rm -f pnpm-lock.yaml

# 3. Limpar logs
sudo rm -f *.txt *.log

echo -e "✅ SISTEMA LIMPO! Agora você pode rodar: ${RED}./install.sh${NC}"
