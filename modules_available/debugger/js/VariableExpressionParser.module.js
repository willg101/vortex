export default Parser

/**
 * @file
 *  Find and parse simple variable expressions to aid in showing values when expressions in the
 *  code window are hovered
 */
var TokenIterator = ace.require('./token_iterator').TokenIterator
var Range = ace.require('ace/range').Range
var variableRegex = /^variable($|\..*)/

var parseSequenceArrows = [
  function (token) {
    if (token.type == 'keyword.operator' && token.value == '->') {
      return parseActions.APPEND_CONTINUE
    } else {
      return parseActions.RETURN
    }
  },
  function (token) {
    if (variableRegex.test(token.type)) {
      return parseActions.RECURSE_RESTART
    } else if (token.type == 'identifier') {
      return parseActions.RESTART
    } else {
      return parseActions.RETURN
    }
  }
]

var parseSequenceBrackets = [
  function (token) {
    if (token.type == 'paren.lparen' && token.value == '[') {
      return parseActions.APPEND_CONTINUE
    } else {
      return parseActions.RETURN
    }
  },
  function (token) {
    if (variableRegex.test(token.type)) {
      return parseActions.RECURSE
    } else if (token.type == 'string' || token.type.match(/^constant\./)) {
      return parseActions.APPEND_CONTINUE
    } else {
      return parseActions.RETURN
    }
  },
  function (token) {
    if (token.type == 'paren.rparen' && token.value.match(/]\)*/)) {
      token.value = ']'
      return parseActions.RESTART
    } else {
      return parseActions.RETURN
    }
  }
]

var parseActions = {
  APPEND_CONTINUE: Symbol('APPEND_CONTINUE'),
  RESTART: Symbol('RESTART'),
  RECURSE: Symbol('RECURSE'),
  RECURSE_RESTART: Symbol('RECURSE_RESTART'),
  RETURN: Symbol('RETURN')
}

function Parser (tokenIterator) {
  this.iter = tokenIterator
  this.fullExpr = ''
  this.pendingExpr = ''
  this.start = tokenIterator.getCurrentTokenPosition() || { row: 0, column: 0 }
  this.end = { row: this.start.row, column: this.start.column }
}

Parser.sequences = {
  parseSequenceBrackets,
  parseSequenceArrows
}

/**
 * @brief
 *  Given a hovered token, find the variable expression that contains the hovered token
 *
 * @param TokenIterator it
 *
 * @return object|false
 *  The return value of Parser.parse(), or false if the hovered character is not within a
 *  variable expression
 */
Parser.getContainingExpression = function (it) {
  // Get the token that was hovered
  var token = it.getCurrentToken()
  var pos = token && it.getCurrentTokenPosition()

  while (token) {
    // Keep walking backwards in search of a variable token.
    while (!variableRegex.test(token.type)) {
      it.stepBackward()
      token = it.getCurrentToken()

      // If we walked back to the beginning of the token stream, or encountered an
      // expression separator, the hovered character is not within a variable expression.
      if (!token || this.expression_separators.has(token.value)) {
        return false
      }
    }

    // Create a copy of our token iterator, and pass it to parseVariableExpression, which
    // will give us `token`'s full variable expression (and modify itCopy in the process,
    // which is why we copy it)
    var itCopy = $.extend({}, it, true)
    var candidateExpr = this.parse(itCopy)

    // If the hovered character is within `token`'s full variable expression, we've found
    // the containing expression.
    if (pos.row >= candidateExpr.range.start.row &&
      pos.column >= candidateExpr.range.start.column &&
      pos.row <= candidateExpr.range.end.row &&
      pos.column <= candidateExpr.range.end.column) {
      return candidateExpr
    } else {
      // Otherwise, continue walking backwards. This covers cases where, e.g., `$bar` is
      // hovered in the expression $biz[ $foo ][ $bar ].
      it.stepBackward()
      token = it.getCurrentToken()
    }
  }
  return false
}

