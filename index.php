<?php /* dpoh: ignore */

define( 'DPOH_ROOT', __DIR__ );
define( 'IS_AJAX_REQUEST', !empty( $_SERVER['HTTP_X_REQUESTED_WITH'] ) );

$handler = function( $e )
{
	$vars = [
		'title'   => get_class( $e ),
		'message' => $e->getMessage(),
		'trace'   => $e->getTraceAsString(),
	];

	header( 'HTTP/1.0 500 Internal server error' );

	if ( IS_AJAX_REQUEST )
	{
		echo json_encode( $vars );
	}
	else
	{
		echo render_template( 'crash.tpl.php', $vars );
	}
};
set_exception_handler( $handler );
unset( $handler );

require_once 'includes/arrays.php';
require_once 'includes/bootstrap.php';
require_once 'includes/exceptions.php';
require_once 'includes/files.php';
require_once 'includes/http.php';
require_once 'includes/javascript.php';
require_once 'includes/models.php';
require_once 'includes/stylesheets.php';
require_once 'includes/templates.php';

echo bootstrap();
