<?php

use Dpoh\DataStorage;
use Dpoh\RequestHandlers;

define('SETTINGS_FILE', 'settings-global.ini');
define('MODULES_PATH', 'modules_enabled');

require_once 'DataStorage.class.php';
require_once 'RequestHandlers.class.php';

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
