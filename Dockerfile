FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build \
  && mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
VOLUME ["/app/data"]
CMD ["npm", "start"]
