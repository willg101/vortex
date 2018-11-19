<?php

define('JS_TEST_JASMINE_VERSION', '3.0.0');
define('JS_TEST_PATH_TRIGGER', 'js-test');

function js_test_boot($vars)
{
    $vars['request_handlers']->register(JS_TEST_PATH_TRIGGER, 'js_test_run');
}

function js_test_run()
{
    function js_test_alter_js_options(&$data)
    {
        $data[ 'settings' ][ 'js_test_mode' ] = true;
    }

    echo render('js_test_page', [ 'version' => JS_TEST_JASMINE_VERSION ]);
}
