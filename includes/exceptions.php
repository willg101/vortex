<?php

/**
 * @brief
 *	Thrown when an HTTP request and its included params are missing required information or contain
 *	invalid information
 */
class HttpException    extends Exception {}

/**
 * @brief
 *	Thrown when the system is misconfigured in such a way that a normal response is not possible
 */
class FatalConfigError extends Exception {}
