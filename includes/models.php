<?php

use Dpoh\DataStorage;
use Dpoh\RequestHandlers;

define('SETTINGS_FILE', 'settings-global.ini');
define('MODULES_PATH', 'modules_enabled');

require_once 'DataStorage.class.php';
require_once 'RequestHandlers.class.php';

/**
 * @brief
 *	Looks up a module data value or returns the module data model
 *
 * @param string $key         (OPTIONAL)
 * @param string $default_val (OPTIONAL)
 *
 * @return mixed
 *	If $key is given, this acts as an alias to $modules_model->get(); otherwise this returns
 *	$modules_models
 */
function modules($key = null, $default_val = null)
{
    // Lazy load the modules model if necessary
    static $modules_model;
    if ($modules_model === null) {
        $modules_model = new DataStorage('modules', load_all_modules());
    }

    return $key !== null
        ? $modules_model->get($key, $default_val)
        : $modules_model;
}

/**
 * @brief
 *	Looks up a global settings data value or returns the global settings data model
 *
 * @param string $key         (OPTIONAL)
 * @param string $default_val (OPTIONAL)
 *
 * @return mixed
 *	If $key is given, this acts as an alias to $settings_model->get(); otherwise this returns
 *	$settings_model
 */
function settings($key = null, $default_val = null)
{
    // Lazy load the global setting model if necessary
    static $settings_model;
    if ($settings_model === null) {
        if (!is_readable(SETTINGS_FILE)) {
            $uid = posix_getuid();
            $info = $uid ? posix_getpwuid($uid) : [];
            $user_name = array_get($info, 'name');
            $user_name = $user_name ? "the user '$user_name'" : 'the current user';
            throw new FatalConfigError('The global settings file (' . SETTINGS_FILE . ') does '
                . "not exist or cannot be read by $user_name.");
        }
        $settings = parse_ini_file(SETTINGS_FILE) ?: [];
        $default_settings = [
            'allowed_directories' => [],
            'tree_root' => '/dev/null',
            'less_variables' => [
                'defaults' =>  "~'" . DPOH_ROOT . "/less/defaults'",
            ],
        ];

        $settings = array_merge($default_settings, $settings);
        $settings[ 'tree_root' ] = realpath($settings[ 'tree_root' ]);
        foreach ($settings[ 'allowed_directories' ] as &$dir) {
            $dir = realpath($dir);
        }

        $settings_model = new DataStorage('global_settings', $settings);
    }

    return $key !== null
        ? $settings_model->get($key, $default_val)
        : $settings_model;
}

/**
 * @return RequestHandlers
 */
function request_handlers()
{
    static $model;

    if ($model === null) {
        $model = new RequestHandlers;
    }

    return $model;
}
