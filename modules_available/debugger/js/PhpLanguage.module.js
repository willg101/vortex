import ProgrammingLanguage from './ProgrammingLanguage.module.js'

class PhpLanguage extends ProgrammingLanguage
{
	async getBytesOfMemoryUsed()
	{
		var data = await BasicApi.Debugger.command( 'eval', 'memory_get_usage()' );
		var mem_data = data.parsed.value[ 0 ] || {};
		return mem_data.value;
	}
}

ProgrammingLanguage.setDefault( new PhpLanguage( 'php' ) );
