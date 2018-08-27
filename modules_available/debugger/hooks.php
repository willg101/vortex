<?php

define( 'DEBUGGER_N_MOST_RECENT_FILES', 10 );

use Vortex\Cli\SocketServerStartCommand;
use Vortex\Cli\SocketServerRunCommand;

function debugger_provide_windows()
{
	return [
		[
			'title'     => 'Console',
			'id'        => 'console',
			'secondary' => FALSE,
			'icon'      => 'terminal',
			'content'   => render( 'console_window' ),
		],
		[
			'title'     => 'Code',
			'id'        => 'code',
			'secondary' => '<span id="filename"></span>',
			'icon'      => 'code',
			'content'   => render( 'code_window' ),
		],
		[
			'title'     => 'Scope',
			'id'        => 'context',
			'secondary' => '<span class="status-indicator"><i class="fa fa-microchip"></i> <span id="mem_usage"></span></span>',
			'icon'      => 'sitemap',
			'content'   => render( 'context_window' ),
		],
		[
			'title'     => 'Watch',
			'id'        => 'watch',
			'secondary' => '',
			'icon'      => 'binoculars',
			'content'   => render( 'watch_window' ),
		],
		[
			'title'     => 'Stack',
			'id'        => 'stack',
			'secondary' => '<span class="status-indicator"><i class="fa fa-sort-amount-desc"></i> <span id="stack_depth"></span></span>',
			'icon'      => 'sort-amount-desc',
			'content'   => render( 'stack_window' ),
		],
	];
}

function debugger_render_preprocess( &$data )
{
	if ( $data[ 'template' ] == 'toolbar_right' )
	{
		$data[ 'implementations' ][ 'debugger' ][ 'weight' ] = 10;
	}
}

/**
 * @brief
 *	Implements hook_boot(). Adds request handlers for the files and config APIs
 */
function debugger_boot()
{
	request_handlers()->register( '/file/',         'debugger_file_api' );
	request_handlers()->register( '/recent_files/', 'debugger_recent_files_api' );
}

/**
 * @brief
 *	Request handler for the files API; sends the contents of a file to the client
 *
 * @param string $path The request path
 */
function debugger_file_api( $path )
{
	require_method( 'GET' );

	// Strip off the leadin 'file/' from the path and check if the corresponding file exists
	$file = '/' . ( array_get( explode( '/', $path, 2 ), 1, '' ) );
	if ( !is_readable( $file ) )
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
function debugger_recent_files_api( $path )
{
	require_method( 'GET' );

	$extensions = implode( '\|', settings( 'allowed_extensions' ) );
	$dirs = implode( ' ', array_map( 'escapeshellarg', settings( 'recent_dirs' ) ) );
	$n_files = DEBUGGER_N_MOST_RECENT_FILES;
	$files = [];
	exec( "find $dirs -type f -regextype sed -regex '.*\.\($extensions\)' -printf '%T@ %p\n' | sort -n | tail -n $n_files | cut -f2- -d\" \"", $files );
	$files = array_filter( array_map( 'trim', $files ) );

	$response = [];
	foreach ( $files as $item )
	{
		if ( client_can_view_file( $item ) )
		{
			array_unshift( $response, [
				'name'     => basename( $item ),
				'fullpath' => $item,
				'is_dir'   => FALSE,
			] );
		}
	}

	send_json( $response );
}

function debugger_provide_console_commands( $data )
{
	$data[ 'application' ]->add( new SocketServerStartCommand() );
	$data[ 'application' ]->add( new SocketServerRunCommand() );
	$data[ 'application' ]->setDefaultCommand( 'socket-server:start' );
}

function debugger_ws_message_received( &$data )
{
	if ( preg_match( '/^X-glob /', $data[ 'message' ] ) )
	{
		$args = debugger_parse_glob_command( $data[ 'message' ] );
		if ( $args[ 'id' ] && $args[ 'pattern' ] )
		{
			$xml_out = '';
			foreach ( glob( $args[ 'pattern' ] . '*' ) as $item )
			{
				$type = is_dir( $item ) ? 'dir' : 'file';
				$xml_out .= "<item type=\"$type\">$item</item>";
			}
			$xml_out = "<globber transaction_id=\"$args[id]\" pattern=\"$args[pattern]\">$xml_out</globber>";
			$data[ 'logger' ]->debug( "Handling X-glob command: $data[message]", $args );
			$data[ 'bridge' ]->sendToWs( $xml_out );
		}
		else
		{
			$data[ 'logger' ]->warning( "Ignoring improperly formatted X-glob command: $data[message]", $args );
		}
	}
	elseif ( preg_match( '/^X-ctrl:stop /', $data[ 'message' ] ) )
	{
		fire_hook( 'stop_socket_server' );
		$data[ 'logger' ]->info( "Received stop command; killing server" );
		exit( 'stop' );
	}
	elseif ( preg_match( '/^X-ctrl:restart /', $data[ 'message' ] ) )
	{
		fire_hook( 'restart_socket_server' );
		$data[ 'logger' ]->info( "Received restart command; restarting server" );
		exit( 'restart' );
	}
	elseif ( preg_match( '/^X-ctrl:peek_queue /', $data[ 'message' ] ) )
	{
		$data[ 'bridge' ]->sendToWs( '<wsserver session-status-change=neutral status="alert" type="peek_queue">' . implode( '', $data[ 'bridge' ]->peekQueue() ) . "</wsserver>" );
	}
	elseif ( preg_match( '/^X-ctrl:detach_queued_session -s (?<id>\d+) /', $data[ 'message' ], $match ) )
	{
		$data[ 'bridge' ]->detachQueuedSession( $match[ 'id' ] );
		$data[ 'bridge' ]->sendToWs( '<wsserver session-status-change=neutral status="alert" type="detach_queued_session" session_id="' . $match[ 'id' ] . '">' );
	}
	elseif ( preg_match( '/^X-ctrl:switch_session -s (?<id>c\d+) /', $data[ 'message' ], $match ) )
	{
		$data[ 'bridge' ]->switchSession( $match[ 'id' ] );
	}
}

function debugger_parse_glob_command( $command )
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
