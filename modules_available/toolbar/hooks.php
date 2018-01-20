<?php

function toolbar_render_preprocess( &$data )
{
	if ( $data[ 'template' ] == 'toolbar_right' )
	{
		$data[ 'implementations' ][ 'toolbar' ][ 'weight' ] = 10;
	}

	$reordered = [
		'toolbar' => $data[ 'implementations' ][ 'toolbar' ],
	];
	$reordered = array_merge( $reordered, $data[ 'implementations' ] );
	$data[ 'implementations' ] = $reordered;
}
