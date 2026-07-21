FROM node:20-alpine

WORKDIR /app

# better-sqlite3 needs to compile a native addon on install
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 4000
CMD ["npm", "start"]
