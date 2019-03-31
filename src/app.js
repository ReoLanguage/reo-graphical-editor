const monaco = require('monaco-editor/esm/vs/editor/editor.api');
const fabric = require('fabric').fabric;
const reoIMonarchLanguage = require('./reo/reo');
const ReoInterpreter = require('./compiler');
let channelTypes = require('./channels');

// Initialize code editor
monaco.languages.register({id: 'reo'});
monaco.languages.setMonarchTokensProvider('reo', reoIMonarchLanguage.language);
monaco.languages.setLanguageConfiguration('reo', reoIMonarchLanguage.conf);
const codeEditor = monaco.editor.create(document.getElementById('text'), {language: 'reo'});

async function loadSource(fileName, cb) {
	let client = new XMLHttpRequest();
	// tell the client that we do not expect XML as response
	client.overrideMimeType("text/plain");
	client.open('GET', fileName);
	client.onreadystatechange = () => {
		if (this.readyState === 4) {
			if (this.status !== 200)
				throw new Error(`Error returned with status ${this.status}: ${this.statusText}`);
			cb(this.responseText)
		}
	};
	client.send()
}

const listener = new ReoInterpreter.ReoListenerImpl(loadSource);
listener.includeSource('default.treo');

// Initialize graphical editor
fabric.Object.prototype.originX = fabric.Object.prototype.originY = 'center';
fabric.Object.prototype.objectCaching = false;
const canvas = new fabric.Canvas('canvas', {
	selection: false,
	preserveObjectStacking: true,
	backgroundColor: '#eee'
});
const c = document.getElementById("canvas"), container = document.getElementById("canvas-container");

function resizeElements() {
	c.width = container.clientWidth;
	c.height = container.clientHeight;

	// Check if the Fabric.js canvas object has been initialized
	if (canvas) {
		canvas.setWidth(container.clientWidth);
		canvas.setHeight(container.clientHeight);
		canvas.calcOffset();

		// Redraw the main component
		let x1 = 25, y1 = 25, x2 = container.clientWidth - 25, y2 = container.clientHeight - 25;
		main.set({
			left: x1,
			top: y1,
			width: x2 - x1,
			height: y2 - y1
		});

		// Reset the label position
		main.label.set({left: x1 + (x2 - x1) / 2, top: y1 + 15});
		main.label.setCoords();
		main.header.set({x1: x1, y1: y1 + headerHeight, x2: x2, y2: y1 + headerHeight});
		main.header.setCoords();
		canvas.requestRenderAll()
	}

	if (codeEditor)
		codeEditor.layout()
}

document.body.onresize = () => resizeElements();

let isDown, origX, origY, origLeft, origTop, origRight, origBottom, fromBoundary;
let mode = 'select';
let id = '0';
let nodes = [], channels = [], components = [];

loadChannels();

// drawing parameters
nodeFillColourSource = '#fff';
nodeFillColourSink = '#fff';
nodeFillColourMixed = '#000';
nodeFactor = 4;

lineFillColour = '#000';
lineStrokeColour = '#000';
lineStrokeWidth = 1;

arrowFactor = 8;
arrowOffsetOut = lineStrokeWidth * nodeFactor + 4;
arrowOffsetIn = arrowOffsetOut + arrowFactor;

fifoHeight = 30;
fifoWidth = 10;
fifoFillColour = '#fff';

buttonBorderOff = '0.5vmin solid white';
buttonBorderOn = '0.5vmin solid black';

mergeDistance = 20;
headerHeight = 30;
loopRadius = 25;

splitSelected = 'lightgreen';
splitDeselected = 'lightblue';

function buttonClick(button) {
	let i;
	canvas.discardActiveObject(null);
	canvas.requestRenderAll();
	document.getElementById(mode).style.border = buttonBorderOff;
	mode = button.id;
	button.style.border = buttonBorderOn;

	for (i = 0; i < components.length; ++i) {
		components[i].set('selectable', mode === 'select');
		components[i].label.set({selectable: mode === 'select', hoverCursor: mode === 'select' ? 'text' : 'default'});
		if (components[i].copy)
			components[i].copy.set({
				selectable: mode === 'select',
				hoverCursor: mode === 'select' ? 'pointer' : 'default'
			});
		if (components[i].delete)
			components[i].delete.set({
				selectable: mode === 'select',
				hoverCursor: mode === 'select' ? 'pointer' : 'default'
			});
		if (components[i].compactSwitch)
			components[i].compactSwitch.set({
				selectable: mode === 'select',
				hoverCursor: mode === 'select' ? 'pointer' : 'default'
			})
	}
	for (i = 0; i < nodes.length; ++i) {
		nodes[i].set({
			selectable: mode === 'select' || mode === 'split',
			hoverCursor: mode === 'select' || mode === 'split' ? 'move' : 'default'
		});
		nodes[i].label.set({selectable: mode === 'select', hoverCursor: mode === 'select' ? 'text' : 'default'});
		nodes[i].selection.set('visible', false)
	}
	for (i = 0; i < channels.length; ++i)
		channels[i].parts[0].set({
			fill: 'transparent',
			selectable: mode === 'select',
			hoverCursor: mode === 'select' ? 'pointer' : 'default'
		});
	canvas.requestRenderAll()
}

document.getElementById("select").onclick = () => buttonClick(document.getElementById("select"));
document.getElementById("split").onclick = () => buttonClick(document.getElementById("split"));
document.getElementById("component").onclick = () => buttonClick(document.getElementById("component"));

/**
 * Exports the canvas to the desired format.
 * @param {String} [format] The format of the output image. Currently supporting "svg" (default), "png" and "treo".
 */
async function download(format) {
	format = format || 'svg';

	const a = document.createElement('a');
	a.download = "reo." + format;
	switch (format) {
		case 'png':
			a.href = canvas.toDataURL();
			break;
		case 'svg':
			a.href = "data:image/svg+xml;base64," + window.btoa(canvas.toSVG());
			break;
		case 'treo':
			a.href = window.URL.createObjectURL(new Blob([codeEditor.getValue()], {type: "text/plain"}));
			break;
	}
	a.click()
}

document.getElementById("downloadSVG").onclick = async () => download();
document.getElementById("downloadPNG").onclick = async () => download('png');
document.getElementById("downloadTreo").onclick = async () => download('treo');

document.getElementById("submit").onclick = async function () {
	ReoInterpreter.parse(codeEditor.getValue(), listener);  // FIXME code should not be collected from editor (because of the comment switch)
	try {
		clearAll();
		eval(listener.generateCode())
	} catch (e) {
		alert(e)
	}
};

document.getElementById("commentSwitch").onclick = function () {
	updateText()
};

// Channel defining modal
const modal = document.getElementById('newChannelModal');

document.getElementById("newChannel").onclick = () => modal.style.display = "block";
document.getElementsByClassName("close")[0].onclick = () => modal.style.display = "none";
document.getElementById("createChannel").onclick = () => {
	loadChannel(JSON.parse(document.getElementById("channelProperties").value));
	modal.style.display = "none"
};

