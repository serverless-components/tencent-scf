FROM node:12.16

WORKDIR /usr/src/app
COPY ./src .
RUN npm install

EXPOSE 9000

CMD [ "node", "./index.js" ]
