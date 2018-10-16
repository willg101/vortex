import File from './File.module.js'
export default { push, list }

const MAX_FILES_IN_HISTORY = 10
const PERSISTENT_STORAGE_KEY = 'vortexRecentFiles'

var recentFiles = []

subscribe('vortex-init', function () {
  try {
    recentFiles = JSON.parse(localStorage.getItem(PERSISTENT_STORAGE_KEY)) || []
  } catch (e) {
    recentFiles = []
  }
})

function push (file) {
  var filename = File.stripScheme(file.path)
  var currentIndex = -1
  recentFiles.some((el, i) => {
    if (el.filename == filename) {
      currentIndex = i
      return true
    }
  })
  if (currentIndex >= 0) {
    recentFiles.splice(currentIndex, 1)
  } else if (recentFiles.length >= MAX_FILES_IN_HISTORY) {
    recentFiles.pop()
  }
  recentFiles.unshift({
    filename,
    host: file.hostname,
    codebaseDir: file.codebaseRoot,
    codebaseId: file.codebaseId
  })
  localStorage.setItem(PERSISTENT_STORAGE_KEY, JSON.stringify(recentFiles))
}

function list () {
  return recentFiles
}
