const ReoListener = require('./ReoListener').ReoListener;
const utils = require('./Utils');
const parseNumberArray = utils.parseNumberArray, generateShapeDefinition = utils.generateShapeDefinition;
module.exports.ReoListenerImpl = ReoListenerImpl;


// This class defines a complete listener for a parse tree produced by ReoParser.
function ReoListenerImpl(sourceLoader) {
	ReoListener.call(this);
	this.sourceLoader = sourceLoader;
	this.componentDefinitions = {};
	// this.imports = new Set();
	// this.sections = {};
	this.componentNames = {};
	// this.components = {};
	this.ports = {};
	this.cachedCode = "";
	return this
}

ReoListenerImpl.prototype = Object.create(ReoListener.prototype);
ReoListenerImpl.prototype.constructor = ReoListenerImpl;

ReoListenerImpl.prototype.includeSource = async function (url) {
	this.sourceLoader(url, this.extractMetadata)
};

ReoListenerImpl.prototype.extractMetadata = function (str) {
	let m2 = /^\s*\/\*!(.*?)!\*\//g.exec(str.replace(/[\n\r]/g, ''));
	if (m2) {
		let mstr = m2[1].trim();
		// convert back to json
		// convert block type to json valid string, replace : with ` because regex isn't powerful enough for this
		mstr = mstr.replace(/{(({(({(({.*?}|.)*?)}|.)*?)}|.)*?)}/g, (m, a, s) => JSON.stringify(a.replace(/:/g, '`')));
		// stringify keys, replace ` back for :
		let fixedstr = "{" + mstr.replace(/([a-z][^\s,()]*|[a-z]+\(.*?\)):/g, '"$1":').replace(/`/g, ':') + "}";

		let mdata = JSON.parse(fixedstr);
		for (let metakey in mdata) {
			let m3 = /^(\w+)(\((.*?)\))?$/g.exec(metakey);
			if (!m3) throw 'failed to parse meta key';
			this.processMetadata({key: m3[1], keyarg: m3[3], value: mdata[metakey]})
		}
	}
};

ReoListenerImpl.prototype.processMetadata = function (s, env) {
	switch (s.key) {
		case 'pos':
			// let wpname = this.genNodeName(s.keyarg, env);
			let wpname = s.keyarg;
			let coord = parseNumberArray(s.value, env);
			this.ports[wpname] = coord;
			// this.waypoints[wpname] = coord;
			break;
		// case 'bound':
		//   this.bound = [parseNumberArray(s.value[0], env), parseNumberArray(s.value[1], env)];
		//   break;
		// case 'spacing':
		//   this.drawNodeSpacing = s.value;
		//   break;
		// case 'label':
		//   this.labels[this.genNodeName(s.keyarg, env)] = s.value;
		//   break;
		// default:
		//   await this.network.processMeta(s, env);
		case 'shape':
			let m = /^([a-zA-Z]\w+)\((.*?)\)/g.exec(s.keyarg);
			let cname = m[1];
			let args = m[2].replace(';', ',').split(',').map(x => x.trim()).filter(x => x.length > 0);
			this.componentDefinitions[cname] = generateShapeDefinition(cname, args, s.value.trim());
			break;
		case 'include':
			this.includeSource(s.value);
			break;
		default:
			throw "unknown metakey " + s.key
	}
};

ReoListenerImpl.prototype.draw = function (component) {
	let definition = this.componentDefinitions[component.name];
	if (definition.type === 'atom')
		return `${definition.define()}${definition.draw(component.ports, this.ports)}`;
	else
		return `createComponent(${this.ports[component.name].join(',')},"${component.name}");${definition.components.map(c => this.draw(c)).join(';')}`;
};

ReoListenerImpl.prototype.generateCode = function () {
	this.ports.main = ['25', '25', 'container.clientWidth-25', 'container.clientHeight-25'];
	if (this.cachedCode === '')
		this.cachedCode = `main=${this.draw(this.componentDefinitions.main)}`;
	return this.cachedCode
};

ReoListenerImpl.prototype.clearCache = function () {
	this.cachedCode = "";
	for (let def in this.componentDefinitions)
		this.componentDefinitions[def].defined = false
};

// Enter a parse tree produced by ReoParser#file. TODO
ReoListenerImpl.prototype.enterFile = function (ctx) {
	console.log('enterFile')
};

// Exit a parse tree produced by ReoParser#file. TODO
ReoListenerImpl.prototype.exitFile = function (ctx) {
	console.log('exitFile')
};


// Enter a parse tree produced by ReoParser#secn. TODO
ReoListenerImpl.prototype.enterSecn = function (ctx) {
	// console.log('enterSecn')
};

// Exit a parse tree produced by ReoParser#secn.
ReoListenerImpl.prototype.exitSecn = function (ctx) {
	// console.log('exitSecn')
	// this.sections[ctx] = ctx.name().getText()
};


// Enter a parse tree produced by ReoParser#imps. TODO
ReoListenerImpl.prototype.enterImps = function (ctx) {
	console.log('enterImps')
};

// Exit a parse tree produced by ReoParser#imps.
ReoListenerImpl.prototype.exitImps = function (ctx) {
	console.log('exitImps')
};


// Enter a parse tree produced by ReoParser#defn.
ReoListenerImpl.prototype.enterDefn = function (ctx) {
	console.log('enterDefn');
	let name = ctx.ID().getText();
	this.componentNames[ctx.component()] = name;
	this.componentDefinitions[ctx.ID().getText()] = {name: name}
};

// Exit a parse tree produced by ReoParser#defn. TODO
ReoListenerImpl.prototype.exitDefn = function (ctx) {
	console.log('exitDefn')
};


// Enter a parse tree produced by ReoParser#component_variable. TODO
ReoListenerImpl.prototype.enterComponent_variable = function (ctx) {
	console.log('enterComponent_variable');
};

// Exit a parse tree produced by ReoParser#component_variable. TODO
ReoListenerImpl.prototype.exitComponent_variable = function (ctx) {
	console.log('exitComponent_variable')
};


// Enter a parse tree produced by ReoParser#component_atomic. TODO
ReoListenerImpl.prototype.enterComponent_atomic = function (ctx) {
	console.log('enterComponent_atomic')
};

// Exit a parse tree produced by ReoParser#component_atomic. TODO
ReoListenerImpl.prototype.exitComponent_atomic = function (ctx) {
	console.log('exitComponent_atomic')
};


// Enter a parse tree produced by ReoParser#component_composite.
ReoListenerImpl.prototype.enterComponent_composite = function (ctx) {
	console.log('enterComponent_composite');
	console.log('sign:', ctx.sign().getText());  // TODO
	console.log('multiset:', ctx.multiset().getText());
	// this.components[ctx] = ctx.sign();
	this.componentNames[ctx.multiset()] = this.componentNames[ctx];
};

// Exit a parse tree produced by ReoParser#component_composite.
ReoListenerImpl.prototype.exitComponent_composite = function (ctx) {
	console.log('exitComponent_composite')
};


// Enter a parse tree produced by ReoParser#atom.
ReoListenerImpl.prototype.enterAtom = function (ctx) {
	console.log('enterAtom')
};

// Exit a parse tree produced by ReoParser#atom.
ReoListenerImpl.prototype.exitAtom = function (ctx) {
	console.log('exitAtom')
};


// Enter a parse tree produced by ReoParser#ref_java.
ReoListenerImpl.prototype.enterRef_java = function (ctx) {
};

// Exit a parse tree produced by ReoParser#ref_java.
ReoListenerImpl.prototype.exitRef_java = function (ctx) {
};


// Enter a parse tree produced by ReoParser#ref_promela.
ReoListenerImpl.prototype.enterRef_promela = function (ctx) {
};

// Exit a parse tree produced by ReoParser#ref_promela.
ReoListenerImpl.prototype.exitRef_promela = function (ctx) {
};


// Enter a parse tree produced by ReoParser#ref_maude.
ReoListenerImpl.prototype.enterRef_maude = function (ctx) {
};

// Exit a parse tree produced by ReoParser#ref_maude.
ReoListenerImpl.prototype.exitRef_maude = function (ctx) {
};


// Enter a parse tree produced by ReoParser#ref_c.
ReoListenerImpl.prototype.enterRef_c = function (ctx) {
};

// Exit a parse tree produced by ReoParser#ref_c.
ReoListenerImpl.prototype.exitRef_c = function (ctx) {
};


// Enter a parse tree produced by ReoParser#multiset_constraint.
ReoListenerImpl.prototype.enterMultiset_constraint = function (ctx) {
	console.log('enterMultiset_constraint');
	// console.log('instance:', ctx.instance().getText());
	console.log(ctx.getText());
	this.componentNames[ctx.instance()] = this.componentNames[ctx];
};

// Exit a parse tree produced by ReoParser#multiset_constraint.
ReoListenerImpl.prototype.exitMultiset_constraint = function (ctx) {
	console.log('exitMultiset_constraint')
};


// Enter a parse tree produced by ReoParser#multiset_setbuilder.
ReoListenerImpl.prototype.enterMultiset_setbuilder = function (ctx) {
	console.log('enterMultiset_setbuilder');
	console.log(ctx.getText());
	for (let multiset of ctx.multiset())
		this.componentNames[multiset] = this.componentNames[ctx];
	this.componentDefinitions[this.componentNames[ctx]].components = []
	// console.log('name:', this.componentNames[ctx]);
	// console.log('multiset:', ctx.multiset()[0].getText());
	// console.log('multiset:', ctx.multiset()[1].getText());
};

// Exit a parse tree produced by ReoParser#multiset_setbuilder.
ReoListenerImpl.prototype.exitMultiset_setbuilder = function (ctx) {
	console.log('exitMultiset_setbuilder')
};


// Enter a parse tree produced by ReoParser#multiset_iteration. TODO
ReoListenerImpl.prototype.enterMultiset_iteration = function (ctx) {
	console.log('enterMultiset_iteration')
};

// Exit a parse tree produced by ReoParser#multiset_iteration. TODO
ReoListenerImpl.prototype.exitMultiset_iteration = function (ctx) {
};


// Enter a parse tree produced by ReoParser#multiset_condition.
ReoListenerImpl.prototype.enterMultiset_condition = function (ctx) {
};

// Exit a parse tree produced by ReoParser#multiset_condition.
ReoListenerImpl.prototype.exitMultiset_condition = function (ctx) {
};


// Enter a parse tree produced by ReoParser#instance_product.
ReoListenerImpl.prototype.enterInstance_product = function (ctx) {
};

// Exit a parse tree produced by ReoParser#instance_product.
ReoListenerImpl.prototype.exitInstance_product = function (ctx) {
};


// Enter a parse tree produced by ReoParser#instance_atomic.
ReoListenerImpl.prototype.enterInstance_atomic = function (ctx) {
	console.log('enterInstance_atomic');
	this.componentNames[ctx.ports()] = this.componentNames[ctx];
	this.componentDefinitions[this.componentNames[ctx]].components.push({name: ctx.component().getText()})
};

ReoListener.prototype.enterInstance_comment = function (ctx) {
	this.extractMetadata(ctx.getText());
};

// Enter a parse tree produced by ReoParser#instance_sum.
ReoListenerImpl.prototype.enterInstance_sum = function (ctx) {
};

// Exit a parse tree produced by ReoParser#instance_sum.
ReoListenerImpl.prototype.exitInstance_sum = function (ctx) {
};


// Enter a parse tree produced by ReoParser#instance_semicolon.
ReoListenerImpl.prototype.enterInstance_semicolon = function (ctx) {
};

// Exit a parse tree produced by ReoParser#instance_semicolon.
ReoListenerImpl.prototype.exitInstance_semicolon = function (ctx) {
};


// Enter a parse tree produced by ReoParser#formula_negation.
ReoListenerImpl.prototype.enterFormula_negation = function (ctx) {
};

// Exit a parse tree produced by ReoParser#formula_negation.
ReoListenerImpl.prototype.exitFormula_negation = function (ctx) {
};


// Enter a parse tree produced by ReoParser#formula_false.
ReoListenerImpl.prototype.enterFormula_false = function (ctx) {
};

// Exit a parse tree produced by ReoParser#formula_false.
ReoListenerImpl.prototype.exitFormula_false = function (ctx) {
};


// Enter a parse tree produced by ReoParser#formula_true.
ReoListenerImpl.prototype.enterFormula_true = function (ctx) {
};

// Exit a parse tree produced by ReoParser#formula_true.
ReoListenerImpl.prototype.exitFormula_true = function (ctx) {
};


// Enter a parse tree produced by ReoParser#formula_structdefn.
ReoListenerImpl.prototype.enterFormula_structdefn = function (ctx) {
};

// Exit a parse tree produced by ReoParser#formula_structdefn.
ReoListenerImpl.prototype.exitFormula_structdefn = function (ctx) {
};


// Enter a parse tree produced by ReoParser#formula_variable.
ReoListenerImpl.prototype.enterFormula_variable = function (ctx) {
};

// Exit a parse tree produced by ReoParser#formula_variable.
ReoListenerImpl.prototype.exitFormula_variable = function (ctx) {
};


// Enter a parse tree produced by ReoParser#formula_conjunction.
ReoListenerImpl.prototype.enterFormula_conjunction = function (ctx) {
};

// Exit a parse tree produced by ReoParser#formula_conjunction.
ReoListenerImpl.prototype.exitFormula_conjunction = function (ctx) {
};


// Enter a parse tree produced by ReoParser#formula_binaryrelation.
ReoListenerImpl.prototype.enterFormula_binaryrelation = function (ctx) {
};

// Exit a parse tree produced by ReoParser#formula_binaryrelation.
ReoListenerImpl.prototype.exitFormula_binaryrelation = function (ctx) {
};


// Enter a parse tree produced by ReoParser#formula_universal.
ReoListenerImpl.prototype.enterFormula_universal = function (ctx) {
};

// Exit a parse tree produced by ReoParser#formula_universal.
ReoListenerImpl.prototype.exitFormula_universal = function (ctx) {
};


// Enter a parse tree produced by ReoParser#formula_componentdefn.
ReoListenerImpl.prototype.enterFormula_componentdefn = function (ctx) {
};

// Exit a parse tree produced by ReoParser#formula_componentdefn.
ReoListenerImpl.prototype.exitFormula_componentdefn = function (ctx) {
};


// Enter a parse tree produced by ReoParser#formula_membership.
ReoListenerImpl.prototype.enterFormula_membership = function (ctx) {
};

// Exit a parse tree produced by ReoParser#formula_membership.
ReoListenerImpl.prototype.exitFormula_membership = function (ctx) {
};


// Enter a parse tree produced by ReoParser#formula_existential.
ReoListenerImpl.prototype.enterFormula_existential = function (ctx) {
};

// Exit a parse tree produced by ReoParser#formula_existential.
ReoListenerImpl.prototype.exitFormula_existential = function (ctx) {
};


// Enter a parse tree produced by ReoParser#formula_brackets.
ReoListenerImpl.prototype.enterFormula_brackets = function (ctx) {
};

// Exit a parse tree produced by ReoParser#formula_brackets.
ReoListenerImpl.prototype.exitFormula_brackets = function (ctx) {
};


// Enter a parse tree produced by ReoParser#formula_implication.
ReoListenerImpl.prototype.enterFormula_implication = function (ctx) {
};

// Exit a parse tree produced by ReoParser#formula_implication.
ReoListenerImpl.prototype.exitFormula_implication = function (ctx) {
};


// Enter a parse tree produced by ReoParser#formula_disjunction.
ReoListenerImpl.prototype.enterFormula_disjunction = function (ctx) {
};

// Exit a parse tree produced by ReoParser#formula_disjunction.
ReoListenerImpl.prototype.exitFormula_disjunction = function (ctx) {
};


// Enter a parse tree produced by ReoParser#term_brackets.
ReoListenerImpl.prototype.enterTerm_brackets = function (ctx) {
};

// Exit a parse tree produced by ReoParser#term_brackets.
ReoListenerImpl.prototype.exitTerm_brackets = function (ctx) {
};


// Enter a parse tree produced by ReoParser#term_instance.
ReoListenerImpl.prototype.enterTerm_instance = function (ctx) {
};

// Exit a parse tree produced by ReoParser#term_instance.
ReoListenerImpl.prototype.exitTerm_instance = function (ctx) {
};


// Enter a parse tree produced by ReoParser#term_unarymin.
ReoListenerImpl.prototype.enterTerm_unarymin = function (ctx) {
};

// Exit a parse tree produced by ReoParser#term_unarymin.
ReoListenerImpl.prototype.exitTerm_unarymin = function (ctx) {
};


// Enter a parse tree produced by ReoParser#term_boolean.
ReoListenerImpl.prototype.enterTerm_boolean = function (ctx) {
};

// Exit a parse tree produced by ReoParser#term_boolean.
ReoListenerImpl.prototype.exitTerm_boolean = function (ctx) {
};


// Enter a parse tree produced by ReoParser#term_exponent.
ReoListenerImpl.prototype.enterTerm_exponent = function (ctx) {
};

// Exit a parse tree produced by ReoParser#term_exponent.
ReoListenerImpl.prototype.exitTerm_exponent = function (ctx) {
};


// Enter a parse tree produced by ReoParser#term_function.
ReoListenerImpl.prototype.enterTerm_function = function (ctx) {
};

// Exit a parse tree produced by ReoParser#term_function.
ReoListenerImpl.prototype.exitTerm_function = function (ctx) {
};


// Enter a parse tree produced by ReoParser#term_range.
ReoListenerImpl.prototype.enterTerm_range = function (ctx) {
};

// Exit a parse tree produced by ReoParser#term_range.
ReoListenerImpl.prototype.exitTerm_range = function (ctx) {
};


// Enter a parse tree produced by ReoParser#term_decimal.
ReoListenerImpl.prototype.enterTerm_decimal = function (ctx) {
};

// Exit a parse tree produced by ReoParser#term_decimal.
ReoListenerImpl.prototype.exitTerm_decimal = function (ctx) {
};


// Enter a parse tree produced by ReoParser#term_variable.
ReoListenerImpl.prototype.enterTerm_variable = function (ctx) {
};

// Exit a parse tree produced by ReoParser#term_variable.
ReoListenerImpl.prototype.exitTerm_variable = function (ctx) {
};


// Enter a parse tree produced by ReoParser#term_componentdefn.
ReoListenerImpl.prototype.enterTerm_componentdefn = function (ctx) {
};

// Exit a parse tree produced by ReoParser#term_componentdefn.
ReoListenerImpl.prototype.exitTerm_componentdefn = function (ctx) {
};


// Enter a parse tree produced by ReoParser#term_application.
ReoListenerImpl.prototype.enterTerm_application = function (ctx) {
};

// Exit a parse tree produced by ReoParser#term_application.
ReoListenerImpl.prototype.exitTerm_application = function (ctx) {
};


// Enter a parse tree produced by ReoParser#term_natural.
ReoListenerImpl.prototype.enterTerm_natural = function (ctx) {
};

// Exit a parse tree produced by ReoParser#term_natural.
ReoListenerImpl.prototype.exitTerm_natural = function (ctx) {
};


// Enter a parse tree produced by ReoParser#term_list.
ReoListenerImpl.prototype.enterTerm_list = function (ctx) {
};

// Exit a parse tree produced by ReoParser#term_list.
ReoListenerImpl.prototype.exitTerm_list = function (ctx) {
};


// Enter a parse tree produced by ReoParser#term_operation.
ReoListenerImpl.prototype.enterTerm_operation = function (ctx) {
};

// Exit a parse tree produced by ReoParser#term_operation.
ReoListenerImpl.prototype.exitTerm_operation = function (ctx) {
};


// Enter a parse tree produced by ReoParser#term_string.
ReoListenerImpl.prototype.enterTerm_string = function (ctx) {
};

// Exit a parse tree produced by ReoParser#term_string.
ReoListenerImpl.prototype.exitTerm_string = function (ctx) {
};


// Enter a parse tree produced by ReoParser#term_tuple.
ReoListenerImpl.prototype.enterTerm_tuple = function (ctx) {
};

// Exit a parse tree produced by ReoParser#term_tuple.
ReoListenerImpl.prototype.exitTerm_tuple = function (ctx) {
};


// Enter a parse tree produced by ReoParser#func.
ReoListenerImpl.prototype.enterFunc = function (ctx) {
};

// Exit a parse tree produced by ReoParser#func.
ReoListenerImpl.prototype.exitFunc = function (ctx) {
};


// Enter a parse tree produced by ReoParser#tuple.
ReoListenerImpl.prototype.enterTuple = function (ctx) {
};

// Exit a parse tree produced by ReoParser#tuple.
ReoListenerImpl.prototype.exitTuple = function (ctx) {
};


// Enter a parse tree produced by ReoParser#list.
ReoListenerImpl.prototype.enterList = function (ctx) {
};

// Exit a parse tree produced by ReoParser#list.
ReoListenerImpl.prototype.exitList = function (ctx) {
};


// Enter a parse tree produced by ReoParser#sign.
ReoListenerImpl.prototype.enterSign = function (ctx) {
};

// Exit a parse tree produced by ReoParser#sign.
ReoListenerImpl.prototype.exitSign = function (ctx) {
};


// Enter a parse tree produced by ReoParser#params.
ReoListenerImpl.prototype.enterParams = function (ctx) {
};

// Exit a parse tree produced by ReoParser#params.
ReoListenerImpl.prototype.exitParams = function (ctx) {
};


// Enter a parse tree produced by ReoParser#param.
ReoListenerImpl.prototype.enterParam = function (ctx) {
};

// Exit a parse tree produced by ReoParser#param.
ReoListenerImpl.prototype.exitParam = function (ctx) {
};


// Enter a parse tree produced by ReoParser#nodes.
ReoListenerImpl.prototype.enterNodes = function (ctx) {
};

// Exit a parse tree produced by ReoParser#nodes.
ReoListenerImpl.prototype.exitNodes = function (ctx) {
};


// Enter a parse tree produced by ReoParser#node.
ReoListenerImpl.prototype.enterNode = function (ctx) {
};

// Exit a parse tree produced by ReoParser#node.
ReoListenerImpl.prototype.exitNode = function (ctx) {
};


// Enter a parse tree produced by ReoParser#type.
ReoListenerImpl.prototype.enterType = function (ctx) {
};

// Exit a parse tree produced by ReoParser#type.
ReoListenerImpl.prototype.exitType = function (ctx) {
};


// Enter a parse tree produced by ReoParser#ports.
ReoListenerImpl.prototype.enterPorts = function (ctx) {
	console.log('enterPorts');
	let ports = [];
	for (let port of ctx.port()) {
		this.ports[port.getText()] = [];
		ports.push(port.getText());
	}

	let component = this.componentDefinitions[this.componentNames[ctx]].components;
	component[component.length - 1].ports = ports
};

// Exit a parse tree produced by ReoParser#ports.
ReoListenerImpl.prototype.exitPorts = function (ctx) {
};


// Enter a parse tree produced by ReoParser#port.
ReoListenerImpl.prototype.enterPort = function (ctx) {
	console.log('enterPort');
};

// Exit a parse tree produced by ReoParser#port.
ReoListenerImpl.prototype.exitPort = function (ctx) {
};


// Enter a parse tree produced by ReoParser#r_var.
ReoListenerImpl.prototype.enterR_var = function (ctx) {
	console.log('enterR_var');
	console.log(ctx.name().getText());
	console.log(ctx.term());
};

// Exit a parse tree produced by ReoParser#r_var.
ReoListenerImpl.prototype.exitR_var = function (ctx) {
	console.log('exitR_var');
};


// Enter a parse tree produced by ReoParser#name.
ReoListenerImpl.prototype.enterName = function (ctx) {
};

// Exit a parse tree produced by ReoParser#name.
ReoListenerImpl.prototype.exitName = function (ctx) {
};


// Enter a parse tree produced by ReoParser#wa.
ReoListenerImpl.prototype.enterWa = function (ctx) {
};

// Exit a parse tree produced by ReoParser#wa.
ReoListenerImpl.prototype.exitWa = function (ctx) {
};


// Enter a parse tree produced by ReoParser#wa_invariant.
ReoListenerImpl.prototype.enterWa_invariant = function (ctx) {
};

// Exit a parse tree produced by ReoParser#wa_invariant.
ReoListenerImpl.prototype.exitWa_invariant = function (ctx) {
};


// Enter a parse tree produced by ReoParser#wa_transition.
ReoListenerImpl.prototype.enterWa_transition = function (ctx) {
};

// Exit a parse tree produced by ReoParser#wa_transition.
ReoListenerImpl.prototype.exitWa_transition = function (ctx) {
};


// Enter a parse tree produced by ReoParser#wa_set.
ReoListenerImpl.prototype.enterWa_set = function (ctx) {
};

// Exit a parse tree produced by ReoParser#wa_set.
ReoListenerImpl.prototype.exitWa_set = function (ctx) {
};


// Enter a parse tree produced by ReoParser#wa_jc_brackets.
ReoListenerImpl.prototype.enterWa_jc_brackets = function (ctx) {
};

// Exit a parse tree produced by ReoParser#wa_jc_brackets.
ReoListenerImpl.prototype.exitWa_jc_brackets = function (ctx) {
};


// Enter a parse tree produced by ReoParser#wa_jc_geq.
ReoListenerImpl.prototype.enterWa_jc_geq = function (ctx) {
};

// Exit a parse tree produced by ReoParser#wa_jc_geq.
ReoListenerImpl.prototype.exitWa_jc_geq = function (ctx) {
};


// Enter a parse tree produced by ReoParser#wa_jc_leq.
ReoListenerImpl.prototype.enterWa_jc_leq = function (ctx) {
};

// Exit a parse tree produced by ReoParser#wa_jc_leq.
ReoListenerImpl.prototype.exitWa_jc_leq = function (ctx) {
};


// Enter a parse tree produced by ReoParser#wa_jc_eq.
ReoListenerImpl.prototype.enterWa_jc_eq = function (ctx) {
};

// Exit a parse tree produced by ReoParser#wa_jc_eq.
ReoListenerImpl.prototype.exitWa_jc_eq = function (ctx) {
};


// Enter a parse tree produced by ReoParser#wa_jc_and.
ReoListenerImpl.prototype.enterWa_jc_and = function (ctx) {
};

// Exit a parse tree produced by ReoParser#wa_jc_and.
ReoListenerImpl.prototype.exitWa_jc_and = function (ctx) {
};


// Enter a parse tree produced by ReoParser#wa_jc_false.
ReoListenerImpl.prototype.enterWa_jc_false = function (ctx) {
};

// Exit a parse tree produced by ReoParser#wa_jc_false.
ReoListenerImpl.prototype.exitWa_jc_false = function (ctx) {
};


// Enter a parse tree produced by ReoParser#wa_jc_true.
ReoListenerImpl.prototype.enterWa_jc_true = function (ctx) {
};

// Exit a parse tree produced by ReoParser#wa_jc_true.
ReoListenerImpl.prototype.exitWa_jc_true = function (ctx) {
};


// Enter a parse tree produced by ReoParser#wa_jc_or.
ReoListenerImpl.prototype.enterWa_jc_or = function (ctx) {
};

// Exit a parse tree produced by ReoParser#wa_jc_or.
ReoListenerImpl.prototype.exitWa_jc_or = function (ctx) {
};


// Enter a parse tree produced by ReoParser#cam.
ReoListenerImpl.prototype.enterCam = function (ctx) {
};

// Exit a parse tree produced by ReoParser#cam.
ReoListenerImpl.prototype.exitCam = function (ctx) {
};


// Enter a parse tree produced by ReoParser#cam_tr.
ReoListenerImpl.prototype.enterCam_tr = function (ctx) {
};

// Exit a parse tree produced by ReoParser#cam_tr.
ReoListenerImpl.prototype.exitCam_tr = function (ctx) {
};


// Enter a parse tree produced by ReoParser#cam_sc.
ReoListenerImpl.prototype.enterCam_sc = function (ctx) {
};

// Exit a parse tree produced by ReoParser#cam_sc.
ReoListenerImpl.prototype.exitCam_sc = function (ctx) {
};


// Enter a parse tree produced by ReoParser#cam_dc_universal.
ReoListenerImpl.prototype.enterCam_dc_universal = function (ctx) {
};

// Exit a parse tree produced by ReoParser#cam_dc_universal.
ReoListenerImpl.prototype.exitCam_dc_universal = function (ctx) {
};


// Enter a parse tree produced by ReoParser#cam_dc_ineq.
ReoListenerImpl.prototype.enterCam_dc_ineq = function (ctx) {
};

// Exit a parse tree produced by ReoParser#cam_dc_ineq.
ReoListenerImpl.prototype.exitCam_dc_ineq = function (ctx) {
};


// Enter a parse tree produced by ReoParser#cam_dc_neq.
ReoListenerImpl.prototype.enterCam_dc_neq = function (ctx) {
};

// Exit a parse tree produced by ReoParser#cam_dc_neq.
ReoListenerImpl.prototype.exitCam_dc_neq = function (ctx) {
};


// Enter a parse tree produced by ReoParser#cam_dc_exponent.
ReoListenerImpl.prototype.enterCam_dc_exponent = function (ctx) {
};

// Exit a parse tree produced by ReoParser#cam_dc_exponent.
ReoListenerImpl.prototype.exitCam_dc_exponent = function (ctx) {
};


// Enter a parse tree produced by ReoParser#cam_dc_multdivrem.
ReoListenerImpl.prototype.enterCam_dc_multdivrem = function (ctx) {
};

// Exit a parse tree produced by ReoParser#cam_dc_multdivrem.
ReoListenerImpl.prototype.exitCam_dc_multdivrem = function (ctx) {
};


// Enter a parse tree produced by ReoParser#cam_dc_term.
ReoListenerImpl.prototype.enterCam_dc_term = function (ctx) {
};

// Exit a parse tree produced by ReoParser#cam_dc_term.
ReoListenerImpl.prototype.exitCam_dc_term = function (ctx) {
};


// Enter a parse tree produced by ReoParser#cam_dc_existential.
ReoListenerImpl.prototype.enterCam_dc_existential = function (ctx) {
};

// Exit a parse tree produced by ReoParser#cam_dc_existential.
ReoListenerImpl.prototype.exitCam_dc_existential = function (ctx) {
};


// Enter a parse tree produced by ReoParser#cam_dc_addsub.
ReoListenerImpl.prototype.enterCam_dc_addsub = function (ctx) {
};

// Exit a parse tree produced by ReoParser#cam_dc_addsub.
ReoListenerImpl.prototype.exitCam_dc_addsub = function (ctx) {
};


// Enter a parse tree produced by ReoParser#cam_dc_and.
ReoListenerImpl.prototype.enterCam_dc_and = function (ctx) {
};

// Exit a parse tree produced by ReoParser#cam_dc_and.
ReoListenerImpl.prototype.exitCam_dc_and = function (ctx) {
};


// Enter a parse tree produced by ReoParser#cam_dc_or.
ReoListenerImpl.prototype.enterCam_dc_or = function (ctx) {
};

// Exit a parse tree produced by ReoParser#cam_dc_or.
ReoListenerImpl.prototype.exitCam_dc_or = function (ctx) {
};


// Enter a parse tree produced by ReoParser#cam_dt_brackets.
ReoListenerImpl.prototype.enterCam_dt_brackets = function (ctx) {
};

// Exit a parse tree produced by ReoParser#cam_dt_brackets.
ReoListenerImpl.prototype.exitCam_dt_brackets = function (ctx) {
};


// Enter a parse tree produced by ReoParser#cam_dt_function.
ReoListenerImpl.prototype.enterCam_dt_function = function (ctx) {
};

// Exit a parse tree produced by ReoParser#cam_dt_function.
ReoListenerImpl.prototype.exitCam_dt_function = function (ctx) {
};


// Enter a parse tree produced by ReoParser#cam_dt_next.
ReoListenerImpl.prototype.enterCam_dt_next = function (ctx) {
};

// Exit a parse tree produced by ReoParser#cam_dt_next.
ReoListenerImpl.prototype.exitCam_dt_next = function (ctx) {
};


// Enter a parse tree produced by ReoParser#cam_dt_unaryMin.
ReoListenerImpl.prototype.enterCam_dt_unaryMin = function (ctx) {
};

// Exit a parse tree produced by ReoParser#cam_dt_unaryMin.
ReoListenerImpl.prototype.exitCam_dt_unaryMin = function (ctx) {
};


// Enter a parse tree produced by ReoParser#cam_dt_not.
ReoListenerImpl.prototype.enterCam_dt_not = function (ctx) {
};

// Exit a parse tree produced by ReoParser#cam_dt_not.
ReoListenerImpl.prototype.exitCam_dt_not = function (ctx) {
};


// Enter a parse tree produced by ReoParser#cam_dt_data.
ReoListenerImpl.prototype.enterCam_dt_data = function (ctx) {
};

// Exit a parse tree produced by ReoParser#cam_dt_data.
ReoListenerImpl.prototype.exitCam_dt_data = function (ctx) {
};


// Enter a parse tree produced by ReoParser#cam_dt_variable.
ReoListenerImpl.prototype.enterCam_dt_variable = function (ctx) {
};

// Exit a parse tree produced by ReoParser#cam_dt_variable.
ReoListenerImpl.prototype.exitCam_dt_variable = function (ctx) {
};


// Enter a parse tree produced by ReoParser#sa.
ReoListenerImpl.prototype.enterSa = function (ctx) {
};

// Exit a parse tree produced by ReoParser#sa.
ReoListenerImpl.prototype.exitSa = function (ctx) {
};


// Enter a parse tree produced by ReoParser#sa_transition.
ReoListenerImpl.prototype.enterSa_transition = function (ctx) {
};

// Exit a parse tree produced by ReoParser#sa_transition.
ReoListenerImpl.prototype.exitSa_transition = function (ctx) {
};


// Enter a parse tree produced by ReoParser#sa_seepagefunction.
ReoListenerImpl.prototype.enterSa_seepagefunction = function (ctx) {
};

// Exit a parse tree produced by ReoParser#sa_seepagefunction.
ReoListenerImpl.prototype.exitSa_seepagefunction = function (ctx) {
};


// Enter a parse tree produced by ReoParser#sa_sc.
ReoListenerImpl.prototype.enterSa_sc = function (ctx) {
};

// Exit a parse tree produced by ReoParser#sa_sc.
ReoListenerImpl.prototype.exitSa_sc = function (ctx) {
};


// Enter a parse tree produced by ReoParser#sa_pbe_or.
ReoListenerImpl.prototype.enterSa_pbe_or = function (ctx) {
};

// Exit a parse tree produced by ReoParser#sa_pbe_or.
ReoListenerImpl.prototype.exitSa_pbe_or = function (ctx) {
};


// Enter a parse tree produced by ReoParser#sa_pbe_and.
ReoListenerImpl.prototype.enterSa_pbe_and = function (ctx) {
};

// Exit a parse tree produced by ReoParser#sa_pbe_and.
ReoListenerImpl.prototype.exitSa_pbe_and = function (ctx) {
};


// Enter a parse tree produced by ReoParser#sa_pbe_variable.
ReoListenerImpl.prototype.enterSa_pbe_variable = function (ctx) {
};

// Exit a parse tree produced by ReoParser#sa_pbe_variable.
ReoListenerImpl.prototype.exitSa_pbe_variable = function (ctx) {
};


// Enter a parse tree produced by ReoParser#sa_pbe_bool.
ReoListenerImpl.prototype.enterSa_pbe_bool = function (ctx) {
};

// Exit a parse tree produced by ReoParser#sa_pbe_bool.
ReoListenerImpl.prototype.exitSa_pbe_bool = function (ctx) {
};


// Enter a parse tree produced by ReoParser#sa_pbe_brackets.
ReoListenerImpl.prototype.enterSa_pbe_brackets = function (ctx) {
};

// Exit a parse tree produced by ReoParser#sa_pbe_brackets.
ReoListenerImpl.prototype.exitSa_pbe_brackets = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p.
ReoListenerImpl.prototype.enterP = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p.
ReoListenerImpl.prototype.exitP = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_brackets.
ReoListenerImpl.prototype.enterP_brackets = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_brackets.
ReoListenerImpl.prototype.exitP_brackets = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_relation.
ReoListenerImpl.prototype.enterP_relation = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_relation.
ReoListenerImpl.prototype.exitP_relation = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_exists.
ReoListenerImpl.prototype.enterP_exists = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_exists.
ReoListenerImpl.prototype.exitP_exists = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_true.
ReoListenerImpl.prototype.enterP_true = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_true.
ReoListenerImpl.prototype.exitP_true = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_not.
ReoListenerImpl.prototype.enterP_not = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_not.
ReoListenerImpl.prototype.exitP_not = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_forall.
ReoListenerImpl.prototype.enterP_forall = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_forall.
ReoListenerImpl.prototype.exitP_forall = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_false.
ReoListenerImpl.prototype.enterP_false = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_false.
ReoListenerImpl.prototype.exitP_false = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_or.
ReoListenerImpl.prototype.enterP_or = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_or.
ReoListenerImpl.prototype.exitP_or = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_neq.
ReoListenerImpl.prototype.enterP_neq = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_neq.
ReoListenerImpl.prototype.exitP_neq = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_and.
ReoListenerImpl.prototype.enterP_and = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_and.
ReoListenerImpl.prototype.exitP_and = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_eqs.
ReoListenerImpl.prototype.enterP_eqs = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_eqs.
ReoListenerImpl.prototype.exitP_eqs = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_args.
ReoListenerImpl.prototype.enterP_args = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_args.
ReoListenerImpl.prototype.exitP_args = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_variable.
ReoListenerImpl.prototype.enterP_variable = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_variable.
ReoListenerImpl.prototype.exitP_variable = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_null.
ReoListenerImpl.prototype.enterP_null = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_null.
ReoListenerImpl.prototype.exitP_null = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_natural.
ReoListenerImpl.prototype.enterP_natural = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_natural.
ReoListenerImpl.prototype.exitP_natural = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_boolean.
ReoListenerImpl.prototype.enterP_boolean = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_boolean.
ReoListenerImpl.prototype.exitP_boolean = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_string.
ReoListenerImpl.prototype.enterP_string = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_string.
ReoListenerImpl.prototype.exitP_string = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_decimal.
ReoListenerImpl.prototype.enterP_decimal = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_decimal.
ReoListenerImpl.prototype.exitP_decimal = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_function.
ReoListenerImpl.prototype.enterP_function = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_function.
ReoListenerImpl.prototype.exitP_function = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_var_port.
ReoListenerImpl.prototype.enterP_var_port = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_var_port.
ReoListenerImpl.prototype.exitP_var_port = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_var_curr.
ReoListenerImpl.prototype.enterP_var_curr = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_var_curr.
ReoListenerImpl.prototype.exitP_var_curr = function (ctx) {
};


// Enter a parse tree produced by ReoParser#p_var_next.
ReoListenerImpl.prototype.enterP_var_next = function (ctx) {
};

// Exit a parse tree produced by ReoParser#p_var_next.
ReoListenerImpl.prototype.exitP_var_next = function (ctx) {
};


// Enter a parse tree produced by ReoParser#pr.
ReoListenerImpl.prototype.enterPr = function (ctx) {
};

// Exit a parse tree produced by ReoParser#pr.
ReoListenerImpl.prototype.exitPr = function (ctx) {
};


// Enter a parse tree produced by ReoParser#pr_string.
ReoListenerImpl.prototype.enterPr_string = function (ctx) {
};

// Exit a parse tree produced by ReoParser#pr_string.
ReoListenerImpl.prototype.exitPr_string = function (ctx) {
};


// Enter a parse tree produced by ReoParser#pr_port.
ReoListenerImpl.prototype.enterPr_port = function (ctx) {
};

// Exit a parse tree produced by ReoParser#pr_port.
ReoListenerImpl.prototype.exitPr_port = function (ctx) {
};


// Enter a parse tree produced by ReoParser#pr_param.
ReoListenerImpl.prototype.enterPr_param = function (ctx) {
};

// Exit a parse tree produced by ReoParser#pr_param.
ReoListenerImpl.prototype.exitPr_param = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba.
ReoListenerImpl.prototype.enterRba = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba.
ReoListenerImpl.prototype.exitRba = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_initial.
ReoListenerImpl.prototype.enterRba_initial = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_initial.
ReoListenerImpl.prototype.exitRba_initial = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_rule.
ReoListenerImpl.prototype.enterRba_rule = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_rule.
ReoListenerImpl.prototype.exitRba_rule = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_syncFire.
ReoListenerImpl.prototype.enterRba_syncFire = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_syncFire.
ReoListenerImpl.prototype.exitRba_syncFire = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_syncBlock.
ReoListenerImpl.prototype.enterRba_syncBlock = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_syncBlock.
ReoListenerImpl.prototype.exitRba_syncBlock = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_equality.
ReoListenerImpl.prototype.enterRba_equality = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_equality.
ReoListenerImpl.prototype.exitRba_equality = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_true.
ReoListenerImpl.prototype.enterRba_true = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_true.
ReoListenerImpl.prototype.exitRba_true = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_def.
ReoListenerImpl.prototype.enterRba_def = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_def.
ReoListenerImpl.prototype.exitRba_def = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_false.
ReoListenerImpl.prototype.enterRba_false = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_false.
ReoListenerImpl.prototype.exitRba_false = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_inequality.
ReoListenerImpl.prototype.enterRba_inequality = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_inequality.
ReoListenerImpl.prototype.exitRba_inequality = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_negation.
ReoListenerImpl.prototype.enterRba_negation = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_negation.
ReoListenerImpl.prototype.exitRba_negation = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_conjunction.
ReoListenerImpl.prototype.enterRba_conjunction = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_conjunction.
ReoListenerImpl.prototype.exitRba_conjunction = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_relation.
ReoListenerImpl.prototype.enterRba_relation = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_relation.
ReoListenerImpl.prototype.exitRba_relation = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_string.
ReoListenerImpl.prototype.enterRba_string = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_string.
ReoListenerImpl.prototype.exitRba_string = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_memorycellIn.
ReoListenerImpl.prototype.enterRba_memorycellIn = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_memorycellIn.
ReoListenerImpl.prototype.exitRba_memorycellIn = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_operation.
ReoListenerImpl.prototype.enterRba_operation = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_operation.
ReoListenerImpl.prototype.exitRba_operation = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_null.
ReoListenerImpl.prototype.enterRba_null = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_null.
ReoListenerImpl.prototype.exitRba_null = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_unarymin.
ReoListenerImpl.prototype.enterRba_unarymin = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_unarymin.
ReoListenerImpl.prototype.exitRba_unarymin = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_memorycellOut.
ReoListenerImpl.prototype.enterRba_memorycellOut = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_memorycellOut.
ReoListenerImpl.prototype.exitRba_memorycellOut = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_bool.
ReoListenerImpl.prototype.enterRba_bool = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_bool.
ReoListenerImpl.prototype.exitRba_bool = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_nat.
ReoListenerImpl.prototype.enterRba_nat = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_nat.
ReoListenerImpl.prototype.exitRba_nat = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_function.
ReoListenerImpl.prototype.enterRba_function = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_function.
ReoListenerImpl.prototype.exitRba_function = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_distribution.
ReoListenerImpl.prototype.enterRba_distribution = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_distribution.
ReoListenerImpl.prototype.exitRba_distribution = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_parameter.
ReoListenerImpl.prototype.enterRba_parameter = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_parameter.
ReoListenerImpl.prototype.exitRba_parameter = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_decimal.
ReoListenerImpl.prototype.enterRba_decimal = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_decimal.
ReoListenerImpl.prototype.exitRba_decimal = function (ctx) {
};


// Enter a parse tree produced by ReoParser#rba_null_ctxt.
ReoListenerImpl.prototype.enterRba_null_ctxt = function (ctx) {
};

// Exit a parse tree produced by ReoParser#rba_null_ctxt.
ReoListenerImpl.prototype.exitRba_null_ctxt = function (ctx) {
};
