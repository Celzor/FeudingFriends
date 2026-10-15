FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN --mount=type=secret,id=build_ca,target=/tmp/build-ca.pem \
    if [ -s /tmp/build-ca.pem ]; then NODE_EXTRA_CA_CERTS=/tmp/build-ca.pem npm ci; else npm ci; fi
COPY types ./types
COPY shared ./shared
COPY scripts ./scripts
COPY client ./client
COPY server ./server
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3010
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server/package.json ./server/package.json
COPY --from=build --chown=node:node /app/server/dist ./server/dist
COPY --from=build --chown=node:node /app/server/data ./server/data
COPY --from=build --chown=node:node /app/client/dist ./client/dist
USER node
EXPOSE 3010
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/dist/server/src/server.js"]