window.onclick = event => {
	if (event.target === modal) modal.style.display = "none"
};

// generate a new object ID
// ID will only contain letters, i.e. z is followed by aa
const generateID = () => id = ((parseInt(id, 36) + 1).toString(36)).replace(/[0-9]/g, 'a');

// Extend the default Fabric.js object type to include additional positional parameters
fabric.Object.prototype.toObject = (function (toObject) {
	return function () {
		return fabric.util.object.extend(toObject.call(this), {
			baseAngle: this.baseAngle,
			referenceAngle: this.referenceAngle,
			referenceDistance: this.referenceDistance,
			referencePoint: this.referencePoint,
			rotate: this.rotate,
			scale: this.scale
		})
	}
})(fabric.Object.prototype.toObject);

const Node = fabric.util.createClass(fabric.Circle, {
	type: 'node',

	initialize: function (options) {
		options || (options = {});
		this.callSuper('initialize', options);
		this.set({
			label: options.label || '',
			channels: options.channels || [], // these are the channels that are connected to this node
			labelOffsetX: options.labelOffsetX || 10,
			labelOffsetY: options.labelOffsetY || -20,
			class: 'node',
			nodeType: 'undefined',
			parent: main,
			id: options.id || generateID()
		})
	},

	toObject: function () {
		return fabric.util.object.extend(this.callSuper('toObject'), {
			label: this.get('label'),
			labelOffsetX: this.get('labelOffsetX'),
			labelOffsetY: this.get('labelOffsetY'),
			class: this.get('class'),
			id: this.get('id')
		})
	},

	_render: function (ctx) {
		this.callSuper('_render', ctx)
	},

	generatePosition: function () {
		return `pos(${this.label.text}): [${Math.round(this.left)}, ${Math.round(this.top)}]`
	}
}); // Node

function createNode(left, top, name, manual) {
	const node = new Node({
		left: left,
		top: top,
		strokeWidth: lineStrokeWidth,
		fill: nodeFillColourSource,
		padding: nodeFactor * lineStrokeWidth,
		radius: nodeFactor * lineStrokeWidth,
		stroke: lineStrokeColour,
		hasControls: false,
		selectable: mode === 'select' || mode === 'split',
		hoverCursor: mode === 'select' || mode === 'split' ? 'move' : 'default',
		id: name
	});

	const label = new fabric.IText(name ? name : node.id, {
		left: left + 10,
		top: top - 20,
		fontSize: 20,
		object: node,
		class: 'label',
		hasControls: false,
		hoverCursor: mode === 'select' ? 'text' : 'default'
	});

	node.set({label: label, labelOffsetX: 10, labelOffsetY: -20});
	label.on('editing:exited', function () {
		label.object.set('id', label.text)
	});

	const selection = new fabric.Circle({
		left: left,
		top: top,
		fill: splitSelected,
		radius: 10,
		evented: false,
		visible: false
	});
	node.set('selection', selection);
	canvas.add(selection);

	const createAnchor = (img, cls, left, top) => {
		img.scale(nodeFactor * 4 / img.height).set({
			left: left,
			top: top,
			class: cls,
			parent: node,
			visible: false,
			selectable: true,
			hasControls: false,
			hasBorders: false,
			lockMovementX: true,
			lockMovementY: true,
			hoverCursor: 'pointer'
		});
		node.set(cls, img);
		canvas.add(img)
	};

	fabric.Image.fromURL('img/delete.svg', img => createAnchor(img, 'delete', node.left - 15, node.top + 15));
	fabric.Image.fromURL('img/split.svg', img => createAnchor(img, 'split', node.left + 15, node.top + 15));

	nodes.push(node);
	setParent(node);
	canvas.add(node, node.label);
	return node
} //createNode

function createAnchor(left, top) {
	return new fabric.Circle({
		left: left,
		top: top,
		strokeWidth: lineStrokeWidth,
		radius: nodeFactor * lineStrokeWidth,
		stroke: lineStrokeColour,
		hasControls: false,
		class: 'anchor',
		opacity: 0
	})
} //createAnchor

/**
 * Creates a channel
 * @param {string} type - type of channel to be created
 * @param {Object} node1
 * @param {string} [node1.name] - optional name of the first node
 * @param {number} node1.x
 * @param {number} node1.y
 * @param {Object} node2
 * @param {string} [node2.name] - optional name of the second node
 * @param {number} node2.x
 * @param {number} node2.y
 * @param {boolean} [manual] - optional flag to indicate the function was initiated by a user action
 * @returns {{class: string, parts: Array}}
 */
function createChannel(type, node1, node2, manual) {
	let channel, i, validChannel = false;
	isDown = false;

	for (i = 0; i < channelTypes.length; ++i)
		if (channelTypes[i].name === type) {
			channel = JSON.parse(JSON.stringify(channelTypes[i]));
			validChannel = true
		}
	if (!validChannel)
		throw new Error("Channel type " + type + " is invalid");

	fabric.util.enlivenObjects(channel.parts, function (objects) {
		channel.parts = objects;
		completeChannelCreation(channel, node1, node2, manual)
	}, undefined, undefined)
} //createChannel

