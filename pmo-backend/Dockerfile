# Multi-stage build for the NestJS + MikroORM API
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
COPY docker-entrypoint.sh ./
COPY migrate.js ./
COPY seed.js ./
# Operational one-off scripts (data backfills and checks) run with `docker compose exec`.
# They are plain CommonJS and use pg directly, so they need no build step.
COPY  COPY scripts/reclassify-link-documents.js ./scripts/
COPY schema ./schema
COPY --from=build /app/public ./public
RUN chmod +x docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main"]
