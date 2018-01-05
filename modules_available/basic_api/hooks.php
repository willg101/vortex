<?php

/**
 * @brief
 *	Implements hook_boot(). Adds request handlers for the files and config APIs
 */
function basic_api_boot()
{
	request_handlers()->register( '/file/',         'basic_api_file_api' );
	request_handlers()->register( '/recent_files/', 'basic_api_recent_files_api' );
	request_handlers()->register( '/config/',       'basic_api_config_api' );
}

/**
 * @brief
 *	Request handler for the files API; sends the contents of a file to the client
 *
 * @param string $path The request path
 */
function basic_api_file_api( $path )
{
	require_method( 'GET' );

	// Strip off the leadin 'file/' from the path and check if the corresponding file exists
	$file = '/' . ( array_get( explode( '/', $path, 2 ), 1, '' ) );
	if ( !file_exists( $file ) )
	{
		error_response( "$file does not exist", 404, 'Not found' );
	}
	elseif ( is_file( $file ) ) // Send the file's contents to the client
	{
		$mime = mime_content_type( $file );
		header( "Content-Type: $mime; charset=utf-8" );
		echo file_get_contents( $file );
	}
	else // List the directory's contents for the client
	{
		$response = [];
		$contents = glob( "$file/*" );

		foreach ( $contents as $item )
		{
			$is_file = is_file( $item );
			if ( !$is_file || client_can_view_file( $item ) )
			{
				if ( input( 'view' ) == 'jstree' )
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
				else
				{
					$response[] = [
						'name'     => basename( $item ),
						'fullpath' => $item,
						'is_dir'   => !$is_file,
					];
				}
			}
		}

		send_json( $response );
	}
}


/**
 * @brief
 *	Request handler for the files API; sends the client a list of the most recently edited files
 *	within the "watched" directories
 */
function basic_api_recent_files_api( $path )
{
	require_method( 'GET' );

	$contents = [];
	$response = [];
	foreach ( settings( 'recent_dirs' ) as $current_dir )
	{
		$extensions = implode( '\|', settings( 'allowed_extensions' ) );
		$files = shell_exec( "find $current_dir -type f -mmin -480 | grep '\.\($extensions\)'" );
		$contents = array_merge( $contents, array_filter( explode( "\n", $files ) ) );

		// Sort the recent files by basename
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
		if ( client_can_view_file( $item ) )
		{
			$response[] = [
				'name'     => basename( $item ),
				'fullpath' => $item,
				'is_dir'   => FALSE,
			];
		}
	}

	send_json( $response );
}

/**
 * @brief
 *	Request handler for the config API; fetches, updates, and deletes config items
 *
 * @param string $path The request path
 */
function basic_api_config_api( $path )
{
	require_method( [ 'GET', 'POST', 'DELETE' ] );

	// Strip off the leading 'config/' from $path and convert the rest of $path to "dot" notation
	$key = array_get( explode( '/', $path, 2 ), 1, '' );
	$key = str_replace( '/', '.', $key );

	switch ( $_SERVER[ 'REQUEST_METHOD' ] )
	{
		case 'GET':
			send_json( $key ? user_config( $key ) : user_config()->get() );
			break;

		case 'POST':
			user_config()->set( $key, input( 'payload' ) ?: NULL )->save();
			send_json( [ 'success' => TRUE ] );
			break;

		case 'DELETE':
			user_config()->del( $key )->save();
			send_json( [ 'success' => TRUE ] );
			break;
	}
}