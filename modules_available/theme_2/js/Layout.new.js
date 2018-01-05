
namespace( 'Theme2' ).Splash = (function( $ )
{
	var did_load = false;

	function onAnimationEnd()
	{
		if ( did_load )
		{
			$( '.splash-outermost' ).addClass( 'out' ).find( '.full' ).css( 'animation-fill-mode', 'none' );
		}
		else
		{
			$( '.v' ).toggleClass( 'a b' );
		}
	}

	function onTransitionEnd( e )
	{
		$( e.target ).remove();
	}

	$( window ).on( 'load', function(){ did_load = true; } );
	$( document ).on( 'animationend', '.v.v1', onAnimationEnd );
	$( document ).on( 'transitionend', '.splash-outermost', onTransitionEnd );
}( jQuery ));

namespace( 'Theme2' ).LayoutElement = (function( $ )
{
	function LayoutElement(){};
} );

namespace( 'Theme2' ).Pane = (function( $ )
{
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

	function normalizeWeightedSizes( weighted_sizes )
	{
		var normalized_sizes     = [];
		var remaining_size       = 100;
		var current_weight       = -1;
		var size_used_this_round = 0;

		weighted_sizes = weighted_sizes.slice();
		weighted_sizes.forEach( function( el, i )
			{
				el.i = i;
			} );
		weighted_sizes.sort( function( a, b )
			{
				return b.weight - a.weight;
			} );
		weighted_sizes.forEach( function( el )
			{
				if ( current_weight != el.weight )
				{
					current_weight = el.weight;
					remaining_size -= size_used_this_round;
					size_used_this_round = 0;
				}

				var my_adjusted_size = remaining_size * ( el.size / 100 );
				size_used_this_round += my_adjusted_size;
				normalized_sizes[ el.i ] = my_adjusted_size || 50;
			} );
		return normalizeSizes( normalized_sizes );
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
		this.direction = this.element.attr( 'data-split' );    // 'vertical' or 'horizontal'
		this.id        = this.element.attr( 'data-split-id' );
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

		var child_panes = this.element.children( '.layout-split' );
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

		this.element.data( 'weighted_size', JSON.parse( localStorage.getItem( 'dpoh_pane_size_' + this.path ) || 'false' ) );

		// Determine the "default capacity" of each of the leaves. Default capacity is a number
		// approximates how many windows each leaf should hold in order to equally distribute space
		if ( this.isRoot() )
		{
			this.calcWeight();
			var min_weight = this.getMinWeight();
			this.calcDefaultCapacity( min_weight );
		}
	}

	Pane.prototype.buildPhantomLayout = function( processor )
	{
		if ( typeof processor != 'function' )
		{
			throw new Error( 'Pane.buildPhantomLayout: Expected `processor` argument to be a '
				+ 'function; received a ' + typeof processor );
		}

		var processed_self = processor( this, this.isRoot(), this.isLeaf() );
		if ( !this.isLeaf() )
		{
			this.children.forEach( function( el, i )
			{
				if ( i )
				{
					processed_self.append( $( '<div class="gutter">' ) );
				}

				processed_self.append( el.buildPhantomLayout( processor ) );
			} );
		}

		return processed_self;
	}

	Pane.prototype.buildPreviewLayout = function( n_preview_windows )
	{
		n_preview_windows = typeof n_preview_windows == 'undefined'
			? 2
			: n_preview_windows;

		var processor = function( pane, is_root, is_leaf )
		{
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
		return this.buildPhantomLayout( processor );
	};

	Pane.prototype.initSortable = function()
	{
		if ( !this.isRoot() )
		{
			this.parent.initSortable();
			return;
		}

		var i = 0;
		var layout = this.element;
		layout.find( '.leaf' ).each( function()
		{
			Sortable.create( this, {
				//forceFallback: true,
				group: "omega",
				handle: '.label-row',
				filter : '.btn',
				scroll : false,
				animation: 150,
				onStart : function()
				{
					$( '#layout_in_use' ).addClass( 'rearranging' ).find( '.layout-split' ).css( 'display', '' );
				},
				onEnd : function()
				{
					$( '#layout_in_use' ).removeClass( 'rearranging' );
					var self = $( this );
					self.css( self.is( '.horizontal' ) ? 'height' : 'width', '' );
					Theme2.Pane.current_layout.validateAll();
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
/*		layout.find(  '.leaf' ).sortable( {
			handle : '.label-row',
			cancel : '.btn',
			cursorAt: { left : 5, top : 5 },
			appendTo : 'body',
			helper : 'clone',
			scroll : false,
			tolerance : 'pointer',
		} ).each( function()
		{
			$( this ).sortable( "option", "connectWith", layout.find( '.leaf' ) );
		} ).on( 'sortupdate', function( e, ui )
		{
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
		} ).on( 'sortstart', function( e, ui )
		{
			$( '#layout_in_use' ).addClass( 'rearranging' ).find( '.layout-split' ).css( 'display', '' );
			$( '.leaf' ).each( function()
			{
				var self = $( this );
				if ( self.is( '.horizontal' ) )
				{
					self.height( self.height() );
				}
				else
				{
					self.width( self.width() );
				}
			} );
		} ).on( 'sortstop', function()
		{
			$( '#layout_in_use' ).removeClass( 'rearranging' );
			var self = $( this );
			self.css( self.is( '.horizontal' ) ? 'height' : 'width', '' );
			Theme2.Pane.current_layout.validateAll();
		} ).on( 'sortover', function( e, ui )
		{
			$( e.target ).addClass( 'sortover' );
		} ).on( 'sortout', function( e, ui )
		{
			$( e.target ).removeClass( 'sortover' );
		} );*/
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

		var weighted_size = this.element.data( 'weighted_size' );
		var key = 'dpoh_pane_size_' + this.path;

		if ( weighted_size )
		{
			localStorage.setItem( key, JSON.stringify( weighted_size ) );
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
	 *	and falling back to using default capacity when no preferences have been saved for this
	 *	window
	 *
	 * @param Window|string a_window
	 */
	Pane.prototype.suggestOwner = function( a_window )
	{
		if ( a_window instanceof Theme2.Window )
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
				// Get all leaf Panes sorted with the preferred Pane (for balance purposes)
				// first; select this first candidate
				var candidates = this.getOwnerCandidates();
				candidates[ 0 ].pane.suggested_windows.push( a_window );
				return candidates[ 0 ].pane;
			}
		}
	};

	/**
	 * @brief
	 *	Calculates and stores each Pane's weight.
	 *
	 * "Weight" as calculated by this function is a key component is determining default capacity,
	 * and is determined by assigning each child Pane a weight of y/x, where y is the current
	 * Pane's weight, and x is the number of child Panes. The root Pane is always assigned a
	 * weight of 1.
	 *
	 * Thus, if the root Pane has 4 children, each of these Panes will have a weight of 1/4.
	 * If each of these Panes, in turn, has 2 children, these will all have a weight of 1/8.
	 *
	 * @param float my_weight OPTIONAL. Should only be passed in recursive calls.
	 */
	Pane.prototype.calcWeight = function( my_weight )
	{
		this.weight = this.isRoot() ? 1 : my_weight;

		if ( this.isLeaf() )
		{
			return;
		}

		var child_weight = this.weight / ( this.children.length || 1 );
		this.children.forEach( function( child )
		{
			child.calcWeight( child_weight );
		} );
	};

	/**
	 * @brief
	 *	Calculates and stores the default capacity of the Pane
	 *
	 * The default capacity is a rough approximation of how many windows each leaf Pane should
	 * hold, relative to the rest of the leaf Panes, in order to appear as balanced as possible.
	 * This is calculated by dividing all each Pane's weight by the lowest weight of all leaves,
	 * and thus is not guaranteed to be a whole number.
	 *
	 * @param float min_weight The lowest weight of all leaf Panes
	 */
	Pane.prototype.calcDefaultCapacity = function( min_weight )
	{
		this.default_capacity = this.weight / min_weight;

		if ( !this.isLeaf() )
		{
			this.children.forEach( function( child )
			{
				child.calcDefaultCapacity( min_weight );
			} );
		}
	};

	/**
	 * @retval object
	 */
	Pane.prototype.getCapacity = function()
	{
		if ( this.isLeaf() )
		{
			var n_visible_windows = this.element.children( ':not(.gutter):visible' ).length;
			return {
				remaining_capacity : this.default_capacity - n_visible_windows,
				n_visible_windows  : n_visible_windows,
			};
		}
		else
		{
			return null;
		}
	}

	/**
	 * @retval Array
	 *	An Array of leaf Panes, in order of suggested Window owners, most preferred first
	 *
	 * @param Array current_candidates OPTIONAL. Should only be passed when called recursively
	 */
	Pane.prototype.getOwnerCandidates = function( current_candidates )
	{
		var i_am_root = this.isRoot();
		if ( i_am_root )
		{
			current_candidates = [];
		}
		else if ( ! (current_candidates instanceof Array) )
		{
			throw new Error( 'getOwnerCandidates() must be called on the root of a Pane' );
		}

		if ( this.isLeaf() )
		{
			current_candidates.push( { pane : this, capacity : this.getCapacity() } );
		}
		else
		{
			this.children.forEach( function( child )
			{
				child.getOwnerCandidates( current_candidates );
			} );
		}

		if ( i_am_root )
		{
			return current_candidates.sort( function( a, b )
			{
				// Sort leaf Panes by remaining capacity, highest first; in the case of a tie,
				// put the Pane with fewer visible Windows first
				a = a.pane.getCapacity();
				b = b.pane.getCapacity();
				return ( b.remaining_capacity - a.remaining_capacity )
					|| ( a.n_visible_windows  - b.n_visible_windows );
			} );
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

	Pane.prototype.validateAll = function( skip_bubble_to_root )
	{
		if ( !skip_bubble_to_root && !this.isRoot() )
		{
			this.parent.validateAll();
			return;
		}

		if ( !this.isLeaf() )
		{
			this.children.forEach( function( child )
			{
				child.validateAll( true );
			} );
		}
		else
		{
			this.validate();
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
	Pane.prototype.validate = function( did_show )
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
		if ( !this.validate_queued )
		{
			this.validate_queued = true; // If the browser is running slowly, don't let multiple
			                             // validations pile up here
			setTimeout( function()
			{
				this.validate_queued = false;

				var visible_children = this.element.children( ':visible' );

				// No need to show this Pane if it has no visible child Panes or Windows
				if ( visible_children.length == 0 )
				{
					this.element.hide();
				}

				var visible_children_sizes = this.element.children( ':visible' ).map( function()
				{
					return $( this ).data( 'weighted_size' ) || { weight : 0, size: 100 };
				} );

				// Show this Pane's child Panes or Windows within a resizable Split if 2 or
				// more are visible
				if ( visible_children.length > 1 )
				{
					this.split = Split( visible_children.toArray(), {
						direction : this.direction.toLowerCase(),
						sizes     : normalizeWeightedSizes( visible_children_sizes.toArray() ),
						onDragEnd : this.storeSizes.bind( this ),
					} );
				}

				this.storeSizes()

			// Bubble up the validation, as the number of visible children has potentially changed
			if ( this.parent )
			{
				this.parent.validate( true );
			}
			else
			{
				publish( 'layout-changed', { pane : '*' } );
			}

			}.bind( this ), 1 );
		}
	}

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
				el.updateWeightedSize( visible_children.length, sizes[ i ] );
			} );
	}

	Pane.prototype.updateWeightedSize = function( weight, size )
	{
		this.element.data( 'weighted_size', { weight : weight, size : size } );
		this.save( true );
	};

	/**
	 * @brief
	 *	Recursively determines the lowest leaf Pane weight
	 */
	Pane.prototype.getMinWeight = function()
	{
		if ( this.isLeaf() )
		{
			return this.weight;
		}
		else
		{
			child_weights = this.children.map( function( child ){ return child.getMinWeight() } );
			return Math.min.apply( undefined, child_weights );
		}
	};

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
			a_window.owner.validate();
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

		this.validateAll();
	};

	/**
	 * @brief
	 *	Determine which root Pane to use as the layout and initialize that Pane
	 */
	Pane.boot = function()
	{
		var layout_id = localStorage.getItem( 'dpoh_selected_layout' ) || $( '.layout-split' ).first().attr( 'data-split-id' );
		var layout_element = $( '[data-split-id="' + layout_id + '"]' );
		layout_element.appendTo( '#layout_in_use' );
		this.current_layout = new Pane( layout_element );
		this.current_layout.initSortable();
		this.current_layout.validateAll();
	};

	return Pane;
}( jQuery ));

namespace( 'Theme2' ).Window = (function( $ )
{
	/**
	 * @brief
	 *	Constructor for a Window
	 *
	 * @param HTMLElement|jQuery
	 */
	function Window( el )
	{
		this.element = $( el );
		this.id      = this.element.attr( 'data-window-id' ); // used in saving/restoring state

		this.element.data( 'weighted_size', JSON.parse( localStorage.getItem( 'dpoh_window_size_' + this.id ) || 'false' ) );
		this.element.data( 'window', this );

		// Find out which Pane should contain this window, and then attach to validate that Pane
		Theme2.Pane.current_layout.suggestOwner( this ).attach( this );

		this.state = 'normal';
		// Valid states: 'minimized', 'maximized', 'normal'
		var state   = localStorage.getItem( 'dpoh_window_state_' + this.id ) || 'normal';
		if ( state == 'minimized' )
		{
			this.minimize();
		}
		else if ( state == 'maximized' )
		{
			this.maximize();
		}

		$( '.btn.minimize', el ).on( 'click', this.minimize.bind( this, undefined, undefined ) );
		$( '.btn.maximize, .btn.unmaximize', el ).on( 'click', this.maximize.bind( this, undefined, undefined ) );
		subscribe( 'window-maximized',   this.onOtherWindowMaximized.bind( this ) );
		subscribe( 'window-unmaximized', this.onOtherWindowUnmaximized.bind( this ) );
	}

	/*
	 * @brief
	 *	Put the window into a minimized state, or take it out of a minimized state
	 *
	 * @param string   enable_or_disable OPTIONAL. When omitted, the current minimize state is
	 *                                   toggled. Must be either 'enable' or 'disable'
	 * @param function on_finish         OPTIONAL. A function to call once the window has been
	 *                                   miminized/un-minimized
	 */
	Window.prototype.minimize = function( enable_or_disable, on_finish )
	{
		// Validate arguments
		if ( typeof on_finish == 'undefined' )
		{
			on_finish = function(){};
		}
		else if ( typeof on_finish != 'function' )
		{
			throw new Error( 'Window.minimize(): when given, argument `on_finish` must be '
				+  'a function; ' + ( typeof on_finish ) + ' was given.' );
		}
		if ( typeof enable_or_disable == 'undefined' )
		{
			enable_or_disable = this.state == 'minimized' ? 'disable' : 'enable';
		}
		else if ( enable_or_disable != 'enable' && enable_or_disable != 'disable' )
		{
			throw new Error( 'Window.minimize(): when given, argument `enable_or_disable` must be '
				+  'either "enable" or "disable"; "' + enable_or_disable + '" was given.' );
		}

		// If we're currently maximized...
		if ( this.state == 'maximized' )
		{

			if ( enable_or_disable == 'disable' )
			{
				return; // ...No need to do anything to become un-minimized
			}
			else
			{
				// First, un-maximize, then minimize
				this.maximize( 'disable', this.minimize.bind( this, 'enable', on_finish ) );
				return;
			}
		}

		var that = this;

		// If we should minimize...
		if ( enable_or_disable == 'enable' )
		{
			// ..and we are not currently minimized
			if ( this.state != 'minimized' )
			{
				// Update our state and begin the animation of minimizing
				this.state = 'minimized';
				this.element.one( 'transitionend', function()
				{
					// Hide the window so that it no longer takes up space, and then validate our
					// owner Pane
					$( this ).hide();
					that.owner.validate()
					on_finish();
					that.save();
				} ).addClass( 'minimize-blur' );
				this.addMinimizedIcon();
			}
		}
		else if ( this.state == 'minimized' ) // Otherwise, if we should un-minimize (and are minimized)
		{
			this.state = 'normal';
			this.element.css( 'display', '' );
			setTimeout( function()
			{
				that.element.removeClass( 'minimize-blur' ).css( 'display', '' );
				that.owner.validate();
				that.save();
				on_finish();
			}, 1 );
		}
	};

	Window.prototype.updateWeightedSize = function( weight, size )
	{
		this.element.data( 'weighted_size', { weight : weight, size : size } );
		this.save();
	};

	Window.prototype.save = function()
	{
		localStorage.setItem( 'dpoh_window_size_'  + this.id, JSON.stringify( this.element.data( 'weighted_size' ) || 'false' ) );
		localStorage.setItem( 'dpoh_window_state_' + this.id, this.state );
	}

	Window.prototype.addMinimizedIcon = function()
	{
		var that = this;
		var icon = this.element.attr( 'data-minimize-icon' );
		$( '<span>' ).addClass( 'fa fa-' + icon ).appendTo( '<button class="btn">' )
			.parent()
			.data( 'related_window', this )
			.on( 'click', function()
			{
				that.minimize();
				$( this ).closest( '.btn' ).one( 'animationend', function(){
						$( this ).remove();
					} )
					.addClass( 'window-restored' );
			} )
			.prependTo('.toolbar .right' );
	}

	Window.prototype.onOtherWindowMaximized = function( e )
	{
		if ( e.window == this )
		{
			return;
		}
		this.element.addClass( 'maximize-blur' );
	}

	Window.prototype.onOtherWindowUnmaximized = function( e )
	{
		if ( e.window == this )
		{
			return;
		}
		this.element.removeClass( 'maximize-blur' );
	}
	/**
	 * @brief
	 *	Put the window into a maximized state, or take it out of a maximized state
	 *
	 * @param string   enable_or_disable OPTIONAL. When omitted, the current maximize state is
	 *                                   toggled. Must be either 'enable' or 'disable'
	 * @param function on_finish         OPTIONAL. A function to call once the window has been
	 *                                   maxinized/un-maximized
	 */
	Window.prototype.maximize = function( enable_or_disable )
	{
		// Validate arguments
		if ( typeof on_finish == 'undefined' )
		{
			on_finish = function(){};
		}
		else if ( typeof on_finish != 'function' )
		{
			throw new Error( 'Window.maximize(): when given, argument `on_finish` must be '
				+  'a function; ' + ( typeof on_finish ) + ' was given.' );
		}
		if ( typeof enable_or_disable == 'undefined' )
		{
			enable_or_disable = this.state == 'maximized' ? 'disable' : 'enable';
		}
		else if ( enable_or_disable != 'enable' && enable_or_disable != 'disable' )
		{
			throw new Error( 'Window.maximize(): when given, argument `enable_or_disable` must be '
				+  'either "enable" or "disable"; "' + enable_or_disable + '" was given.' );
		}

		// If we're currently minimized...
		if ( this.state == 'minimized' )
		{
			if ( enable_or_disable == 'disable' )
			{
				return; // ...No need to do anything to become un-maximized
			}
			else
			{
				// First, un-minimize, then maximize
				this.minimize( 'disable', this.minimize.bind( this, 'enable', on_finish ) );
				return;
			}
		}
		var that = this;

		// If we should maximize...
		if ( enable_or_disable == 'enable' )
		{
			// ..and we are not currently maximized
			if ( this.state != 'maximized' )
			{
				publish( 'window-maximized', { window : this } );
				this.state = 'maximized';
				this.element.addClass( 'maximized blurable' );
				this.maximized_placeholder = $( '<div data-role="placeholder">' )
					.css( {
						height : this.element.css( 'height' ),
						width  : this.element.css( 'width' ),
					} )
				this.element.addClass( 'no-transition' )
					.height( this.element.outerHeight() )
					.width( this.element.outerWidth() )
					.css( {
						position: 'fixed',
					} );
				this.maximized_placeholder.insertAfter( this.element );
				this.element.detach().insertAfter( '#layout_in_use' )
					.position( {
						my : 'left top',
						at : 'left top',
						of : this.maximized_placeholder,
						collision : 'none',
					} ).removeClass( 'no-transition' )
				setTimeout( function()
				{
					this.element.css( {
						width : 'calc( 100% - 20px )',
						height : 'calc( 100% - 66px )',
						top : '56px',
						left : '10px',
					} );

					publish( 'layout-changed', { pane : '*' } );
				}.bind( this ), 35 );

				this.save();
			}
		}
		else if ( this.state == 'maximized' ) // Otherwise, if we should un-maximize (and are maximized)
		{
			publish( 'window-unmaximized', { window : this } );
			this.element.removeClass( 'maximized blurable' );
			this.element.position( { 
				my : 'left top',
				at : 'left top',
				of : this.maximized_placeholder,
				collision : 'none',
			} );
			var new_css = { 
				position :  '',
				top : '',
				left : '',
				width : '',
				height: '',
			};
			this.element.css( {
					height : this.maximized_placeholder.css( 'height' ),
					width  : this.maximized_placeholder.css( 'width' ),
				} );
		setTimeout( function(){
			this.element.addClass( 'no-transition' ).detach().insertAfter( this.maximized_placeholder );
			this.maximized_placeholder.remove();
			this.maximized_placeholder = undefined;
			this.element.css( new_css ).removeClass( 'no-transition' );
			this.owner.validate();
		}.bind( this ), 200 );
			this.state = 'normal';
			this.save();
			publish( 'layout-changed', { pane : '*' } );
		}
	}

	/**
	 * @brief
	 *	Initializes all windows on the page
	 */
	Window.boot = function()
	{
		Window.all_windows = [];
		$( '[data-window-id]' ).each( function()
		{
			Window.all_windows.push( new Window( $( this ) ) );
		} );
	};

	return Window;

}( jQuery ));

$( window ).load( function()
{
	Theme2.Pane.boot();
	Theme2.Window.boot();
} );


namespace( 'Theme2' ).LayoutSelector = (function( $ )
{
	var restart_needed = false;

	function renderLayoutSelector( i, layout_only )
	{
		var el = i == 0
			? $( '#layout_in_use > :first-child' )
			: $( $( '.all-layouts' ).children()[ i - 1 ] );
		if ( !el.length )
		{
			return '';
		}

		var controls = layout_only
			? ''
			: ( '<div class="layout-controls">'
			+ el.attr( 'data-title' )
			+ ' <i class="next-layout fa fa-arrow-right"></i><i class="prev-layout fa fa-arrow-left"></i>'
			+ '</div>' );

		var layout = i == 0
			? Theme2.Pane.current_layout
			: new Theme2.Pane( el );

		var jq = $( '<div class="layout-selector-widget">' ).append( $( '<div class="layout-preview-container" data-index="' + i + '" data-layout-id="' + el.attr( 'data-split-id' ) + '">' )
				.append( layout.buildPreviewLayout() ) )
			.append( controls );

		return $( '<div>' ).append( jq ).html();
	}

	function validateLayoutModal( i )
	{
		$( '.layout-selector-widget' ).html( renderLayoutSelector( i ) );
	}

	function showLayoutSelector()
	{
		validateLayoutModal( 0 );
		Theme.Modal.show();
	}

	function buildPreviewLayout( el, n_leaf_windows )
	{
		if ( typeof n_leaf_windows != "function" )
		{
			var n_windows = n_leaf_windows;
			n_leaf_windows = function()
			{
				return '<div class="preview-window"></div>'
					+ ( n_windows > 1 ? '<div class="gutter"></div><div class="preview-window"></div>'.repeat( n_windows - 1 ) : '' );
			};
		}
		var direction = el.attr( 'data-split' );
		var pane_children = el.children( '.layout-split' );
		var return_html = '<div data-path="' + btoa( el.data( 'path' ) ) + '" class="layout-pane-preview ' + direction + ( pane_children.length ? '' : ' leaf' ) + '">';
		if ( pane_children.length )
		{
			pane_children.each( function( i )
			{
				return_html += ( i ? '<div class="gutter"></div>' : '' ) + buildPreviewLayout( $( this ), n_leaf_windows );
			} );
		}
		else
		{
			return_html += n_leaf_windows( el );
		}

		return return_html + '</div>';
	}

	function onNextLayoutClicked()
	{
		var current_index = Number( $( '.layout-preview-container' ).attr( 'data-index' ) ) + 1;
		if ( current_index > $( '.all-layouts' ).children().length )
		{
			current_index = 0;
		}

		validateLayoutModal( current_index );
	}

	function onPrevLayoutClicked()
	{
		var current_index = Number( $( '.layout-preview-container' ).attr( 'data-index' ) ) - 1;
		if ( current_index < 0 )
		{
			current_index = $( '.all-layouts' ).children().length;
		}
		validateLayoutModal( current_index );
	}

	function onUseLayoutClicked()
	{
		var layout_id = $( '.layout-preview-container' ).attr( 'data-layout-id' );
		localStorage.setItem( 'dpoh_selected_layout', layout_id );
		Theme.Modal.hide();
		location.reload();
	}

	function provideSettingsPage( e )
	{
		e.pages.push( {
			val   : 'page_layout',
			icon  : 'window-restore',
			title : 'Page Layout',
		} );
	}

	function provideSettingsPageWidgets( e )
	{
		if ( e.page == 'page_layout' )
		{
			e.widgets.push( renderLayoutSelector( 0 ) );
		}
	}

	function saveSettings()
	{
		if ( selected_layout !== false && localStorage.getItem( 'dpoh_selected_layout' ) != selected_layout )
		{
			localStorage.setItem( 'dpoh_selected_layout', selected_layout );
			restart_needed = true;
		}
	}

	var selected_layout;
	function cacheSettings( e )
	{
		if ( e.page == 'page_layout' )
		{
			selected_layout = $( '.layout-preview-container' ).attr( 'data-layout-id' );
		}
	}
	function clearCachedSettings()
	{
		selected_layout = false;
	}

	function onSettingsSaved()
	{
		if ( restart_needed )
		{
			location.reload();
		}
	}

	$( document ).on( 'click', '.next-layout', onNextLayoutClicked );
	$( document ).on( 'click', '.prev-layout', onPrevLayoutClicked );

	subscribe( 'gather-settings-pages', provideSettingsPage );
	subscribe( 'gather-settings-page-widgets', provideSettingsPageWidgets );
	subscribe( 'save-settings', saveSettings );
	subscribe( 'settings-saved', onSettingsSaved );
	subscribe( 'cache-settings', cacheSettings );
	subscribe( 'clear-cached-settings', clearCachedSettings );

	return { buildPreviewLayout : buildPreviewLayout };

}( jQuery ));

