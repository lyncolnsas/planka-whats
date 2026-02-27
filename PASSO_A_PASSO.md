# 🍎 Passo a Passo Completo: Do Zero à Instalação (Docker, Planka e WhatsApp)

Este guia cobre tudo o que você precisa para rodar o projeto, desde a instalação do Docker até a configuração de usuários e conexão com o WhatsApp.

---

## 1. Instalação do Docker (O Motor)

Se você estiver usando **Raspberry Pi OS (Bookworm)** ou similar, use estes comandos que garantem a instalação correta:

```bash
# Remova arquivos de lista antigos que possam causar erro
sudo rm -f /etc/apt/sources.list.d/docker.list

# Adicione a chave oficial do Docker (se necessário)
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/raspbian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Configure o repositório forçando a versão "bookworm"
echo "deb [arch=armhf signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/raspbian bookworm stable" | sudo tee /etc/apt/sources.list.d/docker.list

# Atualize e instale o Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Permita que seu usuário use o Docker sem sudo
sudo usermod -aG docker $USER
```

*Importante: Deslogue e logue novamente (ou reinicie) para esta mudança surtir efeito.*

1. **Verifique se está funcionando:**

```bash
docker --version
docker compose version
```

---

## 2. Preparação do Projeto

1. **Clone o repositório:**

```bash
git clone https://github.com/lyncolnsas/planka-whats.git
cd planka-whats
```

1. **Prepare o ambiente (Raspberry Pi):**

    ```bash
    chmod +x setup.sh
    ./setup.sh
    ```

    *Este comando cria as pastas de dados e configura o arquivo de Swap para o build não travar.*

---

### Configurações Automáticas via `setup.sh`

O script de setup agora é inteligente e já faz o seguinte por você:

1. **Detecta seu IP:** Configura o `BASE_URL` automaticamente para o ambiente DHCP.
2. **Gera Chave Secreta:** Cria uma `PLANKA_SECRET_KEY` única.
3. **Configura Acessos:** Define o usuário e senha padrão (`admin@example.com` / `password`).

Se você precisar ajustar manualmente:

```bash
nano .env
```

#### O que você ainda deve conferir

- **Whitelist de WhatsApp:** Adicione seu número em `USER_WHITELIST_MAPPING`.
- **IDs do Kanban:** Após o primeiro acesso, você deve colocar o `BOARD_ID` e `LIST_ID`.

---

## 4. Subindo o Sistema

Rode o comando para construir e iniciar todos os serviços:

```bash
docker compose up --build -d
```

### O que acontece agora?

- O Docker vai baixar o Postgres.
- Vai compilar o Planka (pode demorar no Pi).
- Vai compilar a Bridge API.
- Tudo estará pronto quando você ver todos os containers com status `running`.

---

## 5. Conectando o WhatsApp

1. **Acesse os logs da Bridge:**

    ```bash
    docker logs -f planka-bridge
    ```

2. **Escaneie o QR Code:** Um código QR aparecerá no terminal. Abra seu WhatsApp -> Dispositivos Conectados -> Conectar Aparelho e escaneie.
3. **Teste o comando:** Envie uma mensagem para o número do robô (usando um número que esteja na Whitelist):

    ```bash
    !add Comprar café para o escritório
    ```

---

## 6. Primeiros Passos no Planka (Interface Web)

1. Acesse `http://IP_DO_SEU_PI:3001` no seu navegador.
2. Crie sua primeira conta de Administrador.
3. Crie um **Board (Quadro)** e uma **Lista (Coluna)**.
4. Pegue o `ID` do Board e da Lista na URL do navegador e atualize seu `.env` para que o robô saiba onde salvar as tarefas:
    - `BOARD_ID`: O ID que aparece na URL do quadro.
    - `LIST_ID`: O ID que aparece na URL da lista selecionada.

---
*Dica: Para atualizar o .env após mudar os IDs, rode `docker compose up -d` novamente.*
