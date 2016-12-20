<?php /* dpoh: ignore */

define( 'SEARCH_RECENT_DIR', '/srv/preachingandworship.org/' );

function error( $msg )
{
	header('HTTP/1.1 400 Bad Request' );
	header("Content-Type: application/json;charset=utf-8");
	echo json_encode( [
		'error' => $msg,
	] );
	exit;
}

$params_required = [ 'file_names', 'list_recent_files' ];
if ( !array_intersect_key( $_GET, array_flip( $params_required ) ) )
{	
	error( 'Expected one or more of the following GET parameters: '
		. implode( ', ', $params_required ) );
}

$response = [];

if ( isset( $_GET[ 'list_recent_files' ] ) )
{	
	$files = shell_exec( "find $dir -type f -mmin -480" );
	$response[ 'recent_files' ] = array_filter( explode( "\n", $files ) );
}

if ( isset( $_GET[ 'file_names' ] ) )
{
	$file_names = is_array( $_GET[ 'file_names' ] )
		? $_GET[ 'file_names' ]
		: [ $_GET[ 'file_names' ] ];

	$response[ 'files' ] = [];
	foreach ( $file_names as $file_name )
	{
		$response[ 'files' ][ $file_name ] = @file_get_contents( $file_name );
	}
}

header("Content-Type: application/json;charset=utf-8");
echo json_encode( $response );
exit;