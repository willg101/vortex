import Debugger from './Debugger.module.js'
import LanguageAbstractor from './LanguageAbstractor.module.js'
export default { get, listRecentlyModified, apiPath, clearCache }

var $ = jQuery

// Cached copies of files that have been requested since the most recent pageload; keys are
// absolute paths of files
var filecache = {}

/**
 * @brief
 *  Gets the content of a file or directory directly from the server (i.e., ignores the cache)
 *
 * @param string   path The absolute path of the file
 * @param function cb   Handles the response from the server; passed up to two arguments:
 *                       - A boolean indicating if the file was found
 *                       - A string containing the file's contents/an array containing objects
 *                         for the files within the directory
 */
async function fetchFromSever (path, cb) {
  var hostnamePromise = LanguageAbstractor.getHostname()

  if (Debugger.sessionIsActive()) {
    if (!path.match(/^file:\/\//)) {
      path = 'file://' + path
    }

    var message = await Debugger.command('source', { file: path })
    var hostname = await hostnamePromise
    var codebaseRoot = await LanguageAbstractor.getCodebaseRoot(path)

    if (message.jqMessage.find(' > error[code=100]').length) {
      message.parsed.fileContents = false
    }
    var contents = message.parsed.fileContents || false
    var errorReason = !contents && (message.isStopping ? 'stopping' : (message.isStopped ? 'stopped' : 'other'))
    if (!errorReason) {
      filecache[ path ] = {
        contents,
        hostname,
        path,
        codebaseRoot: codebaseRoot.root,
        codebaseId: codebaseRoot.id
      }
    }
    return new Promise((resolve, reject) => contents ? resolve(filecache[ path ]) : reject(errorReason))
  } else {
    return new Promise((resolve, reject) => {
      $.get(apiPath(path), async function (info) {
        var hostname = await hostnamePromise
        info.hostname = hostname
        filecache[ path ] = {
          contents: info.contents,
          hostname,
          path,
          codebaseRoot: info.root,
          codebaseId: info.id
        }
        resolve(filecache[ path ])
      }).fail(function (errorReason) {
        reject(errorReason)
      })
    })
  }
}

/**
 * @brief
 *  Generate the URL to request a file's contents
 *
 * @param string path    The absolute path of the file to load
 * @param object filters An object containing GET params to include with the request
 *
 * @return string
 */
function apiPath (path, filters) {
  filters = typeof filters === 'object' ? filters : {}
  return makeUrl('file/' + path) + (Object.keys(filters) ? '?' + $.param(filters) : '')
}

/**
 * @brief
 *  Gets the contents of a file or directory
 *
 * @param string   path       @c fetchFromSever()
 * @param bool     skipCache  OPTIONAL. Default is FALSE. When true, ignores the cache and
 *                            sends a request to the server for the file
 */
function get (path, skipCache) {
  path = path.replace(/^file:\/\//, '')

  if (!skipCache && typeof filecache[ path ] !== 'undefined') {
    return new Promise(resolve => resolve(filecache[ path ]))
  } else {
    return fetchFromSever(path)
  }
}

/**
 * @brief
 *  Gets a list of the most recently modified files within the 'watched' directories on the
 *  server
 *
 * @param function cb   Handles the response from the server; passed two arguments:
 *                       - A boolean indicating if the response indicates success
 *                       - An array of objects, each containing the keys 'fullpath', 'is_dir',
 *                         'name'
 */
function listRecentlyModified (cb) {
  $.get(makeUrl('recent_files'), function (data) {
    cb(true, data)
  }).fail(function (status) {
    cb(false, status)
  })
}

/**
 * @brief
 *  Clears part or all of the file cache
 *
 * @param string file OPTIONAL. When given, removes the cached value for the given file;
 *                              when omitted, the entire cache is cleared.
 */
function clearCache (file) {
  if (file) {
    delete filecache[ file ]
  } else {
    filecache = {}
  }
}
