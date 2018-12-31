import Persistor from './Persistor.module.js'

const BP_CANDIDATE_CACHE_SIZE = 30
const BP_CANDIDATE_PERSISTOR_KEY = 'bp_candidate_cache'

var $ = jQuery

var currentBreakpointCandidates = []
var bpcCache;

subscribe('vortex-init', function () {
  var bpcCachePersistor   = new Persistor(BP_CANDIDATE_PERSISTOR_KEY)
  var bpcCacheProxyTarget = new LRUMap(BP_CANDIDATE_CACHE_SIZE, (bpcCachePersistor.map || []).map(e => [ e.key, e.value ]))

  bpcCache = new Proxy(bpcCacheProxyTarget, {
    get : function(target, key) {
      if (key == 'set') {
        return function(key, value) {
          var rval = target.set(key, value)
          bpcCachePersistor.map = target.toJSON()
          return rval
        }
      } else {
        return target[key]
      }
    }
  })
})

subscribe('file-changed', async function (e) {
  currentBreakpointCandidates.forEach(line => e.editor.getSession().removeGutterDecoration(e.line - 1, 'breakpoint-candidate'))
  currentBreakpointCandidates = []
  var newBreakpointCandidates = await getBreakpointCandidatesForFile(e.fileContents)
  if (newBreakpointCandidates && newBreakpointCandidates.length) {
    newBreakpointCandidates.forEach( bp => e.editor.getSession().addGutterDecoration(bp - 1, 'breakpoint-candidate') );
    currentBreakpointCandidates = newBreakpointCandidates
  }
})

async function getBreakpointCandidatesForFile (fileContents) {
  var fileHash = md5(fileContents)
  var bpCandidates = bpcCache.get(fileHash)
  if (bpCandidates) {
    return bpCandidates
  } else {
    bpCandidates = await getBreakpointCandidatesForFileFromServer(fileContents);
    bpcCache.set(fileHash, bpCandidates)
    return bpCandidates
  }
}

async function getBreakpointCandidatesForFileFromServer(fileContents) {
  var serverData = await $.post(makeUrl('get_breakpoint_candidates'), {code: fileContents})
  return (serverData || {}).breakpointCandidates
}
