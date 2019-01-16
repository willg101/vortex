import sessionBreakpoints from './SessionBreakpoints.module.js'

function init () {
  var frag_data = $.deparam(location.hash.substr(1))
  var bp_data = []
  if (!frag_data || !frag_data.bp) {
    return
  }

  try {
    bp_data = JSON.parse(frag_data.bp)
  } catch (e) {
    console.warn(e)
    console.warn('Frag Data: Invalid data received: ' + frag_data.bp)
    return
  }

  for (var i in bp_data) {
    var filename = bp_data[ i ].filename
    for (var j in bp_data[ i ].breakpoints) {
      sessionBreakpoints.create(filename, bp_data[ i ].breakpoints[ j ].line, bp_data[ i ].breakpoints[ j ].expression)
    }
  }
}

$(init)
