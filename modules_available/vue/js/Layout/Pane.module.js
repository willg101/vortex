import Persistor from '../../../debugger/js/Persistor.module.js'
import Window    from './Window.module.js'
export default Pane

var attr = {
	split_direction : 'data-split',
	split_id        : 'data-split-id',
};

var selectors = {
	pane           : '.layout-split',
	current_layout : '#layout_in_use',
	leaf_pane      : '.leaf',
};

const DEFAULT_LAYOUT         = 'outer0_3';
const SELECTED_LAYOUT_LS_KEY = 'dpoh_selected_layout';

/**
 * @brief
 *	Normalizes an Array of numbers so that the numbers all remain proportional to each other
 *	but add up to 100.
 */
function normalizeSizes( sizes )
{
	if ( !sizes.length )
	{
		return undefined;
	}

	var total_size = sizes.reduce( function( sum, el )
	{
		return sum + el;
	} );
	return sizes.map( function( el )
	{
		return el * 100 / total_size;
	} );
}

/**
 * @brief
 *	Pane constructor
 *
 * @param HTMLElement|jQuery el
 * @param Pane               parent OPTIONAL. Should only be given when this constructor is
 *                                  called recursively (external callers should NOT pass this
 *                                  parameter)
 */
function Pane( el, parent )
{
	this.element   = $( el );
	this.direction = this.element.attr( attr.split_direction );    // 'vertical' or 'horizontal'
	this.id        = this.element.attr( attr.split_id );
	this.path      = parent                                // path: a fully qualified id used
		? parent.path + '.' + this.id                      // for saving/loading settings
		: this.id + '{root}';
	this.element.data( 'pane', this );

	this.windows = [];

	this.parent = parent;
	this.children = [];

	var child_panes = this.element.children( selectors.pane );
	if ( child_panes.length ) // Recursively initialize child Panes if applicable
	{
		var that = this;
		child_panes.each( function()
		{
			that.children.push( new Pane( $( this ), that ) );
		} );
	}
	else
	{
		this.suggested_windows = new Persistor( this.id + '_suggested_windows' );
	}

	this.size_persistor = new Persistor( this.id + '_size' );
}

Object.defineProperty( Pane.prototype, 'size', {
	get : function()
	{
		return this.size_persistor.size;
	},
	set : function( val )
	{
		this.size_persistor.size = val;
		return val;
	},
} );

/**
 * @brief
 *	Transform the Pane and its descendants using the given callback
 *
 * @param function transformer Receives a Pane instance as its only argument; returns a jQuery
 *
 * @return jQuery
 */
Pane.prototype.transform = function( transformer )
{
	if ( typeof transformer != 'function' )
	{
		throw new Error( 'Pane.transform: Expected `transformer` argument to be a '
			+ 'function; received a ' + typeof transformer );
	}

	var transformed_self = transformer( this );
	if ( !this.isLeaf() )
	{
		this.children.forEach( function( el, i )
		{
			if ( i )
			{
				transformed_self.append( $( '<div class="gutter">' ) );
			}

			transformed_self.append( el.transform( transformer ) );
		} );
	}

	return transformed_self;
}

/**
 * @brief
 *	Generate the HTML for a preview of this Pane and its children
 *
 * @param int n_preview_windows The number of preview "windows" to include in each leaf Pane
 *
 * @return string
 */
Pane.prototype.buildPreviewLayout = function( n_preview_windows )
{
	n_preview_windows = typeof n_preview_windows == 'undefined'
		? 2
		: n_preview_windows;

	var transformer = function( pane )
	{
		var is_leaf = pane.isLeaf();
		var is_root = pane.isRoot();
		var jquery = $( '<div class="layout-pane-preview ' + pane.direction + '">' );

		if ( is_leaf )
		{
			jquery.addClass( 'leaf' );
			var html = '<div class="preview-window"></div>'
				+ ( n_preview_windows > 1 ? '<div class="gutter"></div>'
				+   '<div class="preview-window"></div>'.repeat( n_preview_windows - 1 ) : '' );
			jquery.append( $( html ) );
		}

		return jquery;
	};
	return $( '<div>' ).append( this.transform( transformer ) ).html();
};

/**
 * @brief
 * Initialize a Sortable instance on each leaf Pane of this Pane's layout
 */
Pane.prototype.initSortable = function()
{
	if ( !this.isRoot() )
	{
		this.parent.initSortable();
		return;
	}

	var i = 0;
	var layout = this.element;
	layout.find( selectors.leaf_pane ).each( function()
	{
		Sortable.create( this, {
			group: "omega",
			handle: '.label-row',
			filter : '.btn',
			scroll : false,
			animation: 150,
			onStart : function()
			{
				$( selectors.current_layout ).addClass( 'rearranging' ).find( selectors.pane ).css( 'display', '' );
			},
			onEnd : function( e )
			{
				var self = $( this );
				self.css( self.is( '.horizontal' ) ? 'height' : 'width', '' );
				$( selectors.current_layout ).removeClass( 'rearranging' );
				$( e.to ).data( 'pane' ).attach( $( e.item ).data( 'window' ) );

				publish( 'layout-changed' );
			},
		} );
	} );
};

