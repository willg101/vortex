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

$route_to_module = NULL;
try
{
	$route_to_module = input( 'route_to_module' );
	$route_to_module = preg_replace( '/\..*/', '', $route_to_module );
}
catch ( HttpException $e )
{
	error_response( $e->getMessage() );
}

bootstrap( FALSE );
$module_ajax_api_script = array_get( modules()->get(), "$route_to_module.ajax_api_script" );
if ( $module_ajax_api_script )
{
	include $module_ajax_api_script;
	exit;
}
else
{
	error_response( "Module '$route_to_module' does not exist or does not define an Ajax API" );
}