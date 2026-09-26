# Debian rather than Alpine: onnxruntime-node (DINOv3 image search) ships
# glibc binaries only.
FROM node:18.19-bookworm-slim

WORKDIR /app

# The CPU inference binaries are bundled in the npm package; skip the optional
# CUDA download so the build also works against an offline registry mirror.
ENV ONNXRUNTIME_NODE_INSTALL=skip

# Copy manifests first so dependency layers cache across source changes.
COPY package*.json .npmrc ./
RUN npm ci --omit=dev || npm install --omit=dev

# FAISS index for image search, installed on its own because it may fail: it
# downloads a prebuilt binary at install time. Without it the API falls back
# to a JavaScript scan (see src/services/vectorIndex.js).
RUN npm run faiss:install || echo "faiss-node not installed: image search will use the JavaScript scan"

# Includes ml/ - the DINOv3 model is baked into the image, so the container
# needs no network access at runtime.
COPY . .

RUN mkdir -p uploads/products uploads/avatars uploads/banners

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "src/server.js"]
