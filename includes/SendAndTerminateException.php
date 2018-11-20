<?php namespace Vortex;

use Exception;

class SendAndTerminateException extends Exception {

    public $response;

    public function __construct(Response $response, $code = 0, $previous = null) {
        $this->response = $response;
        parent::__construct("A request is ready to be sent, followed immediately by terminating "
            . "Vortex. Seeing this come up in an Exception handler is an indication that Vortex "
            . "is malfunctioning.", $code, $previous);
    }
}
