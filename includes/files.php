<?php

use Vortex\App;

/**
 * @brief
 *	Determines if the client can access the given file/directory based on the current config (this
 *	does NOT take into account OS privileges)
 *
 * @param string $path
 *
 * @return bool
 */
function client_can_access_path($path)
{
    // Resolve symlinks, '..', etc.
    $path = realpath($path) . '/';

    foreach (App::get('settings')->get('allowed_directories') as $allowed_dir) {
        // Prevent /a/b/cdef from matching the path /a/b/c
        if (strpos($path, $allowed_dir . '/') === 0) {
            return true;
        }
    }

    return false;
}

/**
 * @brief
 *	Determines if the user is allowed the view the given file. This takes into account:
 *		- The config regarding which paths AND file extensions the client can access
 *		- Whether the given file is *actually* a file (it exists and is not a directory)
 *
 * @param string $file_name
 *
 * @return bool
 */
function client_can_view_file($file_name)
{
    $file_name       = realpath($file_name);
    $file_name       = preg_replace('#^.*?://#', '', $file_name);
    $extension_regex = implode('|', array_map('preg_quote', App::get('settings')->get('allowed_extensions')));

    return client_can_access_path($file_name)
        && is_file($file_name)
        && (preg_match("/\.($extension_regex)$/", $file_name)
            || (in_array('', App::get('settings')->get('allowed_extensions'))
                && !preg_match('/^\./', basename($file_name))));
}

/**
 * @brief
 *	Recursively scans a directory for files with a given extension
 *
 * @param string $extenstion (OMIT the leading '.'; e.g., 'ini' for ini files, not '.ini')
 * @param string $dir
 * @param array  $dirs_seen       OPTIONAL. Should only be passed when calling this function
 *                                recursively
 *
 * @return array
 *	An array where each element is the absolute path of a file within $dir with the
 *	extension $extension
 */
function recursive_file_scan($extension, $dir, &$dirs_seen = [])
{
    // Account for symlink cycles
    $dir = realpath($dir);
    if (isset($dirs_seen[ $dir ])) {
        return [];
    } else {
        $dirs_seen[ $dir ] = true;
    }

    $result            = [];
    $extension_escaped = preg_quote($extension, '/');

    foreach (glob("$dir/*") as $item) {
        if (is_dir($item)) {
            $result = array_merge($result, recursive_file_scan($extension, $item, $dirs_seen));
        } else {
            if (preg_match("/\.$extension_escaped$/", $item)) {
                $result[] = $item;
            }
        }
    }
    return $result;
}

/**
 * @brief
 *	Converts a path to a filename stripped of its extension
 */
function without_file_extension($path)
{
    return preg_replace('/\..*$/', '', basename($path));
}
