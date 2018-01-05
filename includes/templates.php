<?php

/**
 * @brief
 *	Renders a template (i.e., a .tpl.php file) using the given context ($vars)
 *
 * @param string $template_file
 * @param array  $vars          (OPTIONAL)
 */
function render_template( $template_file, $vars = [] )
{
	if ( empty( $vars[ 'has' ] ) )
	{
		$vars[ 'has' ] = function( $name )
		{
			return !!get_template_implementations( $name );
		};
	}
	if ( empty( $vars[ 'show' ] ) )
	{
		$vars[ 'show' ] = function( $name )
		{
			echo render( $name );
		};
	}

	ob_start();
	extract( $vars );
	include( $template_file );
	return ob_get_clean();
}

function render( $name, $vars = [] )
{
	$implementations = get_template_implementations( $name );
	$data = [
		'template'        => $name,
		'vars'            => &$vars,
		'implementations' => $implementations,
	];

	fire_hook( 'render_preprocess', $data );
	fire_hook( 'render_process',    $data );
	usort( $data[ 'implementations' ], function( $a, $b )
	{
		return $a[ 'weight' ] - $b[ 'weight' ];
	} );

	$html = '';
	foreach ( $data[ 'implementations' ] as $module_name => $implementation )
	{
		$postprocess = [
			'rendered' => render_template( $implementation[ 'file' ], $vars ),
			'vars'     => $vars,
			'template' => $name,
			'module'   => $module_name,
		];
		fire_hook( 'render_postprocess', $postprocess );
		$html .= $postprocess[ 'rendered' ];
	}
	return $html;
}

function get_template_implementations( $template_name, $use_cache = TRUE )
{
	static $cache;
	if ( $cache === NULL || !$use_cache )
	{
		foreach ( modules()->get() as $module_name => $module )
		{
			foreach ( $module[ 'templates' ] as $file )
			{
				$key = without_file_extension( $file );
				if ( !isset( $cache[ $key ] ) )
				{
					$cache[ $key ] = [];
				}
				$cache[ $key ][ $module_name ] = [
					'file'   => $file,
					'weight' => 0,
				];
			}
		}
	}

	return array_get( $cache, $template_name, [] );
}
