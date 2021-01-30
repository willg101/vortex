FROM php:7.4.14-apache-buster

RUN a2enmod rewrite proxy proxy_wstunnel \
	&& apt-get update                    \
	&& apt-get install -y unzip          \
	&& rm -rf /var/lib/apt/lists/*

COPY 000-default.conf /etc/apache2/sites-available/
COPY 20-mail.ini      /usr/local/etc/php/conf.d/
COPY main.sh          /

# Don't warn about using composer as root
ENV COMPOSER_ALLOW_SUPERUSER=1

CMD ["/main.sh"]
