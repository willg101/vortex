<?php /* dpoh: ignore */

define( 'LESS_INPUT_FILE',  'less/app.css.less'  );
define( 'LESS_OUTPUT_FILE', 'css/app-' . time() . '.css'  ); //time() for cachebusting

function compile_less( $input = LESS_INPUT_FILE, $output = LESS_OUTPUT_FILE )
{
	$dir = dirname( LESS_OUTPUT_FILE );
	$contents = glob( $dir . '/*' );
	array_walk( $contents, function( $fn )
	{
		if ( is_file( $fn ) )
		{
			unlink( $fn );
		}
	} );
	
	require "lib/lessphp/lessc.inc.php";

	$less = new lessc;
	$less->compileFile( $input, $output );
	return $output;
}