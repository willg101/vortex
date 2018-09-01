import Persistor from '../../../debugger/js/Persistor.module.js'
import Pane      from './Pane.module.js'
export default Window

var attr = {
	window_id     : 'data-window-id',
	minimize_icon : 'data-minimize-icon',
};

var selectors = {
	minimize_btn              : '.btn.minimize',
	maximize_btn              : '.btn.maximize',
	unmaximize_btn            : '.btn.unmaximize',
	minimized_icons_container : '.toolbar .right',
	current_layout            : '#layout_in_use',
};

/**
 * @brief
 *	Constructor for a Window
 *
 * @param HTMLElement|jQuery
 */
function Window( el )
{
	this.element = $( el );
	this.id      = this.element.attr( attr.window_id ); // used in saving/restoring state

	this.persistor = new Persistor( this.id + '_persistor' );
	this.element.data( 'window', this );

	// Find out which Pane should contain this window, and then attach to validate that Pane
	Pane.current_layout.suggestOwner( this ).attach( this );

	if ( this.state == 'minimized' )
	{
		this.state = 'normal';
		this.minimize();
	}
	else if ( this.state == 'maximized' )
	{
		this.state = 'normal';
		this.maximize();
	}
	else
	{
		this.state = 'normal';
	}

	$( selectors.minimize_btn, el ).on( 'click', this.minimize.bind( this, undefined, undefined ) );
	$( selectors.maximize_btn + ', ' + selectors.unmaximize_btn, el ).on( 'click', this.maximize.bind( this, undefined, undefined ) );
	subscribe( 'window-maximized',   this.onOtherWindowMaximized.bind( this ) );
	subscribe( 'window-unmaximized', this.onOtherWindowUnmaximized.bind( this ) );
}

Object.defineProperty( Window.prototype, 'state', {
	get : function()
	{
		return this.persistor.state;
	},
	set : function( val )
	{
		this.persistor.state = val;
		return val;
	},
} );

Object.defineProperty( Window.prototype, 'size', {
	get : function()
	{
		return this.persistor.size;
	},
	set : function( val )
	{
		this.persistor.size = val;
		return val;
	},
} );

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
				that.owner.refresh()
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
			that.owner.refresh();
			that.save();
			on_finish();
		}, 1 );
	}
};

Window.prototype.save = function()
{
	//localStorage.setItem( 'dpoh_window_state_' + this.id, this.state );
}

Window.prototype.addMinimizedIcon = function()
{
	var that = this;
	var icon = this.element.attr( attr.minimize_icon );
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
		.prependTo( selectors.minimized_icons_container );
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
Window.prototype.maximize = function( enable_or_disable, on_finish )
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
			this.element.detach().insertAfter( selectors.current_layout )
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
		this.owner.refresh();
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
	$( '[' + attr.window_id + ']' ).each( function()
	{
		Window.all_windows.push( new Window( $( this ) ) );
	} );
};

subscribe( 'pane-boot', Window.boot );
