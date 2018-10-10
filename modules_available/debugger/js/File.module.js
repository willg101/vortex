export default { basename, dirname, stripScheme, bytesToHumanReadable,
	convertToCodebaseRelativePath, convertFromCodebaseRelativePath, isCodebaseRelative };

var $ = jQuery;

var File = {}

const CODEBASE_RELATIVE_PATH_ID_SEPARATOR = '::';

function normalize( filename )
{
	filename = filename || '';
	return filename.replace( /([^\/]+)\/+$/, '$1' );
}

/**
 * @param string filename
 * @return string
 */
function basename( filename )
{
	return normalize( filename ).replace( /^.*\//, '' );
}

/**
 * @param string filename
 * @return string
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
 * @return string
 */
function stripScheme( filename )
{
	return normalize( filename ).replace( /^file:\/\//, '' );
}

/**
 * @param int size
 * @return string
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

/**
 * @param string path
 * @param string codebase_id
 * @param string codebase_root
 *
 * @return string
 */
function convertToCodebaseRelativePath( path, codebase_id, codebase_root )
{
	var path_stripped = stripScheme( path ).replace( /^\/+/, '/' );
	codebase_root = stripScheme( codebase_root ).replace( /^\/+/, '/' );

	if ( path_stripped.startsWith( codebase_root ) )
	{
		return codebase_id + CODEBASE_RELATIVE_PATH_ID_SEPARATOR
			+ path_stripped.replace( codebase_root, '' ).replace( /^\/+/, '' );
	}
	else
	{
		return path;
	}
}

/**
 * @param string path
 * @param string codebase_id
 * @param string codebase_root
 *
 * @return string
 */
function convertFromCodebaseRelativePath( path, codebase_id, codebase_root )
{
	codebase_id += CODEBASE_RELATIVE_PATH_ID_SEPARATOR;
	if ( !path.startsWith( codebase_id ) )
	{
		return path;
	}
	return codebase_root.replace( /\/*$/, '/' ) + path.replace( codebase_id, '' );
}

/**
 * @param string path
 *
 * @return bool
 */
function isCodebaseRelative( path )
{
	return path.search( CODEBASE_RELATIVE_PATH_ID_SEPARATOR ) !== -1
		&& !path.startsWith( CODEBASE_RELATIVE_PATH_ID_SEPARATOR )
		&& !path.endsWith( CODEBASE_RELATIVE_PATH_ID_SEPARATOR );
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

		let sep = CODEBASE_RELATIVE_PATH_ID_SEPARATOR;

		it( 'convertToCodebaseRelativePath', function()
		{
			expect( convertToCodebaseRelativePath( 'file:///a/b/c.php', 'test', '/a' ) ).toBe( `test${sep}b/c.php` );
			expect( convertToCodebaseRelativePath( '/a/b/c.php',        'test', 'file:///a' ) ).toBe( `test${sep}b/c.php` );
			expect( convertToCodebaseRelativePath( 'file:///d/b/c.php', 'test', '/a' ) ).toBe( 'file:///d/b/c.php' );
			expect( convertToCodebaseRelativePath( '/a/b/c.php',        'test', '/a' ) ).toBe( `test${sep}b/c.php` );
			expect( convertToCodebaseRelativePath( '/a/b/c.php',        'test', '/b' ) ).toBe( '/a/b/c.php' );
		} );

		it( 'convertFromCodebaseRelativePath', function()
		{
			expect( convertFromCodebaseRelativePath( `test${sep}b/c.php`, 'test', 'file:///a' ) ).toBe( 'file:///a/b/c.php' );
			expect( convertFromCodebaseRelativePath( `test${sep}b/c.php`, 'test', '/a/' ) ).toBe( '/a/b/c.php' );
			expect( convertFromCodebaseRelativePath( `foo${sep}d/e.php`,  'test', '/b' ) ).toBe( `foo${sep}d/e.php` );
		} );

		it( 'isCodebaseRelative', function()
		{
			expect( isCodebaseRelative( `test${sep}b/c.php` ) ).toBe( true );
			expect( isCodebaseRelative( `${sep}b/c.php` ) ).toBe( false );
			expect( isCodebaseRelative( `test${sep}` ) ).toBe( false );
		} );
	} );
} );
