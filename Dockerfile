FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (need devDeps for build)
RUN npm ci

# Copy source files
COPY src/ ./src/
COPY skills/ ./skills/
COPY drizzle/ ./drizzle/
COPY tsconfig.json ./
COPY drizzle.config.ts ./

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --omit=dev

# Set environment
ENV NODE_ENV=production

# Start the server
CMD ["node", "dist/index.js"]
