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

Se você ainda não tem o Docker instalado no seu **Raspberry Pi** ou **Linux**:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
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

### 3. Configuração de Variáveis (.env)

Crie o seu arquivo de configuração baseado no exemplo:

```bash
cp .env.example .env
nano .env
```

**Campos obrigatórios para editar:**

- `DB_PASSWORD`: Senha do Banco de Dados.
- `PLANKA_SECRET_KEY`: Uma chave aleatória longa.
- `BASE_URL`: O IP do seu servidor (ex: `http://192.168.1.100:3001`).
- `USER_EMAIL`: E-mail de acesso (Padrão: `admin@example.com`).
- `USER_PASSWORD`: Senha de acesso (Padrão: `password`).
- `USER_WHITELIST_MAPPING`: Seu número de WhatsApp (ex: `5511999999999:id_do_usuario`).

> 💡 **Usuário e Senha Padrão:** No seu primeiro acesso à interface web do Planka, você precisará criar um usuário. As credenciais sugeridas para o robô (`.env`) são:
>
> - **Usuário:** `admin@example.com`
> - **Senha:** `password`
>
> Certifique-se de que o usuário criado no Planka coincida com o que você colocar no `.env`.

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
