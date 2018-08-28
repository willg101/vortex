import File from './File.module.js'
export default { push, list }

var $ = jQuery

const MAX_FILES_IN_HISTORY   = 10;
const PERSISTENT_STORAGE_KEY = 'vortexRecentFiles';

var recentFiles = [];

subscribe( 'vortex-init', function()
{
	try
	{
		recentFiles = JSON.parse( localStorage.getItem( PERSISTENT_STORAGE_KEY ) ) || [];
	}
	catch ( e )
	{
		recentFiles = [];
	}
} );

function push( filename )
{
	filename = File.stripScheme( filename );
	var currentIndex = recentFiles.indexOf( filename );
	if ( currentIndex >= 0 )
	{
		recentFiles.splice( currentIndex, 1 );
	}
	else if ( recentFiles.length >= MAX_FILES_IN_HISTORY )
	{
		recentFiles.pop();
	}
	recentFiles.unshift( filename );
	localStorage.setItem( PERSISTENT_STORAGE_KEY, JSON.stringify( recentFiles ) );
}

function list()
{
	return recentFiles;
}
