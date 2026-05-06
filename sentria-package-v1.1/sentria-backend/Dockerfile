FROM node:20-slim

RUN apt-get update && apt-get install -y \
    libreoffice \
    fonts-montserrat \
    fonts-recommended \
    libfontconfig1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p /tmp

EXPOSE 3000
CMD ["node", "server/index.js"]
