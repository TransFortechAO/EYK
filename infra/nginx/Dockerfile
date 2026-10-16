FROM nginx:alpine

# Remove a configuração padrão
RUN rm /etc/nginx/conf.d/default.conf

# Copia nossa configuração
COPY nginx.conf /etc/nginx/nginx.conf