function completeChannelCreation(channel, node1, node2, manual) {
	const left = Math.min(node1.x, node2.x) + Math.abs(node1.x - node2.x) / 2,
		top = Math.min(node1.y, node2.y) + Math.abs(node1.y - node2.y) / 2;
	let i, p;

	// Create a reference rectangle, ...
	const reference = new fabric.Rect({
		left: left,
		top: top,
		width: 10,
		height: 100,
		fill: 'transparent',
		angle: 90,
		parent: channel,
		hasControls: false,
		lockMovementX: true,
		lockMovementY: true,
		selectable: mode === 'select',
		hoverCursor: mode === 'select' ? 'pointer' : 'default',
		baseLength: 100
	});
	channel.parts.splice(0, 0, reference);
	channel.reference = reference;
	canvas.add(channel.parts[0]);

	// ...a delete button...
	fabric.Image.fromURL('img/delete.svg', function (img) {
		const scale = (nodeFactor * 4) / img.height;
		img.scale(scale).set({
			left: left,
			top: top + 15,
			class: 'delete',
			parent: channel,
			hasBorders: false,
			hasControls: false,
			visible: false,
			baseAngle: 90,
			baseScaleX: scale,
			baseScaleY: scale,
			referenceAngle: 180,
			referenceDistance: 15,
			referencePoint: 'middle',
			rotate: false,
			scale: false,
			hoverCursor: 'pointer'
		});

		// Wait until the image is loaded to create the relationship and add it to the channel
		const invertedBossTransform = fabric.util.invertTransform(channel.parts[0].calcTransformMatrix());
		img.relationship = fabric.util.multiplyTransformMatrices(invertedBossTransform, img.calcTransformMatrix(), false);
		channel.parts.push(img);
		channel.parts[0].set('delete', img);
		channel.delete = img;
		canvas.add(img)
	});

	// ...two nodes...
	channel.node1 = createNode(node1.x, node1.y, node1.name, manual);
	channel.node2 = createNode(node2.x, node2.y, node2.name, manual);

	// ...and two anchors
	// TODO Anchors
	//channel.anchor1 = createAnchor(133,100);
	//channel.anchor2 = createAnchor(167,100);

	// link the channel to the nodes
	channel.node1.channels.push(channel);
	channel.node2.channels.push(channel);

	if (manual)
		updateNodeColouring(channel.node1);
	else {
		updateNode(channel.node1);
		updateNode(channel.node2)
	}

	// code generation functions
	channel.generatePositionMetadata = function () {
		return ` /*! ${this.node1.generatePosition()}, ${this.node2.generatePosition()} !*/`
	};

	channel.toReo = function (withComment) {
		return `${this.name}(${this.node1.label.text}, ${this.node2.label.text})${withComment ? this.generatePositionMetadata() : ''}\n`
	};

	// calculate the relation matrix between the channel component and the reference rectangle
	// then save it as a channel component property
	const bossTransform = channel.parts[0].calcTransformMatrix();
	const invertedBossTransform = fabric.util.invertTransform(bossTransform);
	for (i = 1; i < channel.parts.length; ++i) {
		channel.parts[i].relationship = fabric.util.multiplyTransformMatrices(invertedBossTransform, channel.parts[i].calcTransformMatrix(), false);
		canvas.add(channel.parts[i])
	}
	channels.push(channel);
	channel.node1.bringToFront();
	channel.node2.bringToFront();

	// TODO Anchors
	// canvas.add(channel.anchor1, channel.anchor2);

	setParent(channel);
	updateChannel(channel);

	p = channel.node1;
	// place node on nearby edge of component
	for (i = 0; i < components.length; ++i) {
		if (Math.abs(p.left - components[i].left) < mergeDistance)
			p.set('left', components[i].left);
		if (Math.abs(p.top - components[i].top) < mergeDistance)
			p.set('top', components[i].top);
		if (Math.abs(p.left - (components[i].left + components[i].width)) < mergeDistance)
			p.set('left', components[i].left + components[i].width);
		if (Math.abs(p.top - (components[i].top + components[i].height)) < mergeDistance)
			p.set('top', components[i].top + components[i].height);
		p.setCoords()
	}

	for (i = 0; i < p.channels.length; ++i)
		updateChannel(p.channels[i]);
	p.label.set({left: p.left + p.labelOffsetX, top: p.top + p.labelOffsetY});
	p.label.setCoords();

	// merge with existing nodes, except node2 of the same channel
	for (i = nodes.length - 1; i >= 0; --i) {
		if (nodes[i] === p || nodes[i] === channel.node2)
			continue;
		if (p.intersectsWithObject(nodes[i]))
			if (Math.abs(p.left - nodes[i].left) < mergeDistance && Math.abs(p.top - nodes[i].top) < mergeDistance)
				mergeNodes(nodes[i], p)
	}
	fromBoundary = isBoundaryNode(channel.node1);
	canvas.setActiveObject(channel.node2);
	if (manual)
		isDown = true
}

function createLink(node) {
	const clone = createNode(node.left, node.top, node.label.text),
		link = new fabric.Line([node.left, node.top, clone.left, clone.top], {
			fill: 'silver',
			stroke: 'silver',
			strokeWidth: 1,
			hasBorders: false,
			hasControls: false,
			evented: false,
			hoverCursor: 'default',
			originX: 'center',
			originY: 'center',
			nodes: [node, clone]
		});
	node.link = link;
	clone.link = link;
	canvas.discardActiveObject(null);
	canvas.add(link, clone, clone.label);
	node.bringToFront();
	canvas.setActiveObject(clone);
	canvas.requestRenderAll()
}

/**
 * Creates a span, representing a channel from given properties, and appends it to channels div
 * @param {Object} properties
 * @param {string} properties.name - name of the channel
 * @param {string} properties.class - class attribute of channel
 */
function loadChannel(properties) {
	let img = document.createElement("img");
	img.setAttribute("src", "img/" + properties.name + ".svg");
	img.setAttribute("alt", properties.name);
	let a = document.createElement("a");
	a.setAttribute("title", properties.name);
	a.appendChild(img);
	let span = document.createElement("span");
	span.setAttribute("id", properties.name);
	span.setAttribute("class", properties.class);
	span.appendChild(a);
	span.appendChild(document.createElement("br"));
	span.appendChild(document.createTextNode(properties.name));
	span.onclick = function () {
		buttonClick(this)
	};
	document.getElementById("channels").appendChild(span)
}

/**
 * Loads predefined channels at load time
 */
async function loadChannels() {
	if (typeof Storage !== "undefined" && localStorage.getItem("channels"))
		channelTypes = JSON.parse(localStorage.getItem("channels"));

	for (let i = 0; i < channelTypes.length; ++i)
		loadChannel(channelTypes[i])
}

function calculateAngle(channel, baseAngle) {
	let angle = 0,
		x = (channel.node2.get('left') - channel.node1.get('left')),
		y = (channel.node2.get('top') - channel.node1.get('top'));

	if (x === 0)
		angle = (y === 0) ? 0 : (y > 0) ? Math.PI / 2 : Math.PI * 3 / 2;
	else if (y === 0)
		angle = (x > 0) ? 0 : Math.PI;
	else
		angle = (x < 0) ? Math.atan(y / x) + Math.PI : (y < 0) ? Math.atan(y / x) + (2 * Math.PI) : Math.atan(y / x);

	return ((angle * 180 / Math.PI) + baseAngle) % 360
} //calculateAngle

/**
 * Sets the parent property of object p.
 * @param p - Either a node, a channel or a component.
 */
function setParent(p) {
	if (!main || p === main) return;
	let parentArray, i;

	// if a parent is set, remove the reference to p from the parent
	if (p.parent) {
		switch (p.class) {
			case 'node':
				parentArray = p.parent.nodes;
				break;
			case 'channel':
				parentArray = p.parent.channels;
				break;
			case 'component':
				parentArray = p.parent.components
		}
		for (i = 0; i < parentArray.length; ++i)
			if (parentArray[i] === p) {
				parentArray.splice(i, 1);
				break
			}
	}

	switch (p.class) {
		case 'node':
			for (i = components.length - 1; i >= 0; --i)
				if (p.intersectsWithObject(components[i])) {
					p.parent = components[i];
					components[i].nodes.push(p);
					break
				}

			// set a parent for the channels if necessary
			for (i = 0; i < p.channels.length; ++i)
				setParent(p.channels[i]);
			break;
		case 'channel':
			if (p.node1.parent.index < p.node2.parent.index)
				p.parent = p.node1.parent;
			else
				p.parent = p.node2.parent;
			p.parent.channels.push(p);
			break;
		case 'component':
			for (i = components.length - 1; i >= 0; --i)
				if (p !== components[i] && p.intersectsWithObject(components[i])) {
					p.parent = components[i];
					components[i].components.push(p)
				}
	}
}

