<?php namespace Vortex\Testing;

use Symfony\Component\HttpFoundation\Request;
use Vortex\App;
use Vortex\SendAndTerminateException;

trait TestsRequests {
    protected $most_recent_request;
    protected $most_recent_response;

    public function sendRequest(...$args) {
        if (!defined('DPOH_ROOT')) define('DPOH_ROOT', __FILE__ . '/ll/../../');
        if (!defined('IS_AJAX_REQUEST')) define('IS_AJAX_REQUEST', false);
        require_once DPOH_ROOT . '/includes/bootstrap.php';
        require_once DPOH_ROOT . '/includes/database.php';
        require_once DPOH_ROOT . '/includes/templates.php';
        require_once DPOH_ROOT . '/includes/stylesheets.php';
        require_once DPOH_ROOT . '/includes/http.php';
        require_once DPOH_ROOT . '/includes/javascript.php';

        $request = Request::create(...$args);
        $app = new App(DPOH_ROOT . '/modules_enabled', DPOH_ROOT . '/settings-global.ini', $request);
        App::setInstance($app);
        try {
            bootstrap($app);
        } catch (SendAndTerminateException $e) {
            $this->assertSame($e->response, $app->response);
        }
        $this->most_recent_request  = $app->request;
        $this->most_recent_response = $app->response;
    }

    public function assertStatusCode($code, $msg = '') {
        $this->assertEquals($code, $this->most_recent_response->getStatusCode(), $msg);
    }

    public function assertResponseContains($str, $msg = '') {
        $this->assertContains($str, $this->most_recent_response->getContent(), $msg);
    }
}
