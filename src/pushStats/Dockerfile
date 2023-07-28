# syntax=docker/dockerfile:1

FROM node:16.17.0
WORKDIR "/app"
ENV NODE_ENV=production

COPY ./src/pushStats .

COPY ./users.json ./users.json
RUN npm install

CMD ["node", "index.js"]