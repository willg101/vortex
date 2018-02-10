<?php

define( 'JS_TEST_JASMINE_VERSION', '3.0.0' );
define( 'JS_TEST_PATH_TRIGGER', 'js-test' );

function js_test_boot()
{
	request_handlers()->register( JS_TEST_PATH_TRIGGER, 'js_test_run' );
}

function js_test_alter_js_options( &$data )
{
	if ( request_path() == JS_TEST_PATH_TRIGGER )
	{
		$data[ 'settings' ][ 'js_test_mode' ] = TRUE;
	}
}

function js_test_run()
{
	echo render( 'js_test_page', [ 'version' => JS_TEST_JASMINE_VERSION ] );
}
