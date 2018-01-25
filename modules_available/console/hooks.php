<?php

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
