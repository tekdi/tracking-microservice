
FROM node:20 as dependencies
WORKDIR /app
COPY . ./
RUN npm cache clean --force
RUN npm i typeorm
RUN npm i cache-manager
RUN npm i --legacy-peer-deps

# Install required system dependencies for Puppeteer
RUN apt-get update && apt-get install -y     libnss3     libatk1.0-0     libatk-bridge2.0-0     libcups2     libdrm2     libxkbcommon-x11-0     libgbm1     libasound2     libxshmfence1     fonts-liberation     gconf-service     libappindicator3-1     libnspr4     libx11-xcb1     xdg-utils     --no-install-recommends

EXPOSE 3000
CMD ["npm", "start"]
