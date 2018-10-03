FROM php:7.2.10-cli-stretch

RUN apt-get update                \
	&& apt-get install -y unzip   \
	&& rm -rf /var/lib/apt/lists/*

COPY main.sh /

# Don't warn about using composer as root
ENV COMPOSER_ALLOW_SUPERUSER 1

CMD ["/main.sh"]
