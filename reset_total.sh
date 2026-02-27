#!/bin/bash

# Verificação de ROOT (Prevenção de erro de permissão)
if [[ $EUID -ne 0 ]]; then
   echo -e "\033[0;31m❌ Este script PRECISA ser rodado como ROOT (use sudo).\033[0m"
   echo "Exemplo: sudo ./reset_total.sh"
   exit 1
fi

# ==============================================================================
# SCRIPT DE REINICIALIZAÇÃO TOTAL (FACTORY RESET)
# Objetivo: Limpar TUDO e deixar o sistema pronto para uma nova instalação.
# Agentes: #2 Engenheiro de Infra & #9 DevOps Fixer
# ==============================================================================

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Suporte a modo não-interativo
CONFIRM=$1

if [[ $CONFIRM != "--yes" ]]; then
    echo -e "${RED}⚠️  ALERTA: Isso irá apagar TODOS os dados do Planka, Banco de Dados e WhatsApp!${NC}"
    read -p "Tem certeza que deseja continuar? (s/N): " confirm
    if [[ $confirm != [sS] ]]; then
        echo "Operação cancelada."
        exit 1
    fi
fi

echo "🧹 Iniciando limpeza nuclear..."

# 3. DESINSTALAR BLOQUEADORES (Apache/Nginx que roubam a porta 80)
echo "🔓 Removendo permanentemente Apache e Nginx para liberar o sistema..."
systemctl stop apache2 2>/dev/null || true
systemctl disable apache2 2>/dev/null || true
apt-get purge -y apache2 apache2-utils apache2-bin apache2.2-common 2>/dev/null || true

systemctl stop nginx 2>/dev/null || true
systemctl disable nginx 2>/dev/null || true
apt-get purge -y nginx nginx-common nginx-full 2>/dev/null || true

# Mata qualquer processo residual na porta 80
PID_PORT_80=$(lsof -t -i:80 || netstat -tunlp | grep :80 | awk '{print $7}' | cut -d'/' -f1 || true)
if [ ! -z "$PID_PORT_80" ]; then
    echo "⚠️  Matando processo residual $PID_PORT_80 na porta 80..."
    kill -9 $PID_PORT_80 || true
fi

# Limpa dependências órfãs
apt-get autoremove -y
apt-get autoclean

# 1. Parar containers e remover volumes
if command -v docker &> /dev/null; then
    docker compose down -v --remove-orphans 2>/dev/null || true
    docker system prune -af --volumes 2>/dev/null || true
fi

# 2. Remover arquivos e pastas
rm -rf ./data
rm -f .env
rm -rf node_modules
rm -rf apps/bridge-api/dist
rm -rf apps/bridge-api/node_modules
rm -f pnpm-lock.yaml

# 3. Limpar logs
rm -f *.txt *.log

echo -e "✅ SISTEMA LIMPO! Agora você pode rodar: ${RED}sudo ./install.sh${NC}"
