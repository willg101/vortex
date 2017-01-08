<?php

use Dpoh\DataStorage;
use Dpoh\PersistentDataStorage;

define( 'LESS_INPUT_FILE',  'less/app.css.less'  );
define( 'LESS_OUTPUT_FILE', 'css/app-' . time() . '.css'  ); //time() for cachebusting

define( 'USER_CONFIG_FILE', 'user-config.json' );
define( 'SETTINGS_FILE',    'settings-global.json' );
define( 'MODULES_PATH',     'modules' );

class HttpException    extends Exception {};
class FatalConfigError extends Exception {};
require_once 'DataStorage.class.php';
require_once 'PersistentDataStorage.class.php';

// See http://stackoverflow.com/questions/5695145/how-to-read-and-write-to-an-ini-file-with-php
function file_put_contents_safe( $fileName, $dataToSave )
{
	if ( $fp = fopen( $fileName, 'w' ) )
    {
        $startTime = microtime( TRUE );
        do
        {
			$canWrite = flock( $fp, LOCK_EX );
			// If lock not obtained sleep for 0 - 100 milliseconds, to avoid collision and CPU load
			if( !$canWrite )
			{
				usleep( round( rand( 0, 100 ) * 1000 ) );
			}
        } while ( ( !$canWrite ) and ( ( microtime( TRUE ) - $startTime ) < 5 ) );

        // File was locked so now we can store information
        if ( $canWrite )
        {
			fwrite( $fp, $dataToSave );
			flock( $fp, LOCK_UN );
        }
        fclose( $fp );
    }
}

/**
 * @brief
 *	Compiles a LESS file into a CSS file and saves the result to disk
 */
function compile_less( $input = LESS_INPUT_FILE, $output = LESS_OUTPUT_FILE, array &$errors = [] )
{
	static $clear = TRUE;

	$dir = dirname( LESS_OUTPUT_FILE );
	if ( $clear )
	{
		$contents = glob( $dir . '/cached-*' );
		array_walk( $contents, function( $fn )
		{
			if ( is_file( $fn ) )
			{
				unlink( $fn );
			}
		} );
		$clear = FALSE;
	}
	
	$output = $dir . '/cached-' . basename( $output );

	require_once "lib/less_php/Less.php";

	$less = new Less_Parser();
	$less->ModifyVars( settings( 'less_variables' ) );
	try
	{
		$less->parseFile( $input, __DIR__ . '/less' );
		file_put_contents_safe( $output, $less->getCss() );
	}
	catch( Exception $e )
	{
		$errors[] = $e->getMessage();
		return '';
	}
	return $output;
}

function settings( $key = NULL, $default_val = NULL )
{
	static $settings_obj;
	
	if ( $settings_obj === NULL )
	{
		$settings = json_decode( file_get_contents( SETTINGS_FILE ), TRUE ) ?: [];
		$default_settings = [
			'allowed_directories' => [],
			'tree_root' => '/dev/null',
			'less_variables' => [
				'defaults' =>  "~'" . __DIR__ . "/less/defaults'",
			],
		];
		
		$settings = array_merge( $default_settings, $settings );
		$settings[ 'tree_root' ] = realpath( $settings[ 'tree_root' ] );
		foreach ( $settings[ 'allowed_directories' ] as &$dir )
		{
			$dir = realpath( $dir );
		}
		
		$settings_obj = new DataStorage( 'global_settings', $settings );
	}

	return $key !== NULL
		? $settings_obj->get( $key, $default_val )
		: $settings_obj;
}

function user_config( $key = NULL, $default_val = NULL )
{
	static $user_config_obj;
	
	if ( $user_config_obj === NULL )
	{
		$default_config = [ 'theme_module' => '_core' ];
		$user_config_obj = new PersistentDataStorage( 'user_config', $default_config, FALSE,
			USER_CONFIG_FILE );
	}

	return $key !== NULL
		? $user_config_obj->get( $key, $default_val )
		: $user_config_obj;
}

function client_can_access_path( $path )
{
	$path = realpath( $path ) . '/';
	foreach ( settings( 'allowed_directories' ) as $allowed_dir )
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
	$extension_regex = implode( '|', array_map( 'preg_quote', settings( 'allowed_extensions' ) ) );
	return client_can_access_path( $file_name )
		&& ( preg_match( "/\.($extension_regex)$/", $file_name )
			|| ( in_array( '', settings( 'allowed_extensions' ) ) && preg_match( '/^\./', basename( $file_name ) ) ) );
}

