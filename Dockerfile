FROM node:20-alpine

RUN apk add --no-cache dumb-init
RUN addgroup -S vendoros && adduser -S vendoros -G vendoros

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src/ ./src/
COPY sql/ ./sql/

RUN mkdir -p uploads && chown -R vendoros:vendoros /app

USER vendoros

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
