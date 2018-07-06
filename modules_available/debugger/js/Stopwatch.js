/**
 * @brief
 *	A lightweight "stopwatch" implementation that allows any HTML element to become a "stopwatch"
 *	via $( '.my-class' ).stopwatch( 'start' );
 */
namespace( 'CodeInspector' ).Stopwatch = (function( $ )
{
	var timestamp_attr = 'data-stopwatch-start';

	/**
	 * @brief
	 *	Update the time elapsed on all active stopwatches
	 */
	function refreshAll()
	{
		$( '[' + timestamp_attr + ']' ).each( function()
		{
			refreshOne( $( this ) );
		} );
	}

	/**
	 * @brief
	 *	Update the time elapsed one active stopwatch
	 *
	 * @param jQuery jq
	 */
	function refreshOne( jq )
	{
		var timestamp = parseFloat( jq.attr( timestamp_attr ) );
		var seconds   = Math.floor( ( Date.now() - timestamp ) / 1000 );

		if ( isNaN( seconds ) )
		{
			console.warn( 'Invalid time elapsed', jq )
			jq.stopwatch( 'stop' ); // Don't flood the console
		}
		else
		{
			jq.text( formatTime( seconds ) );
		}
	}

	/**
	 * @brief
	 *	Convert a number to a string; add a leading 0 to single-digit numbers
	 *
	 * @param number n
	 *
	 * @retval string
	 */
	function leadingZeros( n )
	{
		return n.toString().padStart( 2, '0' );
	}

	/**
	 * @brief
	 *	Convert the given number of seconds to a format like hh:mm:ss (e.g., 1:22:33, or 0:22)
	 *
	 * @param number n
	 *
	 * @retval string
	 */
	function formatTime( seconds )
	{
		var minutes = Math.floor( seconds / ( 60 ) );
		var hours   = Math.floor( seconds / ( 60 * 60 ) );
		var output  = '';
		if ( hours )
		{
			output = hours + ':';
		}

		minutes %= 60;
		output += hours ? leadingZeros( minutes ) : minutes;
		output += ':' + leadingZeros( seconds % 60 );

		return output;
	}

	/**
	 * @brief
	 *	Start the interva for refreshing all stopwatches periodically
	 */
	function init()
	{
		setInterval( refreshAll, 100 )
	}

	$( init );

	subscribe( 'provide-tests', function()
	{
		describe( "CodeInspector.Stopwatch", function()
		{
			it( "formatTime", function()
			{
				expect( formatTime( 0 ) ).toBe( '0:00' );
				expect( formatTime( 5 ) ).toBe( '0:05' );
				expect( formatTime( 60 ) ).toBe( '1:00' );
				expect( formatTime( 70 ) ).toBe( '1:10' );
				expect( formatTime( 3600 ) ).toBe( '1:00:00' );
				expect( formatTime( 3660 ) ).toBe( '1:01:00' );
				expect( formatTime( 3661 ) ).toBe( '1:01:01' );
			} );
		} );
	} );

	/**
	 * @brief
	 *	jQuery convenience plugin
	 *
	 * @code
	 * $( '.my-class' ).stopwatch( 'start' );
	 * $( '.my-class' ).stopwatch( 'stop' );
	 * @endcode
	 *
	 * @param string action Either 'start' or 'stop'
	 */
	$.fn.stopwatch = function( action )
	{
		if ( action == 'start' )
		{
			refreshOne( $( this ).attr( timestamp_attr, Date.now() ) );
		}
		else if ( action == 'stop' )
		{
			$( this ).attr( timestamp_attr, null )
		}
		else
		{
			throw new Error( '$.stopwatch(): invalid action `' + action + '`' );
		}

		return this;
	};

}( jQuery ) );
