# Build stage
FROM node:18-alpine as build-stage

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine as production-stage

# 支持多架构 (ARM/x86) - nginx:alpine 官方镜像本身支持多架构
# 复制构建产物
COPY --from=build-stage /app/dist /usr/share/nginx/html

# 自定义 Nginx 配置 (可选，处理 SPA 路由)
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
