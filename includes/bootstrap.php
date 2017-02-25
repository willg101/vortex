<?php

/**
 * @brief
 *	The core of the PHP side of DPOH; boots up all modules, loads config and settings information,
 *	and then optionally renders a response
 *
 * @note During the lifecycle of a request, the following standard hooks are fired (see fire_hook
 *	for more information):
 *	- preboot: Alter modules, user config, and settings data (MUCS). Because modules can be disabled
 *		at this step, and MUCS can (and should, if necessary) be altered at this stage, it's
 *		recommended to keep your logic at this step to a minimum (i.e., don't make decisions based
 *		on MUCS at this stage)
 *	- boot: Perform initialization tasks. So that other modules can safely make decisions based on
 *		MUCS, avoid altering MUCS at or after this stage.
 *
 * @param bool $do_render (OPTIONAL) When TRUE, renders a response based on the current theme
 *	module's page
 *
 * @throws FatalConfigError
 *
 * @retval string|NULL
 */
function bootstrap( $do_render = TRUE )
{
	$boot_vars = [ 'do_render' => &$do_render ];
	fire_hook( 'preboot', $boot_vars );
	fire_hook( 'boot',    $boot_vars, TRUE );

	if ( $do_render )
	{
		$theme_module  = user_config( 'theme_module' );
		$page_template = modules( "$theme_module.page_template" );
		if ( !$page_template )
		{
			throw new FatalConfigError( "No template file in '$theme_module' module for rendering the page" );
			exit;
		}
		else if ( !is_readable( $page_template ) )
		{
			throw new FatalConfigError( "Can't read page template file '$page_template'" );
			exit;
		}

		// Render the page elements and allow modules to alter these renderings
		$renderings = get_renderings();
		fire_hook( 'alter_renderings', $renderings );

		$vars = [
			'show' => function( $key ) use ( $renderings )
			{
				echo isset( $renderings[ $key ] )
					? implode( '', $renderings[ $key ] )
					: NULL;
			},
			'has' => function( $key ) use ( $renderings )
			{
				return !empty( $renderings[ $key ] );
			},
		];
		return render_template( $page_template, $vars );
	}
}

/**
 * @brief
 *	Fires a hook on all modules that implement the given hook
 *
 * @note To implement a hook 'my_hook', a module 'my_module' must define a 'hooks.php' which
 *	contains the definition for a function named my_module_my_hook. All hook implementations are
 *	passed a single array of data that can optionally be altered by the hook implementation. Whether
 *	or not altering the data actually has an effect depends on the caller of the hook.
 *
 * @param string         $hook_name (preferably snake_case)
 * @param array[in,out]  $data
 * @param bool           $reload OPTIONAL. Default is FALSE. Forces the function to clear its cache
 *	of available modules. This should be used after disabling a module.
 */
function fire_hook( $hook_name, array &$data = [], $reload = FALSE )
{
	static $hook_modules;
	if ( $reload || $hook_modules === NULL )
	{
		$hook_modules = [];
		foreach ( modules()->get() as $module_name => $module )
		{
			if ( $module[ 'hook_implementations' ] )
			{
				$hook_modules[] = $module_name;
				require_once( $module[ 'hook_implementations' ] );
			}
		}
	}

	$results = [];
	foreach ( $hook_modules as $module_name )
	{
		$function_name = $module_name . '_' . $hook_name;
		if ( function_exists( $function_name ) )
		{
			$current_result = $function_name( $data );
			if ( $current_result !== NULL )
			{
				$results[ $module_name ] = $current_result;
			}
		}
	}
	return $results;
}
