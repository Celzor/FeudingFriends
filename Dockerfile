# express server, import ../client/ and do a build in a node18 conteiner first
# then copy the build folder to the server container

## ----------------------------------------------
# client build environment
FROM node:18 AS build

COPY ./types /types

WORKDIR /app

COPY ./client/package.json ./
RUN yarn install

COPY ./client ./
RUN yarn build

## ----------------------------------------------
# production server environment
FROM node:18

# copy type definitions to shared location
COPY ./types /types

# set server working dir
WORKDIR /app

# isntall server packages
COPY ./server/package.json ./
RUN yarn install

COPY ./server/ ./

# copy client dist to server
COPY --from=build /app/dist /app/dist

ENV NODE_ENV=production

CMD ["yarn", "start:prod"]
