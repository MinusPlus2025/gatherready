# Single-instance Node service. Attach a persistent volume at /data and set
# GATHERREADY_DB=/data/gatherready.db. Secrets must be injected as environment
# variables (never copied into the image).
FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production \
    PORT=5180 \
    GATHERREADY_DB=/data/gatherready.db
EXPOSE 5180
CMD ["npm", "start"]
