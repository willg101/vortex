var $ = jQuery

var requiredMethods = [
  'evalCommand',
  'getBytesOfMemoryUsed',
  'getConsoleInfo',
  'getConsoleFormatter',
  'globDirectory',
  'getLanguageNameForEditor',
  'getHostname',
  'getCodebaseRoot'
]

class LanguageAbstractor {
  constructor (name) {
    this.name = name
    this.validateMethods()
  }

  validateMethods () {
    requiredMethods.forEach(name => {
      if (typeof this[ name ] !== 'function') {
        throw new this.constructor.Error(`${this.constructor.name}: Missing required method "${name}"`)
      }
    })
  }
}

LanguageAbstractor.setDefault = function (language) {
  if (language instanceof this) {
    this.defaultLanguage = language
  } else {
    throw new this.Error('Cannot use the given language: it is not an instance of ' +
      'LanguageAbstractor')
  }
}

LanguageAbstractor.getDefault = function () {
  if (!this.defaultLanguage) {
    throw new this.Error('No default language is available')
  }

  return this.defaultLanguage
}

requiredMethods.forEach(methodName => {
  LanguageAbstractor[ methodName ] = (...args) => LanguageAbstractor.getDefault()[ methodName ](...args)
})

LanguageAbstractor.Error = class extends Error {}

LanguageAbstractor.NO_CREATE_SESSION = 1

export default LanguageAbstractor