function updateNode(node, keepParent) {
	// set node coordinates
	node.label.setCoords();
	node.set({labelOffsetX: node.label.left - node.left, labelOffsetY: node.label.top - node.top});
	for (let i = nodes.length - 1; i >= 0; --i) {
		// prevent comparing the node with itself
		if (nodes[i] === node) continue;
		// merge nodes that overlap
		if (node.intersectsWithObject(nodes[i]))
			if (Math.abs(node.left - nodes[i].left) < mergeDistance && Math.abs(node.top - nodes[i].top) < mergeDistance)
				mergeNodes(node, nodes[i])
	}
	if (!keepParent)
		setParent(node);
	updateNodeColouring(node)
} //updateNode

function updateNodeColouring(node) {
	let source = false, sink = false, i;
	for (i = 0; i < node.channels.length; ++i) {
		if (node.channels[i].node1 === node) {
			if (node.channels[i].end1 === 'source')
				source = true;
			else
				sink = true
		} else if (node.channels[i].node2 === node) {
			if (node.channels[i].end2 === 'source')
				source = true;
			else
				sink = true
		} else throw new Error("Internal datastructure has broken down at node " + node.id)
	}

	if (source) {
		if (sink)
			node.set({nodeType: 'mixed', fill: nodeFillColourMixed});
		else
			node.set({nodeType: 'source', fill: nodeFillColourSource})
	} else
		node.set({nodeType: 'sink', fill: nodeFillColourSink});
	canvas.requestRenderAll()
}

function updateChannel(channel) {
	const x1 = channel.node1.get('left'), y1 = channel.node1.get('top'),
		x2 = channel.node2.get('left'), y2 = channel.node2.get('top'),
		diffX = Math.abs(x1 - x2), diffY = Math.abs(y1 - y2);

	// update the reference rectangle
	switch (channel.parts[0].type) {
		case 'rect':
			channel.parts[0].set({
				left: Math.min(x1, x2) + diffX / 2,
				top: Math.min(y1, y2) + diffY / 2,
				angle: calculateAngle(channel, 90)
			});

			// convert new size to scaling
			const length = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
			const scale = length / channel.parts[0].baseLength;
			channel.parts[0].set({scaleX: scale, scaleY: scale});
			channel.parts[0].setCoords();
			break;
		case 'circle':
			channel.parts[0].set({left: x1, top: y1 - loopRadius});
			channel.parts[0].setCoords()
	}

	// update all channel components
	for (let i = 1; i < channel.parts.length; ++i) {
		const o = channel.parts[i];
		if (o.type === 'line')
			o.set({x1: x1, y1: y1, x2: x2, y2: y2});
		else {
			if (!o.relationship) throw new Error("No relationship found");
			const newTransform = fabric.util.multiplyTransformMatrices(channel.parts[0].calcTransformMatrix(), o.relationship, false);
			let opt = fabric.util.qrDecompose(newTransform);
			o.set({flipX: false, flipY: false});
			o.setPositionByOrigin(new fabric.Point(opt.translateX, opt.translateY), 'center', 'center');
			o.set(opt);
			if (o.scale === false) {
				if (o.type === 'image')
					o.set({scaleX: o.baseScaleX, scaleY: o.baseScaleY});
				else
					o.set({scaleX: 1, scaleY: 1})
			}
			if (o.rotate === false)
				o.set('angle', o.baseAngle);
			let reference;
			switch (o.referencePoint) {
				case 'node1':
					reference = channel.node1;
					break;
				case 'node2':
					reference = channel.node2;
					break;
				default:
					if (channel.parts[0].type === 'rect')
						reference = channel.parts[0];
					else
						reference = {
							left: loopRadius * Math.cos((channel.parts[0].angle - 90) * Math.PI / 180) + channel.parts[0].left,
							top: loopRadius * Math.sin((channel.parts[0].angle - 90) * Math.PI / 180) + channel.parts[0].top
						}
			}
			o.set({
				left: o.referenceDistance * Math.cos((channel.parts[0].angle + o.referenceAngle + 180) * Math.PI / 180) + reference.left,
				top: o.referenceDistance * Math.sin((channel.parts[0].angle + o.referenceAngle + 180) * Math.PI / 180) + reference.top
			})
		}
		o.setCoords()
	}

	// If the delete button has been loaded, reset the width of the reference object
	if (channel.reference && channel.reference.delete)
		channel.parts[0].set('scaleX', 1).setCoords();
	canvas.requestRenderAll()
} //updateChannel

function isBoundaryNode(node) {
	return node.left === node.parent.left ||
		node.top === node.parent.top ||
		node.left === node.parent.left + node.parent.width ||
		node.top === node.parent.top + node.parent.height
}

function updateText() {
	codeEditor.setValue(components.map(c => c.toReoDefinition(document.getElementById('commentSwitch').checked)).join('\n'))
}

function snapToComponent(node, comp) {
	const right = comp.left + comp.scaleX * comp.width, bottom = comp.top + comp.scaleY * comp.height;
	if (node.left > right) // right side
		node.set('left', right);
	if (node.left < comp.left) // left side
		node.set('left', comp.left);
	if (node.top > bottom) // bottom side
		node.set('top', bottom);
	if (node.top < comp.top) // top side
		node.set('top', comp.top);
	node.setCoords();
	node.label.set({left: node.left + node.labelOffsetX, top: node.top + node.labelOffsetY});
	node.label.setCoords();
	node.label.bringToFront();
	for (let i = 0; i < node.channels.length; ++i)
		updateChannel(node.channels[i]);
	updateText()
}

/**
 * Reposition parts of the component when it's being moved or resized
 * @param c - The component that is being moved or resized
 */
function repositionParts(c) {
	c.label.set({left: c.left + (c.scaleX * c.width) / 2, top: c.top + 15});
	c.label.setCoords();
	c.header.set({x1: c.left, y1: c.top + headerHeight, x2: c.left + c.scaleX * c.width, y2: c.top + headerHeight});
	c.header.setCoords();
	if (c.delete) {
		c.delete.set({left: c.left + 15, top: c.top + 15});
		c.delete.setCoords()
	}
	if (c.compactSwitch) {
		c.compactSwitch.set({left: c.left + 35, top: c.top + 15});
		c.compactSwitch.setCoords()
	}
	if (c.copy) {
		c.copy.set({left: c.left + 55, top: c.top + 15});
		c.copy.setCoords()
	}
}

/**
 * Reposition attached nodes of the component when it's being resized
 * @param c - The component that is being resized
 */
function repositionNodes(c) {
	for (let i = 0; i < c.nodes.length; ++i) {
		let node = c.nodes[i];
		if (node.origLeft === origLeft)
			node.set('left', c.left);
		if (node.origLeft === origRight)
			node.set('left', c.left + c.scaleX * c.width);
		if (node.origTop === origTop)
			node.set('top', c.top);
		if (node.origTop === origBottom)
			node.set('top', c.top + c.scaleY * c.height);
		snapToComponent(node, node.parent)
	}
}

