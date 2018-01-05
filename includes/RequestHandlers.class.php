<?php

namespace Dpoh;

class RequestHandlers
{
	private $handlers = [];

	private $unsorted = TRUE;

	public function register( $pattern, $callback, $options = [] )
	{
		$this->unsorted = TRUE;

		$this->handlers[] = [
			'pattern'  => $this->normalize( $pattern ),
			'callback' => $callback,
			'options'  => $options,
		];
	}

	protected function sortHandlers()
	{
		if ( !$this->unsorted )
		{
			return;
		}

		usort( $this->handlers, function( $a, $b )
		{
			$a = $a[ 'pattern' ];
			$b = $b[ 'pattern' ];

			$diff = substr_count( $b, '/' ) - substr_count( $a, '/' );
			return $diff ?: substr_count( $b, '%' ) - substr_count( $a, '%' );
		} );

		$this->unsorted = FALSE;
	}

	protected function normalize( $url )
	{
		$url = preg_replace( '#(^/|/$)#', '',  $url );
		return preg_replace( '#/+#',      '/', $url );
	}

	protected function matches( $pattern, $url )
	{
		$url     = explode( '/', $url );
		$pattern = explode( '/', $pattern );

		if ( count( $pattern ) > count( $url ) )
		{
			return FALSE;
		}
		else
		{
			foreach ( $pattern as $i => $component )
			{
				if ( $url[ $i ] == preg_replace( '/%(%+)/', '$1', $component ) || $component == '%' )
				{
					continue;
				}
				elseif( $component != $url[ $i ] )
				{
					return FALSE;
				}
			}
			return TRUE;
		}
	}

	public function handle( $url = NULL )
	{
		if ( !isset( $url ) )
		{
			$url = request_path();
		}
		$url = $this->normalize( $url );

		$this->sortHandlers();

		$handled = FALSE;
		foreach ( $this->handlers as $handler )
		{
			if ( $this->matches( $handler[ 'pattern' ], $url ) )
			{
				$data = [
					'url'      =>  $url,
					'pattern'  =>  $handler[ 'pattern' ],
					'options'  => &$handler[ 'options' ],
					'callback' => &$handler[ 'callback' ],
				];
				fire_hook( 'preprocess_request', $data );

				$handler[ 'callback' ]( $url, $handler[ 'options' ] );
				$handled = TRUE;

				fire_hook( 'postprocess_request', $data );
			}
		}

		return $handled;
	}
}
