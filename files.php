<?php /* dpoh: ignore */

define( 'SEARCH_RECENT_DIR', '' );
require_once( 'functions.php' );

function error( $msg )
{
	header('HTTP/1.1 400 Bad Request' );
	header("Content-Type: application/json;charset=utf-8");
	echo json_encode( [
		'error' => $msg,
	] );
	exit;
}

$params_required = [ 'file_names', 'list_recent_files', 'fetch_tree' ];
if ( !array_intersect_key( $_GET, array_flip( $params_required ) ) )
{	
	error( 'Expected one or more of the following GET parameters: '
		. implode( ', ', $params_required ) );
}

$response = [];

if ( isset( $_GET[ 'list_recent_files' ] ) )
{
	$response[ 'recent_files' ] = [];
}

if ( isset( $_GET[ 'file_names' ] ) )
{
	$file_names = is_array( $_GET[ 'file_names' ] )
		? $_GET[ 'file_names' ]
		: [ $_GET[ 'file_names' ] ];

	$response[ 'files' ] = [];
	foreach ( $file_names as $file_name )
	{
		if ( client_can_view_file( $file_name ) )
		{
			$response[ 'files' ][ $file_name ] = @file_get_contents( $file_name );
		}
	}
}

if ( isset( $_GET[ 'fetch_tree' ] ) )
{
	if ( $_GET[ 'fetch_tree' ] == '~ROOT~' || $_GET[ 'fetch_tree' ] == '~RECENTLY_MODIFIED~'
		|| client_can_access_path( $_GET[ 'fetch_tree' ] ) )
	{
		$settings = get_settings();
		$dir = $_GET[ 'fetch_tree' ] == '~ROOT~'
			? $settings[ 'tree_root' ]
			: realpath( $_GET[ 'fetch_tree' ] );

		$contents = NULL;
		$response = [];
		if ( $_GET[ 'fetch_tree' ] == '~ROOT~' )
		{
			$response[] = [
				'text' => 'Recently modified',
				'icon' => 'fa fa-history',
				'state' => [
					'opened' => TRUE,
				],
				'children' => TRUE,
				'li_attr' => [
					'data-full-path' => '~RECENTLY_MODIFIED~',
				],
			];
		}
		else if ( $_GET[ 'fetch_tree' ] == '~RECENTLY_MODIFIED~' )
		{
			$contents = [];
			foreach ( $settings[ 'recent_dirs' ] as $current_dir )
			{
				$extensions = implode( '\|', $settings[ 'allowed_extensions' ] );
				$files = shell_exec( "find $current_dir -type f -mmin -480 | grep '\.\($extensions\)'" );
				$files = array_filter( explode( "\n", $files ) );
				$contents = array_merge( $contents, $files );
			}
		}
		
		if ( $contents === NULL )
		{
			$contents = glob( "$dir/*" );
		}
		
		foreach ( $contents as $item )
		{
			$is_file = is_file( $item );
			if ( !$is_file || client_can_view_file( $item ) )
			{
				$response[] = [
					'text' => basename( $item ),
					'icon' => $is_file ? 'fa fa-file-code-o code' : 'fa fa-folder folder',
					'children' => !$is_file,
					'li_attr' => [
						'data-full-path' => $item,
						'data-is-file' => $is_file,
					],
				];
			}
		}
	}
}

header("Content-Type: application/json;charset=utf-8");
echo json_encode( $response );
exit;