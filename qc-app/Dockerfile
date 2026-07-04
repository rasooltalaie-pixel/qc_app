# تصویر Docker برای سامانه طرح کنترل محصول
FROM node:22-alpine

WORKDIR /app

COPY server/package.json ./server/
RUN cd server && npm install --omit=dev --no-audit --no-fund

COPY server ./server
COPY public ./public

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
VOLUME ["/app/data"]

EXPOSE 4000

CMD ["node", "server/server.js"]
