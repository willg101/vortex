<?php

class SentryClientException extends \Exception
{
}

function sentry_client_preboot()
{
    if (!include_once('vendor/sentry/sentry/lib/Raven/Autoloader.php')) {
        throw new SentryClientException('Unable to load the Raven (PHP Sentry) class autoloader.');
    }
    Raven_Autoloader::register();

    $config_file_name = __DIR__ . '/config.php';
    $config_file_template_name = "$config_file_name.template";
    $refer_to = "Please refer to the template file `$config_file_template_name` for more information.";
    if (!is_readable($config_file_name)) {
        throw new SentryClientException("The Sentry client configuration file ($config_file_name) "
            . "does not exist or is not readable. $refer_to");
    }
    $dsn = include($config_file_name);
    if (!$dsn) {
        throw new SentryClientException("The Sentry client is not properly configured. The "
            . "file `$config_file_name` should return a string; an empty value was returned "
            . "instead. $refer_to");
    } elseif (!is_string($dsn)) {
        throw new SentryClientException("The Sentry client is not properly configured. The "
            . "file `$config_file_name` should supply a string; it supplied a(n) " . gettype($dsn)
            . " value instead. $refer_to");
    }

    $client = (new Raven_Client($dsn))->install();
    sentry_get_client($client);
}

function sentry_get_client($set_client = null)
{
    static $client;
    if ($client === null && $set_client) {
        $client = $set_client;
    }

    return $client;
}

function sentry_client_boot()
{
    $data = [
        'client' => sentry_get_client(),
    ];
    fire_hook('provide_sentry_context', $data);
}
