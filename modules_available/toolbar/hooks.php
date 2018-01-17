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