Parser.expression_separators = new Set([ ':', ';', ')', '(', ',' ])

Parser.prototype.selectSequence = function (token) {
  if (token) {
    var sequences = this.constructor.sequences
    for (var key in sequences) {
      var action = sequences[ key ][ 0 ](token)
      if (action != parseActions.RETURN) {
        return {
          sequence: sequences[ key ],
          action
        }
      }
    }
  }
  return false
}

Parser.prototype.next = function () {
  do {
    var current = this.iter.stepForward()
  }
  while (current && current.type == 'text' && current.value.match(/^\s+$/))
  return current
}

Parser.parse = function (tokenIterator) {
  var parser = new this(tokenIterator)
  parser.parse()
  return {
    expr: parser.fullExpr,
    range: new Range(parser.start.row, parser.start.column, parser.end.row, parser.end.column)
  }
}

Parser.prototype.parse = function () {
  var current = this.iter.getCurrentToken()

  if (current && variableRegex.test(current.type)) {
    this.fullExpr += current.value
    this.end.column += current.value.length
  } else {
    return
  }

  // Flags
  var flags = {
    skip_seek: false,
    stop: false,
    restart: false
  }
  var sequence = []
  var action

  for (var step = 0; !step || step < sequence.length; step++) {
    if (flags.skip_seek) {
      current = this.iter.getCurrentToken()
    } else {
      current = this.next()
    }

    if (step == 0) {
      let selection = this.selectSequence(current)
      if (!selection) {
        return
      }
      ({ sequence, action } = selection)
    } else {
      action = sequence[ step ](current)
    }

    flags = { no_seek: false, stop: false, restart: false }
    this.applyAction(action, current, flags)
    if (flags.stop) {
      return
    } else if (flags.restart) {
      step = -1 // Loop increment will make this 0
      continue
    }
  }
}

Parser.prototype.applyAction = function (action, token, flags) {
  flags = flags || {}
  switch (action) {
    case parseActions.APPEND_CONTINUE:
      this.pendingExpr += token.value
      break

    case parseActions.RECURSE: // fall through
    case parseActions.RECURSE_RESTART:
      var parsed = Parser.parse(this.iter)
      if (parsed) {
        this.pendingExpr += parsed.expr
        this.end.column = parsed.range.end.column // TODO: we need a pending end?
        this.end.row = parsed.range.end.row // TODO: we need a pending end?
        flags.skip_seek = true // We're already at the correct token now;
      } else {
        throw new Error('Failed to parse variable expression')
      }

      if (action == parseActions.RECURSE_RESTART) {
        this.fullExpr += this.pendingExpr
        this.pendingExpr = ''
        flags.restart = true
      }
      break

    case parseActions.RESTART:
      this.fullExpr += this.pendingExpr + token.value
      this.pendingExpr = ''
      this.end.column = this.iter.getCurrentTokenColumn() + token.value.length
      this.end.row = this.iter.getCurrentTokenRow()
      flags.restart = true
      break

    case parseActions.RETURN:
      flags.stop = true
      break
  }
}

