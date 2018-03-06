
namespace( 'Vue.Layout' ).Pane = (function( $ )
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
			Vue.Pane.current_layout.validateAll();
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

		publish( 'pane-boot' );
	};

	$( Pane.boot.bind( Pane ) );

	return Pane;
}( jQuery ));

