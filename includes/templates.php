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
	ob_start();
	extract( $vars );
	include( $template_file );
	return ob_get_clean();
}

/**
 * @brief
 *	Renders all templates from all modules
 *
 * @retval array
 *	@code
 *	[
 *		'template_name_1' => [
 *			'module_1' => 'rendered_template',
 *			'module_2' => 'rendered_template',
 *		],
 *		'template_name_2' => [
 *			'module_3' => 'rendered_template',
 *		],
 *	]
 *	@endcode
 */
function get_renderings()
{
	$renderings = [];

	foreach ( modules()->get() as $module_name => $module )
	{
		foreach ( $module[ 'templates' ] as $template_name )
		{
			if ( !isset( $renderings[ $template_name ] ) )
			{
				$renderings[ $template_name ] = [];
			}
			$key = without_file_extension( $template_name );
			$renderings[ $key ][ $module_name ] = render_template( $template_name );
		}
	}

	return $renderings;
}
