grammar SCnGrammar;

/*options {
  language = JavaScript;
}
*/

scn_article
	: concept field+
	;

field
	: binary_relation | sub | belonging | synonymy | sem_eq
	;


concept
	: id
	;

binary_relation
	: ('=>' | '<=') SPACE* attribute* id binary_relation_comp+
	;

fragment
binary_relation_comp
	: id | content
	;

sub
	: ('@->' | '@->>' | '<-@' | '<<-@') SPACE* attribute* (block | id)
	;

belonging
	: ('->' | '<-') SPACE* attribute* (block | id)
	;

synonymy
	: '=' SPACE* attribute* id
	;

sem_eq
	: '~' SPACE* attribute* content
	;


content
	: '["/'  (~('/"]'))+ '/"]'
	;

contour
	: '[' id+ SPACE* ']'
	;

block
	: '{' id+ SPACE* '}'
	;

attribute
	: id SPACE* ':'SPACE*
	;

fragment
id
	: LITERAL (SPACE LITERAL)*
	;


WHITESPACES
	: (INDENT | WS) {$channel = HIDDEN;}
	;

LITERAL
	: ('\u0410'..'\u042F'
	| '\u0430'..'\u044F'
	| '\u0401' | '\u0451'
	| 'a'..'z'
	| 'A'..'Z'
	| '0'..'9'
	| '_'
	| '-'
	| ','
	| '('
	| ')'
	| ';'
	| '.'
	| '<'
	| '>'
	| '*')+
	;

SPACE
	: ' '
	;
fragment
INDENT
	: '\t'
	| SPACE SPACE SPACE SPACE
	;

COMMENT
    :   '//' ~('\n'|'\r')* '\r'? '\n' {$channel=HIDDEN;}
    |   '/*' ( options {greedy=false;} : . )* '*/'
    ;
fragment
WS  :   ( '\r'
        | '\n'
        )
    ;

STRING
    :  '"' ( ESC_SEQ | ~('\\'|'"') )* '"'
    ;

fragment
HEX_DIGIT : ('0'..'9'|'a'..'f'|'A'..'F') ;

fragment
ESC_SEQ
    :   '\\' ('b'|'t'|'n'|'f'|'r'|'\"'|'\''|'\\')
    |   UNICODE_ESC
    |   OCTAL_ESC
    ;

fragment
OCTAL_ESC
    :   '\\' ('0'..'3') ('0'..'7') ('0'..'7')
    |   '\\' ('0'..'7') ('0'..'7')
    |   '\\' ('0'..'7')
    ;

fragment
UNICODE_ESC
    :   '\\' 'u' HEX_DIGIT HEX_DIGIT HEX_DIGIT HEX_DIGIT
    ;
