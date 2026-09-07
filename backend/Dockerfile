FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY . .
RUN mkdir -p public/uploads data

# Expose server port
EXPOSE 5053

# Set production environment
ENV NODE_ENV=production
ENV PORT=5053

# Start server
CMD ["node", "server.js"]
