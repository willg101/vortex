<?php

function toolbar_render_preprocess( &$data )
{
	if ( $data[ 'template' ] != 'main_center' )
	{
		return;
	}

	$reordered = [
		'toolbar' => $data[ 'implementations' ][ 'toolbar' ],
	];
	$reordered = array_merge( $reordered, $data[ 'implementations' ] );
	$data[ 'implementations' ] = $reordered;
}

function toolbar_ws_message_received( &$data )
{
	if ( preg_match( '/^X_glob /', $data[ 'message' ] ) )
	{
		$args = toolbar_parse_glob_command( $data[ 'message' ] );
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

function toolbar_parse_glob_command( $command )
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
