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
			$request_data  = $_POST;
		}
		else if ( $_SERVER[ 'REQUEST_METHOD' ] === 'GET' )
		{
			$request_data  = $_GET;
		}
		else
		{
			throw new HttpException( 'Unsupport request method' );
		}
	}

	return array_get( $request_data, $key, $default );
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
