if typeof window.SCnML == "undefined"
	window.SCnML = {}

class SCnML.XmlGenerator

	constructor: (@parser) ->

	toXml: (source) ->
		tree = @parser.parse source
		return @articleToXml tree

	articleToXml: (article) ->
		root = $('<SCnArticle />')
		root.append($('<Id>' + article.concept + '</id>'))
		for child in article.getChilds()
			childToXml child, root
		return	root

	childToXml: (child, node) ->
		switch child.getClassName()
			when "Connective"
				@connectiveToXml node, child
			when "Arc"
				@arcToXml node, child
			when "Frame"
				@frameToXml node, child
			when "Component"
				@componentToXml node, child

	connectiveToXml: (xmlNode, node) ->
		xml = $ '<connective></connective>'
		xml.append $ '<marker>' + node.marker + '</marker>' if node.marker != 'undef'
		xml.append $ '<relation>' + node.text + '</relation>' if node.text != 'undef'
		attrs = node.getAttrs()
		if attrs?
			for attr in attrs
				xml.append $ '<attr>${attr}</attr>'
		$(xmlNode).append xml
		return

	arcToXml: (xmlNode, node) ->
		xml = $ '<arc></arc>'
		xml.append $ '<marker>' + node.marker + '</marker>' if node.marker != 'undef'
		target = $ '<node />'

		xml.append $ '<node>' + node.text + '</node>' if node.text != 'undef'
		attrs = node.getAttrs()
		if attrs?
			for attr in attrs
				xml.append $ '<attr>${attr}</attr>'
		$(xmlNode).append xml
		return

	frameToXml: (xmlNode, node) ->
		return

	componentToXml: (xmlNode, node) ->
		return