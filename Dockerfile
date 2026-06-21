FROM node:22

RUN apt-get update && apt-get install -y \
  libgtk-3-0 libnss3 libxss1 libasound2t64 \
  libgbm1 xdg-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

RUN npx electron install.js || true

COPY . .
RUN npm run build

ENV TILEBOARD_TILES_DIR=/data/tiles
ENV TILEBOARD_HEADLESS=true

VOLUME /data/tiles
EXPOSE 3456

CMD ["npx", "electron", "dist/electron/main.js"]
