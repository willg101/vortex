<?php

use Vortex\App;
use Vortex\Exceptions\HttpException;

function base_url()
{
    return sprintf(
        "%s://%s%s",
        isset($_SERVER[ 'HTTPS' ]) && $_SERVER[ 'HTTPS' ] != 'off' ? 'https' : 'http',
        $_SERVER[ 'SERVER_NAME' ],
        base_path()
    );
}

/**
 * AN EXCERPT COPIED FROM DRUPAL 7 CORE, `conf_init()`
 *
 * @brief
 *	Get the base path of this website; helpful for installations that are not at document root
 *
 * @return string
 *	A string ending with '/'
 */
function base_path()
{
    static $base_path;

    if (!isset($base_path)) {
        // $_SERVER['SCRIPT_NAME'] can, in contrast to $_SERVER['PHP_SELF'], not
        // be modified by a visitor.
        if ($dir = rtrim(dirname($_SERVER[ 'SCRIPT_NAME' ]), '\/')) {
            $base_path = $dir;
            $base_path .= '/';
        } else {
            $base_path = '/';
        }
    }

    return $base_path;
}

/**
 * @brief
 *	Verify that the HTTP request was sent using the given method, and if it was not, send a 405
 *	response
 *
 * @param string|array A string containing an HTTP method name, or an array of such strings
 */
function require_method($methods)
{
    if (!is_array($methods)) {
        $methods = [ $methods ];
    }

    $methods = array_map('strtoupper', $methods);

    if (in_array($_SERVER[ 'REQUEST_METHOD' ], $methods)) {
        return;
    } else {
        $method_list = implode(', ', $methods);
        $headers = [
            'HTTP/1.1 405 Not allowed',
            "Allow: $method_list",
        ];
        throw new HttpException("Method '$_SERVER[REQUEST_METHOD]' not allowed. "
            . "Allowed methods: $method_list", $headers);
    }
}

/**
 * @param string $str The content of a cookie header
 * @return array
 */
function parse_cookie_str($str)
{
    $cookies = [];
    foreach (explode('; ', $str) as $raw_cookie) {
        preg_match('/^(?P<key>.*?)=(?P<value>.*?)$/i', trim($raw_cookie), $matches);
        $cookies[ trim($matches[ 'key' ]) ]  = urldecode($matches[ 'value' ]);
    }
    return $cookies;
}

/**
 * @return string
 */
function get_user_ip()
{
    static $ip;
    if ($ip === null) {
        $ip = App::get('request')->headers->get('X-Forwarded-For') ?: App::get('request')->server->get('REMOTE_ADDR');
    }
    return $ip;
}
