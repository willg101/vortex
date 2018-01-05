<?php


$params_required = [ 'file_names', 'list_recent_files', 'fetch_tree', 'file_aliases' ];
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
		$response[ 'files' ][ $file_name ] = is_file( $file_name )
			? @file_get_contents( $file_name )
			: FALSE;
	}
}
elseif ( input( 'list_recent_files' ) )
{
	$contents = [];
	foreach ( settings( 'recent_dirs' ) as $current_dir )
	{
		$extensions = implode( '\|', settings( 'allowed_extensions' ) );
		$files = shell_exec( "find $current_dir -type f -mmin -480 | grep '\.\($extensions\)'" );
		$contents = array_merge( $contents, array_filter( explode( "\n", $files ) ) );

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
elseif ( $fetch_tree = input( 'fetch_tree' ) )
{
	if ( in_array( $fetch_tree, [ '~ROOT~' ] )
		|| client_can_access_path( $_GET[ 'fetch_tree' ] ) )
	{
		$dir = $fetch_tree == '~ROOT~'
			? settings( 'tree_root' )
			: realpath( $fetch_tree );

		$response = [];
		$contents = glob( "$dir/*" );

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
elseif ( $aliases = input( 'file_aliases' ) )
{
	if ( $_SERVER[ 'REQUEST_METHOD' ] == 'POST' )
	{
		$success = FALSE;

		if ( is_array( $aliases ) )
		{
			user_config()->set( 'file_aliases', $aliases )->save();
			$success = TRUE;
		}
		else
		{
			header( "HTTP 1.01/400 Bad request" );
		}

		$response = [ 'success' => $success ];
	}
	else
	{
		$response = user_config( 'file_aliases', [] );
	}
}

header("Content-Type: application/json;charset=utf-8");
echo json_encode( $response );
exit;
