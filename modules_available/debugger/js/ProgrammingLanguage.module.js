var $ = jQuery;

var requiredTranslations = [ 'getBytesOfMemoryUsed' ];

class ProgrammingLanguageTranslator
{
	constructor( name )
	{
		this.name = name;
		this.validateTranslations()
	}

	validateTranslations()
	{
		requiredTranslations.forEach( key =>
		{
			if ( typeof this[ key ] != 'function' )
			{
				throw new ProgrammingLanguageError( `${this.constructor}: Missing required translator "${key}"` );
			}
		} );
	}
}

ProgrammingLanguageTranslator.setDefault = function( language )
{
	if ( language instanceof this )
	{
		this.defaultLanguage = language;
	}
	else
	{
		throw new this.Error( 'Cannot use the give language: it is not an instance of '
			+ 'ProgrammingLanguageTranslator' );
	}
};
ProgrammingLanguageTranslator.getDefault = function(){ return this.defaultLanguage };


ProgrammingLanguageTranslator.tx = function( key, ...args )
{
	if ( !this.defaultLanguage )
	{
		throw new this.Error( 'No default language is available' );
	}
	else if ( typeof this.defaultLanguage[ key ] != 'function' )
	{
		var name = this.defaultLanguage.name;
		throw new this.Error( `The default language '${name}' cannot translation '${key}'` );
	}
	return this.defaultLanguage[ key ]( ...args );
}

ProgrammingLanguageTranslator.Error = class extends Error {}

export default ProgrammingLanguageTranslator
