FROM node:alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV
COPY package.json /usr/src/app/
RUN npm install && npm cache clean --force
COPY . /usr/src/app

HEALTHCHECK --interval=5m --timeout=3s \
  CMD curl -f http://localhost:8000/healthz || exit 1

CMD [ "npm", "start" ]
