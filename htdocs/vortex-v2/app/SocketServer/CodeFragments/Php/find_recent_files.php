<?php

function($max_files, $codebase_root, $excluded_dirs){
    $most_recently_edited    = [];
    $check_if_recently_edited = function($file) use (&$most_recently_edited, $max_files) {
        $mtime = filemtime($file);
        if (count($most_recently_edited) < $max_files || $most_recently_edited[$max_files - 1]['mtime'] < $mtime) {
            if (count($most_recently_edited) === 0) {
                $most_recently_edited[] = ['file' => $file, 'mtime' => $mtime];
            } else {
                for ($i = 0; $i < count($most_recently_edited); $i++) {
                    if ($most_recently_edited[$i]['mtime'] < $mtime) {
                        array_splice($most_recently_edited, $i, 0, [['file' => $file, 'mtime' => $mtime]]);
                        break;
                    }
                }
                if (count($most_recently_edited) > $max_files) {
                    array_pop($most_recently_edited);
                }
            }
        }
    };
    $scan = function($codebase_root, $excluded_dirs, $excluded_dirs_prefix = null) use (&$scan, $check_if_recently_edited) {
        $excluded_dirs_prefix = $excluded_dirs_prefix ?? $codebase_root;
        $subdirs = [];
        if ($dir = opendir($codebase_root)) {
            while (false !== ($item = readdir($dir))) {
                $item_abs_path = "$codebase_root/$item";
                if ($item == '.' || $item == '..' || is_link($item_abs_path)) {
                    continue;
                } else {
                    $item_abs_path = realpath($item_abs_path);
                    if (is_dir($item_abs_path)) {
                        foreach ($excluded_dirs as $exluded_dir) {
                            if (realpath("$excluded_dirs_prefix/$exluded_dir") == $item_abs_path) {
                                continue 2;
                            }
                        }
                        $subdirs[] = $item_abs_path;
                    }
                    elseif (preg_match('/\.(inc|php|module)$/', $item_abs_path)) {
                        $check_if_recently_edited($item_abs_path);
                    }
                }
            }
        }
        foreach ($subdirs as $subdir) {
            $scan($subdir, $excluded_dirs, $excluded_dirs_prefix);
        }
    };
    $scan($codebase_root, $excluded_dirs);
    return $most_recently_edited;
};