function load_all_modules( $mod_path = MODULES_PATH )
{
	$recognized_dirs  = [ 'js', 'css', 'less' ];
	$modules          = [];
	$mod_dir_contents = glob( "$mod_path/*" );
	$default_settings = [
		'external_dependencies' => [
			'js'  => [],
			'css' => [],
		],
	];
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
			
			$modules[ $mod_name ][ 'templates' ] = recursive_file_scan( 'tpl.php', "$item/templates" );
			
			$modules[ $mod_name ][ 'hook_implementations' ] = file_exists( "$item/hooks.php" )
				? "$item/hooks.php"
				: FALSE;

			$modules[ $mod_name ][ 'ajax_api_script' ] = file_exists( "$item/ajax-api.php" )
				? "$item/ajax-api.php"
				: FALSE;

			$modules[ $mod_name ][ 'page_template' ] = file_exists( "$item/page-template.tpl.php" )
				? "$item/page-template.tpl.php"
				: FALSE;
			
			$settings = file_exists( "$item/settings.json" )
				? json_decode( file_get_contents( "$item/settings.json" ), TRUE )
				: [];
			$modules[ $mod_name ][ 'settings' ] = array_merge( $default_settings, $settings );
		}
	}

	return $modules;
}

function modules( $key = NULL, $default_val = NULL )
{
	static $modules_obj;
	if ( $modules_obj === NULL )
	{
		$modules_obj = new DataStorage( 'modules', load_all_modules() );
	}
	
	return $key !== NULL
		? $modules_obj->get( $key, $default_val )
		: $modules_obj;
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
	$extension_escaped = preg_quote( $extension, '/' );
	foreach ( glob( "$dir/*" ) as $item )
	{
		if ( is_dir( $item ) )
		{
			$result = array_merge( $result, recursive_file_scan( $extension, $item, $dirs_seen ) );
		}
		else
		{
			if ( preg_match( "/\.$extension_escaped$/", $item ) )
			{
				$result[] = $item;
			}
		}
	}
	return $result;
}

