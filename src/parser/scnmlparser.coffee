window.SCnML = {}

class SCnML.Parser

	@markerChar = /[\u0021-\u002f]|[\u003a-\u0040]|[\u005b-\u0060]/gi;

	constructor: (@arcMarkers, @relMarkers, @preDefRelMarkers, @brackets) ->
		if typeof @arcMarkers == "undefined"
			@arcMarkers = []
		if typeof @relMarkers == "undefined"
			@relMarkers = []
		if typeof @brackets == "undefined"
			@brackets = []

	parse: (@source) ->
		@prepareSource()
		@initParser()
		return @parseArticle()

	prepareSource: ->
		@source = @removeComments()
		@source = @source.replace /\r\n/ig, "\n"
		@source = @source.replace /^\s*\n/igm, ""
		return

	removeComments: ->
		newSource = ''
		inComment = hasBackSlash = false
		i = 0
		len = @source.length - 1
		while i < len
			c1 = @source[i]
			c2 = @source[i+1]
			if inComment
				if c1 == '*' and c2 == '/' and !hasBackSlash
					inComment = false
					i++
			else
				if c1 == '/' and c2 == '*' and !hasBackSlash
					inComment = true
					i++
				else
					newSource += c1
			hasBackSlash = !hasBackSlash and c1 == '\\'
			i++
		if !inComment
			newSource += @source[len]
		return newSource;

	initParser: ->
		@src = @source
		@pos = @squareBrackets = @curlyBrackets = 0
		return

	parseArticle: ->
		indent = @parseIndent()
		concept = @parseId()
		return null if concept is null
		article = new SCnML.Article concept
		@parseComponentInner article, indent + 1
		return article

	parseId: (current, hasUnderscore) ->
		if typeof current == "undefined"
			return @parseId '', false
		else
			ch = @src[0]
			if ch != '\n' and (ch != ':' or !hasUnderscore)
				hasUnderscore = ch == '_' or ((ch == ' ' or ch == '\t') and hasUnderscore)
				@moveNextChar()
				return @parseId current + ch, hasUnderscore
			else
				return current

	parseComponentInner: (parent, indent) ->
		@parseNewLine()
		while @getIndent() == indent
			@parseIndent()
			arcMarker = @parseArcMarker()
			if arcMarker?
				@parseSpace()
				arc = new SCnML.Arc arcMarker
				parent.addChild arc
				@parseInlineComponent arc, indent
			else
				rel = @parseRelMarker()
				if rel?
					@parseSpace()
					id = @parseId()
					conn = new SCnML.Connective rel, id
					parent.addChild conn
					@parseComponents conn, indent + 1
				else
					predef = @parsePredefRelMarker()
					if predef?
						@parseSpace()
						conn = new SCnML.Connective predef[0], predef[1]
						parent.addChild conn
						@parseInlineComponent conn, indent
					else
						throw "Expected Arc or Relation marker at line " + @getCurrentLine() + "!"
			@parseNewLine()
		return

	markerFollows: ->
		for m in @arcMarkers when @startsWith m
			return true
		for m in @relMarkers when @startsWith m
			return true
		return false

	bracketFollows: ->
		for b in @brackets when @startsWith b[0]
			return true
		return false

	parseFrame: (parent, arcMarker, indent) ->
		@parseNewLine()
		while @getIndent() == indent
			@parseIndent()
			if @src[0] == ']'
				@squareBrackets--
				@moveNextChar()
				return
			arc = new SCnML.Arc arcMarker
			parent.addChild arc
			@parseInlineComponent arc, indent
			@parseNewLine()
		if @squareBrackets > 0
			throw "Expected closing square bracket at line " + @getCurrentLine() + "!"

	parseComponents: (parent, indent) ->
		@parseNewLine()
		while @getIndent() == indent
			@parseIndent()
			if @src[0] == '}'
				if @curlyBrackets > 0
					@curlyBrackets--
					@moveNextChar()
					return
				else
					throw "Unexpected '}' at line " + @getCurrentLine() + "!"
			@parseInlineComponent parent, indent
			@parseNewLine()
		return

	parseInlineComponent: (parent, indent) ->
		content = @parseContent()
		if content?
			comp = new SCnML.Component content.type, content.content
			parent.addChild comp
		else
			attrs = []
			id = @parseId()
			@parseSpace()
			while @src[0] == ':'
				@moveNextChar()
				@parseSpace()
				attrs.push id
				id = @parseId()
				@parseSpace()
			if id == '[' and !@bracketFollows()
				@squareBrackets++
				@moveNextChar()
				frame = new SCnML.Frame attrs
				parent.addChild frame
				@parseFrame frame, arcMarker, indent + 1
			else if id == '{' and !@bracketFollows()
				@curlyBrackets++
				@moveNextChar()
				conn = new SCnML.Connective 'undef', 'undef', attrs
				parent.addChild conn
				@parseComponents conn, indent + 1
			else
				comp = new SCnML.Component "ID", id, attrs
				parent.addChild comp
		@parseComponentInner comp, indent + 1
		return true

	parseContent: ->
		for c in @brackets when @startsWith c[0]
			@moveNextChar c[0].length
			return {
				type: c[2],
				content: @readUntil c[1]
			}
		return null

	readUntil: (str, current, hasBackSlash) ->
		if typeof current == 'undefined'
			return @readUntil str, '', false
		else
			if @startsWith(str) and !hasBackSlash
				@moveNextChar str.length
				return current
			else
				ch = @src[0]
				hasBackSlash = !hasBackSlash and ch == '\\'
				@moveNextChar()
				if !hasBackSlash
					current += ch
				return @readUntil str, current, hasBackSlash

	parseMarker: ->
		m = @parseArcMarker()
		if m?
			return {type: 'arc', marker: m}
		else
			m = @parseRelMarker()
			if m?
				return {type: 'rel', marker: m}
			else
				m = @parsePredefRelMarker()
				if m?
					return {type: 'predef', marker: m}
				else
					return null

	parseArcMarker: ->
		for m in @arcMarkers when @isMatchMarker m
			@moveNextChar m.length
			return m
		return null

	parseRelMarker: ->
		for m in @relMarkers when @isMatchMarker m
			@moveNextChar m.length
			return m
		return null

	parsePredefRelMarker: ->
		for m in @preDefRelMarkers when @isMatchMarker m[0]
			@moveNextChar m[0].length
			return m
		return null

	isMatchMarker: (marker) ->
		nextChar = @src[marker.length]
		return @startsWith(marker) and (nextChar == ' ' or nextChar == '\t')

	startsWith: (str) ->
		result = true
		result = result and @src[i] == str[i] for i in [0..str.length-1]
		return result

	parseNewLine: ->
		@moveNextChar() while (@src[0] == '\n')
		return

	parseSpace: ->
		@moveNextChar() while @src[0] == ' ' or @src[0] == '\t'
		return

	parseIndent: (current) ->
		if typeof current == "undefined"
			return @parseIndent 0
		else
			ch = @src[0]
			if ch == ' '
				current++
			else if (ch == '\t')
				current += 4 - (current + 4) % 4
			else
				return (current - current % 4) / 4
			@moveNextChar()
			return @parseIndent current

	getIndent: (current, offset) ->
		if typeof current == "undefined"
			return @getIndent 0, 0
		else
			ch = @src[offset]
			if ch == ' '
				current++
			else if (ch == '\t')
				current += 4 - (current + 4) % 4
			else
				return (current - current % 4) / 4
			offset++
			return @getIndent current, offset

	moveNextChar: (count) ->
		count = 1 if typeof count != "number"
		@pos += count
		@src = @src.substring(count)

	getCurrentLine: ->
		count = i = 0
		while i < @pos
			count++ if @source[i++] == '\n'
		return count + 1

