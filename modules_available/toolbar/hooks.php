<?php

function toolbar_render_preprocess( &$data )
{
	if ( $data[ 'template' ] == 'toolbar_right' )
	{
		$data[ 'implementations' ][ 'toolbar' ][ 'weight' ] = 10;
	}
}
