import sessionBreakpoints from './SessionBreakpoints.module.js'

var idRegex = /^#frag_data:/

function init () {
  var data
  if (!location.hash.match(idRegex)) {
    return
  }

  try {
    data = JSON.parse(decodeURI(location.hash.replace(idRegex, '')))
  } catch (e) {
    console.warn(e)
    console.warn('Frag Data: Invalid data received')
    return
  }

  for (var i in data) {
    var filename = data[ i ].filename
    for (var j in data[ i ].bp_list) {
      sessionBreakpoints.create(filename, data[ i ].bp_list[ j ].line, data[ i ].bp_list[ j ].expression)
    }
  }
}

$(init)
