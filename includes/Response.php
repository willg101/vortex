<?php
namespace Vortex;

use BadMethodCallException;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class Response {
    /**
     * @var Symfony\Component\HttpFoundation\Response
     */
    private $symfony_response;

    public function __construct(SymfonyResponse $response = NULL) {
        $this->symfony_response = $response
            ?: new SymfonyResponse('', SymfonyResponse::HTTP_OK, ['content-type' => 'text/html']);
    }

    public function setContent($content) {
        if (is_string($content) || is_numeric($content))
        {
            $this->symfony_response->setContent($content);
        } else {
            $this->symfony_response->setContent(json_encode($content));
            $this->symfony_response->headers->set('Content-Type', 'application/json');
        }
        return $this;
    }

    public function sendAndTerminate() {
        $this->symfony_response->send();
        exit;
    }

    public function getSymfonyResponse() {
        return $this->symfony_response;
    }

    public function __call($method, $args) {
        if (is_callable([$this->symfony_response, $method])) {
            $rval = $this->symfony_response->$method(...$args);
            return $rval === null || $rval == $this->symfony_response ? $this : $rval;
        } else {
            throw new BadMethodCallException("Call to undefined method '" . SymfonyResponse::class . "::$method'");
        }
    }

    public function __get($key) {
        return $this->symfony_response->$key;
    }
}