function build_script_requirements()
{
	$result = [];

	foreach ( settings( 'core_js', [] ) as $js_file )
	{
		$result[] = '<script src="' . $js_file . '"></script>';
	}

	foreach ( modules()->get() as $module_name => $module )
	{
		foreach ( $module[ 'settings' ][ 'external_dependencies' ][ 'js' ] as $js_file )
		{
			$result[] = '<script src="' . $js_file . '"></script>';
		}

		if ( count( $module[ 'js' ] ) )
		{
			if ( $module[ 'ajax_api_script' ] )
			{
				$result[] = "<script>send_api_request = send_api_request_original.bind( undefined, '$module_name' );</script>";
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
				$result[] = '<script>module_settings = undefined;</script>';
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

function build_css_requirements()
{
	$result = [];

	foreach ( modules()->get() as $module )
	{
		foreach ( $module[ 'settings' ][ 'external_dependencies' ][ 'css' ] as $css_file )
		{
			array_unshift( $result, '<link rel="stylesheet" href="' . $css_file . '">' );
		}

		foreach ( $module[ 'css' ] as $css_file )
		{
			$result[] = '<link rel="stylesheet" href="' . $css_file . '"/>';
		}
	}

	return implode( "\n\t\t", $result );
}

function build_less_requirements( &$errors = [] )
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
	
	$result = [];

	foreach ( modules()->get() as $module_name => $module )
	{
		if ( count( $module[ 'less' ] ) )
		{
			foreach ( $module[ 'less' ] as $less_file )
			{
				$less_file_plain = preg_replace( '/\..*$/', '', basename( $less_file ) );
				$output = "$dir/$module_name-module-$less_file_plain-" . time() . '.css';
				$output = compile_less( $less_file, $output, $errors );
				$result[] = '<link rel="stylesheet" href="' . $output . '"/>';
			}
		}
	}

	return implode( "\n\t\t", $result );
}

function fire_hook( $hook_name, array &$data = [], $reload = FALSE )
{
	static $hook_modules;
	if ( $reload || $hook_modules === NULL )
	{
		$hook_modules = [];
		foreach ( modules()->get() as $module_name => $module )
		{
			if ( $module[ 'hook_implementations' ] )
			{
				$hook_modules[] = $module_name;
				require_once( $module[ 'hook_implementations' ] );
			}
		}
	}

	$results = [];
	foreach ( $hook_modules as $module_name )
	{
		$function_name = $module_name . '_' . $hook_name;
		if ( function_exists( $function_name ) )
		{
			$current_result = $function_name( $data );
			if ( $current_result !== NULL )
			{
				$results[ $module_name ] = $current_result;
			}
		}
	}
	return $results;
}

function get_renderings()
{
	$renderings = [];

	foreach ( modules()->get() as $module_name => $module )
	{
		foreach ( $module[ 'templates' ] as $template_name )
		{
			if ( !isset( $renderings[ $template_name ] ) )
			{
				$renderings[ $template_name ] = [];
			}
			$key = preg_replace( '/\..*$/', '', basename( $template_name ) );
			$renderings[ $key ][ $module_name ] =
				render_template( $template_name );
		}
	}
	
	return $renderings;
}

/**
 * FROM LARAVEL
 *
 * Get an item from an array using "dot" notation.
 *
 * @param  array   $array
 * @param  string  $key
 * @param  mixed   $default
 * @return mixed
 */
function array_get($array, $key, $default = null)
{
	if (is_null($key)) return $array;
	if (isset($array[$key])) return $array[$key];
	foreach (explode('.', $key) as $segment)
	{
		if ( ! is_array($array) || ! array_key_exists($segment, $array))
		{
			return $default;
		}
		$array = $array[$segment];
	}
	return $array;
}

/**
 * Set an array item to a given value using "dot" notation.
 *
 * If no key is given to the method, the entire array will be replaced.
 *
 * @param  array   $array
 * @param  string  $key
 * @param  mixed   $value
 * @return array
 */
function array_set(&$array, $key, $value)
{
	if (is_null($key)) return $array = $value;
	$keys = explode('.', $key);
	while (count($keys) > 1)
	{
		$key = array_shift($keys);
		// If the key doesn't exist at this depth, we will just create an empty array
		// to hold the next value, allowing us to create the arrays to hold final
		// values at the correct depth. Then we'll keep digging into the array.
		if ( ! isset($array[$key]) || ! is_array($array[$key]))
		{
			$array[$key] = array();
		}
		$array =& $array[$key];
	}
	$array[array_shift($keys)] = $value;
	return $array;
}

function input( $key, $default = NULL )
{
	static $request_data;
	if ( $request_data === NULL )
	{
		if ( $_SERVER[ 'REQUEST_METHOD' ] === 'POST' )
		{
			$request_data  = $_POST;
		}
		else if ( $_SERVER[ 'REQUEST_METHOD' ] === 'GET' )
		{
			$request_data  = $_GET;
		}
		else
		{
			throw new HttpException( 'Unsupport request method' );
		}
	}
	
	return array_get( $request_data, $key, $default );
}

function error_response( $msg, $code = 400, $http_msg = 'Bad Request' )
{
	header( "HTTP/1.1 $code $http_msg" );
	header( "Content-Type: application/json;charset=utf-8" );
	echo json_encode( [
		'error' => $msg,
	] );
	exit;
}

function render_template( $file, $vars = [] )
{
	ob_start();
	extract( $vars );
	include( $file );
	return ob_get_clean();
}

function handle_exceptions()
{
	$handler = function( $e )
	{
		$vars = [
			'title'   => get_class( $e ),
			'message' => $e->getMessage(),
			'trace'   => $e->getTraceAsString(),
		];
		echo render_template( 'crash.tpl.php', $vars );
	};
	set_exception_handler( $handler );
}

function bootstrap( $do_render = TRUE )
{
	handle_exceptions();

	$boot_vars    = [];
	fire_hook( 'preboot', $boot_vars );
	fire_hook( 'boot',    $boot_vars );

	if ( $do_render )
	{
		$theme_module  = user_config( 'theme_module' );
		$page_template = modules( "$theme_module.page_template" );
		if ( !$page_template )
		{
			throw new FatalConfigError( 'No template file for rendering the page' );
			exit;
		}
		else if ( !is_readable( $page_template ) )
		{
			throw new FatalConfigError( "Can't read page template file '$page_template'" );
			exit;			
		}
		
		// Render the page elements and allow modules to alter these renderings
		$renderings = get_renderings();
		fire_hook( 'alter_renderings', $renderings );
		
		$vars = [
			'show' => function( $key ) use ( $renderings )
			{
				echo isset( $renderings[ $key ] )
					? implode( '', $renderings[ $key ] )
					: NULL;
			},
			'has' => function( $key ) use ( $renderings )
			{
				return !empty( $renderings[ $key ] );
			},
		];
		return render_template( $page_template, $vars );
	}
}
