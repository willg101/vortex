<?php

use Monolog\Logger;
use Monolog\Handler\StreamHandler;
use \Monolog\Handler\ErrorLogHandler;

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
 * @throws FatalConfigError
 *
 * @return string|NULL
 */
function bootstrap()
{
    date_default_timezone_set(settings('timezone'));
    $boot_vars = [];
    fire_hook('preboot', $boot_vars);
    fire_hook('boot', $boot_vars, true);

    if (!request_handlers()->handle()) {
        throw new HttpException("Page not found: " . request_path(), [ 'HTTP/1.1 404 Not found' ]);
    }
}

/**
 * @brief
 *	Lazy-initializes the logger for this request/execution, allowing complete override of the
 *	default logging mechanism via hook_init_logger(), and then returns a monolog
 *	(or monolog-compatible) logger instance
 *
 * @return Monolog\Logger
 */
function logger()
{
    static $logger;

    if (!$logger) {
        $handler = null;
        $label   = '';
        $log_level = settings('log_level');
        $log_level = constant(Logger::class . "::$log_level");
        if (php_sapi_name() == 'cli') {
            $label   = 'cli';
            $handler = new ErrorLogHandler(ErrorLogHandler::OPERATING_SYSTEM, $log_level);
        } else {
            $label   = 'http';
            $handler = new StreamHandler(__DIR__ . "/../logs/http.log", $log_level);
        }

        $data = [
            'logger'  => null,
            'label'   => $label,
            'handler' => $handler,
        ];
        fire_hook('init_logger', $data);

        if (!$data[ 'logger' ]) {
            $logger = new Logger("Vortex Logger ($data[label])");
            $logger->pushHandler($handler);
        } else {
            $logger = $data[ 'logger' ];
        }
    }

    return $logger;
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
function fire_hook($hook_name, array &$data = [], $reload = false)
{
    static $hook_modules;
    if ($reload || $hook_modules === null) {
        $hook_modules = [];
        foreach (modules()->get() as $module_name => $module) {
            if ($module[ 'hook_implementations' ]) {
                $hook_modules[] = $module_name;
                require_once($module[ 'hook_implementations' ]);
            }
        }
    }

    $results = [];
    foreach ($hook_modules as $module_name) {
        $function_name = $module_name . '_' . $hook_name;
        if (function_exists($function_name)) {
            $current_result = $function_name($data);
            if ($current_result !== null) {
                $results[ $module_name ] = $current_result;
            }
        }
    }
    return $results;
}
