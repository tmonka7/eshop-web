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

# Includes ml/ - the DINOv3 model is baked into the image, so the container
# needs no network access at runtime.
COPY . .

RUN mkdir -p uploads/products uploads/avatars uploads/banners

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "src/server.js"]
