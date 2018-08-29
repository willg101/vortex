export default { basename, dirname, stripScheme, bytesToHumanReadable };

var $ = jQuery;

var File = {}

function normalize( filename )
{
	filename = filename || '';
	return filename.replace( /([^\/]+)\/+$/, '$1' );
}

/**
 * @param string filename
 * @retval string
 */
function basename( filename )
{
	return normalize( filename ).replace( /^.*\//, '' );
}

/**
 * @param string filename
 * @retval string
 */
function dirname( filename )
{
	filename = normalize( filename );
	if ( !filename.match( /^([A-z]+:\/)?\// ) )
	{
		filename = './' + filename;
	}
	return filename.replace( /(^|\/+)[^\/]+$/, '/' );
}

/**
 * @param string filename
 * @retval string
 */
function stripScheme( filename )
{
	return normalize( filename ).replace( /^file:\/\//, '' );
}

/**
 * @param int size
 * @retval string
 */
function bytesToHumanReadable( size )
{
	if ( size == 0 )
	{
		return '0 B';
	}
	var i = Math.floor( Math.log( size ) / Math.log(1024) );
	return ( size / Math.pow( 1024, i) ).toFixed (2 ) * 1 + ' ' + [ 'B', 'kB', 'MB', 'GB', 'TB' ][ i ];
}

subscribe( 'provide-tests', function()
{
	describe( 'File', function()
	{
		it( 'basename', function()
		{
			expect( basename( 'abc.html' ) ).toBe( 'abc.html' );
			expect( basename( '/abc.html/' ) ).toBe( 'abc.html' );
			expect( basename( '/root/abc.html' ) ).toBe( 'abc.html' );
			expect( basename( '//abc.html' ) ).toBe( 'abc.html' );
		} );

		it( 'dirname', function()
		{
			expect( dirname( 'abc.html' ) ).toBe( './' );
			expect( dirname( '/abc.html/' ) ).toBe( '/' );
			expect( dirname( '/' ) ).toBe( '/' );
			expect( dirname( '/root/abc.html' ) ).toBe( '/root/' );
			expect( dirname( 'file:///root/abc.html' ) ).toBe( 'file:///root/' );
			expect( dirname( '//abc.html' ) ).toBe( '/' );
		} );

		it( 'stripScheme', function()
		{
			expect( stripScheme( 'abc.html' ) ).toBe( 'abc.html' );
			expect( stripScheme( '/abc.html/' ) ).toBe( '/abc.html' );
			expect( stripScheme( '/abc.html' ) ).toBe( '/abc.html' );
			expect( stripScheme( 'file://abc.html' ) ).toBe( 'abc.html' );
			expect( stripScheme( '/var/file://abc.html' ) ).toBe( '/var/file://abc.html' );
		} );

		it( 'bytesToHumanReadable', function()
		{
			expect( bytesToHumanReadable( 0 ) ).toBe( '0 B' );
			expect( bytesToHumanReadable( 50 ) ).toBe( '50 B' );
			expect( bytesToHumanReadable( 1024 ) ).toBe( '1 kB' );
			expect( bytesToHumanReadable( 1536 ) ).toBe( '1.5 kB' );
			expect( bytesToHumanReadable( 3 * 1024 * 1024 ) ).toBe( '3 MB' );
			expect( bytesToHumanReadable( 4 * 1024 * 1024 * 1024 ) ).toBe( '4 GB' );
			expect( bytesToHumanReadable( 5 * 1024 * 1024 * 1024 * 1024 ) ).toBe( '5 TB' );
		} );
	} );
} );
