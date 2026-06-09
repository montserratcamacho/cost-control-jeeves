# Stage 1: Build everything
FROM node:20 AS builder
WORKDIR /app

# Copy the entire repository
COPY . .

# Build frontend
WORKDIR /app/Jeeves-expenses/frontend
RUN npm install
RUN npm run build

# Build backend (install dependencies)
WORKDIR /app/Jeeves-expenses/backend
# Install build tools for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install --production
RUN npm rebuild better-sqlite3

# Stage 2: Final image
FROM node:20
WORKDIR /app/backend

# Install runtime dependencies for better-sqlite3 if needed (usually node image has them)
# Copy backend files from builder
COPY --from=builder /app/Jeeves-expenses/backend ./
# Copy built frontend from builder
COPY --from=builder /app/Jeeves-expenses/frontend/dist ../frontend/dist

# Ensure uploads directory exists
RUN mkdir -p uploads/receipts

# Cloud Run configuration
ENV PORT=8080
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]
