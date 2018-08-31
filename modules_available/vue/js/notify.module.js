// This trivial wrapper around toastr allows other themes to use their own notification system
vTheme.notify = ( level, msg, title, options ) =>
{
	return toastr[ level ]( msg, title, options );
};
