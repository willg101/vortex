class RenderError extends Error {
	constructor( message, ...args )
	{
		super( message, ...args );
		this.name = 'RenderError';
		this.message = message;
		this.stack = (new Error()).stack;
	}
}

vTheme = new Proxy( {}, {
	get : ( target, key ) =>
	{
		if ( target.hasOwnProperty( key ) )
		{
			return target[ key ];
		}
	},

	set : ( target, key, value ) =>
	{
		if ( typeof value != 'function' )
		{
			throw new Error( 'Cannot add non-function properties to `vTheme`' );
		}
		publish( 'update-vtree-item', { key, oldValue : target[ key ], newValue : value } );
		target[ key ] = value;
		return true;
	},

	deleteProperty : ( target, key ) =>
	{
		publish( 'delete-vtree-item', { key, value : target[ key ] } );
		return delete target[ key ];
	},
} );

window.PageTitle = {
	state     : {},
	format    : () => 'Vortex',

	setFormat : function( str )
	{
		this.format = Handlebars.compile( str );
		this.refreshTitle();
	},

	updateState : function( vars )
	{
		$.extend( true, this.state, vars );
		this.refreshTitle();
	},

	refreshTitle : function()
	{
		document.title = this.format( this.state );
	},
};

$( () => window.PageTitle.setFormat( document.title.trim() ) );

/**
 * @brief
 *	Create a URL for by prefixing the given path with this site's base path
 *
 * @param string path
 *
 * @return string
 */
function makeUrl( path )
{
	var settings = typeof Dpoh.settings == 'object'
		? Dpoh.settings
		: { base_path : '/' };

	return settings.base_path + path;
}

/**
 * @brief
 *	Render the a handlebars template
 *
 * @param string template_name E.g. for modules_enabled/foo/hbs/bar.hbs, pass 'foo.bar'
 * @param object vars          The variables to render the template with
 *
 * @return string
 *
 * @throw RenderError
 */
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

/**
 * @brief
 *	Publish an event
 *
 * @param string name
 * @param object data
 */
function publish( name, data )
{
	data = data || {};
	data.type = 'dpoh:' + name;
	$( document ).trigger( data );
}

/**
 * @brief
 *	Listen for an event
 *
 * @param string   name     The name of the event as passed to `publish`
 * @param function callback The event handler; passed an Event object
 */
function subscribe( name, callback )
{
	name = 'dpoh:' + name;
	$( document ).on( name, callback );
}

/**
 * see https://gist.github.com/getify/3667624
 *
 * @param string
 */
function escapeDoubleQuotes( str )
{
	return str.replace( /\\([\s\S])|(")/g,"\\$1$2" );
}

/**
 * @brief
 *	Perform an action only after a set of async tasks have all finished
 *
 * If action `A` should only happen after actions `b` and `c`, the whatever code that is
 * responsible for doing `A` should do something like `whenReadyTo( 'A' ).then( doA );`. This will
 * publish() a `'before-A'` event that other systems can respond to by registering a deferred
 * method
 *
 * For example, assume that before calling `performAnAction()`, two functions `prepare()` and
 * `getReady()` need to perform some asynchronous processing. This can be achieved as follows:
 * @code
 *	function performAnAction()
 *	{
 *		console.log( 'Performed an action' );
 *	}
 *
 *	function prepare( on_finish )
 *	{
 *		setTimeout( on_finish, 1000 );
 *	}
 *
 *	function getReady( on_finish )
 *	{
 *		setTimeout( on_finish, 1500 );
 *	}
 *
 *	subscribe( 'before-perform-action', function( e )
 *	{
 *		prepare( e.register() );
 *		getReady( e.register() );
 *	} );
 *
 *	whenReadyTo( 'perform-action' ).then( performAnAction );
 * @endcode
 *
 * @param string name
 *
 * @return Promise
 */
function whenReadyTo( name )
{
	var before_callbacks = [];
	publish( 'before-' + name, {
		register : function()
		{
			var d = $.Deferred();
			before_callbacks.push( d );
			return d.resolve.bind( d );
		}
	} );
	return $.when.apply( $, before_callbacks );
};
