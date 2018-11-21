FROM php:7.2.10-apache-stretch

RUN a2enmod rewrite proxy proxy_wstunnel \
	&& pecl install xdebug               \
	&& apt-get update                    \
	&& apt-get install -y unzip ssmtp    \
	&& rm -rf /var/lib/apt/lists/*

COPY 000-default.conf /etc/apache2/sites-available/
COPY 20-xdebug.ini    /usr/local/etc/php/conf.d/
COPY 20-mail.ini      /usr/local/etc/php/conf.d/
COPY main.sh          /
COPY ssmtp.conf       /etc/ssmtp/ssmtp.conf

# Don't warn about using composer as root
ENV COMPOSER_ALLOW_SUPERUSER=1

CMD ["/main.sh"]
