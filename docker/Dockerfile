# Multi-stage Dockerfile for MCP Browser Control Server
# Production-ready with security and optimization

# Builder stage
FROM node:18-bullseye AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    python3-pip \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production --no-audit

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Runtime stage
FROM node:18-bullseye-slim AS runtime

# Install Chrome and dependencies for browser automation
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    apt-transport-https \
    && rm -rf /var/lib/apt/lists/*

# Add Chrome repository
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
RUN echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list

# Install Chrome and required libraries
RUN apt-get update && apt-get install -y \
    google-chrome-stable \
    libnss3 \
    libgconf-2-4 \
    libxi6 \
    libxcomposite1 \
    libxss1 \
    libxtst6 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0 \
    xvfb \
    pulseaudio \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r mcpuser && useradd -r -g mcpuser -G audio mcpuser

# Create application directory with proper permissions
WORKDIR /app
RUN chown -R mcpuser:mcpuser /app

# Switch to non-root user
USER mcpuser

# Copy built application from builder stage
COPY --from=builder --chown=mcpuser:mcpuser /app/dist ./dist
COPY --from=builder --chown=mcpuser:mcpuser /app/node_modules ./node_modules
COPY --from=builder --chown=mcpuser:mcpuser /app/package*.json ./

# Create logs directory
RUN mkdir -p logs

# Set environment variables for production
ENV NODE_ENV=production
ENV BROWSER_TYPE=chrome
ENV HEADLESS=true
ENV MAX_CONCURRENT_SESSIONS=10
ENV SESSION_TIMEOUT=600000
ENV LOG_LEVEL=info

# Chrome flags for container environment
ENV CHROME_FLAGS="--no-sandbox --disable-dev-shm-usage --disable-gpu --remote-debugging-port=9222"

# Audio configuration
ENV PULSE_RUNTIME_PATH=/tmp/pulse-runtime
ENV PULSE_STATE_PATH=/tmp/pulse-state

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/health/live').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Expose port
EXPOSE 3000

# Create startup script
COPY docker/startup.sh ./startup.sh
USER root
RUN chmod +x startup.sh
USER mcpuser

# Signal handling for graceful shutdown
STOPSIGNAL SIGTERM

# Start the application
CMD ["./startup.sh"]