canvas.on('object:moving', function (e) {
	e.target.setCoords()
}); //object:moving

canvas.on('object:added', function () {
	listener.clearCache();
	updateText()
}); //object:added

canvas.on('object:removed', function () {
	listener.clearCache();
	updateText()
}); //object:removed

canvas.on('text:changed', function () {
	listener.clearCache();
	updateText()
}); //text:editing:exited

canvas.on('mouse:up', function () {
	onMouseUp()
});

canvas.on('selection:created', function (e) {
	if (e.target.delete)
		e.target.delete.set('visible', true);
	if (e.target.split)
		e.target.split.set('visible', true);
	canvas.requestRenderAll()
});

canvas.on('selection:updated', function (e) {
	let i;
	for (i = 0; i < nodes.length; ++i) {
		if (nodes[i].delete)
			nodes[i].delete.set('visible', false);
		if (nodes[i].split)
			nodes[i].split.set('visible', false)
	}
	for (i = 0; i < channels.length; ++i)
		if (channels[i].parts[0].delete)
			channels[i].parts[0].delete.set('visible', false);
	if (e.target.delete)
		e.target.delete.set('visible', true);
	if (e.target.split)
		e.target.split.set('visible', true);
	canvas.requestRenderAll()
});

canvas.on('before:selection:cleared', function (e) {
	if (e.target.delete && (!e.target.class || e.target.class !== 'component'))
		e.target.delete.set('visible', false);
	if (e.target.split)
		e.target.split.set('visible', false);
	canvas.requestRenderAll()
});

/*canvas.on('mouse:over', function(e) {
  if (e.target) {
    switch (e.target.class) {
      case "anchor":
        // TODO Anchors
        e.target.set('opacity', 100);
        break;
      case 'options':
        e.target.parent.balloon.animate('opacity', 100, {
          onChange: canvas.renderAll.bind(canvas),
          duration: 1000
        });
        break;
      case 'balloon':
        e.target.set({opacity: 100, isHover: true})
    }
    canvas.requestRenderAll()
  }
}); //mouse:over

canvas.on('mouse:out', function(e) {
  if (e.target) {
    switch (e.target.class) {
      case "anchor":
        // TODO Anchors
        e.target.set('opacity', 0);
        break;
      case 'options':
        e.target.parent.balloon.animate('opacity', 0, {
          onChange: canvas.renderAll.bind(canvas),
          duration: 1000,
          onComplete: (e) => {
            let balloon = e.target.parent.balloon;
            if (balloon.isHover)
              balloon.set('opacity', 100)
          }
        });
        break;
      case 'balloon':
        e.target.set({opacity: 0, isHover: false})
    }
    canvas.requestRenderAll()
  }
}); //mouse:out*/

canvas.on('mouse:down', function (e) {
	const pointer = canvas.getPointer(e.e, false), p = canvas.getActiveObject();
	let i, otherNode;
	isDown = true;
	origX = pointer.x;
	origY = pointer.y;
	if (p && mode !== 'select')
		canvas.discardActiveObject(null);
	switch (mode) {
		case 'select':
			if (p) {
				switch (p.class) {
					case 'node':
						bringNodeToFront(p);
						fromBoundary = true;
						for (i = 0; i < p.channels.length; ++i) {
							if (p.channels[i].node1 === p)
								otherNode = 'node2';
							else
								otherNode = 'node1';
							if (!isBoundaryNode(p.channels[i][otherNode])) {
								fromBoundary = false;
								break
							}
						}
						break;
					case 'component':
						bringComponentToFront(p);
						origLeft = p.left;
						origRight = p.left + p.width;
						origTop = p.top;
						origBottom = p.top + p.height;
						p.nodes = [];
						for (i = 0; i < nodes.length; ++i)
							if (nodes[i].parent === p) {
								p.nodes.push(nodes[i]);
								nodes[i].origLeft = nodes[i].left;
								nodes[i].origTop = nodes[i].top
							}
						break;
					case 'delete':
						switch (p.parent.class) {
							case 'component':
								deleteComponent(p.parent);
								break;
							case 'channel':
								deleteChannel(p.parent);
								break;
							case 'node':
								deleteNode(p.parent)
						}
						break;
					case 'compactSwitch':
						compactComponent(p.parent);
						canvas.discardActiveObject(null);
						break;
					case 'copy':
						copyComponent(p.parent);
						break;
					case 'split':
						buttonClick(document.getElementById("split"));
						prepareSplit(p.parent)
				}
			}
			break;
		case 'component':
			createComponent(pointer.x, pointer.y, pointer.x, pointer.y, undefined, true);
			break;
		case 'split':
			if (p) {
				if (p.class && p.class === 'node') {
					if (p.selection.visible === true) {
						for (i = 0; i < p.channels.length; ++i)
							if (p.channels[i].parts[0].fill === splitSelected) {
								splitNode(p);
								break
							}
					} else
						prepareSplit(p)
				} else if (p.parent && p.parent.class === 'channel') {
					p.set('fill', p.fill === splitSelected ? splitDeselected : splitSelected);
					canvas.requestRenderAll()
				}
			}
			break;
		default:
			createChannel(mode, {x: pointer.x, y: pointer.y}, {x: pointer.x, y: pointer.y}, true)
	}
}); //mouse:down

