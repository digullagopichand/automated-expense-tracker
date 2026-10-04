# Multi-stage production Dockerfile for Expense Tracker Backend Service
FROM node:20-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Install curl/wget for health check probes
RUN apk add --no-cache wget

# Create application user and runtime directories
RUN mkdir -p /app/data /app/uploads && chown -R node:node /app

# Copy production dependencies and application source
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node . .

# Run as non-privileged non-root user
USER node

# Expose HTTP port
EXPOSE 5000

# Volume mount points for persistent database and receipt uploads
VOLUME ["/app/data", "/app/uploads"]

# Healthcheck probe for container orchestration
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

CMD ["node", "src/server.js"]
