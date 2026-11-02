FROM node:24-alpine AS sdk
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile --filter @aviation/ai-explainer...
RUN pnpm --filter @aviation/ai-explainer... run build
RUN pnpm --config.node-linker=hoisted --filter @aviation/ai-explainer deploy --legacy --prod /runtime/explanation

FROM node:24-alpine
WORKDIR /app
COPY --from=sdk /runtime/explanation /opt/aviation/explanation
COPY apps/preflight-check/public /app/public
COPY --from=sdk /workspace/packages/shared-sdk/dist-esm/aviation/weight-balance.js /app/public/aviation-sdk/weight-balance.js
COPY --from=sdk /workspace/packages/shared-sdk/dist-esm/aviation/aircraft.js /app/public/aviation-sdk/aircraft.js
USER node
EXPOSE 8080
CMD ["node", "/opt/aviation/explanation/dist/run.js", "--app", "preflight-check", "--host", "0.0.0.0", "--port", "8080", "--static-root", "/app/public"]
