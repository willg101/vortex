import Storage from './PersistentStorage.module.js'
export default Persistor

function generateLocalStorageItemKey (widgetKey, itemKey) {
  return widgetKey + '_::_' + itemKey
}

function Persistor (widgetKey) {
  this.__widgetKey__ = widgetKey
  return new Proxy(this, {
    get: function (target, itemKey) {
      if (typeof target[ itemKey ] === 'undefined') {
        target[ itemKey ] = Storage.get(generateLocalStorageItemKey(target.__widgetKey__, itemKey))
      }
      return target[ itemKey ]
    },

    set: function (target, itemKey, itemValue) {
      if (typeof itemValue === 'undefined') {
        delete this[ itemKey ]
      } else {
        target[ itemKey ] = itemValue
        Storage.set(generateLocalStorageItemKey(target.__widgetKey__, itemKey), itemValue)
      }

      return true
    },

    deleteProperty: function (target, itemKey) {
      delete target[ itemKey ]
      Storage.del(generateLocalStorageItemKey(target.__widgetKey__, itemKey))
      return true
    },

    ownKeys: function (target) {
      var keys = Object.keys(target)
      for (var i = 0; i < localStorage.length; i++) {
        if (localStorage.key(i).startsWith(target.__widgetKey__ + '_::_')) {
          keys.push(localStorage.key(i))
        }
      }
      var removeIndex = keys.indexOf('__widgetKey__')
      if (removeIndex >= 0) {
        keys.splice(removeIndex, 1)
      }
      return keys
    }
  })
}

Persistor.PersistorError = class PersistorError extends Error {}

// Unit tests
subscribe('provide-tests', function () {
  describe('Persistor', function () {
    it('Basic Usage', function () {
      var emptyPersistor = new Persistor('xxx-empty')
      delete emptyPersistor.proportion
      delete emptyPersistor.index

      expect(emptyPersistor.proportion).toBeUndefined()
      expect(emptyPersistor.index).toBeUndefined()

      var proportion = Math.random()
      var index = Math.random()
      var fillablePersistor = new Persistor('xxx-fillable')
      fillablePersistor.proportion = proportion
      fillablePersistor.index = index

      expect(fillablePersistor.proportion).toBe(proportion)
      expect(fillablePersistor.index).toBe(index)

      proportion = Math.random()
      index = Math.random()
      fillablePersistor.proportion = proportion
      fillablePersistor.index = index
      expect(fillablePersistor.proportion).toBe(proportion)
      expect(fillablePersistor.index).toBe(index)

      var prepoluatedPersistor = new Persistor('xxx-fillable')
      expect(prepoluatedPersistor.proportion).toBe(proportion)
      expect(prepoluatedPersistor.index).toBe(index)

      delete fillablePersistor.proportion
      delete fillablePersistor.index

      expect(fillablePersistor.proportion).toBeUndefined()
      expect(fillablePersistor.index).toBeUndefined()
    })
  })
})
