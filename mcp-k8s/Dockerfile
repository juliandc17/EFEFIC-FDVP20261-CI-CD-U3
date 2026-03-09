FROM node:18-alpine
RUN apk add --no-cache curl && \
    curl -LO "https://dl.k8s.io/release/$(curl -Ls https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    chmod +x kubectl && mv kubectl /usr/local/bin/
WORKDIR /app
COPY package.json server.js ./
EXPOSE 3100
ENV HTTP_MODE=true PORT=3100
CMD ["node", "server.js"]