canvas.on('mouse:move', function (e) {
	if (!isDown) return;

	const p = canvas.getActiveObject() || e.target;
	if (!p) return;

	const pointer = canvas.getPointer(e.e, false);
	let i, j, x = pointer.x, y = pointer.y, index = -1;
	switch (p.class) {
		case 'component':
			if (p.status === 'drawing') {
				if (origX > x)
					p.set('left', x);
				if (origY > y)
					p.set('top', y);
				p.set({width: Math.abs(origX - x), height: Math.abs(origY - y)});
				p.setCoords()
			} else {
				if (p.__corner !== 0)
					repositionNodes(p);
				else {
					p.set({left: origLeft + x - origX, top: origTop + y - origY});
					p.setCoords();
					for (i = 0; i < p.nodes.length; ++i) {
						let node = p.nodes[i];
						node.set({left: node.origLeft + x - origX, top: node.origTop + y - origY});
						node.setCoords();
						node.label.set({left: node.left + node.labelOffsetX, top: node.top + node.labelOffsetY});
						node.label.setCoords();
						for (j = 0; j < node.channels.length; ++j)
							updateChannel(node.channels[j])
					}
				}
			}
			repositionParts(p);
			break;
		case 'node':
			p.set({left: x, top: y}).setCoords();
			if (p.link)
				p.link.set({
					x1: p.link.nodes[0].left,
					y1: p.link.nodes[0].top,
					x2: p.link.nodes[1].left,
					y2: p.link.nodes[1].top
				}).setCoords();
			for (i = 0; i < nodes.length; ++i)
				if (Math.abs(p.left - nodes[i].left) < mergeDistance && Math.abs(p.top - nodes[i].top) < mergeDistance)
					p.set({left: nodes[i].left, top: nodes[i].top}).setCoords();

			if (!fromBoundary) {
				// Limit the node position to the parent
				if (p.left < p.parent.left + mergeDistance) // near left boundary
					p.set('left', p.parent.left);
				if (p.top < p.parent.top + headerHeight) // near top boundary
					p.set('top', p.parent.top);
				if (p.left > p.parent.left + p.parent.width - mergeDistance) // near right boundary
					p.set('left', p.parent.left + p.parent.width);
				if (p.top > p.parent.top + p.parent.height - mergeDistance) // near bottom boundary
					p.set('top', p.parent.top + p.parent.height);
				p.setCoords()
			}

			if (fromBoundary || p.parent === main) {
				for (i = 0; i < components.length; ++i) {
					// Check if the node is over an other component
					if (p.left > components[i].left - mergeDistance &&
						p.top > components[i].top - mergeDistance &&
						p.left < components[i].left + components[i].width + mergeDistance &&
						p.top < components[i].top + components[i].height + mergeDistance)
						index = i
				}

				if (index >= 0 && components[index] !== p.parent && components[index] !== main) {
					// Ensure that the node is inside the component
					if (p.left < components[index].left) // near left boundary
						p.set('left', components[index].left);
					if (p.top < components[index].top) // near top boundary
						p.set('top', components[index].top);
					if (p.left > components[index].left + components[index].width) // near right boundary
						p.set('left', components[index].left + components[index].width);
					if (p.top > components[index].top + components[index].height) // near bottom boundary
						p.set('top', components[index].top + components[index].height);
					p.setCoords();

					// Find the closest boundary
					let changingPosition, distance, position, size = 0;
					distance = p.left - components[index].left; // left boundary
					changingPosition = 'left';
					position = components[index].left;
					if (p.top - components[index].top < distance) { // top boundary
						distance = p.top - components[index].top;
						changingPosition = 'top';
						position = components[index].top
					}
					if (components[index].left + components[index].width - p.left < distance) { // right boundary
						distance = components[index].left + components[index].width - p.left;
						changingPosition = 'left';
						position = components[index].left;
						size = components[index].width
					}
					if (components[index].top + components[index].height - p.top < distance) { // bottom boundary
						changingPosition = 'top';
						position = components[index].top;
						size = components[index].height
					}

					// Move the node to the closest boundary
					const newPosition = {};
					newPosition[changingPosition] = components[index][changingPosition] + size;
					p.set(newPosition);
					p.setCoords()
				}
			}

			p.label.set({left: p.left + p.labelOffsetX, top: p.top + p.labelOffsetY});
			if (p.delete)
				p.delete.set({left: p.left - 15, top: p.top + 15}).setCoords();
			if (p.split)
				p.split.set({left: p.left + 15, top: p.top + 15}).setCoords();
			p.selection.set({left: p.left, top: p.top}).setCoords();
			for (i = 0; i < p.channels.length; ++i)
				updateChannel(p.channels[i]);
			break;
		default:
			return
	}
	p.label.setCoords();
	canvas.requestRenderAll()
}); //mouse:move

function onMouseUp() {
	isDown = false;
	const p = canvas.getActiveObject();
	if (p) {
		p.setCoords();
		switch (p.class) {
			case 'node':
				updateNode(p, !(fromBoundary || p.parent === main));
				if (mode === 'split')
					buttonClick(document.getElementById("select"));
				break;
			case 'component':
				p.set({width: p.scaleX * p.width, height: p.scaleY * p.height, scaleX: 1, scaleY: 1});
				p.setCoords();
				if (p.status === 'drawing')
					p.set('status', 'design');
				p.set('selectable', mode === 'select');
				bringComponentToFront(p);
				if (mode !== 'select')
					buttonClick(document.getElementById("select"));
				break;
			case 'label':
				p.setCoords();
				p.object.set({labelOffsetX: p.left - p.object.left, labelOffsetY: p.top - p.object.top});
				break
		}
		if (mode !== 'select')
			canvas.discardActiveObject(null);
		canvas.requestRenderAll();
		updateText()
	}
}

function mergeNodes(destination, source) {
	let j, i;
	for (j = 0; j < source.channels.length; ++j) {
		let loop = false;
		if (source.channels[j].node1 === source) {
			source.channels[j].node1 = destination;
			if (source.channels[j].node2 === destination)
				loop = true
		} else {
			if (source.channels[j].node2 === source) {
				source.channels[j].node2 = destination;
				if (source.channels[j].node1 === destination)
					loop = true
			} else
				throw new Error("channel is not connected to node")
		}
		if (loop) {
			// if the source node is equal to the destination node, create a loop and update the position of all channel parts
			const channel = source.channels[j], rect = channel.parts[0], line = channel.parts[1];

			// create a circle to replace the channel line
			const curve = new fabric.Circle({
				left: line.x1,
				top: line.y1 - loopRadius,
				angle: 0,
				parent: channel,
				strokeWidth: lineStrokeWidth,
				strokeDashArray: line.strokeDashArray,
				fill: 'transparent',
				radius: loopRadius,
				stroke: lineStrokeColour,
				hasControls: false,
				lockMovementX: true,
				lockMovementY: true,
				selectable: mode === 'select',
				hoverCursor: mode === 'select' ? 'pointer' : 'default'
			});
			canvas.add(curve);

			// create a new position for all parts based on their original position
			for (i = 2; i < channel.parts.length; ++i) {
				const o = channel.parts[i];
				if (o.referencePoint === 'node1' || o.referencePoint === 'node2' || o.referencePoint === 'middle') {
					// calculate the distance along the straight line
					let length = o.referenceDistance * Math.cos((rect.angle + o.referenceAngle + 180) * Math.PI / 180);
					// calculate the offset from the straight line
					let offset = o.referenceDistance * Math.sin((rect.angle + o.referenceAngle + 180) * Math.PI / 180);
					let circumference = 2 * Math.PI * loopRadius;
					// determine where on the circumference the object should be placed
					let angleA = (-length / circumference) * 360;
					if (o.referencePoint === 'middle')
						angleA += 180;
					// adjust the object's own angle
					o.angle = o.angle + angleA;
					// reposition the object
					o.set({
						left: (loopRadius + offset) * Math.cos((angleA + 90) * Math.PI / 180) + curve.left,
						top: (loopRadius + offset) * Math.sin((angleA + 90) * Math.PI / 180) + curve.top
					});
					let diffX, diffY;
					if (o.referencePoint === 'middle') {
						diffX = o.left - curve.left;
						diffY = o.top - (curve.top - loopRadius)
					} else {
						diffX = o.left - line.x1;
						diffY = o.top - line.y1
					}
					// save the new referenceDistance and referenceAngle
					o.set({
						referenceDistance: Math.sqrt(Math.pow(diffX, 2) + Math.pow(diffY, 2)),
						referenceAngle: Math.atan2(diffY, diffX) * 180 / Math.PI + 180
					})
				}
				const bossTransform = curve.calcTransformMatrix();
				const invertedBossTransform = fabric.util.invertTransform(bossTransform);
				channel.parts[i].relationship = fabric.util.multiplyTransformMatrices(invertedBossTransform, channel.parts[i].calcTransformMatrix(), false);
				canvas.remove(o);
				canvas.add(o)
			}
			channel.parts[0] = curve;
			channel.reference = curve;
			curve.set('delete', channel.delete);
			channel.parts.splice(1, 1);
			canvas.remove(line)
		} else
			destination.channels.push(source.channels[j])
	}
	for (i = 0; i < nodes.length; ++i)
		if (nodes[i] === source) {
			nodes.splice(i, 1);
			break
		}
	for (i = 0; i < source.parent.nodes.length; ++i)
		if (source.parent.nodes[i] === source) {
			source.parent.nodes.splice(i, 1);
			break
		}
	updateNodeColouring(destination);
	destination.bringToFront();
	canvas.remove(source.label, source.delete, source.split, source)
}

