<?php

function console_specify_windows( &$data )
{
	$data[ 'console' ] = [
		'debugger_main' => TRUE,
	];
}

function console_render_preprocess( &$data )
{
	if ( $data[ 'template' ] == 'debugger_main' )
	{
		$data[ 'implementations' ][ 'console' ][ 'weight' ] = 1;
	}
}

function console_provide_windows()
{
	return [
		[
			'title'     => 'Console',
			'id'        => 'console',
			'secondary' => FALSE,
			'icon'      => 'terminal',
			'content'   => render( 'console_window' ),
		],
	];
}
