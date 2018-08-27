var $ = jQuery;

$.fn.vtree = function( ctx, options )
{
	options = options || {};
	$.extend( options, {
		preprocess  : () => true,
		postprocess : () => true,
	} );

	function buildContextTree( context, is_recursive )
	{
		var nodes = [];

		(context instanceof Array ? context : context.children || [] ).forEach( function( property )
		{
			var stack_depth = property.stackDepth;
			var cid         = property.cid;
			var value       = $( '<div>' ).text( property.value || '' ).html();

			var icon = 'fa-question-circle-o';
			switch ( property.type )
			{
				case 'Superglobals' : icon = 'fa-globe';          break;
				case 'Locals'       : icon = 'fa-location-arrow'; break;
				case 'bool'         : icon = 'fa-toggle-on';      break;
				case 'null'         : icon = 'fa-close';          break;
				case 'string'       : icon = 'fa-quote-left';     break;
				case 'object'       : icon = 'fa-cogs';           break;
				case 'array'        : icon = 'fa-th-list';        break;
				case 'int'          : icon = 'fa-hashtag';        break;
				case 'float'        : icon = 'fa-dot-circle-o';   break;
			}

			if ( property.type == 'null' )
			{
				value = 'NULL'
			}
			else if ( property.type == 'bool' )
			{
				value = Number( value ) ? 'TRUE' : 'FALSE';
			}

			var node = {
				li_attr : {
					'data-identifier'    : property.fullname,
					'class'              : 'identifier-leaf',
					'data-stack-depth'   : stack_depth,
					'data-current-value' : value,
					'data-size'          : property.size,
				},
				icon    : 'identifier-icon fa fa-fw ' + icon,
				text    : '<span class="identifier">'
					+ ( is_recursive ? property.name : property.fullname )
					+ '</span>',
			};

			if ( property.isReadOnly ){ node.li_attr[ 'data-no-alter' ] = 'true'; }
			if ( property.address  ){ node.li_attr[ 'data-address' ]  = property.address; }
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
