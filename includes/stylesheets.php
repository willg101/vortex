<?php

define( 'LESS_OUTPUT_DIR', 'css'  );

/**
 * @brief
 *	Generates the link tags for including each required CSS file (this DOES NOT include or consider
 *	LESS files)
 *
 * @retval string
 */
function build_css_requirements()
{
	$result = [];

	$included_external_assets = [];
	foreach ( modules()->get() as $module )
	{
		foreach ( $module[ 'settings' ][ 'external_dependencies' ][ 'css' ] as $css_file )
		{
			if ( empty( $included_external_assets[ $css_file ] ) )
			{
				array_unshift( $result, '<link rel="stylesheet" href="' . $css_file . '">' );
				$included_external_assets[ $css_file ] = TRUE;
			}
		}

		foreach ( $module[ 'css' ] as $css_file )
		{
			$result[] = '<link rel="stylesheet" href="' . base_path() . $css_file . '"/>';
		}
	}

	return implode( "\n\t\t", $result );
}

/**
 * @brief
 *	Generates the link tags for including each required LESS file (and additionally compiles all
 *	LESS files)
 *
 * @param array[out] $errors An indexed array of errors that occurred while compiling the LESS files
 *
 * @retval string
 */
function build_less_requirements( &$errors = [] )
{
	$result = [];

	foreach ( modules()->get() as $module_name => $module )
	{
		if ( count( $module[ 'less' ] ) )
		{
			foreach ( $module[ 'less' ] as $less_file )
			{
				// Get the input file's basename and strip off the extension
				$less_file_plain = without_file_extension( $less_file );
				$output          = compile_less( $less_file, $module_name, $errors );
				$result[]        = '<link rel="stylesheet" href="' . $output . '"/>';
			}
		}
	}

	return implode( "\n\t\t", $result );
}

/**
 * @brief
 *	Compiles a LESS file into a CSS file and saves the result to disk
 *
 * @param string     $input_file
 * @param string     $output_prefix
 * @param array[out] $errors
 */
function compile_less( $input_file, $output_prefix, array &$errors = [] )
{
	static $clear = TRUE;
	static $request_timestamp;
	if ( ! $request_timestamp )
	{
		$request_timestamp = time();
	}

	if ( $clear )
	{
		$contents = glob( LESS_OUTPUT_DIR . '/cached-*' );
		array_walk( $contents, function( $fn )
		{
			if ( is_file( $fn ) )
			{
				unlink( $fn );
			}
		} );
		$clear = FALSE;
	}

	$output_file = LESS_OUTPUT_DIR . "/cached-$output_prefix-$request_timestamp-"
		. without_file_extension( $input_file ) . '.css';

	$less = new Less_Parser();
	$less->ModifyVars( settings( 'less_variables' ) );
	try
	{
		$less->parseFile( $input_file );
		file_put_contents_safe( $output_file, $less->getCss() );
	}
	catch( Exception $e )
	{
		$errors[] = $e->getMessage();
		return '';
	}
	return $output_file;
}
