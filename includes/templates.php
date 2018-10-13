<?php

/**
 * @brief
 *	Process and inject variables into all implementations of a template, and render each
 *	implementation
 *
 * An implementation of a template is any *.tpl.php file under a module's templates/ directory. An
 * implementation's name is its file name, excluding the extension. For example, foo.tpl.php is an
 * implementation of the `foo` template.
 *
 * Modules can alter template variables before they are injected by implementing
 * hook_render_preprocess and/or hook_render_process, which are identical hooks, but allow
 * processing to be ordered in a before/after manner. These hooks are passed an array like
 * @code
 * [
 * 	'template' => 'foo',
 * 	'vars'     => [ // ALTERABLE
 * 		'bar' => 2,
 * 		'baz => [ 1, 2, 3 ],
 * 	],
 * 	'implementations' => [ // ALTERABLE
 * 		'bar' => [
 * 			'file'   => 'modules/bar/templates/foo.tpl.php',
 * 			'weight' => 0
 * 		],
 * 	],
 * ]
 * @endcode
 *
 * To modify the rendered version of individual template implementations, use
 * hook_render_postprocess, which is passed an array like
 * @code
 * [
 * 	'rendered' => '<h1>Hello, foo 1...2...3</h1>', // ALTERABLE
 * 	'vars'     => [
 * 		'bar' => 2,
 * 		'baz => [ 1, 2, 3 ],
 * 	],
 * 	'template' => 'foo',
 * 	'module'   => 'bar',
 * ]
 * @endcode
 *
 * @param string $name
 * @param array  $vars OPTIONAL
 *
 * @return string
 */
function render($name, $vars = [])
{
    $data = [
        'template'        => $name,
        'vars'            => &$vars,
        'implementations' => get_template_implementations($name),
    ];

    fire_hook('render_preprocess', $data);
    fire_hook('render_process', $data);
    usort($data[ 'implementations' ], function ($a, $b) {
        return $a[ 'weight' ] - $b[ 'weight' ];
    });

    $html = '';
    foreach ($data[ 'implementations' ] as $module_name => $implementation) {
        $postprocess = [
            'rendered' => render_template($implementation[ 'file' ], $vars),
            'vars'     => $vars,
            'template' => $name,
            'module'   => $module_name,
        ];
        fire_hook('render_postprocess', $postprocess);
        $html .= $postprocess[ 'rendered' ];
    }
    return $html;
}

/**
 * @brief
 *	Renders a specific template file (i.e., a .tpl.php file), injecting the variables contained in
 *	the array $vars
 *
 * @note This is a low-level function used by `render()`. In most cases, you should use `render()`,
 * not this method.
 *
 * @param string $template_file
 * @param array  $vars          (OPTIONAL)
 *
 * @return string
 */
function render_template($template_file, $vars = [])
{
    if (empty($vars[ 'has' ])) {
        $vars[ 'has' ] = function ($name) {
            return !!get_template_implementations($name);
        };
    }
    if (empty($vars[ 'show' ])) {
        $vars[ 'show' ] = function ($name) {
            echo render($name);
        };
    }

    ob_start();
    extract($vars);
    include($template_file);
    return ob_get_clean();
}

/**
 * @param string $template_name
 * @param bool   $use_cache     OPTIONAL. Default is FALSE
 *
 * @return array
 */
function get_template_implementations($template_name, $use_cache = true)
{
    static $cache;
    if ($cache === null || !$use_cache) {
        foreach (modules()->get() as $module_name => $module) {
            foreach ($module[ 'templates' ] as $file) {
                $key = without_file_extension($file);
                if (!isset($cache[ $key ])) {
                    $cache[ $key ] = [];
                }
                $cache[ $key ][ $module_name ] = [
                    'file'   => $file,
                    'weight' => 0,
                ];
            }
        }
    }

    return array_get($cache, $template_name, []);
}
