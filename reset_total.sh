#!/bin/bash

# ==============================================================================
# SCRIPT DE LIMPEZA TOTAL (NUCLEAR RESET)
# Objetivo: Deixar o Raspberry Pi limpo, como se o projeto nunca tivesse existido.
# Agentes: #2 Engenheiro de Infra & #9 DevOps Fixer
# ==============================================================================

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}⚠️  ALERTA: Isso irá apagar TODOS os dados do Planka, Banco de Dados e WhatsApp!${NC}"
read -p "Tem certeza que deseja continuar? (s/N): " confirm

if [[ $confirm != [sS] ]]; then
    echo "Operação cancelada."
    exit 1
fi

echo -e "${YELLOW}🧹 Iniciando limpeza profunda...${NC}"

# 1. PARAR E REMOVER TODOS OS CONTAINERS E VOLUMES DO PROJETO
if command -v docker &> /dev/null; then
    echo "🛑 Parando containers e removendo volumes..."
    sudo docker compose down -v --remove-orphans 2>/dev/null || true
    
    # Limpeza agressiva de imagens e volumes órfãos
    echo "♻️  Limpando cache do Docker..."
    sudo docker system prune -af --volumes
fi

# 2. REMOVER PASTAS DE DADOS E CONFIGURAÇÕES
echo "🗑️  Removendo pastas de dados e arquivos de ambiente..."
sudo rm -rf ./data
sudo rm -f .env
sudo rm -rf node_modules
sudo rm -f pnpm-lock.yaml

# 3. LIBERAR PORTAS (Apache/Nginx que podem conflitar na porta 80)
echo "🔓 Liberando porta 80 (Apache/Nginx)..."
sudo systemctl stop apache2 2>/dev/null || true
sudo systemctl disable apache2 2>/dev/null || true
sudo systemctl stop nginx 2>/dev/null || true
sudo systemctl disable nginx 2>/dev/null || true

# 4. REMOVER SWAP (Opcional - mantém o sistema 'virgem', mas o Raspbian original não tem 2GB de swap)
# Se quiser remover o swap criado pelo install.sh, descomente as linhas abaixo:
# sudo swapoff /swapfile 2>/dev/null || true
# sudo rm -f /swapfile
# sudo sed -i '/\/swapfile/d' /etc/fstab

# 5. LIMPAR LOGS
sudo rm -f *.log
sudo rm -f build_output.txt error_logs.txt logs.txt

echo -e "${GREEN}✅ SISTEMA ZERADO COM SUCESSO!${NC}"
echo "O diretório agora está limpo. Você pode rodar o ./install.sh para uma nova instalação pura."