function prepareSplit(node) {
	let i, j;
	for (j = 0; j < nodes.length; ++j) {
		if (nodes[j].selection.visible === true) {
			nodes[j].selection.set('visible', false);
			for (i = 0; i < nodes[j].channels.length; ++i)
				nodes[j].channels[i].parts[0].set({fill: 'transparent', selectable: false, hoverCursor: 'default'});
			break
		}
	}
	node.selection.set('visible', true);
	for (i = 0; i < node.channels.length; ++i)
		node.channels[i].parts[0].set({fill: splitDeselected, selectable: true, hoverCursor: 'pointer'});
	canvas.requestRenderAll()
}

function splitNode(source) {
	let i, otherNode;
	const destination = createNode(source.left, source.top, null, true);
	source.parent.nodes.push(destination);
	for (i = 0; i < source.channels.length; ++i)
		if (source.channels[i].parts[0].fill === splitSelected) {
			if (source.channels[i].node1 === source)
				source.channels[i].node1 = destination;
			if (source.channels[i].node2 === source)
				source.channels[i].node2 = destination;
			destination.channels.push(source.channels[i]);
			source.channels.splice(i, 1);
			--i
		}
	source.selection.set('visible', false);
	destination.selection.set('visible', true);
	updateNodeColouring(destination);
	canvas.discardActiveObject(null);
	source.set({lockMovementX: true, lockMovementY: true});
	canvas.setActiveObject(destination);
	bringNodeToFront(destination);
	fromBoundary = true;
	for (i = 0; i < destination.channels.length; ++i) {
		if (destination.channels[i].node1 === destination)
			otherNode = 'node2';
		else
			otherNode = 'node1';

		if (!isBoundaryNode(destination.channels[i][otherNode])) {
			fromBoundary = false;
			break
		}
	}
}

/**
 * Moves component p and all its objects to the top layer
 */
function bringComponentToFront(p) {
	if (!p || p.class !== 'component') return;

	let i, j, limit = components.length;

	// Move p to the end of the array
	for (i = 0; i < limit; ++i)
		if (components[i] === p) {
			components.splice(i, 1);
			p.set('index', components.length);
			components.push(p);
			--i;
			--limit;
			break
		}
	// Update the other index parameters accordingly
	for (; i < limit; ++i)
		components[i].set('index', i);
	p.bringToFront();
	p.header.bringToFront();
	if (p.delete)
		p.delete.bringToFront();
	if (p.compactSwitch)
		p.compactSwitch.bringToFront();
	if (p.copy)
		p.copy.bringToFront();
	p.label.bringToFront();
	// Set a new parent for the channels if necessary
	for (i = p.channels.length - 1; i >= 0; --i)
		setParent(p.channels[i]);
	for (i = 0; i < p.channels.length; ++i)
		for (j = 1; j < p.channels[i].parts.length; ++j)
			p.channels[i].parts[j].bringToFront();
	for (i = 0; i < p.nodes.length; ++i) {
		p.nodes[i].bringToFront();
		p.nodes[i].label.bringToFront()
	}
	for (i = 0; i < p.components.length; ++i)
		bringComponentToFront(p.components[i]);
	canvas.requestRenderAll()
}

/**
 * Moves node p and all its connected channels to the top layer
 */
function bringNodeToFront(p) {
	let i, j;
	p.selection.bringToFront();
	for (i = 0; i < p.channels.length; ++i) {
		for (j = 1; j < p.channels[i].parts.length; ++j)
			p.channels[i].parts[j].bringToFront();
		p.channels[i].node1.bringToFront();
		p.channels[i].node2.bringToFront()
	}
	p.label.bringToFront();
	if (p.delete)
		p.delete.bringToFront();
	if (p.split)
		p.split.bringToFront()
}

function deleteNode(node) {
	let i;
	// delete the connecting channels
	for (i = node.channels.length - 1; i >= 0; --i)
		deleteChannel(node.channels[i]);
	// remove the node from the global nodes array
	for (i = 0; i < nodes.length; ++i)
		if (nodes[i] === node) {
			nodes.splice(i, 1);
			break
		}
	// remove the node from the parent nodes array
	for (i = 0; i < node.parent.nodes.length; ++i)
		if (node.parent.nodes[i] === node) {
			node.parent.nodes.splice(i, 1);
			break
		}
	canvas.remove(node, node.label)
}

function deleteChannel(channel) {
	let j;
	// delete the channel reference from the connecting nodes
	if (channel.node1)
		for (j = 0; j < channel.node1.channels.length; ++j)
			if (channel.node1.channels[j] === channel) {
				channel.node1.channels.splice(j, 1);
				if (channel.node1.channels.length === 0)
					deleteNode(channel.node1);
				else
					updateNodeColouring(channel.node1);
				break
			}
	if (channel.node2)
		for (j = 0; j < channel.node2.channels.length; ++j)
			if (channel.node2.channels[j] === channel) {
				channel.node2.channels.splice(j, 1);
				if (channel.node2.channels.length === 0)
					deleteNode(channel.node2);
				else
					updateNodeColouring(channel.node2);
				break
			}
	// remove the channel from the global channels array
	for (j = 0; j < channels.length; ++j)
		if (channels[j] === channel) {
			channels.splice(j, 1);
			break
		}
	// remove the channel from the parent channels array
	for (j = 0; j < channel.parent.channels.length; ++j)
		if (channel.parent.channels[j] === channel) {
			channel.parent.channels.splice(j, 1);
			break
		}
	// remove the channel and all its parts
	for (j = 0; j < channel.parts.length; ++j)
		canvas.remove(channel.parts[j])
}

/**
 * Deletes component and all underlying objects, including other components.
 * recursive is for internal use only.
 */
