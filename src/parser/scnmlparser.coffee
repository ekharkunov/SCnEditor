#
# This file contains Semantic Code natural Markup Language parser
# that will be compiled into JavaScript target.
#
# This is a part of OSTIS technology (see http://ostis.net)
#
# Authors:	Burov Alexander (burikella@gmail.com)
#			Kharkunov Eugene (filosovj@mail.ru)
#
# Juny, 2012
#

window.SCnML = {}

class SCnML.Parser

	constructor: (@markers, @contentLimits) ->
		if typeof @predefinedRelMarkers == "undefined"
			@predefinedRelMarkers = []
		if typeof @customRelMarkers == "undefined"
			@customRelMarkers = []
		if typeof @contentLimits == "undefined"
			@contentLimits = []

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

	parseId: ->
		id = ""
		hasUnderscore = false
		for ch in @src
			if ch != '\n' and (ch != ':' or !hasUnderscore)
				hasUnderscore = ch == '_' or ((ch == ' ' or ch == '\t') and hasUnderscore)
				id += ch
			else
				@moveNextChar id.length
				return id

	parseComponentInner: (parent, indent) ->
		@parseNewLine()
		while @getIndent() == indent
			@parseIndent()
			marker = @parseMarker()
			if marker?
				switch marker.set
					when "predefined"
						conn = new SCnML.Connective marker.type, marker.relation
						parent.addChild conn
						@parseInlineComponent conn, indent
					when "custom"
						@parseSpace()
						relation = @parseId()
						conn = new SCnML.Connective marker.type, relation
						parent.addChild conn
						@parseComponents conn, indent + 1
			else
				throw "Expected marker ar line " + @getCurrentLine() + "."
			@parseNewLine()
		return

	parseMarker: ->
		for m in @markers when @isMatchMarker m[0]
			@moveNextChar m[0].length
			return m[1]
		return null

	contentFollows: ->
		for c in @contentLimits when @startsWith c.begin
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
		attrs = []
		while @attrFollows()
			id = @parseId()
			@moveNextChar()
			@parseSpace()
			attrs.push id
		@parseSpace()
		if @contentFollows()
			content = @parseContent()
			if content?
				comp = new SCnML.Component content.type, content.content, attrs
				parent.addChild comp
			else
				throw "Content expected at line " + @getCurrentLine() + "."
		else if @src[0] == '{'
			@curlyBrackets++
			@moveNextChar()
			set = new SCnML.Set attrs
			parent.addChild set
			@parseComponents set, indent + 1
		else if @src[0] == '['
			@squareBrackets++
			@moveNextChar()
			frame = new SCnML.Frame attrs
			parent.addChild frame
			@parseFrame frame, arcMarker, indent + 1
		else
			id = @parseId()
			comp = new SCnML.Component "ID", id, attrs
			parent.addChild comp
		@parseComponentInner comp, indent + 1
		return true

	attrFollows: ->
		attr = ""
		hasUnderscore = false
		for ch in @src
			if ch != '\n' and (ch != ':' or !hasUnderscore)
				hasUnderscore = ch == '_' or ((ch == ' ' or ch == '\t') and hasUnderscore)
				attr += ch
			else if ch == ':'
				return attr.length > 0;
			else
				return false

	parseContent: ->
		for c in @contentLimits when @startsWith c.begin
			@moveNextChar c.begin.length
			return {
				type: c.type,
				content: @readUntil c.end
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

	getXml: ->
		root = $ '<SCnArticle/>'
		root.append $('<Concept />').text @concept
		root.append child.getXml() for child in @childs
		return root

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
		if typeof @attrs == "undefined"
			@attrs = []

	getXml: ->
		root = $ '<Component/>'
		if @type == "ID"
			root.append $('<Id/>').text @text
		else
			root.append $('<Type/>').text @type
			root.append $('<Content/>').text @text
		root.append $('<Attr />').text attr for attr in @attrs
		root.append child.getXml() for child in @childs
		return root

	addChild: (child) ->
		@childs.push child
		return

	getChilds: ->
		return @childs

	getAttrs: ->
		return @attrs

	getClassName: ->
		return "Component"

class SCnML.Set

	constructor: (@attrs)->
		@childs = []
		if typeof @attrs == "undefined"
			@attrs = []

	getXml: ->
		root = $ '<Set/>'
		root.append $('<Attr />').text attr for attr in @attrs
		root.append child.getXml() for child in @childs
		return root

	addChild: (child) ->
		@childs.push child
		return

	getChilds: ->
		return @childs

	getAttrs: ->
		return @attrs

	getClassName: ->
		return "Set"

class SCnML.Frame

	constructor: (@attrs)->
		@childs = []
		if typeof @attrs == "undefined"
			@attrs = []

	getXml: ->
		root = $ '<Frame/>'
		root.append $('<Attr />').text attr for attr in @attrs
		root.append child.getXml() for child in @childs
		return root

	addChild: (child) ->
		@childs.push child
		return

	getChilds: ->
		return @childs

	getAttrs: ->
		return @attrs

	getClassName: ->
		return "Frame"

class SCnML.Connective

	constructor: (@type, @relation, @attrs) ->
		@childs = []
		if typeof @attrs == "undefined"
			@attrs = []

	getXml: ->
		root = $ '<Connective/>'
		root.append $('<Type/>').text @type
		root.append $('<Relation/>').text @relation
		root.append $('<Attr />').text attr for attr in @attrs
		root.append child.getXml() for child in @childs
		return root

	addChild: (child) ->
		@childs.push child
		return

	getChilds: ->
		return @childs

	getAttrs: ->
		return @attrs

	getClassName: ->
		return "Connective"