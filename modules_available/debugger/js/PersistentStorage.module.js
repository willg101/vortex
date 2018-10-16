class PersistentStorageError extends Error {};
var PersistentStorage = { get, set, del, PersistentStorageError }
export default PersistentStorage

var dataStore = {}

/**
 * @param string key
 *
 * @return string
 */
function reduceKeyCollisionProbability (key) {
  return 'basic_api_persistent_storage_local_storage_' + key
}

/**
 * @param string key
 */
function get (key) {
  var lsKey = reduceKeyCollisionProbability(key)
  if (!dataStore[ key ]) {
    var fromLs = localStorage.getItem(lsKey)
    if (!(fromLs === null || fromLs === undefined)) {
      try {
        dataStore[ key ] = JSON.parse(fromLs)
      } catch (e) {
        throw new PersistentStorageError('Invalid JSON: ' + fromLs)
      }
    }
  }
  return dataStore[ key ]
}

/**
 * @param string key
 * @param mixed  value
 *
 * @return mixed
 *  The item actually stored; typically `value`, but may be altered when the
 *  'set-persistent-data' is triggered
 */
function set (key, value) {
  var lsKey = reduceKeyCollisionProbability(key)
  var data = {
    key: key,
    newValue: value,
    prevent: false,
    oldValue: dataStore[ key ]
  }
  value = data.newValue
  publish('set-persistent-data', { data: data })
  if (!data.prevent) {
    localStorage.setItem(lsKey, JSON.stringify(value))
    dataStore[ key ] = value
  }
  return value
};

/**
 * @param string key
 *
 * @return bool
 *  Indicates if the deletion occurred (true) or was prevented when the 'delete-persistent-data'
 *  event was triggered (false)
 */
function del (key) {
  var lsKey = reduceKeyCollisionProbability(key)
  var data = {
    key: key,
    prevent: false,
    value: dataStore[ key ]
  }
  publish('delete-persistent-data', { data: data })
  if (!data.prevent) {
    delete dataStore[ key ]
    localStorage.removeItem(lsKey)
    return true
  }
  return false
}

// Unit tests
subscribe('provide-tests', function () {
  describe('PersistentStorage', function () {
    it('Basic Usage', function () {
      localStorage.removeItem(reduceKeyCollisionProbability('xxx'))
      expect(PersistentStorage.get('xxx')).toBeUndefined()

      PersistentStorage.set('xxx', { 'hello': 'world' })
      expect(typeof PersistentStorage.get('xxx')).toBe('object')
      expect(PersistentStorage.get('xxx').hello).toBe('world')
      expect(localStorage.getItem(reduceKeyCollisionProbability('xxx'))).toBe(JSON.stringify({ 'hello': 'world' }))

      PersistentStorage.del('xxx')
      expect(PersistentStorage.get('xxx')).toBeUndefined()
      expect(localStorage.getItem(reduceKeyCollisionProbability('xxx'))).toBeNull()

      localStorage.setItem(reduceKeyCollisionProbability('xxx-prepopulated'), JSON.stringify({ foo: 'bar' }))
      expect(typeof PersistentStorage.get('xxx-prepopulated')).toBe('object')
      expect(PersistentStorage.get('xxx-prepopulated').foo).toBe('bar')
      PersistentStorage.del('xxx-prepopulated')
      expect(PersistentStorage.get('xxx-prepopulated')).toBeUndefined()

      localStorage.setItem(reduceKeyCollisionProbability('xxx-nested'), JSON.stringify({ foo: { bar: { baz: 'fuzz' } } }))
      expect(typeof PersistentStorage.get('xxx-nested')).toBe('object')
      expect(typeof PersistentStorage.get('xxx-nested').foo).toBe('object')
      expect(typeof PersistentStorage.get('xxx-nested').foo.bar).toBe('object')
      expect(typeof PersistentStorage.get('xxx-nested').foo.bar.baz).toBe('string')
      expect(PersistentStorage.get('xxx-nested').foo.bar.baz).toBe('fuzz')
    })
  })
})
