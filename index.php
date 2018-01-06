<?php /* dpoh: ignore */

define( 'DPOH_ROOT', __DIR__ );
define( 'IS_AJAX_REQUEST', !empty( $_SERVER['HTTP_X_REQUESTED_WITH'] ) );

set_exception_handler( function( $e )
{
	$exceptions = [];

	$headers_applied = FALSE;
	$current = $e;
	do
	{
		$exceptions[] = [
			'title'     => get_class( $current ),
			'message'   => $current->getMessage(),
			'trace'     => $current->getTraceAsString(),
		];

		if ( $current instanceof HttpException )
		{
			$current->applyHeaders();
			$headers_applied = TRUE;
		}

	} while( $current = $current->getPrevious() );

	if ( ($c = count( $exceptions ) ) > 1 )
	{
		foreach ( $exceptions as $i => $exception )
		{
			$i++;
			$exceptions[ $i - 1 ][ 'title' ] .= " ($i of $c)";
		}
	}

	$vars = [
		'exceptions'   => $exceptions,
		'n_exceptions' => count( $exceptions ),
		'base_path'    => is_callable( 'base_path' ) ? base_path() : '',
	];

	if ( !$headers_applied )
	{
		header( 'HTTP/1.0 500 Internal server error' );
	}

	if ( IS_AJAX_REQUEST )
	{
		echo json_encode( $vars );
	}
	else
	{
		extract( $vars );
		include 'crash.tpl.php';
		exit;
	}
} );

require_once 'includes/arrays.php';
require_once 'includes/bootstrap.php';
require_once 'includes/database.php';
require_once 'includes/exceptions.php';
require_once 'includes/files.php';
require_once 'includes/http.php';
require_once 'includes/javascript.php';
require_once 'includes/models.php';
require_once 'includes/stylesheets.php';
require_once 'includes/templates.php';
require_once 'vendor/paragonie/random_compat/lib/random.php';

bootstrap();
