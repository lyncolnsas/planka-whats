# 🚀 Planka + WhatsApp Bridge (Raspberry Pi Edition)

Este projeto transforma seu Raspberry Pi em uma central de produtividade, integrando o **Planka Kanban** com comandos de **WhatsApp**.

## 🍎 Guia 1: Primeira Instalação (Do Zero)

Siga estes passos se você acabou de formatar o Raspberry Pi ou se ainda não baixou o projeto:

1. **Baixe o projeto:**

   ```bash
   git clone https://github.com/lyncolnsas/planka-whats.git
   ```

2. **Entre na pasta:**

   ```bash
   cd planka-whats
   ```

3. **Execute o instalador:**

   ```bash
   chmod +x install.sh && ./install.sh
   ```

---

## ☢️ Guia 2: Reset Total e Reinstalação

Siga estes passos se o sistema já estiver instalado mas você quer **apagar tudo** (inclusive Apache/Nginx) e começar do zero absoluto:

1. **Entre na pasta (se já estiver nela, pule para o passo 3):**

   ```bash
   cd ~/planka-whats
   ```

2. **Atualize os scripts de limpeza:**

   ```bash
   git pull origin main
   ```

3. **Execute a limpeza nuclear:**

   ```bash
   chmod +x reset_total.sh && ./reset_total.sh
   ```

4. **Após a limpeza, instale tudo novo:**

   ```bash
   ./install.sh
   ```

---

## 🛠️ O que cada script faz?

### 🌟 `install.sh`

- **Porta 80**: Desativa Apache/Nginx temporariamente para não dar erro.
- **Docker**: Instala o Docker e Docker Compose automaticamente.
- **IP DHCP**: Detecta seu IP e configura o acesso web sozinho.
- **Swap**: Cria 2GB de memória virtual para o Raspberry Pi não travar.

### ☢️ `reset_total.sh`

- **Purge**: Desinstala permanentemente Apache e Nginx para limpar o sistema.
- **Docker Wipe**: Apaga todos os containers, volumes e imagens.
- **Data Wipe**: Deleta o banco de dados, o arquivo `.env` e todas as configurações.

---

## 📱 Primeiros Passos Pós-Instalação

1. **Acesso Web**: Acesse `http://IP_DO_SEU_PI` (Sem porta, direto no IP).
2. **Login**:
   - 📧 `admin@example.com`
   - 🔑 `password`
3. **WhatsApp**: Escaneie o QR Code rodando:

   ```bash
   sudo docker logs -f planka-bridge
   ```

4. **Configuração Final**: Após criar seu Quadro no Planka, pegue os IDs na URL e coloque no seu arquivo `.env`, depois rode `./install.sh` novamente para aplicar.

---
*Mantido pelos Agentes de Sistemas (Arquiteto & Infra).*
