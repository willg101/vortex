<?php

function code_inspector_provide_windows()
{
	return [
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
			'title'     => 'Stack',
			'id'        => 'stack',
			'secondary' => '<span class="status-indicator"><i class="fa fa-sort-amount-desc"></i> <span id="stack_depth"></span></span>',
			'icon'      => 'sort-amount-desc',
			'content'   => render( 'stack_window' ),
		],
	];
}
