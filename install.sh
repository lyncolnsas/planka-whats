#!/bin/bash

# ==============================================================================
# SCRIPT DE INSTALAÇÃO AUTÔNOMO: PLANKA + WHATSAPP BRIDGE
# Foco: Raspberry Pi (DHCP) - Imagem Oficial
# Agentes: #2 Engenheiro de Infra & #9 DevOps Fixer
# ==============================================================================

set -e

# Cores para logs
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Iniciando Instalação Totalmente Autônoma (Nuclear Mode)...${NC}"

# 1. LIMPEZA TOTAL (Nuclear)
echo "🧹 Removendo rastros de instalações anteriores (Containers, Volumes e Rede)..."
if command -v docker &> /dev/null; then
    sudo docker compose down -v --remove-orphans 2>/dev/null || true
    # Limpa possíveis volumes órfãos com a tag do projeto
    sudo docker volume prune -f --filter "label=com.docker.compose.project=planka-whats" 2>/dev/null || true
fi

# Opcional: Se quiser limpar os arquivos de dados locais também, descomente a linha abaixo:
 sudo rm -rf ./data/*

# 2. INSTALAÇÃO DE DEPENDÊNCIAS DO SISTEMA
echo "📦 Atualizando sistema e instalando dependências base..."
sudo apt-get update
sudo apt-get install -y curl git build-essential ca-certificates jq

# 3. CONFIGURAÇÃO DE SWAP (Vital para o build da Bridge no Pi)
if [ ! -f /swapfile ]; then
    echo "⚡ Criando arquivo de Swap de 2GB para evitar travamentos no build..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# 4. INSTALAÇÃO DO DOCKER (Otimizado para Bookworm/RPi)
if ! command -v docker &> /dev/null; then
    echo "🐳 Instalando Docker Engine..."
    sudo rm -f /etc/apt/sources.list.d/docker.list
    sudo install -m 0755 -d /etc/apt/keyrings
    sudo curl -fsSL https://download.docker.com/linux/raspbian/gpg -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc

    echo "deb [arch=armhf signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/raspbian bookworm stable" | \
        sudo tee /etc/apt/sources.list.d/docker.list

    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker $USER
    echo "✅ Docker pronto."
fi

# 5. ESTRUTURA DE DADOS E PERMISSÕES
echo "📁 Organizando diretórios de dados..."
mkdir -p ./data/postgres ./data/planka ./data/whatsapp-session ./data/backups
touch ./data/whatsapp-contacts.json
sudo chown -R $USER:$USER ./data

# 6. CONFIGURAÇÃO AUTOMÁTICA (.env)
echo "⚙️  Gerando configurações autônomas de produção..."

# Detecta IP DHCP automaticamente (pega o primeiro IP válido da interface de rede)
LOCAL_IP=$(hostname -I | awk '{print $1}')
if [ -z "$LOCAL_IP" ]; then 
    LOCAL_IP="localhost"
fi

# Geração de Segredos Fortes
# Planka recomenda uma chave de 64 caracteres ou base64
RANDOM_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
# Senha do Banco de Dados (Alfanumérica forte)
RANDOM_DB_PASS=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 24 | head -n 1)

# Criação do arquivo .env TOTALMENTE AUTO-CONFIGURADO
cat <<EOT > .env
# ==============================================================================
# CONFIGURAÇÃO AUTÔNOMA - GERADA EM: $(date)
# ==============================================================================

# [BANCO DE DADOS]
DB_USER=postgres
DB_PASSWORD=${RANDOM_DB_PASS}
DB_NAME=planka

# [PLANKA CORE]
# Porta 3001 no host mapeada para 1337 interna
BASE_URL=http://${LOCAL_IP}:3001
PLANKA_SECRET_KEY=${RANDOM_SECRET}

# [BRIDGE WHATSAPP]
# Conexão interna entre containers Docker
PLANKA_URL=http://planka:1337
USER_EMAIL=admin@example.com
USER_PASSWORD=password

# [IDs DO KANBAN]
# Estes IDs devem ser preenchidos após o primeiro acesso ao Planka Web
# Acesse o Board e a Lista no navegador e copie os IDs da URL
BOARD_ID=
LIST_ID=

# [SEGURANÇA WHATSAPP]
# Formato: 5511999999999:ID_DO_USUARIO_PLANKA
# Se deixar vazio, o bot aceitará comandos de qualquer usuário (Não recomendado)
USER_WHITELIST_MAPPING=
EOT

echo -e "✅ Segredos gerados e IP detectado: ${GREEN}${LOCAL_IP}${NC}"

# 7. INICIALIZAÇÃO DO SISTEMA
echo "🏗️  Construindo e subindo serviços... Isso pode levar alguns minutos (Build da Bridge)."
# Forçamos o uso do .env e o build limpo
sudo docker compose --env-file .env up --build -d

# 8. VERIFICAÇÃO FINAL
echo ""
echo -e "${GREEN}==================================================================${NC}"
echo -e "${GREEN}✅ TUDO PRONTO! O SISTEMA ESTÁ SUBINDO EM BACKGROUND.${NC}"
echo ""
echo -e "🔗 Planka Web:   http://${LOCAL_IP}:3001"
echo -e "📧 Usuário:      admin@example.com"
echo -e "🔑 Senha:        password"
echo ""
echo -e "📲 Para ver o QR Code do WhatsApp, digite:"
echo -e "   ${GREEN}sudo docker logs -f planka-bridge${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo "Nota: O Planka pode levar ~1-2 min para estabilizar o banco no primeiro boot."
