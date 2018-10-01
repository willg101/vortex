<?php /* dpoh: ignore */

define( 'DPOH_ROOT', __DIR__ );
define( 'IS_AJAX_REQUEST', !empty( $_SERVER['HTTP_X_REQUESTED_WITH'] ) );

require_once 'vendor/autoload.php';
$whoops = new Whoops\Run;
$whoops->pushHandler( IS_AJAX_REQUEST
	? new Whoops\Handler\JsonResponseHandler
	: new Whoops\Handler\PrettyPageHandler );
$whoops->register();

require_once 'includes/arrays.php';
require_once 'includes/autoloader.php';
require_once 'includes/bootstrap.php';
require_once 'includes/database.php';
require_once 'includes/exceptions.php';
require_once 'includes/files.php';
require_once 'includes/html.php';
require_once 'includes/http.php';
require_once 'includes/javascript.php';
require_once 'includes/models.php';
require_once 'includes/security.php';
require_once 'includes/stylesheets.php';
require_once 'includes/templates.php';

bootstrap();
