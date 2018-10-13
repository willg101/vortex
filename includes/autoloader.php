<?php

/**
 * @brief
 *	An spl class autoloader for Vortex modules.
 *
 *	For a module's classes to be properly autoloaded, the module MUST contain a 'classes'
 *	directory, and the directory structure under 'classes/' MUST mimic the class namespaces, for
 *	example:
 *	modules_available/foo/classes/
 *	                              Bar/Baz.php  -> Contains the class Bar\Baz
 *	                              Fuzz/Baz.php -> Contains the class Fuzz\Baz
 *
 * @param string $class_to_load
 */
function vortex_autoloader($class_to_load)
{
    static $classes_from_modules; // Maps fully-qualified class names to .php file names
    if (!isset($classes_from_modules)) {
        foreach (modules()->get() as $module_name => $module) {
            foreach ($module[ 'classes' ] as $class_file) {
                // Transform 'modules_enabled/foo/classes/Bar/Baz.php' into 'Bar/Baz'
                $class_name = preg_replace('#(^.*?/+classes/+|\.[^/]+$)#', '', $class_file);

                $class_name = str_replace('/', '\\', $class_name);
                $classes_from_modules[ $class_name ] = $class_file;
            }
        }
    }

    if (!empty($classes_from_modules[ $class_to_load ])) {
        require_once $classes_from_modules[ $class_to_load ];
    }
}
