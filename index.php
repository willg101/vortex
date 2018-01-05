<?php /* dpoh: ignore */

define( 'DPOH_ROOT', __DIR__ );
define( 'IS_AJAX_REQUEST', !empty( $_SERVER['HTTP_X_REQUESTED_WITH'] ) );

set_exception_handler( function( $e )
{
	$vars = [
		'title'     => get_class( $e ),
		'message'   => $e->getMessage(),
		'trace'     => $e->getTraceAsString(),
		'base_path' => is_callable( 'base_path' ) ? base_path() : '',
	];

	if ( $e instanceof HttpException )
	{
		$e->applyHeaders();
	}
	else
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