/**
 * @brief
 *	Save this Pane's state in localStorage, along with all child panes' states.
 *
 * @param no_recurse OPTIONAL. When passed (and non-false), prevents a recursive save.
 */
Pane.prototype.save = function( no_recurse )
{
	for ( var key in this.suggested_windows )
	{
		delete this.suggested_windows[ key ];
	}
	this.windows.forEach( function( el, i )
	{
		this.suggested_windows[ el.id ] = i;
	}.bind( this ) );

	if ( !no_recurse )
	{
		this.children.forEach( function( el )
		{
			el.save();
		} );
	}
}

/**
 * @note
 *	Leaves are Panes with no Pane children and are thus capable of containing Window
 *	instances
 *
 * @return bool
 */
Pane.prototype.isLeaf = function()
{
	return ! this.children.length;
}

/**
 * @return bool
 */
Pane.prototype.isRoot = function()
{
	return ! this.parent;
};

/**
 * @brief
 *	Suggest which Pane should contain the given window based on previously saved preferences,
 *	and falling back to suggesting the first leaf Pane in the DOM
 *
 * @param Window|string a_window
 */
Pane.prototype.suggestOwner = function( a_window )
{
	if ( a_window instanceof Window )
	{
		a_window = a_window.id;
	}

	// When the root Pane is a leaf, it is the only Pane that may contain windows
	if ( this.isLeaf() && this.isRoot() )
	{
		// Don't associate the window id with this Pane more than once
		if ( typeof this.suggested_windows[ a_window ] != 'undefined' )
		{
			this.suggested_windows[ a_window ] = Object.keys( this.suggested_windows ).length;
		}

		return this;
	}
	else if ( this.isLeaf() )
	{
		// Check if this leaf is known to own the given window
		return typeof this.suggested_windows[ a_window ] != 'undefined'
			? this
			: false;
	}
	else
	{
		// Recursively iterate through our child Panes in search of a leaf Pane that is
		// known to own the given window
		var rval = false;
		for ( var i in this.children )
		{
			rval = this.children[ i ].suggestOwner( a_window );
			if ( rval )
			{
				return rval;
			}
		}

		// If we reach this point, we didn't find a known owner of the window. Let the root
		// Pane figure out what to do now
		if ( !this.isRoot() )
		{
			return false;
		}
		else
		{
			return this.element.find( selectors.leaf_pane ).sort( ( a, b ) => a.children.length - b.children.length ).first().data( 'pane' );
		}
	}
};

/**
 * @brief
 *	Show this Pane and all of its ancestors so that if any anscestor Pane is currently
 *	hidden, it does not prevent this Pane from showing
 */
Pane.prototype.show = function()
{
	this.element.show();
	if ( !this.isRoot() )
	{
		this.parent.show();
	}
}

/**
 * @brief
 *	Triggers a recursive refresh on one or more Panes
 *
 * @param bool skip_bubble_to_root Only recursive downward, effectively refreshing just this
 * Pane and its children
 */
Pane.prototype.refreshAll = function( skip_bubble_to_root )
{
	if ( !skip_bubble_to_root && !this.isRoot() )
	{
		this.parent.refreshAll();
		return;
	}

	if ( !this.isLeaf() )
	{
		this.children.forEach( function( child )
		{
			child.refreshAll( true );
		} );
	}
	else
	{
		this.refresh();
	}
};

/**
 * @brief
 *	Perform all tasks necessary to ensure this Pane's visual state (hidden/showing) and Split
 *	instance are both appropriate
 *
 * @param bool did_show OPTIONAL. Should only be passed when called recursively; indicates that
 *                                it's not necessary to call this.show(), since it has already
 *                                been called somewhere deeper in the call stack.
 */
