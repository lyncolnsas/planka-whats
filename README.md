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

## ☢️ Guia 2: Reset Total e Reinstalação (Automático)

Use este comando se você estiver tendo erros no Git (`Your local changes would be overwritten`), se a porta 80 estiver ocupada, ou se quiser apenas **zerar e reinstalar tudo** de uma vez só:

```bash
chmod +x reinstall.sh && ./reinstall.sh
```

### O que o `reinstall.sh` faz por você

1. **Sincronia Forçada**: Resolve erros de Git e baixa a versão mais nova do GitHub.
2. **Reset Nuclear**: Desinstala Apache/Nginx e apaga todos os dados antigos.
3. **Instalação Pura**: Reinstala o Planka e a Bridge do zero absoluto.

## 🆘 Guia 3: Limpeza de Emergência (Se o Git travar)

Se você estiver recebendo erros de "Your local changes would be overwritten" ou o `git pull` não funcionar, siga estes passos para forçar a limpeza:

1. **Baixe apenas o arquivo de limpeza:**

   ```bash
   wget https://raw.githubusercontent.com/lyncolnsas/planka-whats/main/reset_total.sh
   ```

2. **Execute a limpeza (Isso apaga tudo e libera a porta 80):**

   ```bash
   chmod +x reset_total.sh && ./reset_total.sh --yes
   ```

3. **Apague a pasta antiga e instale do zero:**

   ```bash
   cd .. && sudo rm -rf planka-whats
   git clone https://github.com/lyncolnsas/planka-whats.git
   cd planka-whats && ./install.sh
   ```

---

## 🛠️ O que cada script faz?

### 🌟 `install.sh`

- **Porta 80**: Desativa Apache/Nginx temporariamente para não dar erro.
- **Docker**: Instala o Docker e Docker Compose automaticamente.
- **IP DHCP**: Detecta seu IP e configura o acesso web sozinho.
- **Swap**: Cria 2GB de memória virtual para o Raspberry Pi não travar.
- **Build Local**: Constrói o Planka a partir do código-fonte local (incluindo suas modificações).

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
