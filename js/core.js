function RenderError( message )
{
	this.name = 'RenderError';
	this.message = message;
	this.stack = (new Error()).stack;
}
RenderError.prototype = new Error;

function namespace( ns, context )
{
	if ( !context || typeof context != "object" )
	{
		context = window;
	}

	ns.split( '.' ).forEach( function( part )
	{
		if ( typeof context[ part ] == "undefined" )
		{
			context[ part ] = {};
		}
		context = context[ part ];
	} );

	return context;
}

function makeUrl( path )
{
	var settings = typeof dpoh_settings == 'object'
		? dpoh_settings
		: {};

	return Dpoh.settings.base_path + path;
}

render = (function()
{
	var cache = {};

	return function( template_name, vars )
	{
		if ( !cache[ template_name ] )
		{
			if ( !Dpoh.templates[ template_name ] )
			{
				throw new RenderError( 'Unknown template "' + template_name + '"' );
			}
			cache[ template_name ] = Handlebars.compile( Dpoh.templates[ template_name ] );
		}

		return cache[ template_name ]( vars );
	};
}())

function publish( name, data )
{
	data = data || {};
	data.type = 'dpoh:' + name;
	$( document ).trigger( data );
}

function subscribe( name, callback )
{
	name = 'dpoh:' + name;
	$( document ).on( name, callback );
}

/**
 * A "class" for performing a task after an arbitrary set of asynchronous functions all finish, or
 * after a specified amount of time passes - whichever happens first.
 *
 * One usecase for this is when a module wants to take some action, preferably after receiving
 * responses to a set of separate requests to the server -- responses which may come back in any
 * order.
 *
 * Example usage:
 * @code
 *	var coord = new Vortex.TimedCoordinator;
 *	coord.register( function( on_finish ){ $.get( 'a/b/c', on_finish ); } );
 *	coord.register( function( on_finish ){ sendAMessageViaWebsocket( hello_world, on_finish ) } );
 *	coord.activate( function( timed_out ){ console.log( 'Done! Timed out: ' + timed_out ); }, 500 );
 * @endcode
 * The example above will fire off a GET request to 'a/b/c' and call sendAMessageViaWebsocket().
 * Once a response is received from the server for both items, or 500 ms passes, a message will be
 * printed to the console.
 */
namespace( 'Vortex' ).TimedCoordinator = (function()
{
	function TimedCoordinator()
	{
		this.registrants = [];
	}

	/**
	 * @brief
	 *	Registers a function to be called when this instance's activate() method is called
	 *
	 * @param function cb
	 */
	TimedCoordinator.prototype.register = function( cb )
	{
		this.registrants.push( cb );
	}

	/**
	 * @retval function
	 *	A copy of this.register(), bound to this instance. This allows functions to be able to
	 *	register callbacks on this instance without having access to the entire instance (which
	 *	would open up the possibility of one of these other functions calling the activate()
	 *	method)
	 */
	TimedCoordinator.prototype.getPublicApi = function()
	{
		return this.register.bind( this );
	}

	/**
	 * @retval function
	 *	A function to be passed to one regsitrant. When the registrant calls this function, it
	 *	indicates that its task is complete. Calling this function more than one time has no
	 *	effect.
	 */
	TimedCoordinator.prototype.createActivator = function()
	{
		var used = false;
		return function()
		{
			if ( !used )
			{
				this.n_ready++;
				used = true;
				if ( this.n_ready >= this.registrants.length )
				{
					this.main_cb( false );
				}
			}
		}.bind( this );
	}

	/**
	 * @brief
	 *	Instructs each registrant to begin its task
	 *
	 * @param function main_cb    Function to call when all registrants are ready or time has expired
	 * @param int      timeout_ms How long to wait, in milliseconds. May be omitted for no timeout
	 *
	 * @note This function intentionally has a similar signature to window.setTimeout()
	 * @note If this is called when there are no registrants, main_cb() is called immediately
	 */
	TimedCoordinator.prototype.activate = function( main_cb, timeout_ms )
	{
		var main_cb_called = false
		this.main_cb = function( timed_out )
		{
			if ( !main_cb_called )
			{
				main_cb_called = true;
				main_cb( timed_out );
			}
		};

		if ( this.registrants.length )
		{
			this.n_ready = 0;
			this.registrants.forEach( function( cb )
			{
				cb( this.createActivator() );
			}.bind( this ) );

			if ( timeout_ms )
			{
				setTimeout( this.main_cb.bind( this, true ), timeout_ms );
			}
		}
		else
		{
			this.main_cb( false );
		}
	}

	return TimedCoordinator;

}());