Pane.prototype.refresh = function( did_show )
{
	// If any of our anscestors are hidden, that will mess up code that searches for visible
	// children, such as `this.element.children( ':visible' );`
	if ( !did_show )
	{
		this.show();
	}

	// Because the call this.show() does not always take effect immediately, we will finish this
	// validation later using setTimeout(), which will allow this function to return, and for
	// the browser to update, before continuing
	if ( !this.refresh_queued )
	{
		this.refresh_queued = true; // If the browser is running slowly, don't let multiple
			                         // validations pile up here
		setTimeout( function()
		{
			this.refresh_queued = false;

			var visible_children = this.element.children( ':visible:not(.gutter)' );

			// No need to show this Pane if it has no visible child Panes or Windows
			if ( visible_children.length == 0 )
			{
				this.element.hide();
			}

			var data_key = this.isLeaf() ? 'window' : 'pane';
			var visible_children_sizes = visible_children.map( function()
			{
				return ( $( this ).data( data_key ) || {} ).size || 100;
			} ).toArray();

			if ( visible_children.length > 1 )
			{
				// If we currently have a Split instance, destroy it and null it out so we can start fresh
				if ( this.split )
				{
					var dimension = this.direction.toLowerCase() == 'vertical' ? 'height' : 'width';
					var margin    = this.direction.toLowerCase() == 'vertical' ? 'top'    : 'left';
					this.element.children().each( function( i )
					{
						var self = $( this );
						if ( i > 0 )
						{
							self.css( 'margin-' + margin, '10px' );
						}
						self[ dimension ]( self[ dimension ] );
					} );
					this.split.destroy();
					delete this.split;
				}
				this.split = Split( visible_children.toArray(), {
					direction : this.direction.toLowerCase(),
					sizes     : normalizeSizes( visible_children_sizes ),
					onDragEnd : this.storeSizes.bind( this ),
				} );
				if ( margin )
				{
					this.element.children().each( function()
					{
						$( this ).css( 'margin-' + margin, '' );
					} );
				}
			}
			else if ( this.split )
			{
				this.split.destroy();
				delete this.split;
			}

			this.storeSizes()

			// Bubble up the validation, as the number of visible children has potentially changed
			if ( this.parent )
			{
				this.parent.refresh( true );
			}
			else
			{
				publish( 'layout-changed', { pane : '*' } );
			}

		}.bind( this ), 50 );
	}
}

/**
 * @brief
 *	Store this Pane's Split sizes in localStorage
 */
Pane.prototype.storeSizes = function()
{
	var sizes = this.split ? this.split.getSizes() : [ 100 ];
	var all_children = this.isLeaf() ? ( this.windows || [] ) : this.children;
	var visible_children = all_children.filter( function( el )
		{
			return el.element.is( ':visible' );
		} );
	visible_children.forEach( function( el, i )
		{
			el.size = sizes[ i ];
		} );
}

/**
 * @brief
 *	Attach a Window to this leaf Pane
 *
 * @param Window a_window
 */
Pane.prototype.attach = function( a_window )
{
	if ( !this.isLeaf() )
	{
		throw new Error( "Can't attach a Window to a non-leaf Pane" );
	}

	var html_element_needs_move = !this.element.find( a_window.element ).length;

	if ( a_window.owner )
	{
		if ( html_element_needs_move )
		{
			a_window.element = a_window.element.detach();
		}
		var index_to_remove = a_window.owner.windows.indexOf( a_window );
		if ( index_to_remove != -1 )
		{
			a_window.owner.windows.splice( index_to_remove, 1 );
		}
	}

	a_window.owner = this;

	var index = this.suggested_windows[ a_window.id ];
	if ( html_element_needs_move )
	{
		if ( typeof index != 'undefined' && this.element.children().length > index )
		{
			this.element.children().eq( index ).before( a_window.element );
			this.windows.splice( index, 0, a_window );
		}
		else
		{
			this.element.append( a_window.element );
			this.windows.push( a_window );
		}
	}
	else
	{
		this.windows.splice( a_window.element.index(), 0, a_window );
	}

	if ( Pane.saving_allowed )
	{
		Pane.current_layout.save();
	}

	this.refreshAll();
};

subscribe( 'apply-default-layout-settings', function( e )
{
	if ( e.layout == 'outer0_3' )
	{
		e.settings.defaults = e.settings.defaults.concat(
		[
			{ layout_el : "inner-top_3_size",    key : "size", value : 70 },
			{ layout_el : "inner-bottom_4_size", key : "size", value : 30 },
			{ layout_el : "middle-l_3_size",     key : "size", value : 75 },
			{ layout_el : "middle-r_6_size",     key : "size", value : 25 },
		] );
	}
} );

/**
 * @brief
 *	Determine which root Pane to use as the layout and initialize that Pane
 */
Pane.boot = function()
{
	var layout_id = localStorage.getItem( SELECTED_LAYOUT_LS_KEY );
	if ( !layout_id )
	{
		var e = { layout : DEFAULT_LAYOUT, settings : { defaults : [] } };
		publish( 'apply-default-layout-settings', e );
		e.settings.defaults.forEach( params =>
		{
			var p = new Persistor( params.layout_el );
			p[ params.key ] = params.value;
		} );
		layout_id = e.layout;
		localStorage.setItem( SELECTED_LAYOUT_LS_KEY, layout_id );
	}
	var layout_element = $( '[' + attr.split_id + '="' + layout_id + '"]' );
	layout_element.appendTo( selectors.current_layout );
	this.current_layout = new Pane( layout_element );
	this.current_layout.initSortable();
	this.current_layout.refreshAll();

	publish( 'pane-boot' );
	Pane.saving_allowed = true;
};

$( Pane.boot.bind( Pane ) );
