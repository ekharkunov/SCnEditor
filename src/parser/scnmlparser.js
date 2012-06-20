(function() {
  window.SCnML = {};
  SCnML.Parser = (function() {
    function Parser(markers, contentLimits) {
      this.markers = markers;
      this.contentLimits = contentLimits;
      if (typeof this.predefinedRelMarkers === "undefined") {
        this.predefinedRelMarkers = [];
      }
      if (typeof this.customRelMarkers === "undefined") {
        this.customRelMarkers = [];
      }
      if (typeof this.contentLimits === "undefined") {
        this.contentLimits = [];
      }
    }
    Parser.prototype.parse = function(source) {
      this.source = source;
      this.prepareSource();
      this.initParser();
      return this.parseArticle();
    };
    Parser.prototype.prepareSource = function() {
      this.source = this.removeComments();
      this.source = this.source.replace(/\r\n/ig, "\n");
      this.source = this.source.replace(/^\s*\n/igm, "");
    };
    Parser.prototype.removeComments = function() {
      var c1, c2, hasBackSlash, i, inComment, len, newSource;
      newSource = '';
      inComment = hasBackSlash = false;
      i = 0;
      len = this.source.length - 1;
      while (i < len) {
        c1 = this.source[i];
        c2 = this.source[i + 1];
        if (inComment) {
          if (c1 === '*' && c2 === '/' && !hasBackSlash) {
            inComment = false;
            i++;
          }
        } else {
          if (c1 === '/' && c2 === '*' && !hasBackSlash) {
            inComment = true;
            i++;
          } else {
            newSource += c1;
          }
        }
        hasBackSlash = !hasBackSlash && c1 === '\\';
        i++;
      }
      if (!inComment) {
        newSource += this.source[len];
      }
      return newSource;
    };
    Parser.prototype.initParser = function() {
      this.src = this.source;
      this.pos = this.squareBrackets = this.curlyBrackets = 0;
    };
    Parser.prototype.parseArticle = function() {
      var article, concept, indent;
      indent = this.parseIndent();
      concept = this.parseId();
      if (concept === null) {
        return null;
      }
      article = new SCnML.Article(concept);
      this.parseComponentInner(article, indent + 1);
      return article;
    };
    Parser.prototype.parseId = function() {
      var ch, hasUnderscore, id, _i, _len, _ref;
      id = "";
      hasUnderscore = false;
      _ref = this.src;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        ch = _ref[_i];
        if (ch !== '\n' && (ch !== ':' || !hasUnderscore)) {
          hasUnderscore = ch === '_' || ((ch === ' ' || ch === '\t') && hasUnderscore);
          id += ch;
        } else {
          this.moveNextChar(id.length);
          return id;
        }
      }
    };
    Parser.prototype.parseComponentInner = function(parent, indent) {
      var conn, marker, relation;
      this.parseNewLine();
      while (this.getIndent() === indent) {
        this.parseIndent();
        marker = this.parseMarker();
        if (marker != null) {
          switch (marker.set) {
            case "predefined":
              conn = new SCnML.Connective(marker.type, marker.relation);
              parent.addChild(conn);
              this.parseInlineComponent(conn, indent);
              break;
            case "custom":
              this.parseSpace();
              relation = this.parseId();
              conn = new SCnML.Connective(marker.type, relation);
              parent.addChild(conn);
              this.parseComponents(conn, indent + 1);
          }
        } else {
          throw "Expected marker ar line " + this.getCurrentLine() + ".";
        }
        this.parseNewLine();
      }
    };
    Parser.prototype.parseMarker = function() {
      var m, _i, _len, _ref;
      _ref = this.markers;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        m = _ref[_i];
        if (this.isMatchMarker(m[0])) {
          this.moveNextChar(m[0].length);
          return m[1];
        }
      }
      return null;
    };
    Parser.prototype.contentFollows = function() {
      var c, _i, _len, _ref;
      _ref = this.contentLimits;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        c = _ref[_i];
        if (this.startsWith(c.begin)) {
          return true;
        }
      }
      return false;
    };
    Parser.prototype.parseFrame = function(parent, arcMarker, indent) {
      var arc;
      this.parseNewLine();
      while (this.getIndent() === indent) {
        this.parseIndent();
        if (this.src[0] === ']') {
          this.squareBrackets--;
          this.moveNextChar();
          return;
        }
        arc = new SCnML.Arc(arcMarker);
        parent.addChild(arc);
        this.parseInlineComponent(arc, indent);
        this.parseNewLine();
      }
      if (this.squareBrackets > 0) {
        throw "Expected closing square bracket at line " + this.getCurrentLine() + "!";
      }
    };
    Parser.prototype.parseComponents = function(parent, indent) {
      this.parseNewLine();
      while (this.getIndent() === indent) {
        this.parseIndent();
        if (this.src[0] === '}') {
          if (this.curlyBrackets > 0) {
            this.curlyBrackets--;
            this.moveNextChar();
            return;
          } else {
            throw "Unexpected '}' at line " + this.getCurrentLine() + "!";
          }
        }
        this.parseInlineComponent(parent, indent);
        this.parseNewLine();
      }
    };
    Parser.prototype.parseInlineComponent = function(parent, indent) {
      var attrs, comp, content, frame, id, set;
      attrs = [];
      while (this.attrFollows()) {
        id = this.parseId();
        this.moveNextChar();
        this.parseSpace();
        attrs.push(id);
      }
      this.parseSpace();
      if (this.contentFollows()) {
        content = this.parseContent();
        if (content != null) {
          comp = new SCnML.Component(content.type, content.content, attrs);
          parent.addChild(comp);
        } else {
          throw "Content expected at line " + this.getCurrentLine() + ".";
        }
      } else if (this.src[0] === '{') {
        this.curlyBrackets++;
        this.moveNextChar();
        set = new SCnML.Set(attrs);
        parent.addChild(set);
        this.parseComponents(set, indent + 1);
      } else if (this.src[0] === '[') {
        this.squareBrackets++;
        this.moveNextChar();
        frame = new SCnML.Frame(attrs);
        parent.addChild(frame);
        this.parseFrame(frame, arcMarker, indent + 1);
      } else {
        id = this.parseId();
        comp = new SCnML.Component("ID", id, attrs);
        parent.addChild(comp);
      }
      this.parseComponentInner(comp, indent + 1);
      return true;
    };
    Parser.prototype.attrFollows = function() {
      var attr, ch, hasUnderscore, _i, _len, _ref, _results;
      attr = "";
      hasUnderscore = false;
      _ref = this.src;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        ch = _ref[_i];
        if (ch !== '\n' && (ch !== ':' || !hasUnderscore)) {
          hasUnderscore = ch === '_' || ((ch === ' ' || ch === '\t') && hasUnderscore);
          attr += ch;
        } else if (ch === ':') {
          return attr.length > 0;
        } else {
          return false;
        }
      }
      return _results;
    };
    Parser.prototype.parseContent = function() {
      var c, _i, _len, _ref;
      _ref = this.contentLimits;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        c = _ref[_i];
        if (this.startsWith(c.begin)) {
          this.moveNextChar(c.begin.length);
          return {
            type: c.type,
            content: this.readUntil(c.end)
          };
        }
      }
      return null;
    };
    Parser.prototype.readUntil = function(str, current, hasBackSlash) {
      var ch;
      if (typeof current === 'undefined') {
        return this.readUntil(str, '', false);
      } else {
        if (this.startsWith(str) && !hasBackSlash) {
          this.moveNextChar(str.length);
          return current;
        } else {
          ch = this.src[0];
          hasBackSlash = !hasBackSlash && ch === '\\';
          this.moveNextChar();
          if (!hasBackSlash) {
            current += ch;
          }
          return this.readUntil(str, current, hasBackSlash);
        }
      }
    };
    Parser.prototype.isMatchMarker = function(marker) {
      var nextChar;
      nextChar = this.src[marker.length];
      return this.startsWith(marker) && (nextChar === ' ' || nextChar === '\t');
    };
    Parser.prototype.startsWith = function(str) {
      var i, result, _ref;
      result = true;
      for (i = 0, _ref = str.length - 1; 0 <= _ref ? i <= _ref : i >= _ref; 0 <= _ref ? i++ : i--) {
        result = result && this.src[i] === str[i];
      }
      return result;
    };
    Parser.prototype.parseNewLine = function() {
      while (this.src[0] === '\n') {
        this.moveNextChar();
      }
    };
    Parser.prototype.parseSpace = function() {
      while (this.src[0] === ' ' || this.src[0] === '\t') {
        this.moveNextChar();
      }
    };
    Parser.prototype.parseIndent = function(current) {
      var ch;
      if (typeof current === "undefined") {
        return this.parseIndent(0);
      } else {
        ch = this.src[0];
        if (ch === ' ') {
          current++;
        } else if (ch === '\t') {
          current += 4 - (current + 4) % 4;
        } else {
          return (current - current % 4) / 4;
        }
        this.moveNextChar();
        return this.parseIndent(current);
      }
    };
    Parser.prototype.getIndent = function(current, offset) {
      var ch;
      if (typeof current === "undefined") {
        return this.getIndent(0, 0);
      } else {
        ch = this.src[offset];
        if (ch === ' ') {
          current++;
        } else if (ch === '\t') {
          current += 4 - (current + 4) % 4;
        } else {
          return (current - current % 4) / 4;
        }
        offset++;
        return this.getIndent(current, offset);
      }
    };
    Parser.prototype.moveNextChar = function(count) {
      if (typeof count !== "number") {
        count = 1;
      }
      this.pos += count;
      return this.src = this.src.substring(count);
    };
    Parser.prototype.getCurrentLine = function() {
      var count, i;
      count = i = 0;
      while (i < this.pos) {
        if (this.source[i++] === '\n') {
          count++;
        }
      }
      return count + 1;
    };
    return Parser;
  })();
  SCnML.Article = (function() {
    function Article(concept) {
      this.concept = concept;
      this.childs = [];
    }
    Article.prototype.getXml = function() {
      var child, root, _i, _len, _ref;
      root = $('<SCnArticle/>');
      root.append($('<Concept />').text(this.concept));
      _ref = this.childs;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        child = _ref[_i];
        root.append(child.getXml());
      }
      return root;
    };
    Article.prototype.addChild = function(child) {
      this.childs.push(child);
    };
    Article.prototype.getChilds = function() {
      return this.childs;
    };
    Article.prototype.getClassName = function() {
      return "Article";
    };
    return Article;
  })();
  SCnML.Component = (function() {
    function Component(type, text, attrs) {
      this.type = type;
      this.text = text;
      this.attrs = attrs;
      this.childs = [];
      if (typeof this.attrs === "undefined") {
        this.attrs = [];
      }
    }
    Component.prototype.getXml = function() {
      var attr, child, root, _i, _j, _len, _len2, _ref, _ref2;
      root = $('<Component/>');
      if (this.type === "ID") {
        root.append($('<Id/>').text(this.text));
      } else {
        root.append($('<Type/>').text(this.type));
        root.append($('<Content/>').text(this.text));
      }
      _ref = this.attrs;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        attr = _ref[_i];
        root.append($('<Attr />').text(attr));
      }
      _ref2 = this.childs;
      for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
        child = _ref2[_j];
        root.append(child.getXml());
      }
      return root;
    };
    Component.prototype.addChild = function(child) {
      this.childs.push(child);
    };
    Component.prototype.getChilds = function() {
      return this.childs;
    };
    Component.prototype.getAttrs = function() {
      return this.attrs;
    };
    Component.prototype.getClassName = function() {
      return "Component";
    };
    return Component;
  })();
  SCnML.Set = (function() {
    function Set(attrs) {
      this.attrs = attrs;
      this.childs = [];
      if (typeof this.attrs === "undefined") {
        this.attrs = [];
      }
    }
    Set.prototype.getXml = function() {
      var attr, child, root, _i, _j, _len, _len2, _ref, _ref2;
      root = $('<Set/>');
      _ref = this.attrs;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        attr = _ref[_i];
        root.append($('<Attr />').text(attr));
      }
      _ref2 = this.childs;
      for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
        child = _ref2[_j];
        root.append(child.getXml());
      }
      return root;
    };
    Set.prototype.addChild = function(child) {
      this.childs.push(child);
    };
    Set.prototype.getChilds = function() {
      return this.childs;
    };
    Set.prototype.getAttrs = function() {
      return this.attrs;
    };
    Set.prototype.getClassName = function() {
      return "Set";
    };
    return Set;
  })();
  SCnML.Frame = (function() {
    function Frame(attrs) {
      this.attrs = attrs;
      this.childs = [];
      if (typeof this.attrs === "undefined") {
        this.attrs = [];
      }
    }
    Frame.prototype.getXml = function() {
      var attr, child, root, _i, _j, _len, _len2, _ref, _ref2;
      root = $('<Frame/>');
      _ref = this.attrs;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        attr = _ref[_i];
        root.append($('<Attr />').text(attr));
      }
      _ref2 = this.childs;
      for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
        child = _ref2[_j];
        root.append(child.getXml());
      }
      return root;
    };
    Frame.prototype.addChild = function(child) {
      this.childs.push(child);
    };
    Frame.prototype.getChilds = function() {
      return this.childs;
    };
    Frame.prototype.getAttrs = function() {
      return this.attrs;
    };
    Frame.prototype.getClassName = function() {
      return "Frame";
    };
    return Frame;
  })();
  SCnML.Connective = (function() {
    function Connective(type, relation, attrs) {
      this.type = type;
      this.relation = relation;
      this.attrs = attrs;
      this.childs = [];
      if (typeof this.attrs === "undefined") {
        this.attrs = [];
      }
    }
    Connective.prototype.getXml = function() {
      var attr, child, root, _i, _j, _len, _len2, _ref, _ref2;
      root = $('<Connective/>');
      root.append($('<Type/>').text(this.type));
      root.append($('<Relation/>').text(this.relation));
      _ref = this.attrs;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        attr = _ref[_i];
        root.append($('<Attr />').text(attr));
      }
      _ref2 = this.childs;
      for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
        child = _ref2[_j];
        root.append(child.getXml());
      }
      return root;
    };
    Connective.prototype.addChild = function(child) {
      this.childs.push(child);
    };
    Connective.prototype.getChilds = function() {
      return this.childs;
    };
    Connective.prototype.getAttrs = function() {
      return this.attrs;
    };
    Connective.prototype.getClassName = function() {
      return "Connective";
    };
    return Connective;
  })();
}).call(this);
