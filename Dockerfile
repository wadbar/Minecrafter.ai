FROM node:20-alpine AS builder
# Enable Corepack for pnpm/yarn or use npm
WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
# Run Vite build and esbuild for server compilation
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Add standard security layers
RUN apk add --no-cache dumb-init

# Copy compiled backend and frontend statics
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
# Only install production dependencies
RUN npm ci --omit=dev

# Expose production port
EXPOSE 3000

# Use dumb-init for proper signal handling
USER node
CMD ["dumb-init", "node", "dist/server.cjs"]
