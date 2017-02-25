<?php /* dpoh: ignore */

define( 'DPOH_ROOT', __DIR__ );

$handler = function( $e )
{
	$vars = [
		'title'   => get_class( $e ),
		'message' => $e->getMessage(),
		'trace'   => $e->getTraceAsString(),
	];
	echo render_template( 'crash.tpl.php', $vars );
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
