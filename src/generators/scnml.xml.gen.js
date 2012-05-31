(function() {
  if (typeof window.SCnML === "undefined") {
    window.SCnML = {};
  }
  SCnML.XmlGenerator = (function() {
    function XmlGenerator(parser) {
      this.parser = parser;
    }
    XmlGenerator.prototype.toXml = function(source) {
      var tree;
      tree = this.parser.parse(source);
      return this.articleToXml(tree);
    };
    XmlGenerator.prototype.articleToXml = function(article) {
      var child, root, _i, _len, _ref;
      root = $('<SCnArticle />');
      root.append($('<Id>' + article.concept + '</id>'));
      _ref = article.getChilds();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        child = _ref[_i];
        childToXml(child, root);
      }
      return root;
    };
    XmlGenerator.prototype.childToXml = function(child, node) {
      switch (child.getClassName()) {
        case "Connective":
          return this.connectiveToXml(node, child);
        case "Arc":
          return this.arcToXml(node, child);
        case "Frame":
          return this.frameToXml(node, child);
        case "Component":
          return this.componentToXml(node, child);
      }
    };
    XmlGenerator.prototype.connectiveToXml = function(xmlNode, node) {
      var attr, attrs, xml, _i, _len;
      xml = $('<connective></connective>');
      if (node.marker !== 'undef') {
        xml.append($('<marker>' + node.marker + '</marker>'));
      }
      if (node.text !== 'undef') {
        xml.append($('<relation>' + node.text + '</relation>'));
      }
      attrs = node.getAttrs();
      if (attrs != null) {
        for (_i = 0, _len = attrs.length; _i < _len; _i++) {
          attr = attrs[_i];
          xml.append($('<attr>${attr}</attr>'));
        }
      }
      $(xmlNode).append(xml);
    };
    XmlGenerator.prototype.arcToXml = function(xmlNode, node) {
      var attr, attrs, target, xml, _i, _len;
      xml = $('<arc></arc>');
      if (node.marker !== 'undef') {
        xml.append($('<marker>' + node.marker + '</marker>'));
      }
      target = $('<node />');
      if (node.text !== 'undef') {
        xml.append($('<node>' + node.text + '</node>'));
      }
      attrs = node.getAttrs();
      if (attrs != null) {
        for (_i = 0, _len = attrs.length; _i < _len; _i++) {
          attr = attrs[_i];
          xml.append($('<attr>${attr}</attr>'));
        }
      }
      $(xmlNode).append(xml);
    };
    XmlGenerator.prototype.frameToXml = function(xmlNode, node) {};
    XmlGenerator.prototype.componentToXml = function(xmlNode, node) {};
    return XmlGenerator;
  })();
}).call(this);
