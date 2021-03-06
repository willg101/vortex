<?php namespace Vortex\Exceptions;

use Exception;

/**
 * @brief
 *	Thrown when an HTTP request and its included params are missing required information or contain
 *	invalid information
 *
 * TODO: This class can almost certainly be reduced now
 */
class HttpException extends Exception
{
    /// @var array
    private $headers;

    /**
     * @param string     $message
     * @param array      $headers
     * @param string|int $code
     * @param Exception  $previous
     */
    public function __construct($message, array $headers = [ 'HTTP 1.1/400 Bad request' ], $code = 0, $previous = null)
    {
        parent::__construct($message, $code, $previous);
        $this->headers = $headers;
    }

    /**
     * @return array
     */
    public function getHeaders()
    {
        return $this->headers;
    }

    public function applyHeaders()
    {
        array_map('header', $this->getHeaders());
    }
}
