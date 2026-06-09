# Stage 1: Build the frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY Jeeves-expenses/frontend/package*.json ./
RUN npm install
COPY Jeeves-expenses/frontend/ ./
RUN npm run build

# Stage 2: Setup the backend
FROM node:20-slim
WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY Jeeves-expenses/backend/package*.json ./
RUN npm install --production

COPY Jeeves-expenses/backend/ ./
RUN mkdir -p uploads/receipts
# Copy built frontend from stage 1
COPY --from=frontend-builder /app/frontend/dist ../frontend/dist

# Expose the port (Cloud Run uses PORT env var)
ENV PORT=3001
EXPOSE 3001

# Start the application
CMD ["node", "server.js"]