function deleteComponent(component, recursive) {
	let k;
	// delete underlying components
	for (k = 0; k < component.components.length; ++k)
		deleteComponent(component.components[k], true);
	// delete all nodes that are in this component
	for (k = 0; k < component.nodes.length; ++k)
		deleteNode(component.nodes[k]);
	// remove the component from the global components array
	for (k = 0; k < components.length; ++k)
		if (components[k] === component) {
			components.splice(k, 1);
			break
		}
	// remove the component from the parent components array
	if (component.parent && !recursive)
		for (k = 0; k < component.parent.components.length; ++k)
			if (component.parent.components[k] === component) {
				component.parent.components.splice(k, 1);
				break
			}
	if (component !== main)
		canvas.remove(component.delete, component.compactSwitch, component.copy);
	canvas.remove(component, component.header, component.label)
}

function compactComponent(component) {
	if (component.compact)
		component.set({height: component.realHeight, width: component.realWidth});
	else
		component.set({realHeight: component.height, realWidth: component.width, height: 90, width: 110});
	component.compact = !component.compact;
	repositionParts(component);
	repositionNodes(component)
}

function copyComponent(p) {
	createComponent(p.left + 20, p.top + 20, p.left + p.width + 20, p.top + p.height + 20, p.id);

	let i, c;
	for (i = 0; i < p.channels.length; ++i) {
		c = p.channels[i];
		createChannel(c.name, {x: c.node1.left + 20, y: c.node1.top + 20, name: c.node1.id}, {
			x: c.node2.left + 20,
			y: c.node2.top + 20,
			name: c.node2.id
		})
	}
}

document.addEventListener("keydown", function (e) {
	const p = canvas.getActiveObject();
	switch (e.code) {
		case "Delete":
			if (p)
				switch (p.class) {
					case 'node':
						deleteNode(p);
						break;
					case 'component':
						deleteComponent(p);
						break;
					default:
						if (p.parent && p.parent.class && p.parent.class === 'channel')
							deleteChannel(p.parent)
				}
			break;
		case "Escape":
			if (mode !== 'select') {
				if (isDown)
					onMouseUp();
				buttonClick(document.getElementById("select"))
			}
			break;
		case "KeyZ":
			if (e.ctrlKey) {
				if (e.shiftKey)
					console.log("Ctrl + Shift + Z");  // TODO redo
				else
					console.log("Ctrl + Z")  // TODO undo
			}
	}
});

function createComponent(x1, y1, x2, y2, name, manual) {  // FIXME parent component must be set for code generation
	const width = (x2 - x1), height = (y2 - y1), left = x1, top = y1;

	const component = new fabric.Rect({
		left: left,
		top: top,
		width: width,
		height: height,
		fill: '#eee',
		stroke: '#000',
		strokeWidth: 1,
		hoverCursor: 'default',
		originX: 'left',
		originY: 'top',
		hasRotatingPoint: false,
		selectable: mode === 'select',
		area: width * height,
		class: 'component',
		status: manual ? 'drawing' : 'design',
		nodes: [],
		channels: [],
		components: [],
		id: name ? name : generateID()
	});

	const header = new fabric.Line([x1, y1 + headerHeight, x2, y1 + headerHeight], {
		fill: '#000',
		stroke: '#000',
		strokeWidth: 1,
		evented: false
	});
	const label = new fabric.IText(component.id, {
		left: left + (width / 2),
		top: top + 15,
		fontSize: 24,
		class: 'title',
		object: component,
		hoverCursor: mode === 'select' ? 'text' : 'default',
		hasControls: false,
		lockMovementX: true,
		lockMovementY: true,
		selectable: mode === 'select'
	});
	component.set({label: label, header: header});

	if (name !== 'main') {
		const createAnchor = (img, cls) => {
			img.scale((nodeFactor * 4) / img.height).set({
				left: component.left + 35,
				top: component.top + 15,
				class: cls,
				parent: component,
				hasControls: false,
				hasBorders: false,
				lockMovementX: true,
				lockMovementY: true,
				hoverCursor: 'pointer'
			});
			component.set(cls, img);
			if (cls === 'compactSwitch') component.set('compact', false);
			canvas.add(img)
		};
		fabric.Image.fromURL('img/delete.svg', img => createAnchor(img, 'delete'));
		fabric.Image.fromURL('img/compact.svg', img => createAnchor(img, 'compactSwitch'));
		fabric.Image.fromURL('img/copy.svg', img => createAnchor(img, 'copy'))
	}

	/*var options = new fabric.Circle({
	  left: left + 15,
	  top: top + 15,
	  radius: nodeFactor * 2,
	  hasControls: false,
	  selectable: false,
	  parent: rect,
	  class: 'options'
	});

	var balloon = new fabric.Rect({
	  left: left - 40,
	  top: top - 40,
	  width: 50,
	  height: headerHeight,
	  fill: '#FFF',
	  stroke: '#000',
	  strokeWidth: 1,
	  originX: 'left',
	  originY: 'top',
	  selectable: false,
	  class: 'balloon',
	  isHover: false,
	  opacity: 0
	});

	rect.set({options: options, balloon: balloon});
	canvas.add(options, balloon);*/

	component.generatePositionMetadata = function () {
		return ` /*! pos(${this.id}): [${Math.round(this.left)}, ${Math.round(this.top)}, ${Math.round(this.left + this.width)}, ${Math.round(this.top + this.height)}] !*/`
	};

	component.toReoDefinition = function (withComment) {
		return `${this.id}(${this.nodes.filter(isBoundaryNode).map(n => n.id).join(', ')}) {\n`
			// Channels which are inside component
			+ (this.channels.length > 0 ? '\t//Channels\n' + this.channels.map(c => `\t${c.toReo(withComment)}`).join('') + '\n' : '')
			// Other component's instances which are inside component  // FIXME pass correct ports to instance creation
			+ (this.components.length > 0 ? '\t//Components\n' + this.components.map(c => `\t${c.toReoInstance(withComment)}`).join('') : '')
			+ '}\n'
	};

	component.toReoInstance = function (withComment) {
		return `${this.id}(${this.nodes.filter(isBoundaryNode).map(n => n.id).join(', ')})${withComment ? this.generatePositionMetadata() : ''}\n`
	};

	setParent(component);
	component.set('index', components.length);
	components.push(component);
	canvas.add(component, header, label);
	canvas.setActiveObject(component);
	return component
}

function clearAll() {
	canvas.clear();
	id = '0';
	nodes = [];
	channels = [];
	components = [];
	main = undefined
}

var main = createComponent(25, 25, container.clientWidth - 25, container.clientHeight - 25, 'main');
main.set({id: 'main', evented: false});
buttonClick(document.getElementById("select"));
updateText();
resizeElements();

// Test
//createChannel('sync',{x: 100, y: 150},{x: 200, y: 150});
//createChannel('lossysync',{x: 100, y: 250},{x: 200, y: 250});
//createChannel('syncdrain',{x: 100, y: 350},{x: 200, y: 350});
//createChannel('syncspout',{x: 100, y: 450},{x: 200, y: 450});
//createChannel('fifo1',{x: 100, y: 550},{x: 200, y: 550});
