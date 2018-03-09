namespace( 'Vue.Layout' ).Pane = (function( $ )
{
	var attr = {
		split_direction : 'data-split',
		split_id        : 'data-split-id',
	};

	var selectors = {
		pane           : '.layout-split',
		current_layout : '#layout_in_use',
		leaf_pane      : '.leaf',
	};

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
		this.suggested_windows = []; // ids of windows that are known to be associated with this
		                             // Pane, but not necessarily contained within this Pane at the
		                             // moment

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
			try
			{
				this.suggested_windows = JSON.parse( localStorage.getItem( 'dpoh_layout_windows@' + this.path ) ) || [];
			}
			catch ( e )
			{
				// noop
			}
		}

		this.element.data( 'size', JSON.parse( localStorage.getItem( 'dpoh_pane_size_' + this.path ) || 'false' ) );
	}

	/**
	 * @brief
	 *	Transform the Pane and its descendants using the given callback
	 *
	 * @param function transformer Receives a Pane instance as its only argument; returns a jQuery
	 *
	 * @retval jQuery
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
	 * @retval string
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
				onEnd : function()
				{
					var self = $( this );
					self.css( self.is( '.horizontal' ) ? 'height' : 'width', '' );
					Vue.Layout.Pane.current_layout.validateAll();
					$( document ).trigger( {
						type : 'dpoh-interface:layout-changed',
						pane : '*',
					} );
					layout.find( '.leaf' ).each( function()
					{
						var windows = $( this ).children().map( function(){ return $( this ).attr( 'data-window-id' ) } ).toArray();
						var pane = $( this ).data( 'pane' );
						pane.suggested_windows = windows;
						localStorage.setItem( 'dpoh_layout_windows@' + pane.path, JSON.stringify( windows ) );
						$( this ).find( '[data-role=window]' ).each( function()
						{
							pane.attach( $( this ).data( 'window' ) );
						} );
					} );
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
		var windows = this.suggested_windows.slice();
		this.windows.forEach( function( el )
		{
			if ( windows.indexOf( el.id ) == -1 )
			{
				windows.push( el.id )
			}
		} );
		localStorage.setItem( 'dpoh_layout_windows@' + this.path, JSON.stringify( windows ) );

		var size = this.element.data( 'size' );
		var key = 'dpoh_pane_size_' + this.path;

		if ( size )
		{
			localStorage.setItem( key, JSON.stringify( size ) );
		}
		else
		{
			localStorage.removeItem( key );
		}

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
	 * @retval bool
	 */
	Pane.prototype.isLeaf = function()
	{
		return ! this.children.length;
	}

	/**
	 * @retval bool
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
		if ( a_window instanceof Vue.Layout.Window )
		{
			a_window = a_window.id;
		}

		// When the root Pane is a leaf, it is the only Pane that may contain windows
		if ( this.isLeaf() && this.isRoot() )
		{
			// Don't associate the window id with this Pane more than once
			if ( this.suggested_windows.indexOf( a_window ) == -1 )
			{
				this.suggested_windows.push( a_window );
			}

			return this;
		}
		else if ( this.isLeaf() )
		{
			// Check if this leaf is known to own the given window
			return this.suggested_windows.indexOf( a_window ) != -1
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
				return this.element.find( selectors.leaf_pane ).first().data( 'pane' );
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

		var previous_sizes = undefined;

		// If we currently have a Split instance, destroy it and null it out so we can start fresh
		if ( this.split )
		{
			previous_sizes = this.split.getSizes();
			this.split.destroy();
			delete this.split;
		}

		// Because the call this.show() does not always take effct immediately, we will finish this
		// validation later using setTimeout(), which will allow this function to return, and for
		// the browser to update, before continuing
		if ( !this.refresh_queued )
		{
			this.refresh_queued = true; // If the browser is running slowly, don't let multiple
			                             // validations pile up here
			setTimeout( function()
			{
				this.refresh_queued = false;

				var visible_children = this.element.children( ':visible' );

				// No need to show this Pane if it has no visible child Panes or Windows
				if ( visible_children.length == 0 )
				{
					this.element.hide();
				}

				var visible_children_sizes = this.element.children( ':visible' ).map( function()
				{
					return $( this ).data( 'size' ) || 100;
				} );

				// Show this Pane's child Panes or Windows within a resizable Split if 2 or
				// more are visible
				if ( visible_children.length > 1 )
				{
					this.split = Split( visible_children.toArray(), {
						direction : this.direction.toLowerCase(),
						sizes     : normalizeSizes( visible_children_sizes.toArray() ),
						onDragEnd : this.storeSizes.bind( this ),
					} );
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
				el.updateSize( sizes[ i ] );
			} );
	}

	/**
	 * @brief
	 *	Update the cache and localStorage with a new size
	 */
	Pane.prototype.updateSize = function( size )
	{
		this.element.data( 'size', size );
		this.save( true );
	};

	/**
	 * @brief
	 *	Attach a Window to this leaf Pane
	 *
	 * @param Vue.Layout.Window a_window
	 */
	Pane.prototype.attach = function( a_window )
	{
		if ( !this.isLeaf() )
		{
			throw new Error( "Can't attach a Window to a non-leaf Pane" );
		}

		if ( a_window.owner )
		{
			a_window.element = a_window.element.detach();
			var index_to_remove = a_window.owner.windows.indexOf( a_window );
			if ( index_to_remove != -1 )
			{
				a_window.owner.windows.splice( index_to_remove, 1 );
			}
			a_window.owner.refresh( true );
		}

		a_window.owner = this;

		var index = this.suggested_windows.indexOf( a_window.id );

		if ( index >= 0 && this.element.children().length > index )
		{
			this.element.children().eq( index ).before( a_window.element );
			this.windows.splice( index, 0, a_window );
		}
		else
		{
			this.element.append( a_window.element );
			this.windows.push( a_window );
		}

		this.refreshAll( true );
	};

	/**
	 * @brief
	 *	Determine which root Pane to use as the layout and initialize that Pane
	 */
	Pane.boot = function()
	{
		var layout_id = localStorage.getItem( 'dpoh_selected_layout' ) || $( selectors.pane ).first().attr( attr.split_id );
		var layout_element = $( '[' + attr.split_id '="' + layout_id + '"]' );
		layout_element.appendTo( selectors.current_layout );
		this.current_layout = new Pane( layout_element );
		this.current_layout.initSortable();
		this.current_layout.refreshAll();

		publish( 'pane-boot' );
	};

	$( Pane.boot.bind( Pane ) );

	return Pane;
}( jQuery ));

