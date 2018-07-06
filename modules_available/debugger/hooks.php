<?php

function debugger_provide_windows()
{
	return [
		[
			'title'     => 'Console',
			'id'        => 'console',
			'secondary' => FALSE,
			'icon'      => 'terminal',
			'content'   => render( 'console_window' ),
		],
		[
			'title'     => 'Code',
			'id'        => 'code',
			'secondary' => '<span id="filename"></span>',
			'icon'      => 'code',
			'content'   => render( 'code_window' ),
		],
		[
			'title'     => 'Context',
			'id'        => 'context',
			'secondary' => '<span class="status-indicator"><i class="fa fa-microchip"></i> <span id="mem_usage"></span></span>',
			'icon'      => 'sitemap',
			'content'   => render( 'context_window' ),
		],
		[
			'title'     => 'Watch',
			'id'        => 'watch',
			'secondary' => '',
			'icon'      => 'binoculars',
			'content'   => render( 'watch_window' ),
		],
		[
			'title'     => 'Stack',
			'id'        => 'stack',
			'secondary' => '<span class="status-indicator"><i class="fa fa-sort-amount-desc"></i> <span id="stack_depth"></span></span>',
			'icon'      => 'sort-amount-desc',
			'content'   => render( 'stack_window' ),
		],
	];
}
