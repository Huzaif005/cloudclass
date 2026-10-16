# ============================================================================
# CLOUDCLASS - MULTI-STAGE HARDENED DOCKERFILE (AWS DEPLOYMENT)
# ============================================================================
# SOC-2 Compliant: Non-root execution, dumb-init PID 1 signal forwarding,
# automated container healthcheck, and minimal attack surface.
# ============================================================================

# --- STAGE 1: Dependency Builder ---
FROM node:20-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# --- STAGE 2: Production Runtime ---
FROM node:20-alpine AS runtime

# Install dumb-init for proper signal forwarding (SIGTERM / SIGINT)
RUN apk add --no-cache dumb-init

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=8000

# Copy node_modules from builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json ./

# Copy application source code
COPY . .

# Create uploads directory and set permissions to unprivileged user 'node'
RUN mkdir -p uploads logs && chown -R node:node /app

# Switch to non-root user
USER node

# Expose HTTP port
EXPOSE 8000

# Container Healthcheck (AWS ECS / ALB / App Runner)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8000/api/health/live || exit 1

# Start container with dumb-init
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
