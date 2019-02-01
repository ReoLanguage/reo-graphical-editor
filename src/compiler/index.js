const antlr4 = require('antlr4'),
	ReoLexer = require('./ReoLexer').ReoLexer,
	ReoParser = require('./ReoParser').ReoParser;

module.exports.ReoListenerImpl = require('./ReoListenerImpl').ReoListenerImpl;

module.exports.parse = (input, listener) => {
	antlr4.tree.ParseTreeWalker.DEFAULT.walk(
		listener,
		new ReoParser(new antlr4.CommonTokenStream(new ReoLexer(new antlr4.InputStream(input)))).file()
	)
};
