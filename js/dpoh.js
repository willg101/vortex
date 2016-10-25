(function( $ )
{
	var identifier = 0;
	var interval = null;

	function init()
	{
		interval = setInterval( sendCommand.bind( undefined, "get" ), 100 );
	}


	function sendCommand( command )
	{
		if ( command != "get" && command != "quit" )
		{
			command = "send " + command + " -i " + identifier++;
		}

		if ( command == "quit" )
		{
			clearInterval( interval );
			$( "#debugger_output" ).append( '<p style="color: red">Server killed</p>' );
		}

		$.post( '/xdebug_http/connect.php', { commands: [ command ] }, onResponseReceived.bind( undefined, command ) );
	}

	function onResponseReceived( command, data )
	{
		for ( var i in data )
		{
			if ( command != "get" )
			{
				return;
			}

			if ( ! data[ i ] )
			{
				continue;
			}

			var message = "<p>Message from debugger engine:</p>";

			var null_char_pos = data[ i ].indexOf( String.fromCharCode( 0 ) );
			if ( null_char_pos >= 0 )
			{
				data[ i ] = data[ i ].substring( null_char_pos + 1 );
			}

			if ( data[ i ] == "NO_DATA" )
			{
				//message = '<p style="color: #888; font-style: italic">No data available.</p>';
				return;
			}
			else
			{
				var jq_message = $( data[ i ] );
				var attributes = [ 'fileuri', 'filename', 'lineno' ];

				for ( var j in attributes )
				{
					jq_message.each( function( index, el )
					{
						var selector = '[' + attributes[ j ] + ']';
						if ( $( el ).is( selector ) )
						{
							message += "<p>-- " + attributes[ j ] + ": " + $( el ).attr( attributes[ j ] ) + "<p>";
						}
						else if ( $( el ).find( selector ).length )
						{
							message += "<p>-- " + attributes[ j ] + ": " + $( el ).find( selector ).attr( attributes[ j ] ) + "<p>";
						}
					} );
				}
			}

			$( "#debugger_output" ).append( message );
		}
	}

	function onCommandButtonClicked( e )
	{
		var command_name = $( e.target ).attr( 'data-command' );
		sendCommand( command_name );
	}

	$( document ).on( 'click', '[data-command]', onCommandButtonClicked );
	$( init );

}( jQuery ) );

