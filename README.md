# 🚀 Planka + WhatsApp Bridge (Monorepo)

Este projeto integra o gerenciador de tarefas **Planka (Kanban)** com o **WhatsApp**, permitindo criar e gerenciar cards através de comandos de chat. Estruturado como um monorepo utilizando **Turborepo** e **Docker**, otimizado para rodar em **Raspberry Pi** ou VPS.

---

## 🏗️ Arquitetura do Projeto

- **`apps/planka`**: Instância customizada do Planka Kanban.
- **`apps/bridge-api`**: Backend em **NestJS** que processa mensagens do WhatsApp.
- **`packages/shared-types`**: Tipagem compartilhada para consistência total.
- **`docker-compose.yml`**: Orquestrador de serviços (Postgres, Planka, Bridge, Backup).

---

## 🍎 Guia de Instalação: Do Zero ao Funcionamento

Siga este passo a passo para instalar e configurar todo o ecossistema.

### 1. Instalação do Docker (O Motor)

Se você estiver usando **Raspberry Pi OS (Bookworm)** ou similar:

```bash
# Remova listas antigas e configure o repositório correto
sudo rm -f /etc/apt/sources.list.d/docker.list

sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/raspbian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=armhf signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/raspbian bookworm stable" | sudo tee /etc/apt/sources.list.d/docker.list

# Instale o pacote completo
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Permita o uso sem sudo
sudo usermod -aG docker $USER
```

*Reinicie seu terminal ou dê logout/login após o comando `usermod`.*

### 2. Clonagem e Preparação

```bash
git clone https://github.com/lyncolnsas/planka-whats.git
cd planka-whats

# Prepare as pastas e memória (essencial para Raspberry Pi)
chmod +x setup.sh
./setup.sh
```

### 3. Configuração Automática (.env)

O script `setup.sh` já configura automaticamente para você:

- **BASE_URL**: Detecta o IP local do seu Raspberry Pi.
- **PLANKA_SECRET_KEY**: Gera uma chave aleatória e segura.
- **Credenciais**: Pré-configura o acesso padrão (`admin@example.com` / `password`).

Se você precisar alterar algo manualmente ou adicionar novos números à Whitelist:

```bash
nano .env
```

> 💡 **Nota Importante:** No seu primeiro acesso ao Planka no navegador, crie o usuário exatamente com os dados acima para que o robô consiga conectar.

### 4. Inicialização do Sistema

Suba todos os containers (a primeira vez pode demorar, pois o Planka será compilado):

```bash
docker compose up --build -d
```

### 5. Conexão com o WhatsApp

Para conectar o seu celular ao robô:

1. Acesse os logs da Bridge:

   ```bash
   docker logs -f planka-bridge
   ```

2. Escaneie o **QR Code** que aparecerá no terminal usando o WhatsApp no seu celular (Aparelhos Conectados).

---

## 📱 Como Usar (Comandos)

Uma vez conectado, envie mensagens para o número do robô a partir de um número autorizado:

- `!add Comprar suprimentos` - Cria um card no Kanban.
- `#ajuda` - Lista os comandos disponíveis.

---

## 🏁 Configuração Final (IDs do Planka)

Para que o robô saiba exatamente em qual coluna soltar as tarefas:

1. Acesse o Planka no seu navegador (`http://IP:3001`).
2. Crie seu Board e sua Lista.
3. Copie o ID do Board e da Lista da URL do navegador.
4. Atualize o `.env` com `BOARD_ID` e `LIST_ID`.
5. Reinicie os containers: `docker compose up -d`.

---

## 🍓 Documentação Adicional

- [Guia Específico de Performance para Raspberry Pi](./README_RASPBERRY.md)
- [Passo a Passo Detalhado de Configuração](./PASSO_A_PASSO.md)

---
*Mantido pelo Agente #1: O Arquiteto de Sistemas.*
