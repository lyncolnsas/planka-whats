# Stage 1: Server build
FROM node:22-alpine AS server

RUN apk -U upgrade \
  && apk add build-base python3 --no-cache

WORKDIR /app

COPY server .

RUN npm install npm --global \
  && npm install \
  && npm run build \
  && npm prune --production

# Stage 2: Client build
FROM node:22 AS client

WORKDIR /app

COPY client .

RUN npm install npm --global \
  && npm install --omit=dev \
  && DISABLE_ESLINT_PLUGIN=true npm run build

# Stage 3: Final image
# Final stage
FROM node:22-alpine

RUN apk -U upgrade \
  && apk add bash python3 py3-pip squid build-base python3-dev --no-cache \
  && npm install npm --global

WORKDIR /app

# Copy server files from server build stage
COPY --from=server /app .

# Fix line endings and permissions early (cached independently of client changes)
RUN sed -i 's/\r$//' ./start.sh && \
  chmod +x ./start.sh && \
  mkdir -p ./data && \
  chown -R node:node /app

# Copy client files from client build stage (invalidates cache on every UI change)
COPY --from=client /app/dist ./public
COPY --from=client /app/dist/index.html ./views

# Restore python setup
RUN python3 -m venv .venv \
  && .venv/bin/pip3 install --upgrade pip \
  && .venv/bin/pip3 install -r requirements.txt --no-cache-dir \
  && cp .env.sample .env \
  && chown -R node:node .venv .env

USER node
ENV NODE_ENV=production
EXPOSE 1337

HEALTHCHECK --interval=20s --timeout=5s --start-period=60s \
  CMD node healthcheck.js

CMD ["/bin/bash", "./start.sh"]
