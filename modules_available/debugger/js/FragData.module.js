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
    for (var j in data[ i ].bpList) {
      sessionBreakpoints.create(filename, data[ i ].bpList[ j ].line, data[ i ].bpList[ j ].expression)
    }
  }
}

$(init)
