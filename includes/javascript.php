<?php

use Vortex\App;

/**
 * @brief
 *	Builds the script tags for the response
 *
 * @return string
 */
function build_script_requirements()
{
    $options = [
        'settings' => [
            'base_path' => base_path(),
        ],
        'templates' => load_handlebar_templates()
    ];
    App::fireHook('alter_js_options', $options);
    $result = [
        '<script>Dpoh = ' . json_encode($options) . ';</script>'
    ];

    // Include each "core"/"internal"/absolutely required JS file
    foreach (App::get('settings')->get('core_js', []) as $js_file) {
        $result[] = '<script src="' . $js_file . '"></script>';
    }

    $included_external_assets = [];
    foreach (App::get('modules')->get() as $module_name => $module) {
        foreach ($module[ 'settings' ][ 'external_js' ] as $js_file) {
            if (empty($included_external_assets[ $js_file ])) {
                $result[] = '<script src="' . process_asset_path($js_file) . '"></script>';
                $included_external_assets[ $js_file ] = true;
            }
        }

        foreach ($module[ 'js' ] as $js_file) {
            $is_module = strpos($js_file, '.module.js') !== false ? 'type="module"' : '';
            $result[] = '<script ' . $is_module . ' src="' . process_asset_path($js_file) . '"></script>';
        }
    }

    return implode("\n\t\t", $result);
}

function process_asset_path($file_name) {
    if (strpos($file_name, DPOH_ROOT) === 0) {
        $file_name = substr($file_name, mb_strlen(DPOH_ROOT));
        $file_name = base_path() . $file_name;
        $file_name = preg_replace('#^/+#', '/', $file_name);
    }
    return $file_name;
}

/**
 * @return array
 */
function load_handlebar_templates()
{
    static $templates;

    $filename_to_key = function ($filename) {
        $filename = preg_replace('#/{2,}#', '/', $filename);
        $vortex_root = preg_quote(DPOH_ROOT, '#');
        $filename = preg_replace("#(^${vortex_root}/modules_[^/]+/+[^/]+/+|hbs/|\.hbs$)#", '', $filename);
        return preg_replace('#/+#', '.', $filename);
    };

    if ($templates === null) {
        foreach (App::get('modules')->get() as $module_name => $module) {
            foreach ($module[ 'hbs' ] as $file) {
                $key = $module_name . '.' . $filename_to_key($file);
                $templates[ $key ] = file_get_contents($file);
            }
        }
    }

    return $templates;
}
