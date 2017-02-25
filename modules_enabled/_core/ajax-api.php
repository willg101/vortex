<?php

$params_required = [ 'file_names', 'list_recent_files', 'fetch_tree' ];
if ( !array_intersect_key( $_GET, array_flip( $params_required ) ) )
{	
	error_response( 'Expected one or more of the following GET parameters: '
		. implode( ', ', $params_required ) );
}

$response = [];

if ( $file_names = input( 'file_names' ) )
{
	$file_names = is_array( $file_names )
		? $file_names
		: [ $file_names ];

	$response[ 'files' ] = [];
	foreach ( $file_names as $file_name )
	{
		if ( client_can_view_file( $file_name ) )
		{
			$response[ 'files' ][ $file_name ] = @file_get_contents( $file_name );
		}
	}
}

if ( $fetch_tree = input( 'fetch_tree' ) )
{
	if ( in_array( $fetch_tree, [ '~ROOT~', '~RECENTLY_MODIFIED~' ] )
		|| client_can_access_path( $_GET[ 'fetch_tree' ] ) )
	{
		$dir = $fetch_tree == '~ROOT~'
			? settings( 'tree_root' )
			: realpath( $fetch_tree );

		$contents = NULL;
		$response = [];

		if ( $fetch_tree == '~ROOT~' )
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
		else if ( $fetch_tree == '~RECENTLY_MODIFIED~' )
		{
			$contents = [];
			foreach ( settings( 'recent_dirs' ) as $current_dir )
			{
				$extensions = implode( '\|', settings( 'allowed_extensions' ) );
				$files = shell_exec( "find $current_dir -type f -mmin -480 | grep '\.\($extensions\)'" );
				$files = array_filter( explode( "\n", $files ) );
				$contents = array_merge( $contents, $files );
				
				usort( $contents, function( $a, $b )
				{
					$a = strtolower( basename( $a ) );
					$b = strtolower( basename( $b ) );
					if ( $a > $b )
					{
						return 1;
					}
					else if ( $b > $a )
					{
						return -1;
					}
					else
					{
						return 0;
					}
				} );
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