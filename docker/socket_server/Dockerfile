FROM php:7.2.10-cli-stretch

COPY main.sh /

# Don't warn about using composer as root
ENV COMPOSER_ALLOW_SUPERUSER 1

CMD ["/main.sh"]
