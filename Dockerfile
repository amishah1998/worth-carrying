FROM node:22-slim
WORKDIR /app
COPY package.json ./
COPY bin ./bin
COPY src ./src
COPY public ./public
ENV NODE_ENV=production PORT=8080 RECORDER_DB=/data/observations.sqlite
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 8080
CMD ["node", "bin/worth-carrying.js"]
