import ReoLexer from './ReoLexer';
import ReoParser from './ReoParser';
import antlr4 from 'antlr4';

export { default as ReoListenerImpl } from './ReoListenerImpl';

export function parse (input, listener) {
	antlr4.tree.ParseTreeWalker.DEFAULT.walk(
		listener,
		new ReoParser(new antlr4.CommonTokenStream(new ReoLexer(new antlr4.InputStream(input)))).file()
	)
}
