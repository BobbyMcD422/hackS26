FROM node:22-bookworm-slim

WORKDIR /app

COPY frontend/icalweb/package*.json ./

RUN npm ci

COPY frontend/icalweb ./

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
