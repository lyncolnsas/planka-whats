# Build stage
FROM node:20-alpine AS build
RUN apk add --no-cache git build-base python3 && corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --no-frozen-lockfile --ignore-scripts
RUN pnpm --filter @planka/shared-types build
RUN pnpm --filter bridge-api build
# DEBUG: Find where main.js was generated
RUN find /app -name "main.js"

# Final stage
FROM node:20-alpine AS runner
RUN apk add --no-cache git
WORKDIR /app

# Copy workspace configuration
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Copy shared types (needed for workspace dependency)
COPY --from=build /app/packages/shared-types ./packages/shared-types

# Copy bridge-api package.json to correct path for workspace resolution
COPY --from=build /app/apps/bridge-api/package.json ./apps/bridge-api/package.json

# Install production dependencies from root to resolve workspace links
RUN npm install -g pnpm && pnpm install --prod --filter bridge-api --ignore-scripts

# FAIL-SAFE: Copy build artifacts
COPY --from=build /app/apps/bridge-api /app/temp_source

# Create dist folder & move main.js (excluding node_modules matches)
# Create dist folder & move ALL build artifacts (main.js and siblings)
# We find the folder containing main.js and copy everything from it
RUN mkdir -p ./apps/bridge-api/dist && \
    MAIN_JS=$(find /app/temp_source -name "main.js" -not -path "*/node_modules/*" | head -n 1) && \
    DIR=$(dirname "$MAIN_JS") && \
    echo "Found build artifacts in $DIR, copying to dist..." && \
    cp -r "$DIR/"* ./apps/bridge-api/dist/

ENV NODE_ENV=production
EXPOSE 3000

# Set working directory to the app folder so it finds node_modules locally
WORKDIR /app/apps/bridge-api

# Verify availability before starting
CMD ["sh", "-c", "ls -l dist/main.js && node dist/main.js"]
