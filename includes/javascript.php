<?php

/**
 * @brief
 *	Builds the script tags for the response
 *
 * @retval string
 */
function build_script_requirements()
{
	$options = [
		'settings' => [
			'base_path' => base_path(),
		],
		'templates' => load_handlebar_templates()
	];
	fire_hook( 'alter_js_options', $options );
	$result = [
		'<script>Dpoh = ' . json_encode( $options ) . ';</script>'
	];

	// Include each "core"/"internal"/absolutely required JS file
	foreach ( settings( 'core_js', [] ) as $js_file )
	{
		$result[] = '<script src="' . $js_file . '"></script>';
	}

	$included_external_assets = [];
	foreach ( modules()->get() as $module_name => $module )
	{
		foreach ( $module[ 'settings' ][ 'external_js' ] as $js_file )
		{
			if ( empty( $included_external_assets[ $js_file ] ) )
			{
				$result[] = '<script src="' . $js_file . '"></script>';
				$included_external_assets[ $js_file ] = TRUE;
			}
		}

		foreach ( $module[ 'js' ] as $js_file )
		{
			$is_module = strpos( $js_file, '.module.js' ) !== FALSE ? 'type="module"' : '';
			$result[] = '<script ' . $is_module . ' src="' . base_path() . $js_file . '"></script>';
		}
	}

	return implode( "\n\t\t", $result );
}

/**
 * @retval array
 */
function load_handlebar_templates()
{
	static $templates;

	$filename_to_key = function( $filename )
	{
		$filename = preg_replace( '#/{2,}#', '/', $filename );
		$filename = preg_replace( "#(^modules_enabled/ [^/]+? / | hbs/ | \.hbs$)#x", '', $filename );
		return str_replace( '/', '.', $filename );
	};

	if ( $templates === NULL )
	{
		foreach ( modules()->get() as $module_name => $module )
		{
			foreach ( $module[ 'hbs' ] as $file )
			{
				$key = $module_name . '.' . $filename_to_key( $file );
				$templates[ $key ] = file_get_contents( $file );
			}
		}
	}

	return $templates;
}
