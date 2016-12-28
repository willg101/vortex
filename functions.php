<?php /* dpoh: ignore */

define( 'LESS_INPUT_FILE',  'less/app.css.less'  );
define( 'LESS_OUTPUT_FILE', 'css/app-' . time() . '.css'  ); //time() for cachebusting

define( 'SETTINGS_FILE', 'settings.ini' );

function compile_less( $input = LESS_INPUT_FILE, $output = LESS_OUTPUT_FILE )
{
	$dir = dirname( LESS_OUTPUT_FILE );
	$contents = glob( $dir . '/app-*' );
	array_walk( $contents, function( $fn )
	{
		if ( is_file( $fn ) )
		{
			unlink( $fn );
		}
	} );
	
	require "lib/lessphp/lessc.inc.php";

	$less = new lessc;
	try
	{
		$less->compileFile( $input, $output );
	}
	catch( Exception $e )
	{
		echo $e->getMessage();
		exit;
	}
	return $output;
}

function get_settings()
{
	$settings = parse_ini_file( SETTINGS_FILE, TRUE );
	
	if ( !isset( $settings[ 'allowed_directories' ] ) || !is_array( $settings[ 'allowed_directories' ] ) )
	{
		$settings[ 'allowed_directories' ] = [];
	}
	
	 $settings[ 'tree_root' ] = realpath( $settings[ 'tree_root' ] );
	
	foreach ( $settings[ 'allowed_directories' ] as &$dir )
	{
		$dir = realpath( $dir );
	}

	return $settings;
}

function client_can_access_path( $path )
{
	$path = realpath( $path ) . '/';
	$settings = get_settings();
	foreach ( $settings[ 'allowed_directories' ] as $allowed_dir )
	{
		if ( strpos( $path, $allowed_dir . '/' ) === 0 )
		{
			return TRUE;
		}
	}
	return FALSE;
}

function client_can_view_file( $file_name )
{
	$file_name       = preg_replace( '#^.*?://#', '', $file_name );
	$settings        = get_settings();
	$extension_regex = implode( '|', array_map( 'preg_quote', $settings[ 'allowed_extensions' ] ) );
	return client_can_access_path( $file_name ) && preg_match( "/\.($extension_regex)$/", $file_name );
}
