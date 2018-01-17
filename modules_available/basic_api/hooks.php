<?php

use Vortex\Cli\SocketServerStartCommand;
use Vortex\Cli\SocketServerRunCommand;

/**
 * @brief
 *	Implements hook_boot(). Adds request handlers for the files and config APIs
 */
function basic_api_boot()
{
	request_handlers()->register( '/file/',         'basic_api_file_api' );
	request_handlers()->register( '/recent_files/', 'basic_api_recent_files_api' );
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

function basic_api_provide_console_commands( $data )
{
	$data[ 'application' ]->add( new SocketServerStartCommand() );
	$data[ 'application' ]->add( new SocketServerRunCommand() );
	$data[ 'application' ]->setDefaultCommand( 'socket-server:start' );
}

function basic_api_ws_message_received( &$data )
{
	if ( preg_match( '/^X_glob /', $data[ 'message' ] ) )
	{
		$args = basic_api_parse_glob_command( $data[ 'message' ] );
		if ( $args[ 'id' ] && $args[ 'pattern' ] )
		{
			$xml_out = '';
			foreach ( glob( $args[ 'pattern' ] . '*' ) as $item )
			{
				$type = is_dir( $item ) ? 'dir' : 'file';
				$xml_out .= "<item type=\"$type\">$item</item>";
			}
			$xml_out = "<globber transaction_id=\"$args[id]\" pattern=\"$args[pattern]\">$xml_out</globber>";
			$data[ 'logger' ]->debug( "Handling X_glob command: $data[message]", $args );
			$data[ 'bridge' ]->sendToWs( $xml_out );
		}
		else
		{
			$data[ 'logger' ]->warning( "Ignoring improperly formatted X_glob command: $data[message]", $args );
		}
	}
}

function basic_api_parse_glob_command( $command )
{
	static $regex= '/(
		-p \s+  " (?P<pattern_quoted_d> [^"]+ )  " |
		-p \s+ \' (?P<pattern_quoted_s> [^"]+ ) \' |
		-p \s+    (?P<pattern> \w+ )               |
		-i \s+    (?P<id> \w+ )
	)/x';
	static $parsed_items = [
		'id'      => [ 'id' ],
		'pattern' => [ 'pattern_quoted_d', 'pattern_quoted_s', 'pattern' ],
	];
	$out = [
		'id'      => FALSE,
		'pattern' => FALSE,
	];

	$matches = [];
	if ( preg_match_all( $regex, $command, $matches ) )
	{
		foreach ( $parsed_items as $key => $locations )
		{
			foreach ( $locations as $location )
			{
				while ( ( $val = array_shift( $matches[ $location ] ) ) !== NULL )
				{
					if ( $val )
					{
						$out[ $key ] = $val;
						break 2;
					}
				}
			}
		}
	}

	return $out;
}
