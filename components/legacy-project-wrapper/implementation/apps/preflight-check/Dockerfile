FROM nginxinc/nginx-unprivileged:1.25-alpine
COPY apps/preflight-check/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/preflight-check/public /usr/share/nginx/html
EXPOSE 8080
