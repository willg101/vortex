<?php

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
