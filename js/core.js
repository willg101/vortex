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
