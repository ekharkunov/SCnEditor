(function() {
  window.SCnML = {};
  SCnML.Parser = (function() {
    Parser.markerChar = /[\u0021-\u002f]|[\u003a-\u0040]|[\u005b-\u0060]/gi;
    function Parser(arcMarkers, relMarkers, preDefRelMarkers, brackets) {
      this.arcMarkers = arcMarkers;
      this.relMarkers = relMarkers;
      this.preDefRelMarkers = preDefRelMarkers;
      this.brackets = brackets;
      if (typeof this.arcMarkers === "undefined") {
        this.arcMarkers = [];
      }
      if (typeof this.relMarkers === "undefined") {
        this.relMarkers = [];
      }
      if (typeof this.brackets === "undefined") {
        this.brackets = [];
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
    Parser.prototype.parseId = function(current, hasUnderscore) {
      var ch;
      if (typeof current === "undefined") {
        return this.parseId('', false);
      } else {
        ch = this.src[0];
        if (ch !== '\n' && (ch !== ':' || !hasUnderscore)) {
          hasUnderscore = ch === '_' || ((ch === ' ' || ch === '\t') && hasUnderscore);
          this.moveNextChar();
          return this.parseId(current + ch, hasUnderscore);
        } else {
          return current;
        }
      }
    };
    Parser.prototype.parseComponentInner = function(parent, indent) {
      var arc, arcMarker, conn, id, predef, rel;
      this.parseNewLine();
      while (this.getIndent() === indent) {
        this.parseIndent();
        arcMarker = this.parseArcMarker();
        if (arcMarker != null) {
          this.parseSpace();
          arc = new SCnML.Arc(arcMarker);
          parent.addChild(arc);
          this.parseInlineComponent(arc, indent);
        } else {
          rel = this.parseRelMarker();
          if (rel != null) {
            this.parseSpace();
            id = this.parseId();
            conn = new SCnML.Connective(rel, id);
            parent.addChild(conn);
            this.parseComponents(conn, indent + 1);
          } else {
            predef = this.parsePredefRelMarker();
            if (predef != null) {
              this.parseSpace();
              conn = new SCnML.Connective(predef[0], predef[1]);
              parent.addChild(conn);
              this.parseInlineComponent(conn, indent);
            } else {
              throw "Expected Arc or Relation marker at line " + this.getCurrentLine() + "!";
            }
          }
        }
        this.parseNewLine();
      }
    };
    Parser.prototype.markerFollows = function() {
      var m, _i, _j, _len, _len2, _ref, _ref2;
      _ref = this.arcMarkers;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        m = _ref[_i];
        if (this.startsWith(m)) {
          return true;
        }
      }
      _ref2 = this.relMarkers;
      for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
        m = _ref2[_j];
        if (this.startsWith(m)) {
          return true;
        }
      }
      return false;
    };
    Parser.prototype.bracketFollows = function() {
      var b, _i, _len, _ref;
      _ref = this.brackets;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        b = _ref[_i];
        if (this.startsWith(b[0])) {
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
      var attrs, comp, conn, content, frame, id;
      content = this.parseContent();
      if (content != null) {
        comp = new SCnML.Component(content.type, content.content);
        parent.addChild(comp);
      } else {
        attrs = [];
        id = this.parseId();
        this.parseSpace();
        while (this.src[0] === ':') {
          this.moveNextChar();
          this.parseSpace();
          attrs.push(id);
          id = this.parseId();
          this.parseSpace();
        }
        if (id === '[' && !this.bracketFollows()) {
          this.squareBrackets++;
          this.moveNextChar();
          frame = new SCnML.Frame(attrs);
          parent.addChild(frame);
          this.parseFrame(frame, arcMarker, indent + 1);
        } else if (id === '{' && !this.bracketFollows()) {
          this.curlyBrackets++;
          this.moveNextChar();
          conn = new SCnML.Connective('undef', 'undef', attrs);
          parent.addChild(conn);
          this.parseComponents(conn, indent + 1);
        } else {
          comp = new SCnML.Component("ID", id, attrs);
          parent.addChild(comp);
        }
      }
      this.parseComponentInner(comp, indent + 1);
      return true;
    };
    Parser.prototype.parseContent = function() {
      var c, _i, _len, _ref;
      _ref = this.brackets;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        c = _ref[_i];
        if (this.startsWith(c[0])) {
          this.moveNextChar(c[0].length);
          return {
            type: c[2],
            content: this.readUntil(c[1])
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
    Parser.prototype.parseMarker = function() {
      var m;
      m = this.parseArcMarker();
      if (m != null) {
        return {
          type: 'arc',
          marker: m
        };
      } else {
        m = this.parseRelMarker();
        if (m != null) {
          return {
            type: 'rel',
            marker: m
          };
        } else {
          m = this.parsePredefRelMarker();
          if (m != null) {
            return {
              type: 'predef',
              marker: m
            };
          } else {
            return null;
          }
        }
      }
    };
    Parser.prototype.parseArcMarker = function() {
      var m, _i, _len, _ref;
      _ref = this.arcMarkers;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        m = _ref[_i];
        if (this.isMatchMarker(m)) {
          this.moveNextChar(m.length);
          return m;
        }
      }
      return null;
    };
    Parser.prototype.parseRelMarker = function() {
      var m, _i, _len, _ref;
      _ref = this.relMarkers;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        m = _ref[_i];
        if (this.isMatchMarker(m)) {
          this.moveNextChar(m.length);
          return m;
        }
      }
      return null;
    };
    Parser.prototype.parsePredefRelMarker = function() {
      var m, _i, _len, _ref;
      _ref = this.preDefRelMarkers;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        m = _ref[_i];
        if (this.isMatchMarker(m[0])) {
          this.moveNextChar(m[0].length);
          return m;
        }
      }
      return null;
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
    Article.prototype.toString = function() {
      var child, string, _i, _len, _ref;
      string = "(article[" + this.concept + "]:\n";
      _ref = this.childs;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        child = _ref[_i];
        string += "\n\t" + child.toString().replace("\n", "\n\t", "mg");
      }
      string += "\n)";
      return string;
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
    }
    Component.prototype.toString = function() {
      var attr, child, string, _i, _j, _len, _len2, _ref, _ref2;
      string = "(component[" + this.type + "] {";
      if (typeof this.attrs === 'object') {
        _ref = this.attrs;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          attr = _ref[_i];
          string += attr + ": ";
        }
      }
      string += this.text + "}:\n";
      _ref2 = this.childs;
      for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
        child = _ref2[_j];
        string += "\n\t" + child.toString().replace("\n", "\n\t", "mg");
      }
      string += "\n)";
      return string;
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
  SCnML.Frame = (function() {
    function Frame(attrs) {
      this.attrs = attrs;
      this.childs = [];
    }
    Frame.prototype.toString = function() {
      var attr, child, string, _i, _j, _len, _len2, _ref, _ref2;
      string = "(frame ";
      if (typeof this.attrs === 'object') {
        _ref = this.attrs;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          attr = _ref[_i];
          string += attr + ": ";
        }
      }
      string += this.text + "\n";
      _ref2 = this.childs;
      for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
        child = _ref2[_j];
        string += "\n\t" + child.toString().replace("\n", "\n\t", "mg");
      }
      return string += "\n)";
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
  SCnML.Arc = (function() {
    function Arc(marker) {
      this.marker = marker;
      this.childs = [];
    }
    Arc.prototype.toString = function() {
      var string;
      string = "(arc[" + this.marker + "]\n\t";
      if (this.childs.length > 0) {
        string += this.childs[0].toString().replace("\n", "\n\t", "mg");
      }
      string += "\n)";
      return string;
    };
    Arc.prototype.addChild = function(child) {
      this.childs.push(child);
    };
    Arc.prototype.getChilds = function() {
      return this.childs;
    };
    Arc.prototype.getClassName = function() {
      return "Arc";
    };
    return Arc;
  })();
  SCnML.Connective = (function() {
    function Connective(marker, text, attrs) {
      this.marker = marker;
      this.text = text;
      this.attrs = attrs;
      this.childs = [];
    }
    Connective.prototype.toString = function() {
      var attr, child, string, _i, _j, _len, _len2, _ref, _ref2;
      string = "(connective[" + this.marker + "] ";
      if (typeof this.attrs === 'object') {
        _ref = this.attrs;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          attr = _ref[_i];
          string += attr + ": ";
        }
      }
      string += this.text + "{" + this.text + "}:\n";
      _ref2 = this.childs;
      for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
        child = _ref2[_j];
        string += "\n\t" + child.toString().replace("\n", "\n\t", "mg");
      }
      string += "\n)";
      return string;
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
