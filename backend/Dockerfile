FROM node:18.19-alpine

WORKDIR /app

# Copy manifests first so dependency layers cache across source changes.
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

RUN mkdir -p uploads/products uploads/avatars uploads/banners

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "src/server.js"]