subscribe('provide-tests', function () {
  function MockTokenIterator (tokens) {
    this.index = 0
    this.tokens = tokens
  }

  MockTokenIterator.prototype.indexInRange = function () {
    return this.index >= 0 && this.index < this.tokens.length
  }

  MockTokenIterator.prototype.getCurrentTokenColumn = function () {
    return this.indexInRange() ? this.tokens[ this.index ].col : null
  }

  MockTokenIterator.prototype.getCurrentTokenRow = function () {
    return this.indexInRange() ? this.tokens[ this.index ].row : null
  }

  MockTokenIterator.prototype.getCurrentTokenPosition = function () {
    return this.indexInRange()
      ? { row: this.tokens[ this.index ].row, column: this.tokens[ this.index ].col }
      : null
  }

  MockTokenIterator.prototype.getCurrentToken = function () {
    return this.indexInRange()
      ? { type: this.tokens[ this.index ].type, value: this.tokens[ this.index ].value }
      : null
  }

  MockTokenIterator.prototype.stepForward = function () {
    this.index = Math.min(this.tokens.length, this.index + 1)
    return this.getCurrentToken()
  }

  MockTokenIterator.prototype.stepBackward = function () {
    this.index = Math.max(-1, this.index - 1)
    return this.getCurrentToken()
  }

  function verifyResult (iter, expectedExpr, expectedRange) {
    var result = Parser.parse(iter)
    expect(!!result).toBe(true)
    expect(result.expr).toBe(expectedExpr)
    expect(result.range.start.row).toBe(expectedRange[ 0 ])
    expect(result.range.start.column).toBe(expectedRange[ 1 ])
    expect(result.range.end.row).toBe(expectedRange[ 2 ])
    expect(result.range.end.column).toBe(expectedRange[ 3 ])
  }

  describe('CodeInspector.VariableExpressionParser', function () {
    it('parse', function () {
      function verifyResult (iter, expectedExpr, expectedRange) {
        var result = Parser.parse(iter)
        expect(!!result).toBe(true)
        expect(result.expr).toBe(expectedExpr)
        expect(result.range.start.row).toBe(expectedRange[ 0 ])
        expect(result.range.start.column).toBe(expectedRange[ 1 ])
        expect(result.range.end.row).toBe(expectedRange[ 2 ])
        expect(result.range.end.column).toBe(expectedRange[ 3 ])
      }

      var emptyIter = new MockTokenIterator([])
      var trivialIter = new MockTokenIterator([
        { row: 1, col: 1, value: '$a', type: 'variable' }
      ])
      var arraySingleIndexIter = new MockTokenIterator([
        { row: 1, col: 1, value: '$abc', type: 'variable' },
        { row: 1, col: 5, value: '[', type: 'paren.lparen' },
        { row: 1, col: 6, value: '"zyx"', type: 'string' },
        { row: 1, col: 11, value: ']', type: 'paren.rparen' }
      ])
      var arrayDoubleIndexIter = new MockTokenIterator([
        { row: 1, col: 1, value: '$asdf', type: 'variable' },
        { row: 1, col: 5, value: '[', type: 'paren.lparen' },
        { row: 1, col: 6, value: '"zyx"', type: 'string' },
        { row: 1, col: 11, value: ']', type: 'paren.rparen' },
        { row: 1, col: 12, value: '[', type: 'paren.lparen' },
        { row: 1, col: 13, value: '"uv"', type: 'string' },
        { row: 1, col: 17, value: ']', type: 'paren.rparen' }
      ])
      var arrayMultilineIter = new MockTokenIterator([
        { row: 1, col: 1, value: '$defa', type: 'variable' },
        { row: 1, col: 6, value: '[', type: 'paren.lparen' },
        { row: 1, col: 7, value: '"zyx"', type: 'string' },
        { row: 1, col: 12, value: ']', type: 'paren.rparen' },
        { row: 2, col: 1, value: '    ', type: 'text' },
        { row: 2, col: 5, value: '[', type: 'paren.lparen' },
        { row: 2, col: 6, value: '"uv"', type: 'string' },
        { row: 2, col: 10, value: ']', type: 'paren.rparen' }
      ])
      var arrayVariableIndexIter = new MockTokenIterator([
        { row: 1, col: 1, value: '$fizz', type: 'variable' },
        { row: 1, col: 6, value: '[', type: 'paren.lparen' },
        { row: 1, col: 7, value: '$foo', type: 'variable' },
        { row: 2, col: 5, value: '[', type: 'paren.lparen' },
        { row: 2, col: 6, value: '"nested"', type: 'string' },
        { row: 2, col: 10, value: ']', type: 'paren.rparen' },
        { row: 1, col: 11, value: ']', type: 'paren.rparen' },
        { row: 2, col: 1, value: '    ', type: 'text' },
        { row: 2, col: 5, value: '[', type: 'paren.lparen' },
        { row: 2, col: 6, value: '"uv"', type: 'string' },
        { row: 2, col: 10, value: ']', type: 'paren.rparen' }
      ])
      var objSingleIter = new MockTokenIterator([
        { row: 1, col: 1, value: '$abc', type: 'variable' },
        { row: 1, col: 5, value: '->', type: 'keyword.operator' },
        { row: 1, col: 7, value: 'zyx', type: 'identifier' }
      ])
      var objDoubleIter = new MockTokenIterator([
        { row: 1, col: 1, value: '$abc', type: 'variable' },
        { row: 1, col: 5, value: '->', type: 'keyword.operator' },
        { row: 1, col: 7, value: 'zyx', type: 'identifier' },
        { row: 1, col: 11, value: '->', type: 'keyword.operator' },
        { row: 1, col: 13, value: 'fuzz', type: 'identifier' }
      ])
      var objMultilineIter = new MockTokenIterator([
        { row: 1, col: 1, value: '$hello', type: 'variable' },
        { row: 2, col: 1, value: '->', type: 'keyword.operator' },
        { row: 2, col: 3, value: 'foo', type: 'identifier' },
        { row: 3, col: 1, value: '->', type: 'keyword.operator' },
        { row: 3, col: 3, value: 'bar', type: 'identifier' }
      ])
      var objVariableIter = new MockTokenIterator([
        { row: 1, col: 1, value: '$hello', type: 'variable' },
        { row: 2, col: 1, value: '->', type: 'keyword.operator' },
        { row: 2, col: 3, value: '$foo', type: 'variable' },
        { row: 3, col: 1, value: '->', type: 'keyword.operator' },
        { row: 3, col: 3, value: 'bar', type: 'identifier' }
      ])
      var complexIter = new MockTokenIterator([
        { row: 1, col: 1, value: '$world', type: 'variable' },
        { row: 2, col: 1, value: '->', type: 'keyword.operator' },
        { row: 2, col: 3, value: 'buzz', type: 'identifier' },
        { row: 2, col: 7, value: '[', type: 'paren.lparen' },
        { row: 2, col: 8, value: '$_GET', type: 'variable.language' },
        { row: 2, col: 12, value: ']', type: 'paren.rparen' },
        { row: 3, col: 1, value: '->', type: 'keyword.operator' },
        { row: 3, col: 3, value: 'bar', type: 'identifier' }
      ])

      verifyResult(emptyIter, '', [ 0, 0, 0, 0 ])
      verifyResult(trivialIter, '$a', [ 1, 1, 1, 3 ])
      verifyResult(arraySingleIndexIter, '$abc["zyx"]', [ 1, 1, 1, 12 ])
      verifyResult(arrayDoubleIndexIter, '$asdf["zyx"]["uv"]', [ 1, 1, 1, 18 ])
      verifyResult(arrayMultilineIter, '$defa["zyx"]["uv"]', [ 1, 1, 2, 11 ])
      verifyResult(arrayVariableIndexIter, '$fizz[$foo["nested"]]["uv"]', [ 1, 1, 2, 11 ])
      verifyResult(objSingleIter, '$abc->zyx', [ 1, 1, 1, 10 ])
      verifyResult(objDoubleIter, '$abc->zyx->fuzz', [ 1, 1, 1, 17 ])
      verifyResult(objMultilineIter, '$hello->foo->bar', [ 1, 1, 3, 6 ])
      verifyResult(objVariableIter, '$hello->$foo->bar', [ 1, 1, 3, 6 ])
      verifyResult(complexIter, '$world->buzz[$_GET]->bar', [ 1, 1, 3, 6 ])
    })
  })
})
