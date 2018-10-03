<?php

/**
 * @brief
 *	A convenience method for getting request parameters regardless of the request type (POST/GET)
 *
 * @param string $key     The key of the item to look up; may be given in "dot" notation
 * @param mixed  $default The value to return if no data exists for the value at $key
 *
 * @throws HttpException when the request method is not POST or GET
 *
 * @retval mixed
 */
function input( $key, $default = NULL )
{
	static $request_data;
	if ( $request_data === NULL )
	{
		if ( $_SERVER[ 'REQUEST_METHOD' ] === 'POST' )
		{
			$request_data = $_POST;
		}
		else if ( $_SERVER[ 'REQUEST_METHOD' ] === 'GET' )
		{
			$request_data = $_GET;
		}
		else
		{
			throw new HttpException( 'Unsupported request method' );
		}
	}

	return trim( array_get( $request_data, $key, $default ) );
}

function base_url()
{
	return sprintf( "%s://%s%s",
		isset( $_SERVER[ 'HTTPS' ] ) && $_SERVER[ 'HTTPS' ] != 'off' ? 'https' : 'http',
		$_SERVER[ 'SERVER_NAME' ],
		base_path()
	);
}

/**
 * @brief
 *	Sends a JSON-encoded error response to the client and ends the response (i.e., exits)
 *
 * @param string $message      The message to include in the JSON
 * @param int    $code         OPTIONAL. Default is 400. The status code to use
 * @param string $http_message OPTIONAL. Default is 'Bad Request'
 */
function error_response( $message, $code = 400, $http_message = 'Bad Request' )
{
	header( "HTTP/1.1 $code $http_message" );
	header( "Content-Type: application/json;charset=utf-8" );
	echo json_encode( [
		'error' => $message,
	] );
	exit;
}

/**
 * COPIED FROM DRUPAL 7 CORE
 *
 * Returns the requested URL path of the page being viewed.
 *
 * Examples:
 * - http://example.com/node/306 returns "node/306".
 * - http://example.com/drupalfolder/node/306 returns "node/306" while
 *	 base_path() returns "/drupalfolder/".
 * - http://example.com/path/alias (which is a path alias for node/306) returns
 *	 "path/alias" as opposed to the internal path.
 * - http://example.com/index.php returns an empty string (meaning: front page).
 * - http://example.com/index.php?page=1 returns an empty string.
 *
 * @return
 *	 The requested Drupal URL path
 */
function request_path() {
	static $path;

	if (isset($path)) {
		return $path;
	}

	if (isset($_GET['q']) && is_string($_GET['q'])) {
		// This is a request with a ?q=foo/bar query string. $_GET['q'] is
		// overwritten in drupal_path_initialize(), but request_path() is called
		// very early in the bootstrap process, so the original value is saved in
		// $path and returned in later calls.
		$path = $_GET['q'];
	}
	elseif ( isset($_SERVER['REQUEST_URI'] ) )
	{
		// This request is either a clean URL, or 'index.php', or nonsense.
		// Extract the path from REQUEST_URI.
		$request_path = strtok($_SERVER['REQUEST_URI'], '?');
		$base_path_len = strlen(rtrim(dirname($_SERVER['SCRIPT_NAME']), '\/'));
		// Unescape and strip $base_path prefix, leaving q without a leading slash.
		$path = substr(urldecode($request_path), $base_path_len + 1);
		// If the path equals the script filename, either because 'index.php' was
		// explicitly provided in the URL, or because the server added it to
		// $_SERVER['REQUEST_URI'] even when it wasn't provided in the URL (some
		// versions of Microsoft IIS do this), the front page should be served.
		if ($path == basename($_SERVER['PHP_SELF']))
		{
			$path = '';
		}
	}
	else
	{
		// This is the front page.
		$path = '';
	}

	// Under certain conditions Apache's RewriteRule directive prepends the value
	// assigned to $_GET['q'] with a slash. Moreover we can always have a trailing
	// slash in place, hence we need to normalize $_GET['q'].
	$path = trim($path, '/');

	return $path;
}

function send_json( $data, $die = TRUE )
{
	header( "Content-Type: application/json; charset=utf-8" );
	echo json_encode( $data );

	if ( $die )
	{
		die;
	}
}

/**
 * AN EXCERPT COPIED FROM DRUPAL 7 CORE, `conf_init()`
 *
 * @brief
 *	Get the base path of this website; helpful for installations that are not at document root
 *
 * @retval string
 *	A string ending with '/'
 */
function base_path()
{
	static $base_path;

	if ( !isset( $base_path ) )
	{
		// $_SERVER['SCRIPT_NAME'] can, in contrast to $_SERVER['PHP_SELF'], not
		// be modified by a visitor.
		if ( $dir = rtrim( dirname( $_SERVER[ 'SCRIPT_NAME' ] ), '\/' ) )
		{
			$base_path = $dir;
			$base_path .= '/';
		}
		else
		{
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
function require_method( $methods )
{
	if ( !is_array( $methods ) )
	{
		$methods = [ $methods ];
	}

	$methods = array_map( 'strtoupper', $methods );

	if ( in_array( $_SERVER[ 'REQUEST_METHOD' ], $methods ) )
	{
		return;
	}
	else
	{
		$method_list = implode( ', ', $methods );
		$headers = [
			'HTTP/1.1 405 Not allowed',
			"Allow: $method_list",
		];
		throw new HttpException( "Method '$_SERVER[REQUEST_METHOD]' not allowed. "
			. "Allowed methods: $method_list", $headers );
	}
}

/**
 * @param string $str The content of a cookie header
 * @retval array
 */
function parse_cookie_str( $str )
{
	$cookies = [];
	foreach ( explode( '; ', $str ) as $raw_cookie )
	{
		preg_match( '/^(?P<key>.*?)=(?P<value>.*?)$/i', trim( $raw_cookie ), $matches );
		$cookies[ trim( $matches[ 'key' ] ) ]  = urldecode( $matches[ 'value' ] );
	}
	return $cookies;
}
