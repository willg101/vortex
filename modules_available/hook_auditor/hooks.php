<?php

/**
 * @param string $function_name
 * @param array  $hook_data
 * @param array  $trace
 */
function hook_auditor_create_record($function_name, array $hook_data, array $trace) {
    // Prepare data for insertion into db
    $hook_name = substr($function_name, strlen('hook_auditor_'));
    $hook_data = array_map(function($el) {
        return gettype($el);
    }, $hook_data);
    $trace = array_map(function($frame) {
        return [
            'function' => ($frame['class'] ? $frame['class'] . $frame['type'] : '') . $frame['function'],
            'line'     => trim(str_replace(DPOH_ROOT, '', $frame['line']), '/'),
            'file'     => $frame['file'],
         ];
    }, $trace);
    $hook_data = json_encode($hook_data);
    $trace     = json_encode($trace);

    static $has_created_table = false;
    if (!$has_created_table) {
        hook_auditor_create_db_table();
        $has_created_table = true;
    }

    // Insert the data into the db only if an identical record does not already exist
    $existing_record = db_query("
        SELECT 1
        FROM hook_audit_records
        WHERE hook_name = :hook_name
            AND hook_data = :hook_data
            AND trace = :trace",
        [
            ':hook_name' => $hook_name,
            ':hook_data' => $hook_data,
            ':trace'     => $trace
        ]);
    if (!$existing_record) {
        db_query("
            INSERT INTO hook_audit_records (hook_name, hook_data, trace)
            VALUES (:hook_name, :hook_data, :trace)",
            [
                ':hook_name' => $hook_name,
                ':hook_data' => $hook_data,
                ':trace'     => $trace,
            ]);
    }
}

/**
 * @param bool $clear OPTIONAL; default is true. When true, removes each record from the db that
 *                    this function returns
 *
 * @return array
 */
function hook_auditor_list_all_records($clear = true) {
    static $has_created_table = false;
    if (!$has_created_table) {
        hook_auditor_create_db_table();
        $has_created_table = true;
    }

    $all_records = db_query('SELECT * FROM hook_audit_records');
    foreach ($all_records as &$record) {
        $record['hook_data'] = json_decode($record['hook_data'], true);
        $record['trace']     = json_decode($record['trace'], true);

        if ($clear) {
            db_query('DELETE FROM hook_audit_records WHERE id = :id', [ ':id' => $record['id'] ]);
        }
    }

    return $all_records;
}

/**
 * @brief
 *  Search for all defined hooks
 *
 * @return array
 *  An indexed array of hook names
 */
function hook_auditor_list_all_hooks() {
    // Use grep to find all statements that look like a hook definition (false positives are OK)
    $output = '';
    $modules_path  = escapeshellarg(__DIR__ . '/../../modules_available');
    $includes_path = escapeshellarg(__DIR__ . '/../../includes');
    exec("grep -rl $'\(app->\|App::\|\[\(.\)app\\2\]->\)fireHook' $modules_path $includes_path", $output);

    // Process the output from grep
    $all_hooks = [];
    foreach ($output as $line) {
        $all_hooks = array_merge($all_hooks, hook_auditor_find_hooks_in_file($line));
    }

    return array_unique($all_hooks);
}

/**
 * @brief
 *  Find all hook definitions within a file
 *
 * @param string $file
 *
 * @return array
 */
function hook_auditor_find_hooks_in_file($file) {
    // Note: This function may produce false positives. That's OK -- it just means unused functions
    // will be dynamically defined later in this file. While not ideal, it's an acceptable tradeoff
    // in terms of simplicity, especially since this module is targeted at development of Vortex.

    $file_contents = file_get_contents($file);
    $matches       = [];
    return preg_match_all('/fireHook\s*\(\s*([\'"])([a-zA-Z0-9_][a-zA-Z0-9_]*)\1/', $file_contents, $matches)
        ? $matches[2]
        : [];
}

/**
 * @brief
 *  Implements hook_provide_windows
 */
function hook_auditor_provide_windows($data) {
    hook_auditor_create_record(__FUNCTION__, $data, debug_backtrace());

    return [
        [
            'title'     => 'Hook Auditor',
            'id'        => 'hook_auditor',
            'secondary' => false,
            'icon'      => 'heartbeat',
            'content'   => render('hook_auditor_window'),
        ],
    ];
}

/**
 * @brief
 *  Creates a table in the db for storing hook audit records
 *
 * @note
 *  It's OK to call this function when the table already exists.
 */
function hook_auditor_create_db_table() {
    db_query("
        CREATE TABLE IF NOT EXISTS hook_audit_records (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            hook_name TEXT,
            hook_data TEXT,
            trace     TEXT
        );
    ");
}

// ################################################################################################
// ## Dynamically generate hook implementations of all detected hooks
// ################################################################################################
foreach (hook_auditor_list_all_hooks() as $hook) {
    $function_name = "hook_auditor_$hook";
    eval("
        if (!function_exists('$function_name')) {
            function $function_name(\$data) {
                hook_auditor_create_record(__FUNCTION__, \$data, debug_backtrace());
            }
        }");
}
