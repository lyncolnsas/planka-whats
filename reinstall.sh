#!/bin/bash

# ==============================================================================
# SCRIPT DE REINSTALAÇÃO TOTAL (ONE-CLICK REINSTALL)
# Objetivo: Atualizar código, resetar o sistema e instalar tudo de novo.
# Totalmente autônomo e sem perguntas.
# ==============================================================================

GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}🔄 Iniciando Sincronização e Reinstalação Nuclear...${NC}"

# 1. FORÇAR ATUALIZAÇÃO DO CÓDIGO (Resolve conflitos de git pull automaticamente)
echo "📥 Buscando atualizações do GitHub e limpando sobras locais..."
# Garante que estamos na pasta correta
cd "$(dirname "$0")"
git fetch origin main
git reset --hard origin/main

# 2. DAR PERMISSÃO AOS SCRIPTS (Garantia)
chmod +x install.sh
chmod +x reset_total.sh

# 3. EXECUTAR LIMPEZA TOTAL (Sem perguntas)
echo "🧹 Executando Limpeza Nuclear (Purge Apache/Nginx/Docker/Data)..."
./reset_total.sh --yes

# 4. EXECUTAR INSTALAÇÃO MESTRE
echo "🚀 Iniciando Nova Instalação Autônoma..."
./install.sh

echo -e "${GREEN}✨ PROCESSO CONCLUÍDO COM SUCESSO!${NC}"
