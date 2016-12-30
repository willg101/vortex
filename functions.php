<?php /* dpoh: ignore */

define( 'LESS_INPUT_FILE',  'less/app.css.less'  );
define( 'LESS_OUTPUT_FILE', 'css/app-' . time() . '.css'  ); //time() for cachebusting

define( 'SETTINGS_FILE', 'settings.ini' );
define( 'MODULES_PATH',  'modules' );

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
	
	require_once "lib/lessphp/lessc.inc.php";

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

function load_all_modules( $mod_path = MODULES_PATH )
{
	$recognized_dirs = [ 'js', 'css', 'less' ];
	$modules          = [];
	$mod_dir_contents = glob( "$mod_path/*" );
	foreach ( $mod_dir_contents as $item )
	{
		$mod_name = basename( $item );
		$modules[ $mod_name ] = [];
		if ( is_dir( $item ) )
		{
			foreach ( $recognized_dirs as $dir )
			{
				$modules[ $mod_name ][ $dir ] = [];
				if ( file_exists( "$item/$dir" ) )
				{
					$modules[ $mod_name ][ $dir ] = recursive_file_scan( $dir, "$item/$dir" );
				}
			}
			
			$modules[ $mod_name ][ 'settings' ] = file_exists( "$item/settings.ini" )
				? parse_ini_file( "$item/settings.ini", TRUE )
				: [];

			$modules[ $mod_name ][ 'api_script' ] = file_exists( "$item/api.php" )
				? "$item/api.php"
				: FALSE;

			$modules[ $mod_name ][ 'template' ] = file_exists( "$item/template.php" )
				? "$item/api.php"
				: FALSE;
		}
	}

	return $modules;
}

function recursive_file_scan( $extension, $dir, &$dirs_seen = [] )
{
	// Account for symlink cycles
	$real_path = realpath( $dir );
	if ( isset( $dirs_seen[ $real_path ] ) )
	{
		return [];
	}
	else
	{
		$dirs_seen[ $real_path ] = TRUE;
	}

	$result = [];
	foreach ( glob( "$dir/*" ) as $item )
	{
		if ( is_dir( $item ) )
		{
			$result = array_merge( $result, recursive_file_scan( $extension, $item, $dirs_seen ) );
		}
		else if ( preg_match( "/\.$extension$/", $item ) )
		{
			$result[] = $item;
		}
	}
	return $result;
}

function build_script_requirements( $modules )
{
	$result = [];

	foreach ( $modules as $module_name => $module )
	{
		if ( count( $module[ 'js' ] ) )
		{
			if ( $module[ 'api_script' ] )
			{
				$result[] = "<script>send_api_request = send_api_request_original.bind( undefined, '$module[api_script]' );</script>";
			}
			else
			{
				$result[] = '<script>send_api_request = undefined;</script>';
			}

			if ( !empty( $module[ 'settings' ][ 'js_settings' ] ) )
			{
				$result[] = "<script>module_settings = " . json_encode( $module[ 'settings' ][ 'js_settings' ] ) . ";</script>";
			}
			else
			{
				$result[] = '<script>send_api_request = undefined;</script>';
			}

			foreach ( $module[ 'js' ] as $js_file )
			{
				$result[] = '<script src="' . $js_file . '"></script>';
			}
		}
	}
	$result[] = '<script>send_api_request = undefined;</script>';
	$result[] = '<script>module_settings  = undefined;</script>';
	
	return implode( "\n\t\t", $result );
}

function build_css_requirements( $modules )
{
	$result = [];

	foreach ( $modules as $module )
	{
		if ( count( $module[ 'css' ] ) )
		{
			foreach ( $module[ 'css' ] as $css_file )
			{
				$result[] = '<link rel="stylesheet" href="' . $css_file . '"/>';
			}
		}
	}

	return implode( "\n\t\t", $result );
}

function build_less_requirements( $modules, &$errors = [] )
{
	$dir = dirname( LESS_OUTPUT_FILE );
	$contents = glob( $dir . '/module-*' );
	array_walk( $contents, function( $fn )
	{
		if ( is_file( $fn ) )
		{
			unlink( $fn );
		}
	} );
	
	require_once "lib/lessphp/lessc.inc.php";

	$less = new lessc;
	$result = [];

	foreach ( $modules as $module_name => $module )
	{
		if ( count( $module[ 'less' ] ) )
		{
			foreach ( $module[ 'less' ] as $less_file )
			{
				$output = "$dir/module-$module_name-" . time() . '.css';
				try
				{
					$less->compileFile( $less_file, $output );
				}
				catch( Exception $e )
				{
					$errors[] = $e->getMessage();
					continue;
				}
				$result[] = '<link rel="stylesheet" href="' . $output . '"/>';
			}
		}
	}

	return implode( "\n\t\t", $result );
}