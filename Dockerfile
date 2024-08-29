FROM node:20 as dependencies
WORKDIR /app
COPY . ./
RUN npm cache clean --force
RUN npm i typeorm
RUN npm i cache-manager
RUN npm i --legacy-peer-deps
RUN apt-get update 
EXPOSE 3000
CMD ["npm", "start"]
