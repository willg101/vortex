var $ = jQuery;

/**
 * @brief
 *	jQuery plugin to build a jsTree representingthe value of one or more variables
 *
 * Samples Usages:
 *	var data = await Debugger.command( 'property_get' ... );
 *
 *	# Basic
 *	$( '.my-selector' ).vtree( data.parsed.value )
 *
 *	# Hide all icons
 *	$( '.my-selector' ).vtree( data.parsed.value, { pickIcon : () => '' } );
 *
 *	# Show only bool values
 *	$( '.my-selector' ).vtree( data.parsed.value, { preprocess : prop => return prop.type == 'bool' } );
 *
 * Supported options:
 *	- `pickIcon`    : A function that receives the property being added to the tree and returns
 *	                  string containing the CSS icon class
 *	- `preprocess`  : A function that receives three values: a jQuery of an element that $.jstree
 *	                  will be called on, the data for the tree, and the original value passed to the
 *	                  plugin. This function is called once for each element in the jQuery selection,
 *	                  and is called immediately before calling $.jstree(). If this returns `false`,
 *	                  $.jstree is NOT called on the current element (other falsy return values like
 *	                  `undefined` are ignored)
 *	- `postprocess` : A function that receives three values: a jQuery of an element that $.jstree
 *	                  was called on, the data for the tree, and the original value passed to the
 *	                  plugin. This function is called once for each element in the jQuery selection
 *	                  that preprocess() did NOT return `false` for. The return value of this
 *	                  function is ignored.
 */
$.fn.vtree = function( ctx, options )
{
	function pickIcon( property )
	{
		switch ( property.type )
		{
			case 'Superglobals' : return 'fa-globe';
			case 'Locals'       : return 'fa-location-arrow';
			case 'bool'         : return 'fa-toggle-on';
			case 'null'         : return 'fa-close';
			case 'string'       : return 'fa-quote-left';
			case 'object'       : return 'fa-cogs';
			case 'array'        : return 'fa-th-list';
			case 'int'          : return 'fa-hashtag';
			case 'float'        : return 'fa-dot-circle-o';
			default             : return 'fa-question-circle-o';
		}
	}

	options = $.extend( {
		preprocess  : () => true,
		postprocess : () => true,
		pickIcon,
	}, options || {} );

	function buildContextTree( context, is_recursive )
	{
		var nodes = [];

		(context instanceof Array ? context : context.children || [] ).forEach( function( property )
		{
			var stack_depth = property.stackDepth || 0;
			var cid         = property.cid || 0;
			var value       = $( '<div>' ).text( property.value || '' ).html();
			var address     = property.address || `s${stack_depth}c${cid}` + btoa( property.fullname );

			if ( property.type == 'null' )
			{
				value = 'NULL'
			}
			else if ( property.type == 'bool' )
			{
				value = Number( value ) ? 'TRUE' : 'FALSE';
			}

			var icon = options.pickIcon( property );

			var node = {
				li_attr : {
					'data-identifier'    : property.fullname,
					'class'              : 'identifier-leaf',
					'data-stack-depth'   : stack_depth,
					'data-current-value' : value,
					'data-size'          : property.size,
					'data-address'       : address,
				},
				icon    : 'identifier-icon fa fa-fw ' + icon,
				text    : '<span class="identifier">'
					+ ( is_recursive ? property.name : property.fullname )
					+ '</span>',
			};

			if ( property.isReadOnly ){ node.li_attr[ 'data-no-alter' ] = 'true'; }
			if ( cid               ){ node.li_attr[ 'data-cid' ] = cid; }

			if ( [ 'uninitialized', 'object', 'array', 'Superglobals', 'Locals' ]
				.indexOf( property.type ) == -1 )
			{
				node.text += ( property.name ? ': ' : '' ) + value;
			}

			if ( property.children )
			{
				node.children = buildContextTree( property.children, true );
			}
			else if ( property.hasChildren )
			{
				node.children     = true;
				node.get_children = async function( cb )
				{
					var children = await property.fetchChildren();
					var tree = buildContextTree( children, true );
					cb( tree );
					return tree;
				};
			}

			nodes.push( node );
		} );

		if ( is_recursive )
		{
			return nodes;
		}
		else
		{
			return function( obj, cb )
			{
				if ( obj.id == '#' )
				{
					cb( nodes );
				}
				else if ( typeof obj.original.get_children == 'function' )
				{
					obj.original.get_children( cb );
				}
			};
		}
	}

	var tree = buildContextTree( ctx );

	return this.each( () => {

		if ( options.preprocess( this, tree, ctx ) === false )
		{
			return;
		}

		this.jstree( "destroy" ).jstree( {
			core : {
				data : tree
			}
		} );

		options.postprocess( this, tree, ctx );
	} );
}

subscribe( 'provide-tests', function()
{
	describe( "$.vtree", function()
	{
		it( "Basic usage", function()
		{
			var element = $( '<div>' );
			expect( element.hasClass( 'jstree' ) ).toBe( false );
			element.vtree( [] );
			expect( element.hasClass( 'jstree' ) ).toBe( true );
		} );

		it( "pickIcon", function()
		{
			var element = $( '<div>' );
			var didCall = false;
			element.vtree( [ { value : 'hello', type : 'string' } ], { pickIcon : function( p )
			{
				expect( p.value ).toBe( 'hello' );
				didCall = true;
			} } );
			expect( didCall ).toBe( true );
		} );

		it( "preprocess", function()
		{
			var element = $( '<div>' );
			var didCall = false;
			var ctx = [ { value : 'hello', type : 'string' } ];
			element.vtree( ctx, { preprocess : function( ...args )
			{
				expect( args.length ).toBe( 3 );
				expect( args[ 0 ] instanceof jQuery ).toBe( true );
				expect( typeof args[ 1 ] ).toBe( 'function' );
				expect( args[ 2 ] ).toBe( ctx );
				didCall = true;
			} } );
			expect( didCall ).toBe( true );

			element = $( '<div>' );
			expect( element.hasClass( 'jstree' ) ).toBe( false );
			element.vtree( [], { preprocess : () => false } );
			expect( element.hasClass( 'jstree' ) ).toBe( false );
		} );

		it( "postprocess", function()
		{
			var element = $( '<div>' );
			var didCall = false;
			var ctx = [ { value : 'hello', type : 'string' } ];
			element.vtree( ctx, { preprocess : function( ...args )
			{
				expect( args.length ).toBe( 3 );
				expect( args[ 0 ] instanceof jQuery ).toBe( true );
				expect( typeof args[ 1 ] ).toBe( 'function' );
				expect( args[ 2 ] ).toBe( ctx );
				didCall = true;
			} } );
			expect( didCall ).toBe( true );
		} );
	} );
} );
