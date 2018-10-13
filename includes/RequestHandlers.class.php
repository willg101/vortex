<?php

namespace Dpoh;

/**
 * @brief
 *	Delegate incoming HTTP requests to the proper handlers
 */
class RequestHandlers
{
    /**
     * Registered request handlers.
     *
     * @var array
     */
    private $handlers = [];

    /**
     * Indicates if $handlers has been sorted by specificity yet
     *
     * @var bool
     */
    private $sorted = false;

    /**
     * @param string   $pattern  A URL pattern like 'a/b/c' or 'd/%'. '%' indicates a wildcard.
     * @param callable $callback A callable like `function( string $url, array $options )`. This
     *                           callable is responsible printing its output; its return value is
     *                           discarded.
     * @param array    $options  OPTIONAL. An arbitrary array of data to pass to $callback
     */
    public function register($pattern, $callback, array $options = [])
    {
        $this->sorted = false;

        $this->handlers[] = [
            'pattern'  => $this->normalize($pattern),
            'callback' => $callback,
            'options'  => $options,
        ];
    }

    /**
     * @brief
     *	Sort $this->handlers in order of specificity, from most specific to least
     */
    protected function sortHandlers()
    {
        if ($this->sorted) {
            return;
        }

        usort($this->handlers, function ($a, $b) {
            $a = $a[ 'pattern' ];
            $b = $b[ 'pattern' ];

            $diff = substr_count($b, '/') - substr_count($a, '/');
            return $diff ?: substr_count($b, '%') - substr_count($a, '%');
        });

        $this->sorted = true;
    }

    /**
     * @brief
     *	Collapse repeated '/' characters and strip leading and trailing '/'
     *
     * @param string $url
     *
     * @return string
     */
    protected function normalize($url)
    {
        $url = preg_replace('#(^/+|/+$)#', '', $url);
        return preg_replace('#/+#', '/', $url);
    }

    /**
     * @brief
     *	Determines if a given pattern matches a normalized url
     *
     * @param string $pattern See documentation from register()'s `$pattern` argument
     * @param string $url
     *
     * @return bool
     */
    protected function matches($pattern, $url)
    {
        $url     = explode('/', $url);
        $pattern = explode('/', $pattern);

        if (count($pattern) > count($url)) {
            return false;
        } else {
            foreach ($pattern as $i => $component) {
                // Treat '%%' as a literal '%'; handle wildcards
                if ($url[ $i ] == preg_replace('/%(%+)/', '$1', $component) || $component == '%') {
                    continue;
                } elseif ($component != $url[ $i ]) {
                    return false;
                }
            }
            return true;
        }
    }

    /**
     * @brief
     *	Apply the registered handler for this request
     *
     * To perform an action immediately before or after the request is handled, use
     * hook_preprocess_request or hook_postprocess_request, respectively. These hooks are passed an
     * array like
     * @code
     * [
     * 	'url'      => 'a/b/c',
     * 	'pattern'  => 'a/b/%',
     * 	'options'  => [ 'foo' => 'bar' ], // ALTERABLE
     * 	'callback' => 'my_handler_function', // ALTERABLE
     * ]
     * @endcode
     *
     * @param string $url OPTIONAL. When omitted, retrieves the URL from `request_path()`
     *
     * @return bool
     *	Indicates whether the request was handled or not
     */
    public function handle($url = null)
    {
        if (!isset($url)) {
            $url = request_path();
        }
        $url = $this->normalize($url);

        $this->sortHandlers();

        $handled = false;
        foreach ($this->handlers as $handler) {
            if ($this->matches($handler[ 'pattern' ], $url)) {
                $data = [
                    'url'      =>  $url,
                    'pattern'  =>  $handler[ 'pattern' ],
                    'options'  => &$handler[ 'options' ],
                    'callback' => &$handler[ 'callback' ],
                ];
                fire_hook('preprocess_request', $data);

                $handler[ 'callback' ]($url, $handler[ 'options' ]);
                $handled = true;

                fire_hook('postprocess_request', $data);
                break;
            }
        }

        return $handled;
    }
}
