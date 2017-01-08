<?php /* dpoh: ignore */

require_once 'functions.php';

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