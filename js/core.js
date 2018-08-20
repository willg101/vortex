class RenderError extends Error {
	constructor( message )
	{
		this.name = 'RenderError';
		this.message = message;
		this.stack = (new Error()).stack;
	}
}

/**
 * @brief
 *	Create a faux namespace, implemented as a nested object
 *
 * @param string ns The namespace, separated by dots; e.g., 'foo.bar'
 *
 * @retval object
 */
function namespace( ns )
{
	var context = window;

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

/**
 * @brief
 *	Create a URL for by prefixing the given path with this site's base path
 *
 * @param string path
 *
 * @retval string
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
 * @retval string
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
 * Thrown when a subclass of View attempts to render itself without defining a
 * `template` property on the subclass
 */
class UndefinedTemplateError extends Error
{
	/**
	 * @param View instance
	 */
	constructor( instance )
	{
		super( 'Class "' + instance.constructor.name + '" does not define a template' );
	}
}

/**
 * Abstract subclass wrapper around a handlebars template and the render() function above.
 */
class View
{
	// template = 'module_name.template_name'; Subclasses MUST define this

	/**
	 * @param object Vars
	 */
	constructor( vars )
	{
		this.vars = this.process( vars );
	}

	/**
	 * Process the object of variables passed to the constructor
	 * @param object vars
	 * @retval vars
	 */
	process( vars ){ return vars }

	toString()
	{
		var template = this.constructor.template;
		if ( !template )
		{
			throw new UndefinedTemplateError( this );
		}
		return render( template, this.vars );
	}
}

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
 * @retval Promise
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