class SCnML.Article

	constructor: (@concept) ->
		@childs = []

	toString: ->
		string = "(article[" + @concept + "]:\n"
		string += "\n\t" + child.toString().replace("\n", "\n\t", "mg") for child in @childs
		string += "\n)"
		return string

	addChild: (child) ->
		@childs.push child
		return

	getChilds: ->
		return @childs

	getClassName: ->
		return "Article"

class SCnML.Component

	constructor: (@type, @text, @attrs) ->
		@childs = []

	toString: ->
		string = "(component[" + @type + "] {"
		if typeof @attrs == 'object'
			string += attr + ": " for attr in @attrs
		string += @text + "}:\n"
		string += "\n\t" + child.toString().replace("\n", "\n\t", "mg") for child in @childs
		string += "\n)"
		return string

	addChild: (child) ->
		@childs.push child
		return

	getChilds: ->
		return @childs

	getAttrs: ->
		return @attrs

	getClassName: ->
		return "Component"

class SCnML.Frame

	constructor: (@attrs)->
		@childs = []

	toString: ->
		string = "(frame "
		if typeof @attrs == 'object'
			string += attr + ": " for attr in @attrs
		string += @text + "\n"
		string += "\n\t" + child.toString().replace("\n", "\n\t", "mg") for child in @childs
		string += "\n)"

	addChild: (child) ->
		@childs.push child
		return

	getChilds: ->
		return @childs

	getAttrs: ->
		return @attrs

	getClassName: ->
		return "Frame"

class SCnML.Arc

	constructor: (@marker) ->
		@childs = []

	toString: ->
		string = "(arc[" + @marker + "]\n\t"
		string += @childs[0].toString().replace("\n", "\n\t", "mg") if @childs.length > 0
		string += "\n)"
		return string

	addChild: (child) ->
		@childs.push child
		return

	getChilds: ->
		return @childs

	getClassName: ->
		return "Arc"

class SCnML.Connective

	constructor: (@marker, @text, @attrs) ->
		@childs = []

	toString: ->
		string = "(connective[" + @marker + "] "
		if typeof @attrs == 'object'
			string += attr + ": " for attr in @attrs
		string += @text + "{" + @text + "}:\n"
		string += "\n\t" + child.toString().replace("\n", "\n\t", "mg") for child in @childs
		string += "\n)"
		return string

	addChild: (child) ->
		@childs.push child
		return

	getChilds: ->
		return @childs

	getAttrs: ->
		return @attrs

	getClassName: ->
		return "Connective"