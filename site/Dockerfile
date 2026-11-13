FROM nginx:1.27-alpine
# APK do release mais recente no repositório do app; o container baixa no build e copia para o volume ao iniciar.
ARG APK_URL=https://github.com/Hiagomda/adota/releases/download/apk-0.1.0-46/egua-adota.apk
# Endereços da API e das fotos que o nginx do site chama. O ambiente de teste troca pelos *.dev.
ARG API_HOST=api.eguaadota.com.br
ARG FOTOS_HOST=img.eguaadota.com.br
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
RUN sed -i \
    -e "s/set \$api_host api.eguaadota.com.br;/set \$api_host ${API_HOST};/" \
    -e "s/set \$fotos_host img.eguaadota.com.br;/set \$fotos_host ${FOTOS_HOST};/" \
    /etc/nginx/conf.d/default.conf \
  && grep -q "set \$api_host ${API_HOST};" /etc/nginx/conf.d/default.conf \
  && grep -q "set \$fotos_host ${FOTOS_HOST};" /etc/nginx/conf.d/default.conf
COPY index.html 404.html google.html version.json favicon.ico /usr/share/nginx/html/
COPY img /usr/share/nginx/html/img
COPY js /usr/share/nginx/html/js
COPY version.json /opt/version.json
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
  && if [ -n "$APK_URL" ]; then apk add --no-cache wget && wget -O /opt/egua-adota.apk "$APK_URL"; fi
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
