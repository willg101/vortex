<?php

/**
 * @brief
 *	Builds the script tags for the response
 *
 * @retval string
 */
function build_script_requirements()
{
	$result = [];

	// Include each "core"/"internal"/absolutely required JS file
	foreach ( settings( 'core_js', [] ) as $js_file )
	{
		$result[] = '<script src="' . $js_file . '"></script>';
	}

	// Include every JavaScript file from each module. Define a module_settings object and
	// send_api_request function specific to each module prior to including a module's scripts
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

	// Destroy send_api_request and module_settings
	$result[] = '<script>send_api_request = undefined;</script>';
	$result[] = '<script>module_settings  = undefined;</script>';

	return implode( "\n\t\t", $result );
}