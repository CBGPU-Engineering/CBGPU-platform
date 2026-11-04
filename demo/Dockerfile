FROM node:22-bookworm-slim
WORKDIR /app
COPY FrontEnd/cbgpu/package*.json FrontEnd/cbgpu/
RUN cd FrontEnd/cbgpu && npm ci --no-audit --no-fund
COPY . .
RUN cd FrontEnd/cbgpu && npm run build:demo
RUN chown -R node:node FrontEnd/cbgpu/.next-demo
ENV CBGPU_DEMO=1
USER node
CMD ["node", "scripts/demo.mjs", "--built", "--container"]
