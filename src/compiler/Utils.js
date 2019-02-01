module.exports = {
	parseNumberArray: parseNumberArray,
	generateShapeDefinition: generateShapeDefinition
};

function solveExpression(expr, env) {
	let execstr = "";
	for (let sym in env)
		execstr += "let @@=@@;".format(sym, env[sym]);
	return eval(execstr + expr)
}

function parseNumber(expr, env) {
	return typeof expr === 'number' ? expr : solveExpression(expr, env)
}

function parseNumberArray(arr, env) {
	for (let i = 0; i < arr.length; ++i)
		arr[i] = parseNumber(arr[i], env);
	return arr
}

function ReoComponentAtom(name, args, shape) {
	this.name = name;
	this.args = args;
	this.shape = shape;
	this.defined = false;
	this.type = 'atom';
	return this
}

ReoComponentAtom.prototype.define = function () {
	if (this.defined) return '';
	let argList = '', argmap = {};
	for (let i = 0; i < this.args.length; ++i) {
		argList += 'pos' + (i + 1) + ',';
		argmap['pos' + this.args[i]] = i + 1;
	}
	let jsSrc = this.shape;
	for (let k in argmap)
		jsSrc = jsSrc.split('#' + k).join('pos' + argmap[k]);
	this.defined = true;
	return `function draw${this.name}(${argList}){${jsSrc}}`
};

ReoComponentAtom.prototype.draw = function (ports, nodes) {
	return `draw${this.name}(${ports.map(port => '{x:' + nodes[port][0] + ',y:' + nodes[port][1] + ',name:"' + port + '"}').join(',')})`
};

function generateShapeDefinition(name, args, shape) {
	return new ReoComponentAtom(name, args, shape);
}
