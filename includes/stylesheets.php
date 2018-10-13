<?php

/**
 * @brief
 *	Generates the link tags for including each required CSS file (this DOES NOT include or consider
 *	LESS files)
 *
 * @return string
 */
function build_css_requirements()
{
    $result = [];

    $included_external_assets = [];
    foreach (modules()->get() as $module) {
        foreach ($module[ 'settings' ][ 'external_css' ] as $css_file) {
            if (empty($included_external_assets[ $css_file ])) {
                array_unshift($result, '<link rel="stylesheet" href="' . $css_file . '">');
                $included_external_assets[ $css_file ] = true;
            }
        }

        foreach ($module[ 'css' ] as $css_file) {
            $result[] = '<link rel="stylesheet" href="' . base_path() . $css_file . '"/>';
        }
    }

    return implode("\n\t\t", $result);
}

/**
 * @brief
 *	Generates the link tags for including each required LESS file (and additionally compiles all
 *	LESS files)
 *
 * @return string
 */
function build_less_requirements()
{
    $result = [];

    foreach (modules()->get() as $module_name => $module) {
        if (count($module[ 'less' ])) {
            foreach ($module[ 'less' ] as $less_file) {
                // Get the input file's basename and strip off the extension
                $less_file_plain = without_file_extension($less_file);
                $output          = compile_less($less_file, $module_name);
                $result[]        = '<link rel="stylesheet" href="' . $output . '"/>';
            }
        }
    }

    return implode("\n\t\t", $result);
}

/**
 * @brief
 *	Compiles a LESS file into a CSS file and saves the result to disk
 *
 * @param string $input_file
 * @param string $output_prefix
 */
function compile_less($input_file, $output_prefix)
{
    static $clear = true;
    static $request_timestamp;
    if (! $request_timestamp) {
        $request_timestamp = time();
    }

    $less_output_dir = settings('less_output_dir');

    if ($clear) {
        $contents = glob($less_output_dir . '/cached-*');
        array_walk($contents, function ($fn) {
            if (is_file($fn)) {
                unlink($fn);
            }
        });
        $clear = false;
    }

    $output_file = $less_output_dir . "/cached-$output_prefix-$request_timestamp-"
        . without_file_extension($input_file) . '.css';

    $less = new Less_Parser();
    $less->ModifyVars(settings('less_variables'));
    $less->parseFile($input_file);
    file_put_contents_safe($output_file, $less->getCss());
    return $output_file;
}
