define(['jquery', 'util/util'], function($, Util) {

	var _scope = this;
	var graphDefaults =  {
		paddingTop: 30,
		paddingBottom: 0,
		paddingLeft: 20,
		paddingRight: 20,

		close: {
			left: true,
			right: true, 
			top: true,
			bottom: true
		},

		title: '',
		zoomMode: false,
		defaultMouseAction: 'drag', // rangeX, rangeY
		shiftMouseAction: 'zoomXY', // rangeX, rangeY
		defaultWheelAction: 'zoomY',
		lineToZero: false,
		fontSize: 12,
		fontFamily: 'Myriad Pro, Helvetica, Arial',
		addLabelOnClick: false,
		onVerticalTracking: false,
		onHorizontalTracking: false,
		rangeLimitX: 1,
		rangeLimitY: 0,		
		unzoomGradual: true,

		plugins: ['zoom', 'drag'],

		keyCombinations: {
			integral: { shift: true, ctrl: false },
			zoom: { shift: false, ctrl: false }
		}
	};


	var Graph = function(dom, options, axis) {

		this._creation = Date.now() + Math.random();

		this.options = $.extend({}, graphDefaults, options);
		this.axis = {left: [], top: [], bottom: [], right: []};
		this.title = false;

		this.width = 0;
		this.height = 0;

		this.ns = 'http://www.w3.org/2000/svg';
		this.nsxlink = "http://www.w3.org/1999/xlink";
		this.series = [];
		this._dom = dom;
		// DOM
		this.doDom();
		this.registerEvents();
		this.shapes = [];

		this.trackingLines = {
			id: 0,
			current: false,
			dasharray: [false, "5, 5", "5, 1", "1, 5"],
			currentDasharray: [],
			vertical: [],
			horizontal: []
		};

		this.ranges = {
			current: undefined,
			x: [],
			y: [],
			countX: 0,
			countY: 0
		};
		
		this.currentAction = false;

		var funcName;
		if(axis) {
			for(var i in axis) {
				for(var j = 0, l = axis[i].length; j < l; j++) {
					switch(i) {
						case 'top': funcName = 'setTopAxis'; var axisInstance = new GraphXAxis(this, 'top', axis[i][j]); break;
						case 'bottom': funcName = 'setBottomAxis';  var axisInstance = new GraphXAxis(this, 'bottom', axis[i][j]); break;
						case 'left': funcName = 'setLeftAxis';  var axisInstance = new GraphYAxis(this, 'left', axis[i][j]);break;
						case 'right': funcName = 'setRightAxis';  var axisInstance = new GraphYAxis(this, 'right', axis[i][j]); break;
					}
					this[funcName](axisInstance, j);
				}
			}
		}

		this._pluginsInit();
	}

	Graph.extendPrototype = function(toWhat, fromWhat) {
		$.extend(toWhat, Graph[fromWhat].prototype);
	};

	Graph.prototype = {

		setAttributeTo: function(to, params, ns) {
			var i;

			if(ns) {
				for(i in params) {
					console.log(ns, i, params[i]);
					to.setAttributeNS(ns, i, params[i]);
				}
			} else {
				for(i in params) {
					to.setAttribute(i, params[i]);
				}
			}
		},

		doDom: function() {

			// Create SVG element, set the NS
			this.dom = document.createElementNS(this.ns, 'svg');
			this.dom.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
			//this.dom.setAttributeNS(this.ns, 'xmlns:xlink', this.nsxml);	
			this.setAttributeTo(this.dom, {
				'xmlns': this.ns,
				'font-family': this.options.fontFamily,
				'font-size': this.options.fontSize 
			});
			
/*

			this.setAttributeTo(this.dom, {
				'xmlns:xlink': this.nsxlink
			});

*/
		
			this._dom.appendChild(this.dom);
			
			
			this.defs = document.createElementNS(this.ns, 'defs');
			this.dom.appendChild(this.defs);

			this.rectEvent = document.createElementNS(this.ns, 'rect');
			this.setAttributeTo(this.rectEvent, {
				'pointer-events': 'fill',
				'fill': 'transparent'
			});
			this.dom.appendChild(this.rectEvent);


			// Handling graph title
			this.domTitle = document.createElementNS(this.ns, 'text');
			this.setTitle(this.options.title);
			this.setAttributeTo(this.domTitle, {
				'text-anchor': 'middle',
				'y': 20
			});
			this.dom.appendChild(this.domTitle);
			//


			this.graphingZone = document.createElementNS(this.ns, 'g');
			this.setAttributeTo(this.graphingZone, {
				'transform': 'translate(' + this.options.paddingLeft + ', ' + this.options.paddingTop + ')'
			});
			this.dom.appendChild(this.graphingZone);

			this.shapeZone = document.createElementNS(this.ns, 'g');
			this.graphingZone.appendChild(this.shapeZone);

		/*	this.shapeZoneRect = document.createElementNS(this.ns, 'rect');
			//this.shapeZoneRect.setAttribute('pointer-events', 'fill');
			this.shapeZoneRect.setAttribute('fill', 'transparent');
			this.shapeZone.appendChild(this.shapeZoneRect);
		*/
			this.axisGroup = document.createElementNS(this.ns, 'g');
			this.graphingZone.appendChild(this.axisGroup);


			this.plotGroup = document.createElementNS(this.ns, 'g');
			this.graphingZone.appendChild(this.plotGroup);
			
			this._makeClosingLines();

			this.clip = document.createElementNS(this.ns, 'clipPath');
			this.clip.setAttribute('id', '_clipplot' + this._creation)
			this.defs.appendChild(this.clip);

			this.clipRect = document.createElementNS(this.ns, 'rect');
			this.clip.appendChild(this.clipRect);
			this.clip.setAttribute('clipPathUnits', 'userSpaceOnUse');


			this.markerArrow = document.createElementNS(this.ns, 'marker');
			this.markerArrow.setAttribute('viewBox', '0 0 10 10');
			this.markerArrow.setAttribute('id', 'arrow' + this._creation);
			this.markerArrow.setAttribute('refX', '0');
			this.markerArrow.setAttribute('refY', '5');
			this.markerArrow.setAttribute('markerUnits', 'strokeWidth');
			this.markerArrow.setAttribute('markerWidth', '4');
			this.markerArrow.setAttribute('markerHeight', '3');
			this.markerArrow.setAttribute('orient', 'auto');
			//this.markerArrow.setAttribute('fill', 'context-stroke');
			//this.markerArrow.setAttribute('stroke', 'context-stroke');

			var pathArrow = document.createElementNS(this.ns, 'path');
			pathArrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
			pathArrow.setAttribute('fill', 'context-stroke');
			this.markerArrow.appendChild(pathArrow);

			this.defs.appendChild(this.markerArrow);

/*
			this.patternFill = document.createElementNS(this.ns, 'pattern');
			this.patternFill.setAttribute('clipPathUnits', 'userSpaceOnUse');
			this.patternFill.setAttribute('viewBox', '0 0 10 10');
			this.patternFill.setAttribute('width', '5');
			this.patternFill.setAttribute('height', '5');
			this.patternFill.setAttribute('stroke-width', '1px');
			var pattern = document.createElementNS(this.ns, 'path');
			pattern.setAttribute('d', 'M 0 0 L 10 10 L 10 0');
			pattern.setAttribute('stroke', 'black');
			pattern.setAttribute('stroke-width', '1px');
			this.patternFill.setAttribute('id', 'patternFill' + this._creation);
			this.patternFill.appendChild(pattern);
			this.defs.appendChild(this.patternFill);
*/
			this.vertLineArrow = document.createElementNS(this.ns, 'marker');
			this.vertLineArrow.setAttribute('viewBox', '0 0 10 10');
			this.vertLineArrow.setAttribute('id', 'verticalline' + this._creation);
			this.vertLineArrow.setAttribute('refX', '0');
			this.vertLineArrow.setAttribute('refY', '5');
			this.vertLineArrow.setAttribute('markerUnits', 'strokeWidth');
			this.vertLineArrow.setAttribute('markerWidth', '20');
			this.vertLineArrow.setAttribute('markerHeight', '10');
			this.vertLineArrow.setAttribute('orient', 'auto');
			//this.vertLineArrow.setAttribute('fill', 'context-stroke');
			//this.vertLineArrow.setAttribute('stroke', 'context-stroke');
			this.vertLineArrow.setAttribute('stroke-width', '1px');

			var pathVertLine = document.createElementNS(this.ns, 'path');
			pathVertLine.setAttribute('d', 'M 0 -10 L 0 10');
			pathVertLine.setAttribute('stroke', 'black');
			
			this.vertLineArrow.appendChild(pathVertLine);

			this.defs.appendChild(this.vertLineArrow);


			this.plotGroup.setAttribute('clip-path', 'url(#_clipplot' + this._creation + ')');

			this.bypassHandleMouse = false;
		},

		setOption: function(name, val) {
			this.options[name] = val;
		},

		kill: function() {
			this._dom.removeChild(this.dom);

		},

		getXY: function(e) {
			
			var x = e.clientX;
			var y = e.clientY;
			var pos = $(this._dom).offset();

			x -= pos.left - window.scrollX;
			y -= pos.top - window.scrollY;

			return {x: x, y: y};
		},

		registerEvents: function() {
			var self = this;
			this.dom.addEventListener('mousemove', function(e) {
				e.preventDefault();
				var coords = self.getXY(e);
				self.handleMouseMove(coords.x,coords.y,e);
			});

			this.dom.addEventListener('mousedown', function(e) {
				e.preventDefault();
				if(e.which == 3 || e.ctrlKey)
					return;
				var coords = self.getXY(e);
				self.handleMouseDown(coords.x,coords.y,e);
			});

			this.dom.addEventListener('mouseup', function(e) {
				e.preventDefault();
				var coords = self.getXY(e);
				self.handleMouseUp(coords.x,coords.y,e);
			});

			this.dom.addEventListener('dblclick', function(e) {
				e.preventDefault();
				if(self.clickTimeout)
					window.clearTimeout(self.clickTimeout);
				var coords = self.getXY(e);
				self.cancelClick = true;
				self.handleDblClick(coords.x,coords.y,e);
			});

			this.dom.addEventListener('click', function(e) {

				// Cancel right click or Command+Click
				if(e.which == 3 || e.ctrlKey)
					return;
				e.preventDefault();
				var coords = self.getXY(e);
				if(self.clickTimeout)
					window.clearTimeout(self.clickTimeout);

				// Only execute the action after 200ms
				self.clickTimeout = window.setTimeout(function() {
					self.handleClick(coords.x,coords.y,e);
				}, 200);
			});


			document.addEventListener('keydown', function(e) {
				var code = e.keyCode;
				if(code < 37 || code > 40)
					return;

				self.applyToAxes(function(axis, position) {
					var min = axis.getActualMin(),
						max = axis.getActualMax(),
						shift = (max - min) * 0.05 * (axis.isFlipped() ? -1 : 1) * ((code == 39 || code == 40) ? -1 : 1);
					axis.setCurrentMin(min + shift);
					axis.setCurrentMax(max + shift);
				}, code, (code == 39 || code == 37), (code == 40 || code == 38));
				self.refreshDrawingZone(true);
				self.drawSeries(true);
				// Left : 39
				// Down: 40
				// Right: 37
				// Top: 38

			});

			this.rectEvent.addEventListener('mousewheel', function(e) {
				e.preventDefault();
				e.stopPropagation();
				var deltaY = e.wheelDeltaY || e.wheelDelta || - e.deltaY;
				self.handleMouseWheel(deltaY,e);	

				return false;
			});

			this.rectEvent.addEventListener('wheel', function(e) {
				var deltaY = e.wheelDeltaY || e.wheelDelta || - e.deltaY;
				self.handleMouseWheel(deltaY,e);	
				e.preventDefault();
				return false;
			});
		},



		handleMouseDown: function(x,y,e) {
			var self = this,
				$target = $(e.target), 
				shift = e.shiftKey, 
				ctrl = e.ctrlKey, 
				keyComb = this.options.keyCombinations,
				i;

			for(i in keyComb) {
				if(!keyComb[i]._forced) {
					if(shift !== keyComb[i].shift)
						continue;
					if(ctrl !== keyComb[i].ctrl)
						continue;
				}
				this.mouseLease = i; // Lease the mouse action to the current action
				this._pluginExecute(i, 'onMouseDown', [x, y, e]);
				break;
			}
		},


		handleMouseMove: function(x, y, e) {

			if(this.bypassHandleMouse) {
				this.bypassHandleMouse.handleMouseMove(e);
				return;
			}
			
			this.applyToAxes('handleMouseMove', [x - this.options.paddingLeft, e], true, false);
			this.applyToAxes('handleMouseMove', [y - this.options.paddingTop, e], false, true);

			if(!this.mouseLease) {
				var results = {};
				for(var i = 0; i < this.series.length; i++)
					results[this.series[i].getName()] = this.series[i].handleMouseMove(false, true);
				if(this.options.onMouseMoveData)
					this.options.onMouseMoveData(e, results);
				return;
			}

			this._pluginExecute(this.mouseLease, 'onMouseMove', [x, y, e, $target = $(e.target)]);
		},


		handleMouseUp: function(x, y, e) {

			if(this.bypassHandleMouse) {
				this.bypassHandleMouse.handleMouseUp(e);
				return;
			}

			this._pluginExecute(this.mouseLease, 'onMouseUp', [x, y, e, $(e.target)]);
			this.mouseLease = false;

		},



		isZooming: function() {
			return this.currentAction == 'zooming';
		},

		handleMouseWheel: function(delta, e) {

			if(this.options.defaultWheelAction == 'zoomY' || this.options.defaultWheelAction == 'zoomX') {

				this.applyToAxes('handleMouseWheel', [delta, e], false, true);

			} else if(this.options.defaultWheelAction == 'toSeries') {

				for(var i = 0, l = this.series.length; i < l; i++) {
					this.series[i].handleMouseWheel(delta, e);
				}

			}

			this.redraw(true);
			this.drawSeries(true);
		},

		handleClick: function(x, y, e) {
			
			if(!this.options.addLabelOnClick){
				return;
			}

			if(this.currentAction !== false) {
				return;
			}

			for(var i = 0, l = this.series.length; i < l; i++) {
				this.series[i].addLabelX(this.series[i].getXAxis().getVal(x - this.getPaddingLeft()));
			}
		},

		annotationMoving: function(start) {
			this.bypassHandleMouse = start;
		},

		handleDblClick: function(x,y,e) {
		//	var _x = x - this.options.paddingLeft;
		//	var _y = y - this.options.paddingTop;

			if(this.options.unzoomGradual) {
				var xAxis = this.getXAxis();
				var xMin = xAxis.getActualMin(),
					xMax = xAxis.getActualMax(),
					diff = xMax - xMin;

				xMin = Math.max(xAxis.getMinValue(), xMin - diff);
				xMax = Math.min(xAxis.getMaxValue(), xMax + diff);

				xAxis.setCurrentMin(xMin);
				xAxis.setCurrentMax(xMax);

				this.redraw(true);
				this.drawSeries(true);

			} else {

				this.redraw();
				this.drawSeries();
			}
/*
			if(this.getXAxis().options.onZoom)
				this.getXAxis().options.onZoom(this.getXAxis().getActualMin(), this.getXAxis().getActualMax());

			if(this.getYAxis().options.onZoom)
				this.getYAxis().options.onZoom(this.getYAxis().getActualMin(), this.getYAxis().getActualMax());
			*/
		},

		resetAxis: function() {

			while(this.axisGroup.firstChild) {
				this.axisGroup.removeChild(this.axisGroup.firstChild);
			}
			this.axis.left = [];
			this.axis.right = [];
			this.axis.bottom = [];
			this.axis.top = [];
		},

		resetSeries: function() {
			for(var i = 0; i < this.series.length; i++) {
				this.series[i].kill(true);	
			}
			this.series = [];
		},

		applyToAxis: {
			'string': function(type, func, params) {
		//		params.splice(1, 0, type);

				for(var i = 0; i < this.axis[type].length; i++)
					this.axis[type][i][func].apply(this.axis[type][i], params);	
			},

			'function': function(type, func, params) {
				for(var i = 0; i < this.axis[type].length; i++)
					func.call(this, this.axis[type][i], type);
			}
		},
		
		applyToAxes: function(func, params, tb, lr) {
			var ax = [], i = 0, l;

			if(tb || tb == undefined) {
				ax.push('top');
				ax.push('bottom');
			}
			if(lr || lr == undefined) {
				ax.push('left');
				ax.push('right');
			}

			for(l = ax.length; i < l; i++)
				this.applyToAxis[typeof func].call(this, ax[i], func, params);
		},


		setWidth: function(width, skipResize) {
			this.width = width;

			if(!skipResize)
				this._resize();
		},

		getWidth: function() {
			return this.width;
		},

		setHeight: function(height, skipResize) {
			this.height = height;

			if(!skipResize)
				this._resize();
		},

		getHeight: function() {
			return this.height;
		},

		resize: function(w, h) {
			this.setWidth(w, true);
			this.setHeight(h, true);

			this._resize();
		},

		getDom: function() { 
			return this.dom;
		},

		applyStyleText: function(dom) {
//			dom.setAttribute('font-family', '"Myriad Pro", Arial, Serif');
//			dom.setAttribute('font-size', '12px');
		},

		getXAxis: function(num, options) {
			if(this.axis.top.length > 0 && this.axis.bottom.length == 0)
				return this.getTopAxis(num, options);

			return this.getBottomAxis(num, options);
		},

		getYAxis: function(num, options) {
			return this.getLeftAxis(num, options);
		},

		_getAxis: function(num, options, inst, pos) {
			num = num || 0;
			if(typeof num == "object") {
				options = num;
				num = 0;
			}
			return this.axis[pos][num] = this.axis[pos][num] || new Graph[inst](this, pos, options);
		},

		getTopAxis: function(num, options) {
			return this._getAxis(num, options, 'GraphXAxis', 'top');
		},

		getBottomAxis: function(num, options) {
			return this._getAxis(num, options, 'GraphXAxis', 'bottom');
		},

		getLeftAxis: function(num, options) {
			return this._getAxis(num, options, 'GraphYAxis', 'left');
		},

		getRightAxis: function(num, options) {
			return this._getAxis(num, options, 'GraphYAxis', 'right');
		},

		setXAxis: function(axis, num) {
			this.setBottomAxis(axis, num);
		},
		setYAxis: function(axis, num) {
			this.setLeftAxis(axis, num);
		},

		setLeftAxis: function(axis, num) {
			num = num || 0;
			this.axis.left[num] = axis;
		},
		setRightAxis: function(axis, num) {
			num = num || 0;
			this.axis.right[num] = axis;
		},
		setTopAxis: function(axis, num) {
			num = num || 0;
			this.axis.top[num] = axis;
		},
		setBottomAxis: function(axis, num) {
			num = num || 0;
			this.axis.bottom[num] = axis;
		},

		getPaddingTop: function() {
			return this.options.paddingTop;
		},

		getPaddingLeft: function() {
			return this.options.paddingLeft;
		},

		getPaddingTop: function() {
			return this.options.paddingTop;
		},

		getPaddingRight: function() {
			return this.options.paddingRight;
		},

		// Title
		setTitle: function(title) {
			this.title = title;
			this.domTitle.textContent = title;
		},

		displayTitle: function() {
			this.domTitle.setAttribute('display', 'inline');
		},

		hideTitle: function() {
			this.domTitle.setAttribute('display', 'none');
		},

		drawSerie: function(serie) {
			serie.draw(this.getDrawingGroup());
		},


		getDrawingHeight: function(useCache) {
			if(useCache && this.innerHeight)
				return this.innerHeight;
			var height = this.height - this.options.paddingTop - this.options.paddingBottom;
			return (this.innerHeight = height);
		},

		getDrawingWidth: function(useCache) {
			if(useCache && this.innerWidth)
				return this.innerWidth;
			var width = this.width - this.options.paddingLeft - this.options.paddingRight;
			return (this.innerWidth = width);
		},

		getBoundaryAxisFromSeries: function(axis, xy, minmax) {
			var x = xy == 'x',
				min = minmax == 'min',
				val,
				func = x ? ['getMinX', 'getMaxX'] : ['getMinY', 'getMaxY'],
				func2use = func[min ? 0 : 1],
				currentSerie,
				serie,
				series,
				serieValue,
				i,
				l;

			val = min ? Number.MAX_VALUE : Number.MIN_VALUE;
			series = this.getSeriesFromAxis(axis, true);
			for(i = 0, l = series.length; i < l; i++) {

				serie = series[i];
				serieValue = serie[func2use]();
				val = Math[minmax](val, serieValue);

				if(val == serieValue && currentSerie) {
					currentSerie.isMinOrMax(false, xy, minmax);
					currentSerie = serie;
					serie.isMinOrMax(true, xy, minmax);
				}
			}
		
			return val;
		},

		getSeriesFromAxis: function(axis, selfSeries) {
			var series = [],
				i = this.series.length - 1;
			for(; i >= 0; i--)
				if(this.series[i].getXAxis() == axis || this.series[i].getYAxis() == axis)
					series.push(this.series[i]);

			if(selfSeries) {
				for(i = 0; i < axis.series.length; i++)
					series.push(axis.series[i])
			}

			return series;
		},

		_resize: function() {

			if(!this.width || !this.height)
				return;

			this.dom.setAttribute('width', this.width);
			this.dom.setAttribute('height', this.height);
			this.domTitle.setAttribute('x', this.width / 2);
			
			this.refreshDrawingZone();
		},

		redraw: function(doNotRecalculateMinMax, noX, noY) {

			if(!this.width || !this.height)
				return;

			this.refreshDrawingZone(doNotRecalculateMinMax, noX, noY);

			return true;
		},

		// Repaints the axis and series
		refreshDrawingZone: function(doNotRecalculateMinMax, noX, noY) {

			var i, j, l, xy, min, max;
			var axisvars = ['bottom', 'top', 'left', 'right'], shift = [0, 0, 0, 0], axis;
			this._painted = true;
			this.refreshMinOrMax();

			for(j = 0, l = axisvars.length; j < l; j++) {
				xy = j < 2 ? 'x' : 'y';
				if(noX && j < 2)
					continue;
				else if(noY && j > 1)
					continue;

				for(i = this.axis[axisvars[j]].length - 1; i >= 0; i--) {
					axis = this.axis[axisvars[j]][i];
					if(axis.disabled)
						continue;

					axis.setMinValue(this.getBoundaryAxisFromSeries(this.axis[axisvars[j]][i], xy, 'min'));
					axis.setMaxValue(this.getBoundaryAxisFromSeries(this.axis[axisvars[j]][i], xy, 'max'));
				}
			}


			min = shift[0];
			shift[2] = 0;
			shift[3] = 0;

		
			// Apply to top and bottom
			this.applyToAxes(function(axis) {
				if(axis.disabled)
					return;
				var axisIndex = axisvars.indexOf(arguments[1]);
				axis.setShift(shift[axisIndex] + axis.getAxisPosition(), axis.getAxisPosition()); 
				shift[axisIndex] += axis.getAxisPosition(); // Allow for the extra width/height of position shift
			}, false, true, false);
	
	
			// Applied to left and right
			this.applyToAxes(function(axis) {
				if(axis.disabled)
					return;

				axis.setMinPx(shift[1]);
				axis.setMaxPx(this.getDrawingHeight(true) - shift[0]);

				// First we need to draw it in order to determine the width to allocate
				// This is done to accomodate 0 and 100000 without overlapping any element in the DOM (label, ...)

				var drawn = axis.draw(doNotRecalculateMinMax) || 0,
					axisIndex = axisvars.indexOf(arguments[1]),
					axisDim = axis.getAxisPosition();

				// Get axis position gives the extra shift that is common
				axis.setShift(shift[axisIndex] + axisDim + drawn, drawn + axisDim);
				shift[axisIndex] += drawn + axisDim;
				axis.drawSeries();
			}, false, false, true);

		
			// Apply to top and bottom
			this.applyToAxes(function(axis) {
				if(axis.disabled)
					return;
				axis.setMinPx(shift[2]);
				axis.setMaxPx(this.getDrawingWidth(true) - shift[3]);
				axis.draw(doNotRecalculateMinMax);
				axis.drawSeries();
			}, false, true, false);

			// Apply to all axis
	/*		this.applyToAxes(function(axis) {
				axis.drawSeries();
			}, false, true, true);
	*/		
			this.closeLine('right', this.getDrawingWidth(true), this.getDrawingWidth(true), 0, this.getDrawingHeight(true) - shift[0]);
			this.closeLine('left', shift[1], shift[1], 0, this.getHeight(true) - shift[0]);
			this.closeLine('top', shift[1], this.getDrawingWidth(true) - shift[2], 0, 0);
			this.closeLine('bottom', shift[1], this.getDrawingWidth(true) - shift[2], this.getDrawingHeight(true) - shift[0], this.getDrawingHeight(true) - shift[0]);

			this.clipRect.setAttribute('y', shift[1]);
			this.clipRect.setAttribute('x', shift[2]);
			this.clipRect.setAttribute('width', this.getDrawingWidth() - shift[2] - shift[3]);
			this.clipRect.setAttribute('height', this.getDrawingHeight() - shift[1] - shift[0]);


			this.rectEvent.setAttribute('x', shift[1]);
			this.rectEvent.setAttribute('y', shift[2]);
			this.rectEvent.setAttribute('width', this.getDrawingWidth() - shift[2] - shift[3]);
			this.rectEvent.setAttribute('height', this.getDrawingHeight() - shift[1] - shift[0]);

/*
			this.shapeZoneRect.setAttribute('x', shift[1]);
			this.shapeZoneRect.setAttribute('y', shift[2]);
			this.shapeZoneRect.setAttribute('width', this.getDrawingWidth() - shift[2] - shift[3]);
			this.shapeZoneRect.setAttribute('height', this.getDrawingHeight() - shift[1] - shift[0]);
*/
			this.shift = shift;
			this.redrawShapes();
		},

		closeLine: function(mode, x1, x2, y1, y2) {	
			if(this.options.close[close] && this.options.axis[mode].length == 0) {
				this.closingLines[mode].setAttribute('display', 'block');
				this.closingLines[mode].setAttribute('x1', x1);
				this.closingLines[mode].setAttribute('x2', x2);
				this.closingLines[mode].setAttribute('y1', y1);
				this.closingLines[mode].setAttribute('y2', y2);
			} else {
				this.closingLines[mode].setAttribute('display', 'none');
			}
		},

		refreshMinOrMax: function() {
			var i = this.series.length - 1;
			for(;i >= 0; i--) { // Let's remove the serie from the stack
				this.series[i].isMinOrMax(false);
			}
		},

		_makeSerie: function(name, options, type) {
			switch(type) {
				case 'contour':
					var serie = new GraphSerieContour();
				break;

				case 'line':
				default:
					var serie = new GraphSerie();
				break;	
			}
			serie.init(this, name, options);
			this.plotGroup.appendChild(serie.groupMain);
			return serie;
		},

		newSerie: function(name, options, type) {
			var serie = this._makeSerie(name, options, type);
			this.series.push(serie);
			return serie;
		},

		getSerie: function(name) {
			if(typeof name == 'number') {
				return this.series[name];
			}
			var i = 0, l = this.series.length;
			for(; i < l; i++) {
				if(this.series[i].getName() == name)
					return this.series[i];
			}
		},

		drawSeries: function(doNotRedrawZone) {
			if(!this.width || !this.height)
				return;
			var i = this.series.length - 1;

			for(; i >= 0; i--)
				this.series[i].draw(doNotRedrawZone);
		},

		checkMinOrMax: function(serie) {
			var xAxis = serie.getXAxis();
			var yAxis = serie.getYAxis();

			var minX = serie.getMinX(),
				maxX = serie.getMaxX(),
				minY = serie.getMinY(),
				maxY = serie.getMaxY(),
				isMinMax = false;

			if(minX <= xAxis.getMinValue()) {
				isMinMax = true;
				serie.isMinOrMax(true, 'x', 'min');
			}

			if(maxX >= xAxis.getMaxValue()) {
				isMinMax = true;
				serie.isMinOrMax(true, 'x', 'max');
			}

			if(minY <= yAxis.getMinValue()) {
				isMinMax = true;
				serie.isMinOrMax(true, 'y', 'min');
			}

			if(maxX >= xAxis.getMaxValue()) {
				isMinMax = true;
				serie.isMinOrMax(true, 'y', 'max');
			}

			return isMinMax;
		},

		removeSerie: function(serie) {
			var i = this.series.length - 1;
			for(;i >= 0; i--) { // Let's remove the serie from the stack
				if(this.series[i] == serie)
					this.series.slice(i, 1);
			}
			serie.removeDom();
			if(serie.isMinOrMax())
				this.refreshDrawingZone();
		},

		setZoomMode: function(zoomMode) {
			if(zoomMode == 'x' || zoomMode == 'y' || zoomMode == 'xy' || !zoomMode)
				this.options.zoomMode = zoomMode;
		},

		setDefaultWheelAction: function(wheelAction) {
			if(wheelAction != 'zoomY' && wheelAction != 'zoomX' && wheelAction != 'none')
				return;
			this.options.defaultWheelAction = wheelAction;
		},

		getZoomMode: function() {
			return this.options.zoomMode;
		},

		makeShape: function(annotation, events, notify) {

			if(notify) {
				if(false === this.triggerEvent('onAnnotationMake', annotation)) {
					return;
				}
			}

			switch(annotation.type) {
				case 'rectangle':
				case 'rect':
					var shape = new GraphRect(this);
				break;

				case 'arrow':
					var shape = new GraphArrow(this);
				break;

				case 'line':
					var shape = new GraphLine(this);
				break;

				case 'peakInterval':
					var shape = new GraphPeakInterval(this);
				break;

				case 'rangeX':
					var shape = new GraphRangeX(this);
				break;
			}


			if(!shape)
				return;

			shape.setOriginalData(annotation, events);
			shape.setSerie(this.getSerie(0));

			
			if(annotation.fillColor)	shape.set('fillColor', annotation.fillColor);
			if(annotation.strokeColor)	shape.set('strokeColor', annotation.strokeColor);
			if(annotation.strokeWidth)	shape.set('strokeWidth', annotation.strokeWidth);

			if(annotation.label) {
				//shape.set('labelText', annotation.label.text);
				shape.set('labelPosition', annotation.label.position);
				shape.set('labelSize', annotation.label.size);
				if(annotation.label.anchor)
					shape.set('labelAnchor', annotation.label.anchor);
			}

			switch(annotation.type) {
				case 'rect':
				case 'rectangle':
					shape.set('width', annotation.width);
					shape.set('height', annotation.height);
				break;
			}

			this.shapes.push(shape);

			return shape;
		},

		redrawShapes: function() {
			this.graphingZone.removeChild(this.shapeZone);
			for(var i = 0, l = this.shapes.length; i < l; i++) {
				this.shapes[i].redraw();
			}
			this.graphingZone.insertBefore(this.shapeZone, this.axisGroup);
		},

		_makeClosingLines: function() {

			this.closingLines = {};
			var els = ['top', 'bottom', 'left', 'right'], i = 0, l = 4, line;
			for(; i < l; i++) {	
				var line = document.createElementNS(this.ns, 'line');
				line.setAttribute('stroke', 'black');
				line.setAttribute('shape-rendering', 'crispEdges');
				line.setAttribute('stroke-linecap', 'square');
				line.setAttribute('display', 'none');
				this.closingLines[els[i]] = line;
				this.graphingZone.appendChild(line);
			}
		},

		_pluginsExecute: function(funcName, args) {
			Array.prototype.splice.apply(args, [0, 0, this]);
			var i = 0, l = this.options.plugins.length;
			for(; i < l; i++) {
				if(this.plugins[this.options.plugins[i]] && this.plugins[this.options.plugins[i]][funcName])
					this.plugins[this.options.plugins[i]][funcName].apply(this, args);
			}
		},

		_pluginExecute: function(which, func, args) {
			Array.prototype.splice.apply(args, [0, 0, this]);
			if(this.plugins[which] && this.plugins[which][func])
				this.plugins[which][func].apply(this.plugins[which], args);
			else
				return;
		},

		_pluginsInit: function() {
			this._pluginsExecute('init', arguments);
		},

		triggerEvent: function() {
			var func = arguments[0], 
				args = Array.prototype.splice.apply(arguments, [0, 1]);
			if(typeof this.options[func] == "function")
				return this.options[func].apply(this, arguments);
			return true;
		}

	}



	Graph.prototype.plugins = {};

	Graph.prototype.plugins.drag = {

		onMouseDown: function(graph, x, y, e, target) {
			this._draggingX = x;
			this._draggingY = y;

			return true;
		},

		onMouseMove: function(graph, x, y, e, target) {
			var deltaX = x - this._draggingX;
			var deltaY = y - this._draggingY;

			graph.applyToAxes(function(axis) {
				axis.setCurrentMin(axis.getVal(axis.getMinPx() - deltaX));
				axis.setCurrentMax(axis.getVal(axis.getMaxPx() - deltaX));
			}, false, true, false);

			graph.applyToAxes(function(axis) {
				axis.setCurrentMin(axis.getVal(axis.getMinPx() - deltaY));
				axis.setCurrentMax(axis.getVal(axis.getMaxPx() - deltaY));
			}, false, false, true);

			this._draggingX = x;
			this._draggingY = y;

			graph.refreshDrawingZone(true);
			graph.drawSeries();
		}
	}

			/*
			} else if(this.currentAction == 'labelDragging') {
				for(var i = 0, l = this.series.length; i < l; i++) {
					if(this.series[i].labelDragging)
						this.series[i].handleLabelMove(x, y);
				}
			} else if(this.currentAction == 'labelDraggingMain') {
				for(var i = 0, l = this.series.length; i < l; i++) {
					if(this.series[i].labelDragging)
						this.series[i].handleLabelMainMove(x, y);
				}
			}*/ 

			/*


			} else if(this.currentAction == 'labelDragging' || this.currentAction == 'labelDraggingMain') {
				for(var i = 0, l = this.series.length; i < l; i++) {
					if(this.series[i].labelDragging)
						this.series[i].labelDragging = false;
				}
				this.currentAction = false;
			

			*/

	
	Graph.prototype.plugins.rangeX = {

		onMouseDown: function(graph, x, y, e, target) {
			var self = graph;
			this.count = this.count || 0;
			if(this.count == graph.options.rangeLimitX)
				return;
			x -= graph.getPaddingLeft(), xVal = graph.getXAxis().getVal(x);
			var shape = graph.makeShape({type: 'rangeX', pos: {x: xVal, y: 0}, pos2: {x: xVal, y: 0}}, {
				onChange: function(newData) {
					self.triggerEvent('onAnnotationChange', newData);
				}
			}, true);

			if(require) {
				require(['util/context'], function(Context) {
					Context.listen(shape._dom, [
						['<li><a><span class="ui-icon ui-icon-cross"></span> Remove range zone</a></li>', 
						function(e) {
							shape.kill();
						}]
					]);
				});
			}

			var color = Util.getNextColorRGB(this.count, graph.options.rangeLimitX);
			
			shape.set('fillColor', 'rgba(' + color + ', 0.3)');
			shape.set('strokeColor', 'rgba(' + color + ', 0.9)');
			this.count++;
			shape.handleMouseDown(e, true);
			shape.draw();
		}
	}



	Graph.prototype.plugins.integral = {

		onMouseDown: function(graph, x, y, e, target) {
			var self = graph;
			this.count = this.count || 0;
			x -= graph.getPaddingLeft(), xVal = graph.getXAxis().getVal(x);
			var shape = graph.makeShape({type: 'peakInterval', pos: {x: xVal, y: 0}, pos2: {x: xVal, y: 0}}, {
				onChange: function(newData) {
					self.triggerEvent('onAnnotationChange', newData);
				}
			}, true);

			if(!shape)
				return;

			if(require) {
				require(['util/context'], function(Context) {
					Context.listen(shape._dom, [
						['<li><a><span class="ui-icon ui-icon-cross"></span> Remove integral</a></li>', 
						function(e) {
							shape.kill();
						}]
					]);
				});
			}

			var color = Util.getNextColorRGB(this.count, graph.options.rangeLimitX);
			
			shape.set('fillColor', 'rgba(' + color + ', 0.3)');
			shape.set('strokeColor', 'rgba(' + color + ', 0.9)');
			this.count++;
			shape.handleMouseDown(e, true);
			shape.draw();
		}
	}



	Graph.prototype.plugins.zoom = {

		init: function(graph) {

			this._zoomingSquare = document.createElementNS(this.ns, 'rect');
			graph.setAttributeTo(this._zoomingSquare, {
				'display': 'none',
				'fill': 'rgba(171,12,12,0.2)',
				'stroke': 'rgba(171,12,12,1)',
				'shape-rendering': 'crispEdges',
				'x': 0,
				'y': 0,
				'height': 0,
				'width': 0
			});

			graph.dom.appendChild(this._zoomingSquare);
		},

		onMouseDown: function(graph, x, y, e, target) {

			var zoomMode = graph.getZoomMode();
			if(!zoomMode)
				return;

			this._zoomingMode = zoomMode;
			this._zoomingXStart = x;
			this._zoomingYStart = y;
			this.x1 = x - graph.getPaddingLeft();
			this.y1 = y - graph.getPaddingTop();

			this._zoomingSquare.setAttribute('width', 0);
			this._zoomingSquare.setAttribute('height', 0);
			this._zoomingSquare.setAttribute('display', 'block');

			switch(zoomMode) {
				case 'x': 
					this._zoomingSquare.setAttribute('y', graph.options.paddingTop);
					this._zoomingSquare.setAttribute('height', graph.getDrawingHeight() - graph.shift[0]);
				break;
				case 'y':
					this._zoomingSquare.setAttribute('x', graph.options.paddingLeft/* + this.shift[1]*/);
					this._zoomingSquare.setAttribute('width', graph.getDrawingWidth()/* - this.shift[1] - this.shift[2]*/);
				break;
			}
		},

		onMouseMove: function(graph, x, y, e, target) {
			switch(this._zoomingMode) {
				case 'xy':
					this._zoomingSquare.setAttribute('x', Math.min(this._zoomingXStart, x));
					this._zoomingSquare.setAttribute('y', Math.min(this._zoomingYStart, y));
					this._zoomingSquare.setAttribute('width', Math.abs(this._zoomingXStart - x));
					this._zoomingSquare.setAttribute('height', Math.abs(this._zoomingYStart - y));
				break;
				case 'x': 
					this._zoomingSquare.setAttribute('x', Math.min(this._zoomingXStart, x));
					this._zoomingSquare.setAttribute('width', Math.abs(this._zoomingXStart - x));
				break;
				case 'y':
					this._zoomingSquare.setAttribute('y', Math.min(this._zoomingYStart, y));
					this._zoomingSquare.setAttribute('height', Math.abs(this._zoomingYStart - y));
				break;
			}	
		},

		onMouseUp: function(graph, x, y, e, target) {
			this._zoomingSquare.setAttribute('display', 'none');
			var _x = x - graph.options.paddingLeft;
			var _y = y - graph.options.paddingTop;

			if((x - this._zoomingXStart == 0 && this._zoomingMode != 'y') || (y - this._zoomingYStart == 0 && this._zoomingMode != 'x')) {
				return;
			}

			switch(this._zoomingMode) {
				case 'x':
					graph.applyToAxes('_doZoom', [_x, this.x1], true, false);
				break;
				case 'y':
					graph.applyToAxes('_doZoom', [_y, this.y1], false, true);
				break;
				case 'xy':
					graph.applyToAxes('_doZoom', [_x, this.x1], true, false);
					graph.applyToAxes('_doZoom', [_y, this.y1], false, true);
				break;
			}
			
			graph.redraw(true);
			graph.drawSeries(true);
		}
	}

	/****************************************************/
	/*** GRAPH AXIS *************************************/
	/****************************************************/


	var GraphAxis = function() {


	}

	GraphAxis.prototype = {

		defaults: {
			lineAt0: false,
			display: true,
			flipped: false,
			axisDataSpacing: {min: 0.1, max: 0.1},
			unitModification: false,
			primaryGrid: true,
			secondaryGrid: true,			
			shiftToZero: false,
			tickPosition: 1,
			nbTicksPrimary: 3,
			nbTicksSecondary: 10,
			ticklabelratio: 1,
			exponentialFactor: 0,
			exponentialLabelFactor: 0,
			wheelBaseline: 0,
			logScale: false,
			allowedPxSerie: 100,
			forcedMin: false,
			forcedMax: false
		},

		init: function(graph, options, overwriteoptions) {

			this.unitModificationTimeTicks = [[1, [1,2,5,10,20,30]], [60, [1,2,5,10,20,30]], [3600, [1,2,6,12]], [3600*24, [1,2,3,4,5,10,20,40]]];

			var self = this;
			this.graph = graph;
			this.options = $.extend(true, {}, GraphAxis.prototype.defaults, overwriteoptions, options);

			this.group = document.createElementNS(this.graph.ns, 'g');
			this.hasChanged = true;
			this.groupGrids = document.createElementNS(this.graph.ns, 'g');
			this.graph.axisGroup.insertBefore(this.groupGrids, this.graph.axisGroup.firstChild);
			this.rectEvent = document.createElementNS(this.graph.ns, 'rect');
			this.rectEvent.setAttribute('pointer-events', 'fill');
			this.rectEvent.setAttribute('fill', 'transparent');
			this.group.appendChild(this.rectEvent);

			this.setEvents();

			this.graph.axisGroup.appendChild(this.group); // Adds to the main axiszone

			this.line = document.createElementNS(this.graph.ns, 'line');
			this.line.setAttribute('stroke', 'black');
			this.line.setAttribute('shape-rendering', 'crispEdges');
			this.line.setAttribute('stroke-linecap', 'square');
			this.groupTicks = document.createElementNS(this.graph.ns, 'g');
			this.groupTickLabels = document.createElementNS(this.graph.ns, 'g');

			
			this.group.appendChild(this.groupTicks);
			this.group.appendChild(this.groupTickLabels);
			this.group.appendChild(this.line);

			this.labelValue;

			this.label = document.createElementNS(this.graph.ns, 'text');
			this.labelTspan = document.createElementNS(this.graph.ns, 'tspan');
			this.label.appendChild(this.labelTspan);

			this.expTspan = document.createElementNS(this.graph.ns, 'tspan');
			this.label.appendChild(this.expTspan);
			this.expTspan.setAttribute('dx', 10);
			this.expTspanExp = document.createElementNS(this.graph.ns, 'tspan');
			this.label.appendChild(this.expTspanExp);
			this.expTspanExp.setAttribute('dy', -5);
			this.expTspanExp.setAttribute('font-size', "0.8em");

			this.label.setAttribute('text-anchor', 'middle');

			this.groupGrids.setAttribute('clip-path', 'url(#_clipplot' + this.graph._creation + ')');
			this.graph.applyStyleText(this.label);
			this.group.appendChild(this.label);

			this.groupSeries = document.createElementNS(this.graph.ns, 'g');
			this.group.appendChild(this.groupSeries);

			this.ticks = [];
			this.series = [];
			this.totalDelta = 0;
			this.currentAction = false;

			this.group.addEventListener('mousemove', function(e) {
				e.preventDefault();
				var coords = self.graph.getXY(e);
				self.handleMouseMoveLocal(coords.x,coords.y,e);

				for(var i = 0, l = self.series.length; i < l; i++) {
					self.series[i].handleMouseMove(false, true);

					if(self.currentAction == 'labelDragging')
						self.series[i].handleLabelMove(coords.x, coords.y);

					if(self.currentAction == 'labelDraggingMain')
						self.series[i].handleLabelMainMove(coords.x, coords.y);
				}
			});

			this.group.addEventListener('mouseup', function(e) {
				e.preventDefault();
				self.handleMouseUp();
			});

			this.group.addEventListener('mouseout', function(e) {
				e.preventDefault();
				var coords = self.graph.getXY(e);
				self.handleMouseOutLocal(coords.x,coords.y,e);
			});

			this.labels = [];
			this.group.addEventListener('click', function(e) {
				e.preventDefault();
				var coords = self.graph.getXY(e);
				self.addLabel(self.getVal(coords.x - self.graph.getPaddingLeft()));
			});

			this.axisRand = Math.random();
			this.clip = document.createElementNS(this.graph.ns, 'clipPath');
			this.clip.setAttribute('id', '_clip' + this.axisRand)
			this.graph.defs.appendChild(this.clip);

			this.clipRect = document.createElementNS(this.graph.ns, 'rect');
			this.clip.appendChild(this.clipRect);
			this.clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
		},

		setEvents: function() {
			var self = this;
			this.rectEvent.addEventListener('mousedown', function(e) {

				e.stopPropagation();
				e.preventDefault();
				if(e.which == 3 || e.ctrlKey)
					return;
				var coords = self.graph.getXY(e);

				self.graph.currentAction = 'zooming';
				self.graph._zoomingMode = self instanceof GraphXAxis ? 'x' : 'y';
				self.graph._zoomingXStart = coords.x;
				self.graph._zoomingYStart = coords.y;
				self.graph._zoomingXStartRel = coords.x - self.graph.getPaddingLeft();
				self.graph._zoomingYStartRel = coords.y - self.graph.getPaddingTop();
				self.this._zoomingSquare.setAttribute('width', 0);
				self.this._zoomingSquare.setAttribute('height', 0);

				switch(self.graph._zoomingMode) {
					case 'x': 
						self.this._zoomingSquare.setAttribute('y', self.graph.getPaddingTop() + self.shift - self.totalDimension);
						self.this._zoomingSquare.setAttribute('height', self.totalDimension);
					break;
					case 'y':
						self.this._zoomingSquare.setAttribute('x', self.graph.getPaddingLeft() + self.shift - self.totalDimension);
						self.this._zoomingSquare.setAttribute('width', self.totalDimension);
					break;
				}

				self.this._zoomingSquare.setAttribute('display', 'block');
			});
		},

		addLabel: function(x) {
			for(var i = 0, l = this.series.length; i < l; i++) {
				if(this.series[i].currentAction !== false)
					continue;
				this.series[i].addLabelObj({x: x});
			}
		},


		setDisplay: function(bool) {
			this.options.display = !!bool;
		},
		
		setLineAt0: function(bool) {
			this.options.lineAt0 = !!bool;
		},

		setAxisDataSpacing: function(val1, val2) {
			this.options.axisDataSpacing.min = val1;
			this.options.axisDataSpacing.max = val2 || val1;
		},

		setAxisDataSpacingMin: function(val) {
			this.options.axisDataSpacing.min = val;
		},

		setAxisDataSpacingMax: function(val) {
			this.options.axisDataSpacing.max = val;
		},

		setMinPx: function(px) { this.minPx = px; },
		getMinPx: function() { return this.options.flipped ? this.maxPx : this.minPx; },
		setMaxPx: function(px) { this.maxPx = px; },
		getMaxPx: function(px) { return this.options.flipped ? this.minPx : this.maxPx; },
		getMathMaxPx: function() { return this.maxPx; },

		// Returns the true minimum of the axis. Either forced in options
		getMinValue: function() {
			return this.options.forcedMin || (this.options.forcedMin === 0 ? 0 : this.realMin);
		},

		getMaxValue: function() {
			return this.options.forcedMax || (this.options.forcedMax === 0 ? 0 : this.realMax);
		},

		setMinValue: function(min) { this.realMin = min; },
		setMaxValue: function(max) { this.realMax = max; },
		forceMin: function(val) {    this.options.forcedMin = val || false; },
		forceMax: function(val) {    this.options.forcedMax = val || false; },

		getNbTicksPrimary: function() {
			return this.options.nbTicksPrimary;
		},

		getNbTicksSecondary: function() {
			return this.options.nbTicksSecondary;
		},

		handleMouseMove: function(px,e) {
			this.mouseVal = this.getVal(px);
		},

		handleMouseWheel: function(delta, e) {
			delta = Math.min(0.2, Math.max(-0.2, delta));

			this._doZoomVal(
				((this.getActualMax() - this.options.wheelBaseline) * (1 + delta)) + this.options.wheelBaseline,
				((this.getActualMin() - this.options.wheelBaseline) * (1 + delta)) + this.options.wheelBaseline
			);

			this.graph.redraw(true);
			this.graph.drawSeries(true);

		},

		handleMouseUp: function(px, e) {

			if(this.currentAction == 'labelDragging' || this.currentAction == 'labelDraggingMain') {
				for(var i = 0, l = this.series.length; i < l; i++) {
					this.series[i].handleLabelUp();
				}
				this.currentAction = false;

			} else if(this.graph.isZooming())
				this._handleZoom(px);
			
		},

		_doZoomVal: function(val1, val2, mute) {

			return this._doZoom(this.getPx(val1), this.getPx(val2), val1, val2, mute);
		},

		_doZoom: function(px1, px2, val1, val2, mute) {

			//if(this.options.display || 1 == 1) {
			var val1 = val1 || this.getVal(px1);
			var val2 = val2 || this.getVal(px2);
			this.setCurrentMin(Math.min(val1, val2));
			this.setCurrentMax(Math.max(val1, val2));
			this._hasChanged = true;
			if(this.options.onZoom && !mute)
				this.options.onZoom(this._realMin, this._realMax);
		//	}
		},

		getSerieShift: function() {
			return this._serieShift;
		},

		getSerieScale: function() {
			return this._serieScale;
		},

		getMouseVal: function() {
			return this.mouseVal;
		},

		isFlipped: function() {
			return this.options.flipped;
		},

		getUnitPerTick: function(px, nbTick, valrange, max) {

			var pxPerTick = px / nbTicks; // 1000 / 100 = 10 px per tick
			if(!nbTick)
				nbTick = px / 10;
			else
				nbTick = Math.min(nbTick, px / 10);


			// So now the question is, how many units per ticks ?
			// Say, we have 0.0004 unit per tick
			var unitPerTick = valrange / nbTick;

			if(this.options.unitModification == 'time') {
				// Determine the time domain using max.
					
				var max = this.getModifiedValue(this.getMaxValue()), 
				units = [[60, 'min'], [3600, 'h'], [3600*24, 'd']];
				if(max < 3600) { // to minutes
					umin = 0;
				} else if(max < 3600 * 24) {
					umin = 1;
				} else {
					umin = 2;
				}
		
				var breaked = false;
				for(var i = 0, l = this.unitModificationTimeTicks.length; i < l; i++) {
					for(var k = 0, m = this.unitModificationTimeTicks[i][1].length; k < m; k++) {
						if(unitPerTick < this.unitModificationTimeTicks[i][0] * this.unitModificationTimeTicks[i][1][k]) {
							breaked = true;
							break;
						}
					}
					if(breaked)
						break;
				}

				//i and k contain the good variable;
				if(i !== this.unitModificationTimeTicks.length)
					unitPerTickCorrect = this.unitModificationTimeTicks[i][0] * this.unitModificationTimeTicks[i][1][k];
				else
					unitPerTickCorrect = 1;

			} else {
				// We take the log
				var decimals = Math.floor(Math.log(unitPerTick) / Math.log(10));
				/*
					Example:
						13'453 => Math.log10() = 4.12 => 4
						0.0000341 => Math.log10() = -4.46 => -5
				*/

				var numberToNatural = unitPerTick * Math.pow(10, - decimals);
				
				/*
					Example:
						13'453 (4) => 1.345
						0.0000341 (-5) => 3.41
				*/

				this.decimals = - decimals;

				var possibleTicks = [1,2,5,10];
				var closest = false;
				for(var i = possibleTicks.length - 1; i >= 0; i--)
					if(!closest || (Math.abs(possibleTicks[i] - numberToNatural) < Math.abs(closest - numberToNatural))) {
						closest = possibleTicks[i];
				}
				
				// Ok now closest is the number of unit per tick in the natural number
				/*
					Example:
						13'453 (4) (1.345) => 1
						0.0000341 (-5) (3.41) => 5 
				*/

				// Let's scale it back
				var unitPerTickCorrect = closest * Math.pow(10, decimals);
				/*
					Example:
						13'453 (4) (1.345) (1) => 10'000
						0.0000341 (-5) (3.41) (5) => 0.00005
				*/
			}

			var nbTicks = valrange / unitPerTickCorrect;
			var pxPerTick = px / nbTick;


			return [unitPerTickCorrect, nbTicks, pxPerTick];
		},

		setMinMaxToFitSeries: function() {

			var interval = this.getMaxValue() - this.getMinValue();
			this._realMin = this.getMinValue() - (this.options.axisDataSpacing.min * interval);
			this._realMax = this.getMaxValue() + (this.options.axisDataSpacing.max * interval);

			if(this.options.logScale) {
				this._realMin = Math.max(1e-50, this._realMin);
				this._realMax = Math.max(1e-50, this._realMax);
			}

		},

		_getActualInterval: function() {
			return this.getActualMax() - this.getActualMin();
		},

		getActualMin: function() {
			return this._realMin == this._realMax ? this._realMin - 1 : this._realMin;
		},

		getActualMax: function() {
			return this._realMax == this._realMin ? this._realMax + 1 : this._realMax;
		},

		setCurrentMin: function(val) {
			this._realMin = val;
			if(this.options.logScale)
				this._realMin = Math.max(1e-50, val);
		},

		setCurrentMax: function(val) {
			this._realMax = val;

			if(this.options.logScale)
				this._realMax = Math.max(1e-50, val);
		},

		flip: function(bool) {
			this.options.flipped = bool;
		},

		_draw: function(doNotRecalculateMinMax) {
			var visible;

			switch(this.options.tickPosition) {
				case 1:
					this.tickPx1 = 2;
					this.tickPx2 = 0;
				break;

				case 2:
					this.tickPx1 = 1;
					this.tickPx2 = 1;
				break;

				case 3:
					this.tickPx1 = 0;
					this.tickPx2 = 2;
				break;
			}

			// Remove all ticks
			while(this.groupTicks.firstChild)
				this.groupTicks.removeChild(this.groupTicks.firstChild);


			// Remove all ticks
			while(this.groupTickLabels.firstChild)
				this.groupTickLabels.removeChild(this.groupTickLabels.firstChild);

			// Remove all grids
			while(this.groupGrids.firstChild)
				this.groupGrids.removeChild(this.groupGrids.firstChild);

			if(!doNotRecalculateMinMax || this._realMin == undefined || !this._realMax == undefined)
				this.setMinMaxToFitSeries(); // We reset the min max as a function of the series
			// The data min max is stored in this.realMin, this.realMax

			var widthPx = this.maxPx - this.minPx;
			var valrange = this._getActualInterval();


			/* Number of px per unit */
			/* Example: width: 1000px
			/* 			10 - 100 => 11.11
			/*			0 - 2 => 500
			/*			0 - 0.00005 => 20'000'000
														*/
			
			if(!this.options.display) {
				this.line.setAttribute('display', 'none');
				return 0;
			}

			this.line.setAttribute('display', 'block');

			if(!this.options.logScale) {
				// So the setting is: How many ticks in total ? Then we have to separate it
				if(this.options.scientificTicks)
					this.scientificExp = Math.floor(Math.log(Math.max(Math.abs(this.getActualMax()), Math.abs(this.getActualMin()))) / Math.log(10));

				var nbTicks1 = this.getNbTicksPrimary();

				var primaryTicks = this.getUnitPerTick(widthPx, nbTicks1, valrange, this.getActualMax());
				var nbSecondaryTicks = this.secondaryTicks();
				if(nbSecondaryTicks)
					var nbSecondaryTicks = nbSecondaryTicks; // Math.min(nbSecondaryTicks, primaryTicks[2] / 5);

				// We need to get here the width of the ticks to display the axis properly, with the correct shift
				var widthHeight = this.drawTicks(primaryTicks, nbSecondaryTicks);

			} else {
				var widthHeight = this.drawLogTicks();
			}

			/************************************/
			/*** DRAWING LABEL ******************/
			/************************************/

			var label;
			if(label = this.getLabel()) {
				this.labelTspan.textContent = label;
				if(this.getExponentialLabelFactor()) {
					this.expTspan.nodeValue = 'x10';
					this.expTspanExp.nodeValue = this.getExponentialLabelFactor();
					visible = true;
				} else if(this.options.scientificTicks) {
					this.expTspan.textContent = 'x10';
					this.expTspanExp.textContent = this.scientificExp;
					visible = true;
				} else
					visible = false;

				this.expTspan.setAttribute('display', visible ? 'block' : 'none');
				this.expTspanExp.setAttribute('display', visible ? 'block' : 'none');
			}

			/************************************/
			/*** DRAW CHILDREN IMPL SPECIFIC ****/
			/************************************/
			this.drawSpecifics();
			if(this.options.lineAt0 && this.getActualMin() < 0 && this.getActualMax() > 0)
				this._draw0Line(this.getPx(0));

			return widthHeight + (label ? 20 : 0);
		},

		setTickLabelRatio: function(tickRatio) {
			this.options.ticklabelratio = tickRatio;
		},

		draw: function(doNotRecalculateMinMax) {
			this._widthLabels = 0;
			var drawn = this._draw(doNotRecalculateMinMax);
			this._widthLabels += drawn;

			return this.series.length > 0 ? 100 : drawn;
		},

		drawTicks: function(primary, secondary) {

			var unitPerTick = primary[0],
				min = this.getActualMin(),
				max = this.getActualMax(),
				widthHeight = 0,
				secondaryIncr,
				incrTick,
				subIncrTick;


			if(secondary) 
				secondaryIncr = unitPerTick / (secondary + 1);

			
			var loop = 0;

			incrTick = this.options.shiftToZero ? this.realMin - Math.ceil((this.realMin - min) / unitPerTick) * unitPerTick : Math.floor(min / unitPerTick) * unitPerTick;
			this.incrTick = primary[0];
			this.resetTicks();
			while(incrTick < max) {
				loop++;
				if(loop > 200)
					break;
				if(secondary) {
					subIncrTick = incrTick + secondaryIncr;
					//widthHeight = Math.max(widthHeight, this.drawTick(subIncrTick, 1));
					var loop2 = 0;
					while(subIncrTick < incrTick + unitPerTick) {
						loop2++;
						if(loop2 > 100)
							break;
						if(subIncrTick < min || subIncrTick > max) {
							subIncrTick += secondaryIncr;
							continue;
						}
						this.drawTick(subIncrTick, false, Math.abs(subIncrTick - incrTick - unitPerTick / 2) < 1e-4 ? 3:2);
						subIncrTick += secondaryIncr;
					}
				}

				if(incrTick < min || incrTick > max) {
					incrTick += primary[0];
					continue;
				}

				this.drawTick(incrTick, true, 4);
				incrTick += primary[0];
			}

			this.widthHeightTick = this.getMaxSizeTick();
			return this.widthHeightTick;
		},

		resetTicks: function() {},

		secondaryTicks: function() {
			return this.options.nbTicksSecondary;
		},

		drawLogTicks: function() {
			var min = this.getActualMin(), max = this.getActualMax();
			var incr = Math.min(min, max);
			var max = Math.max(min, max);

			var optsMain = {
				fontSize: '1.0em',
				exponential: true,
				overwrite: false
			}
			if(incr < 0)
				incr = 0;
			var pow = incr == 0 ? 0 : Math.floor(Math.log(incr) / Math.log(10));
			var incr = 1, k = 0, val;
			while((val = incr * Math.pow(10, pow)) < max) {
				if(incr == 1) { // Superior power
					if(val > min)
						this.drawTick(val, true, 5, optsMain);
				}
				if(incr == 10) {
					incr = 1;
					pow++;
				} else {
					if(incr != 1 && val > min)
						this.drawTick(val, true, 2, {overwrite: incr, fontSize: '0.6em' });	
					incr++;
				}
			}
			return 5;
		},

		getPx: function(value) {
			return this.getPos(value);
		},

		getPos: function(value) {
//			if(this.getMaxPx() == undefined)
//				console.log(this);
//console.log(this.getMaxPx(), this.getMinPx(), this._getActualInterval());
			// Ex 50 / (100) * (1000 - 700) + 700
				if(!this.options.logScale) {

					return (value - this.getActualMin()) / (this._getActualInterval()) * (this.getMaxPx() - this.getMinPx()) + this.getMinPx();
				}
				else {
					// 0 if value = min
					// 1 if value = max
					if(value < 0)
						return;

					var value = ((Math.log(value) - Math.log(this.getActualMin())) / (Math.log(this.getActualMax()) - Math.log(this.getActualMin()))) * (this.getMaxPx() - this.getMinPx()) + this.getMinPx();
					
					return value;
				}
		},

		getRelPx: function(value) {
			return value / (this.getMaxPx() - this.getMinPx()) * this._getActualInterval();
		},

		getVal: function(px) {
			// Ex 50 / (100) * (1000 - 700) + 700
			return (px - this.getMinPx()) / (this.getMaxPx() - this.getMinPx()) * this._getActualInterval() + this.getActualMin();
		},

		valueToText: function(value) {
			
			if(this.options.scientificTicks) {
				value /= Math.pow(10, this.scientificExp);
				return value.toFixed(1);
			} else {

				value = value * Math.pow(10, this.getExponentialFactor()) * Math.pow(10, this.getExponentialLabelFactor());
				if(this.options.shiftToZero)
					value -= this.realMin;
				if(this.options.ticklabelratio)
					value *= this.options.ticklabelratio;
				if(this.options.unitModification) {
					value = this.modifyUnit(value, this.options.unitModification);
					return value;
				}
				var dec = this.decimals - this.getExponentialFactor() - this.getExponentialLabelFactor();
				if(dec > 0)
					return value.toFixed(dec);

				return value.toFixed(0);
			}
		},

		getModifiedValue: function(value) {
			if(this.options.ticklabelratio)
				value *= this.options.ticklabelratio;

			if(this.options.shiftToZero)
				value -= this.getMinValue() * (this.options.ticklabelratio || 1);
			return value;
		},



		modifyUnit: function(value, mode) {
			switch(mode) {
				case 'time': // val must be in seconds => transform in hours / days / months
					var max = this.getModifiedValue(this.getMaxValue()), 
					units = [[60, 'min'], [3600, 'h'], [3600*24, 'd']];
					if(max < 3600) { // to minutes
						umin = 0;
					} else if(max < 3600 * 24) {
						umin = 1;
					} else if(max < 3600 * 24 * 30) {
						umin = 2;
					}
				break;
			}

			var incr = this.incrTick;
			var text = "", valueRounded;
			
			value = value / units[umin][0];
			
			valueRounded = Math.floor(value);
			
			text = valueRounded + units[umin][1];
			umin--;
			
			
			while(incr < 1 * units[umin + 1][0] && umin > -1) {
				first = false;
				value = (value - valueRounded) * units[umin + 1][0] / units[umin][0];
				valueRounded = Math.round(value);
				text += " " + valueRounded + units[umin][1];
				umin--;

			}
			
			return text;
		},

		getExponentialFactor: function() {
			return this.options.exponentialFactor;
		},

		setExponentialFactor: function(value) {
			this.options.exponentialFactor = value;
		},

		setExponentialLabelFactor: function(value) {
			this.options.exponentialLabelFactor = value;
		},

		getExponentialLabelFactor: function() {
			return this.options.exponentialLabelFactor;
		},

		setLabel: function(value) {
			this.options.labelValue = value;
		},

		getLabel: function() {
			return this.options.labelValue;
		},

		setShift: function(shift, totalDimension) {
			this.shift = shift;
			this.totalDimension = totalDimension; // Width (axis y) or height (axis x) of the axis.
			this._setShift();
		},

		getShift: function() {
			return this.shift;
		},

		setTickPosition: function(pos) {
			switch(pos) {
				case 3:
				case 'outside':
					pos = 3;
				break;
				
				case 2:
				case 'centered':
					pos = 2;
				break;

				default:
				case 1:
				case 'inside':
					pos = 1;
				break;
			}

			this.options.tickPosition = pos;
		},

		togglePrimaryGrid: function(bool) {
			this.options.primaryGrid = bool;
		},

		toggleSecondaryGrid: function(bool) {
			this.options.secondaryGrid = bool;
		},

		doGridLine: function(primary, x1, x2, y1, y2) {
			var gridLine = document.createElementNS(this.graph.ns, 'line');
			gridLine.setAttribute('shape-rendering', 'crispEdges');	
			gridLine.setAttribute('y1', y1);
			gridLine.setAttribute('y2', y2);
			gridLine.setAttribute('x1', x1);
			gridLine.setAttribute('x2', x2);

			gridLine.setAttribute('stroke', primary ? this.getColorPrimaryGrid() : this.getColorSecondaryGrid());
			this.groupGrids.appendChild(gridLine);
		},

		getColorPrimaryGrid: function() {
			return '#c0c0c0';
		},

		getColorSecondaryGrid: function() {
			return '#f0f0f0';
		},

		setTickContent: function(dom, val, options) {
			if(!options) options = {};

			if(options.overwrite || !options.exponential)
				dom.textContent = options.overwrite || this.valueToText(val);
			else {
				var log = Math.round(Math.log(val) / Math.log(10));
				var unit = Math.floor(val * Math.pow(10, -log));

				dom.textContent = (unit != 1) ? unit + "x10" : "10";
				var tspan = document.createElementNS(this.graph.ns, 'tspan');
				tspan.textContent = log;
				tspan.setAttribute('font-size', '0.7em');
				tspan.setAttribute('dy', -3);
				dom.appendChild(tspan);
			}

			if(options.fontSize)
				dom.setAttribute('font-size', options.fontSize);
		},

		removeSerie: function(serie) {
			this.series.splice(this.series.indexOf(serie), 1);
		},

		killSeries: function(noRedraw) {
			for(var i = 0; i < this.series.length; i++) {
				this.series[i].kill(noRedraw);
			}
			this.series = [];
		},

		removeSeries: function() {
			this.killSeries();
		},

		handleMouseOutLocal: function(x, y, e) {
			for(var i = 0, l = this.series.length; i < l; i++)
				this.series[i].hideTrackingMarker();
		}
	}






	/*******************************************/
	/** GRAPH X AXIS ***************************/
	/*******************************************/


	var GraphXAxis = function(graph, topbottom, options) {
		this.init(graph, options);
		this.top = topbottom == 'top';
	}

	$.extend(GraphXAxis.prototype, GraphAxis.prototype, {

		getAxisPosition: function() {
			var size = (this.options.tickPosition == 1 ? 15 : 25) + this.graph.options.fontSize * 2;	
			if(this.options.allowedPxSerie && this.series.length > 0)
				size += this.options.allowedPxSerie;
			return size;
		},

		getAxisWidthHeight: function() {
			return;
		},

		_setShift: function() {
			this.group.setAttribute('transform', 'translate(0 ' + (this.top ? this.shift : (this.graph.getDrawingHeight() - this.shift)) + ')')
		},

		getMaxSizeTick: function() {
			return (this.top ? -1 : 1) * ((this.options.tickPosition == 1) ? 15 : 25)
		},

		drawTick: function(value, label, scaling, options) {
			var group = this.groupTicks;
			var tick = document.createElementNS(this.graph.ns, 'line'),
				val = this.getPos(value);

			if(val == undefined)
				return;

			tick.setAttribute('shape-rendering', 'crispEdges');
			tick.setAttribute('x1', val);
			tick.setAttribute('x2', val);

			tick.setAttribute('y1', (this.top ? 1 : -1) * this.tickPx1 * scaling);
			tick.setAttribute('y2', (this.top ? 1 : -1) * this.tickPx2 * scaling);

			if(label && this.options.primaryGrid)
				this.doGridLine(true, val, val, 0, this.graph.getDrawingHeight());
			else if(!label && this.options.secondaryGrid)
				this.doGridLine(false, val, val, 0, this.graph.getDrawingHeight());
			
			tick.setAttribute('stroke', 'black');

			this.groupTicks.appendChild(tick);
			if(label) {
				var groupLabel = this.groupTickLabels;
				var tickLabel = document.createElementNS(this.graph.ns, 'text');
				tickLabel.setAttribute('x', val);
				tickLabel.setAttribute('y', (this.top ? -1 : 1) * ((this.options.tickPosition == 1) ? 8 : 25));
				tickLabel.setAttribute('text-anchor', 'middle');
				tickLabel.style.dominantBaseline = 'hanging';

				this.setTickContent(tickLabel, value, options);
				this.graph.applyStyleText(tickLabel);
				this.groupTickLabels.appendChild(tickLabel);
			}
			this.ticks.push(tick);
		},

		drawSpecifics: function() {

			// Adjusts group shift
			//this.group.setAttribute('transform', 'translate(0 ' + this.getShift() + ')');

			// Place label correctly
			this.label.setAttribute('text-anchor', 'middle');
			this.label.setAttribute('x', Math.abs(this.getMaxPx() - this.getMinPx()) / 2 + this.getMinPx());
			this.label.setAttribute('y', (this.top ? -1 : 1) * ((this.options.tickPosition == 1 ? 10 : 15) + this.graph.options.fontSize));

			this.line.setAttribute('x1', this.getMinPx());
			this.line.setAttribute('x2', this.getMaxPx());
			this.line.setAttribute('y1', 0);
			this.line.setAttribute('y2', 0);

			this.labelTspan.style.dominantBaseline = 'hanging';
			this.expTspan.style.dominantBaseline = 'hanging';
			this.expTspanExp.style.dominantBaseline = 'hanging';	
		},

		drawSeries: function() {

			if(!this.shift)
				return;

			this.rectEvent.setAttribute('y', !this.top ? 0 : -this.shift);
			this.rectEvent.setAttribute('height', this.totalDimension);
			this.rectEvent.setAttribute('x', Math.min(this.getMinPx(), this.getMaxPx()));
			this.rectEvent.setAttribute('width', Math.abs(this.getMinPx() - this.getMaxPx()));
			//this.rectEvent.setAttribute('fill', 'rgba(0, 0, 0, 0.5)');
//console.log(this.clipRect);
			this.clipRect.setAttribute('y', !this.top ? 0 : -this.shift);
			this.clipRect.setAttribute('height', this.totalDimension);
			this.clipRect.setAttribute('x', Math.min(this.getMinPx(), this.getMaxPx()));
			this.clipRect.setAttribute('width', Math.abs(this.getMinPx() - this.getMaxPx()));


			for(var i = 0, l = this.series.length; i < l; i++)
				this.series[i].draw();	
		},

		_draw0Line: function(px) {
			this._0line = document.createElementNS(this.graph.ns, 'line');
			this._0line.setAttribute('x1', px);
			this._0line.setAttribute('x2', px);

			this._0line.setAttribute('y1', 0);
			this._0line.setAttribute('y2', this.getMaxPx());
		
			this._0line.setAttribute('stroke', 'black');
			this.groupGrids.appendChild(this._0line);
		},



		addSerie: function(name, options) {
			var serie = new GraphSerieAxisX(name, options);
			serie.setAxis(this);
			serie.init(this.graph, name, options);
			serie.autoAxis();
			serie.setXAxis(this);
			this.series.push(serie);
			this.groupSeries.appendChild(serie.groupMain);
			this.groupSeries.setAttribute('clip-path', 'url(#_clip' + this.axisRand + ')');

			return serie;
		},

		handleMouseMoveLocal: function(x, y, e) {
			x -= this.graph.getPaddingLeft();
			this.mouseVal = this.getVal(x);
		}
	});






	/*******************************************/
	/** GRAPH Y AXIS ***************************/
	/*******************************************/

	var GraphYAxis = function(graph, leftright, options) {
		this.init(graph, options, { flipped: true });
		this.leftright = leftright;
		this.left = leftright == 'left';
		
	}

	$.extend(GraphYAxis.prototype, GraphAxis.prototype, {

		getAxisPosition: function() {
			var size = 0;
			if(this.options.allowedPxSerie && this.series.length > 0)
				size = this.options.allowedPxSerie;
			return size;
		},

		getAxisWidthHeight: function() {
			return 15;
		},

		resetTicks: function() {
			this.longestTick = [false, 0];
		},

		getMaxSizeTick: function() {

			return (this.longestTick[0] ? this.longestTick[0].getComputedTextLength() : 0) + (this.left ? 10 : 0);
		},

		drawTick: function(value, label, scaling, options) {
			var group = this.groupTicks,
				tickLabel,
				labelWidth = 0,
				pos = this.getPos(value);

			if(pos == undefined)
				return;

			var tick = document.createElementNS(this.graph.ns, 'line');
			tick.setAttribute('shape-rendering', 'crispEdges');	
			tick.setAttribute('y1', pos);
			tick.setAttribute('y2', pos);
			tick.setAttribute('x1', this.tickPx1 * scaling);
			tick.setAttribute('x2', this.tickPx2 * scaling);
			tick.setAttribute('stroke', 'black');
		
			if(label && this.options.primaryGrid)
				this.doGridLine(true, 0, this.graph.getDrawingWidth(), pos, pos);
			else if(!label && this.options.secondaryGrid)
				this.doGridLine(false, 0, this.graph.getDrawingWidth(), pos, pos);
			
			this.groupTicks.appendChild(tick);

			if(label) {
				var groupLabel = this.groupTickLabels;
				tickLabel = document.createElementNS(this.graph.ns, 'text');
				tickLabel.setAttribute('y', pos);
				tickLabel.setAttribute('x', this.left ? -10 : 10);

				if(this.left) {				
					tickLabel.setAttribute('text-anchor', 'end');
				} else {
					tickLabel.setAttribute('text-anchor', 'start');
				}
				tickLabel.style.dominantBaseline = 'central';
				this.graph.applyStyleText(tickLabel);
				this.setTickContent(tickLabel, value, options);
				this.groupTickLabels.appendChild(tickLabel);
				
				if((tickLabel + "").length > this.longestTick[1]) {
					this.longestTick[0] = tickLabel;
					this.longestTick[1] = (tickLabel + "").length;

				}
			}
			this.ticks.push(tick);
		},

		drawSpecifics: function() {

			// Place label correctly
			//this.label.setAttribute('x', (this.getMaxPx() - this.getMinPx()) / 2);
			this.label.setAttribute('transform', 'translate(' + (-this.widthHeightTick - 8) + ', ' + (Math.abs(this.getMaxPx() - this.getMinPx()) / 2 + Math.min(this.getMinPx(), this.getMaxPx())) +') rotate(-90)');

			this.line.setAttribute('y1', this.getMinPx());
			this.line.setAttribute('y2', this.getMaxPx());
			this.line.setAttribute('x1', 0);
			this.line.setAttribute('x2', 0);	
		},

		drawSeries: function() {
			if(!this.shift)
				return;

			this.rectEvent.setAttribute('x', - this.shift);
			this.rectEvent.setAttribute('width', this.totalDimension);
			this.rectEvent.setAttribute('y', Math.min(this.getMinPx(), this.getMaxPx()));
			this.rectEvent.setAttribute('height', Math.abs(this.getMinPx() - this.getMaxPx()));


			this.clipRect.setAttribute('x', - this.shift);
			this.clipRect.setAttribute('width', this.totalDimension);
			this.clipRect.setAttribute('y', Math.min(this.getMinPx(), this.getMaxPx()));
			this.clipRect.setAttribute('height', Math.abs(this.getMinPx() - this.getMaxPx()));


			for(var i = 0, l = this.series.length; i < l; i++)
				this.series[i].draw();	
			
		},

		_setShift: function() {

			var xshift = this.isLeft() ? this.getShift() : this.graph.getWidth() - this.graph.getPaddingRight() - this.graph.getPaddingLeft() - this.getShift();
			this.group.setAttribute('transform', 'translate(' + xshift + ' 0)');

		},

		isLeft: function() {
			return this.left;
		},

		isRight: function() {
			return !this.left;
		},

		flip: function(bool) {
			this.flipped = !bool;
		},

		_draw0Line: function(px) {
			this._0line = document.createElementNS(this.graph.ns, 'line');
			this._0line.setAttribute('y1', px);
			this._0line.setAttribute('y2', px);

			this._0line.setAttribute('x1', 0);
			this._0line.setAttribute('x2', this.graph.getDrawingWidth());
		
			this._0line.setAttribute('stroke', 'black');
			this.groupGrids.appendChild(this._0line);
		},

		addSerie: function(name, options) {
			var serie = new GraphSerieAxisY(name, options);
			serie.init(this.graph, name, options);
			serie.setAxis(this);
			serie.autoAxis();
			serie.setYAxis(this);
			this.series.push(serie);
			this.groupSeries.appendChild(serie.groupMain);
			this.groupSeries.setAttribute('clip-path', 'url(#_clip' + this.axisRand + ')');

			return serie;
		},

		handleMouseMoveLocal: function(x, y, e) {
			y -= this.graph.getPaddingTop();
			this.mouseVal = this.getVal(y);
		}
	});

	var GraphSerie = function() { }
	GraphSerie.prototype = {

		defaults: {
			lineColor: 'black',
			lineStyle: 1,
			flip: false,

			markers: {
				show: false,
				type: 1,
				zoom: 1,
				strokeColor: false,
				strokeWidth: 1,
				fillColor: 'transparent'
			},
			
			trackMouse: false,
			trackMouseLabel: false,
			trackMouseLabelRouding: 1,
			label: '',
			lineToZero: false
		},


		init: function(graph, name, options) {

			this.graph = graph;
			this.name = name;
			this.id = Math.random() + Date.now();

			this.options = $.extend(true, {}, GraphSerie.prototype.defaults, options);
			this.data = [];
			this._isMinOrMax = { x: { min: false, max: false}, y: { min: false, max: false} };

			this.groupLines = document.createElementNS(this.graph.ns, 'g');
			this.domMarker = document.createElementNS(this.graph.ns, 'path');
			this.groupMain = document.createElementNS(this.graph.ns, 'g');
			

			this.marker = document.createElementNS(this.graph.ns, 'circle');
			this.marker.setAttribute('fill', 'black');
			this.marker.setAttribute('r', 3);
			this.marker.setAttribute('display', 'none');

			this.markerLabel = document.createElementNS(this.graph.ns, 'text');
			this.markerLabelSquare = document.createElementNS(this.graph.ns, 'rect');
			this.markerLabelSquare.setAttribute('fill', 'white');


			this.groupLabels = document.createElementNS(this.graph.ns, 'g');
			//this.scale = 1;
			//this.shift = 0;

			this.minX = Number.MAX_VALUE;
			this.minY = Number.MAX_VALUE;
			this.maxX = Number.MIN_VALUE;
			this.maxY = Number.MIN_VALUE;

			this.lines = [];
			

			this.groupMain.appendChild(this.groupLines);
			this.groupMain.appendChild(this.groupLabels);
			this.groupMain.appendChild(this.marker);
			this.groupMain.appendChild(this.domMarker);
			this.groupMain.appendChild(this.markerLabelSquare);
			this.groupMain.appendChild(this.markerLabel);

			this.labels = [];

			this.currentAction = false;

			if(this.initExtended1)
				this.initExtended1();
		},


		/**
		 *	Possible data types
		 *	[100, 0.145, 101, 0.152, 102, 0.153]
		 *	[[100, 0.145, 101, 0.152], [104, 0.175, 106, 0.188]]
		 *	[[100, 0.145], [101, 0.152], [102, 0.153], [...]]
		 *	[{ x: 100, dx: 1, y: [0.145, 0.152, 0.153]}]
		 *
		 *	Converts every data type to a 1D array
		 */
		setData: function(data, arg, type) {

			var z = 0;
			var x, dx, arg = arg || "2D", type = type || 'float', arr;
			if(!data instanceof Array)
				return;

			// Single object
			var datas = [];
			if(!(data instanceof Array) && typeof data == 'object') {
				data = [data];
			} else if(data instanceof Array && !(data[0] instanceof Array)) {// [100, 103, 102, 2143, ...]
				data = [data];
				arg = "1D";
			}

			var _2d = (arg == "2D");

			// [[100, 0.145], [101, 0.152], [102, 0.153], [...]] ==> [[[100, 0.145], [101, 0.152], [102, 0.153], [...]]]
			if(data[0] instanceof Array && arg == "2D" && !(data[0][0] instanceof Array))
				data = [data];


			if(data[0] instanceof Array) {
				for(var i = 0, k = data.length; i < k; i++) {
					arr = this._addData(type, _2d ? data[i].length * 2 : data[i].length);
					datas.push(arr);
					z = 0;
					
					for(var j = 0, l = data[i].length; j < l; j++) {

						if(_2d) {
							arr[z] = (data[i][j][0]);
							this._checkX(arr[z]);
							z++;
							arr[z] = (data[i][j][1]);
							this._checkY(arr[z]);
							z++;
						} else { // 1D Array
							arr[z] = data[i][j];
							this[j % 2 == 0 ? '_checkX' : '_checkY'](arr[z]);
							z++;

						}
					}
				}
			} else if(typeof data[0] == 'object') {
				
				var number = 0, numbers = [], datas = [], k = 0;
				for(var i = 0, l = data.length; i < l; i++) {
					number += data[i].y.length;
					continuous = (i != 0) && (!data[i + 1] || data[i].x + data[i].dx * (data[i].y.length) == data[i + 1].x);
					if(!continous) {
						datas.push(this._addData(type, number));
						numbers.push(number);
						number = 0;
					}
				}

				number = 0, k = 0, z = 0;
				for(var i = 0, l = data.length; i < l; i++) {
					x = data[i].x, dx = data[i].dx;
					for(var j = 0, k = data[i].y.length; j < k; j++) {
						datas[k][z] = (x + j * dx);
						this._checkX(datas[k][z]);
						z++;
						datas[k][z] = (data[i].y[j]);
						this._checkY(datas[k][z]);
						z++;
					}
					number += data[i].y.length;
					if(numbers[k] == number) {
						k++;
						number = 0;
						z = 0;
					}
				}
			}


			this.data = datas;
		},


		_addData: function(type, howmany) {

			switch(type) {
				case 'int':
					var size = howmany * 4; // 4 byte per number (32 bits)
				break;
				case 'float':
					var size = howmany * 8; // 4 byte per number (64 bits)
				break;
			}

			var arr = new ArrayBuffer(size);

			switch(type) {
				case 'int':
					return new Int32Array(arr);
				break;

				default:
				case 'float':
					return new Float64Array(arr);
				break;
			}
		},

		kill: function(noRedraw) {

			this.graph.plotGroup.removeChild(this.groupMain);
			/*if(this.marker)
				this.groupMain.removeChild(this.marker);
	*/
			this.graph.series.splice(this.graph.series.indexOf(this), 1);
			if(!noRedraw)
				this.graph.redraw();
			// Remove serie
			
		},

		handleMouseWheel: function() {},

		getName: function() {
			return this.name;
		},

		_checkX: function(val) {
			this.minX = Math.min(this.minX, val);
			this.maxX = Math.max(this.maxX, val);
		},


		_checkY: function(val) {
			this.minY = Math.min(this.minY, val);
			this.maxY = Math.max(this.maxY, val);
		},


		empty: function() {

			for(var i = 0, l = this.lines.length; i < l; i++) {
				this.groupLines.removeChild(this.lines[i]);
				
			}

			while(this.groupMarkers.firstChild)
				this.groupMarkers.removeChild(this.groupMarkers.firstChild);
		},


		isMinOrMax: function(bool, xy, minmax) {
			if(bool == undefined)
				return this._isMinOrMax.x.min || this._isMinOrMax.x.max || this._isMinOrMax.y.min || this._isMinOrMax.y.max;

			if(minmax == undefined && xy != undefined) {
				this._isMinOrMax[xy].min = bool;
				this._isMinOrMax[xy].max = bool;
				return;
			}

			if(xy != undefined && minmax != undefined)
				this._isMinOrMax[xy][minmax] = bool;
		},


		draw: function() {

			var x, y, xpx, ypx, i = 0, l = this.data.length, j = 0, k, currentLine, doAndContinue, _higher;

			this._drawn = true;			

			var next = this.groupLines.nextSibling;
			this.groupMain.removeChild(this.groupLines);
			this.groupMain.removeChild(this.domMarker);
			this.marker.setAttribute('display', 'none');

			
			this.markerPath = '';
			this._markerPath = this.getMarkerPath();
			
			var incrXFlip = 0;
			var incrYFlip = 1;
			if(this.getFlip()) {
				incrXFlip = 1;
				incrYFlip = 0;
			}

			for(; i < l ; i++) {
				
				currentLine = "M ";
				doAndContinue = 0;
				_higher = false;
				var _last = false, _in = false;
				j = 0, k = 0;

				for(; j < this.data[i].length; j+=2) {


				//	if(xpx < this.getXAxis().getMinPx() || xpx > this.getXAxis().getMaxPx())
				//		continue;
				

				xpx = this.getX(this.data[i][j + incrXFlip]);
				ypx = this.getY(this.data[i][j + incrYFlip]);

				/*	if((!this.getYAxis().isFlipped() && (ypx > this.getYAxis().getMaxPx() || ypx < this.getYAxis().getMinPx())) || (this.getYAxis().isFlipped() && (ypx < this.getYAxis().getMaxPx() || ypx > this.getYAxis().getMinPx()))) {

						if(_higher != (_higher = ypx > this.getYAxis().getMaxPx())) {
							if(_last) {

								currentLine = this._addPoint(currentLine, _last[0], _last[1], k);
								k++;
								_last = false;
								doAndContinue = false;
								_in = true;
							}
						}

						if(doAndContinue || k == 0) {
							_last = [xpx, ypx];
							continue;
						}
						if(_in)
							doAndContinue = 1;
						else
							_last = [xpx, ypx];
						_in = false;
					} else {
						_in = true;
						doAndContinue = false;
					}

					if(_in && _last && !doAndContinue) {
						currentLine = this._addPoint(currentLine, _last[0], _last[1], k);
						k++;
						_last = false;
					}*/
					
					currentLine = this._addPoint(currentLine, xpx, ypx, k);
					k++;
				}
				
				this._createLine(currentLine, i, k);
			}

			i++;
			for(; i < this.lines.length; i++) {
				this.groupLines.removeChild(this.lines[i]);
				this.lines.splice(i, 1);


			}

			this.domMarker.setAttribute('fill', this.options.markers.fillColor || 'transparent');
			this.domMarker.setAttribute('stroke', this.options.markers.strokeColor || this.getLineColor());
			this.domMarker.setAttribute('stroke-width', this.options.markers.strokeWidth);
			this.domMarker.setAttribute('d', this.markerPath || 'M 0 0');

			//this.groupMain.appendChild(this.groupLines);
			this.groupMain.appendChild(this.domMarker);
			this.groupMain.insertBefore(this.groupLines, next);
			var label;
			for(var i = 0, l = this.labels.length; i < l; i++)
				this.repositionLabel(this.labels[i]);
		},

		hideTrackingMarker: function() {
			this.marker.setAttribute('display', 'none');
			this.markerLabel.setAttribute('display', 'none');
			this.markerLabelSquare.setAttribute('display', 'none');
		},

		getX: function(val) {
			return Math.round(this.getXAxis().getPx(val) * 1000) / 1000;
		},

		getY: function(val) {
			return Math.round(this.getYAxis().getPx(val) * 1000) / 1000;
		},

		_addPoint: function(currentLine, xpx, ypx, k) {
			var pos;
			
			if(k != 0) {
				if(this.options.lineToZero)
					currentLine += 'M ';
				else
					currentLine += "L ";
			}

			currentLine += xpx;
			currentLine += " ";
			currentLine += ypx;
			currentLine += " "; 
			
			if(this.options.lineToZero && (pos = this.getYAxis().getPos(0)) !== undefined) {
				currentLine += "L ";
				currentLine += xpx;
				currentLine += " ";
				currentLine += pos;
				currentLine += " ";
			}

			if(!this.options.markers.show)
				return currentLine;
			this._drawMarkerXY(xpx, ypx);
			return currentLine;
		},

		// Returns the DOM
		_createLine: function(points, i, nbPoints) {
			

			if(this.lines[i]) {
				var line = this.lines[i];
			} else {
				var line = document.createElementNS(this.graph.ns, 'path');
				line.setAttribute('stroke', this.getLineColor());
				line.setAttribute('stroke-width', this.getLineWidth());
				if(this.getLineDashArray())
					line.setAttribute('stroke-dasharray', this.getLineDashArray());
				line.setAttribute('fill', 'none');
			}

			if(nbPoints == 0) {
				line.setAttribute('d', 'M 0 0');
			} else {
				line.setAttribute('d', points);


				if(this.options.areaUnderLine) {
					points += " V " + this.getYAxis().getPx(0) + " H " + this.getXAxis().getPx(0) + " z";
				//	auline.setAttribute('d', points);
				}
		
			}

			if(!this.lines[i]) {			
				this.groupLines.appendChild(line);
				this.lines[i] = line;

			}
			
			return line;
		},

		getMarkerPath: function() {

			switch(this.options.markers.type) {
				case 1:
					return 'm -2 -2 l 4 0 l 0 4 l -4 0 z';
				break;

				case 2:
					return 'm -2 -2 l 4 4 m -4 0 l 4 -4 z';
				break;
			}
		},

		_drawMarkerXY: function(x, y) {

			if(!this.options.markers.show)
				return;

			this.markerPath += 'M ' + x + ' ' + y + ' ';
			this.markerPath += this._markerPath;

			/*var shape = document.createElementNS(this.graph.ns, 'path');
			shape.setAttribute('transform', 'translate(' + x + ' ' + y + ') scale(' + this.options.markers.zoom + ')');
			shape.setAttribute('d', this._markerPath);
			
			this.groupMarkers.appendChild(shape);*/
		},

		autoAxis: function() {
			this.setXAxis(this.graph.getXAxis());
			this.setYAxis(this.graph.getYAxis());
		},


		/* AXIS */

		setXAxis: function(axis) {
			if(typeof axis == "Number")
				this.xaxis = this.graph.getXAxis(axis);
			else
				this.xaxis = axis;
		},

		setYAxis: function(axis) {
			if(typeof axis == "Number")
				this.yaxis = this.graph.getYAxis(axis);
			else
				this.yaxis = axis;
		},

		getXAxis: function() {
			return this.xaxis;
		},

		getYAxis: function() {
			return this.yaxis;
		},

		/* */
		

		/* DATA MIN MAX */

		getMinX: function() {
			return this.minX;
		},

		getMaxX: function() {
			return this.maxX;
		},

		getMinY: function() {
			return this.minY;
		},

		getMaxY: function() {
			return this.maxY;
		},

		/* */
		handleLabelMove: function(x, y) {

			var label = this.labelDragging;

			if(!label)
				return;

			label.labelX += x - label.draggingIniX;
			label.draggingIniX = x;

			label.labelY += y - label.draggingIniY;
			label.draggingIniY = y;

			label.rect.setAttribute('x', label.labelX);
			label.rect.setAttribute('y', label.labelY  - this.graph.options.fontSize);
			label.labelDom.setAttribute('x', label.labelX);
			label.labelDom.setAttribute('y', label.labelY);

			label.labelLine.setAttribute('x1', label.labelX + label.labelDom.getComputedTextLength() / 2);
			label.labelLine.setAttribute('y1', label.labelY  - this.graph.options.fontSize / 2);

		},

		handleLabelMainMove: function(x, y) {
			
			if(this.options.labelMoveFollowCurve || 1 == 1) {
				var label = this.labelDragging;
				label.x = this.getXAxis().getVal(x - this.graph.options.paddingLeft);
				
				label.y = this.handleMouseMove(label.x, false).interpolatedY;
				this.repositionLabel(label, true);
			}
		},

		handleLabelUp: function() {
			
			this.labelDragging = false;
		},

		searchClosestValue: function(valX) {

			for(var i = 0; i < this.data.length; i++) {
				if((valX <= this.data[i][this.data[i].length - 2] && valX > this.data[i][0])) {
					xMinIndex = this._searchBinary(valX, this.data[i], false);
				} else if((valX >= this.data[i][this.data[i].length - 2] && valX < this.data[i][0])) {
					xMinIndex = this._searchBinary(valX, this.data[i], true);
				} else 
					continue;

				return {
					dataIndex: i,
					xMin: this.data[i][xMinIndex],
					xMax: this.data[i][xMinIndex + 2],
					yMin: this.data[i][xMinIndex + 1],
					yMax: this.data[i][xMinIndex + 3],
					xBeforeIndex: xMinIndex / 2,
					xBeforeIndexArr: xMinIndex
				}
			}

		},


		handleMouseMove: function(x, doMarker) {

			
			var valX = x || this.getXAxis().getMouseVal(),
				xMinIndex, 
				xMin, 
				yMin, 
				xMax, 
				yMax;
 			
 			var value = this.searchClosestValue(valX);
 			if(!value)
 				return;

			var ratio = (valX - value.xMin) / (value.xMax - value.xMin);
			var intY = ((1 - ratio) * value.yMin + ratio * value.yMax);

			if(doMarker && this.options.trackMouse) {
				if(!xMin)
					return false;
				else {
					
					var x = this.getX(this.getFlip() ? intY : valX);
					var y = this.getY(this.getFlip() ? valX : intY);

					this.marker.setAttribute('display', 'block');
					this.marker.setAttribute('cx', x);
					this.marker.setAttribute('cy', y);

					this.markerLabel.setAttribute('display', 'block');
					this.markerLabelSquare.setAttribute('display', 'block');
					switch(this.options.trackMouseLabel) {
						case false:
						break;

						default:
							this.markerLabel.textContent = this.options.trackMouseLabel
																.replace('<x>', valX.toFixed(this.options.trackMouseLabelRouding))
																.replace('<y>', intY.toFixed(this.options.trackMouseLabelRouding));
						break;
					}

					this.markerLabel.setAttribute('x', x + 5);
					this.markerLabel.setAttribute('y', y - 5);

					this.markerLabelSquare.setAttribute('x', x + 5);
					this.markerLabelSquare.setAttribute('y', y - 5 - this.graph.options.fontSize);
					this.markerLabelSquare.setAttribute('width', this.markerLabel.getComputedTextLength() + 2);
					this.markerLabelSquare.setAttribute('height', this.graph.options.fontSize + 2);
				}
			}

			return {
				xBefore: value.xMin,
				xAfter: value.xMax,
				yBefore: value.yMin,
				yAfter: value.yMax,
				trueX: valX,
				interpolatedY: intY,
				xBeforeIndex: value.xBeforeIndex
			};
		},

		_searchBinary: function(target, haystack, reverse) {
			var seedA = 0,
				length = haystack.length,
				seedB = (length - 2);

			if(haystack[seedA] == target)
				return seedA;

			if(haystack[seedB] == target)
				return seedB;

			var seedInt;
			var i = 0;
			
			while(true) {
				i++;
				if(i > 100)
					throw "Error loop";

				seedInt = (seedA + seedB) / 2;
				seedInt -= seedInt % 2; // Always looks for an x.

				if(seedInt == seedA || haystack[seedInt] == target)
					return seedInt;

		//		console.log(seedA, seedB, seedInt, haystack[seedInt]);
				if(haystack[seedInt] <= target) {
					if(reverse)
						seedB = seedInt;
					else
						seedA = seedInt;
				} else if(haystack[seedInt] > target) {
					if(reverse)
						seedA = seedInt;
					else
						seedB = seedInt;
				}
			}
		},

		/* FLIP */

		setFlip: function(bol) {
			this.options.flip = bol;
		},

		getFlip: function() {
			return this.options.flip;
		},


		/* LINE STYLE */

		setLineStyle: function(number) {
			this.options.lineStyle = number;
		},

		getLineStyle: function() {
			return this.options.lineStyle;
		},

		getLineDashArray: function() {
			switch(this.options.lineStyle) {
				
				case 2: 
					return "5, 5";
				break;

				case false:
				case 1:
					return false;
				break;

				default:
					return this.options.lineStyle;
				break;
			}
		},

		/*  */




		setLineWidth: function(width) {
			this.options.lineWidth = width;
		},

		getLineWidth: function() {
			return this.options.lineWidth;
		},


		/* LINE COLOR */

		setLineColor: function(color) {
			this.options.lineColor = color;
		},

		getLineColor: function() {
			return this.options.lineColor;
		},

		/* */



		/* MARKERS */

		showMarkers: function(skipRedraw) {
			this.options.markers.show = true;

			if(!skipRedraw && this._drawn)
				this.draw();
		},

		hideMarkes: function(skipRedraw) {
			this.options.markers.hide = true;

			if(!skipRedraw && this._drawn)
				this.draw();
		},

		setMarkerType: function(type, skipRedraw) {
			this.options.markers.type = type;
			
			if(!skipRedraw && this._drawn)
				this.draw();
		},

		setMarkerZoom: function(zoom, skipRedraw) {
			this.options.markers.zoom = zoom;

			if(!skipRedraw && this._drawn)
				this.draw();
		},

		setMarkerStrokeColor: function(color, skipRedraw) {
			this.options.markers.strokeColor = color;

			if(!skipRedraw && this._drawn)
				this.draw();
		},

		setMarkerStrokeWidth: function(width, skipRedraw) {
			this.options.markers.strokeWidth = width;

			if(!skipRedraw && this._drawn)
				this.draw();
		},

		setMarkerFillColor: function(color, skipRedraw) {
			this.options.markers.fillColor = color;

			if(!skipRedraw && this._drawn)
				this.draw();
		},

		addLabelX: function(x, label) {
			this.addLabelObj({
				x: x,
				label: label
			});
		},

		addLabel: function(x, y, label) {
			this.addLabelObj({
				x: x,
				y: y,
				label: label
			});
		},

		repositionLabel: function(label, recalculateLabel) {
			var x = !this.getFlip() ? this.getX(label.x) : this.getY(label.x),
				y = !this.getFlip() ? this.getY(label.y) : this.getX(label.y);
				
			var nan = (isNaN(x) || isNaN(y));
			label.group.setAttribute('display', nan ? 'none' : 'block');

			if(recalculateLabel) {
				label.labelDom.textContent = this.options.label
										.replace('<x>', label.x.toFixed(this.options.trackMouseLabelRouding) || '')
										.replace('<label>', label.label || '');

				label.rect.setAttribute('width', label.labelDom.getComputedTextLength() + 2);
			}
			if(nan)
				return;
			label.group.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
		},

		addLabelObj: function(label) {
			var self = this, group, labelDom, rect, path;

			this.labels.push(label);
			if(label.x && !label.y) {
				label.y = this.handleMouseMove(label.x, false).interpolatedY;
			}


			
			group = document.createElementNS(this.graph.ns, 'g');
			this.groupLabels.appendChild(group);
			
			labelDom = document.createElementNS(this.graph.ns, 'text');
			labelDom.setAttribute('x', 5);
			labelDom.setAttribute('y', -5);
			

			var labelLine = document.createElementNS(this.graph.ns, 'line');
			labelLine.setAttribute('stroke', 'black');
			labelLine.setAttribute('x2', 0);
			labelLine.setAttribute('x1', 0);


			group.appendChild(labelLine);
			group.appendChild(labelDom);
			rect = document.createElementNS(this.graph.ns, 'rect');
			rect.setAttribute('x', 5);
			rect.setAttribute('y', -this.graph.options.fontSize - 5);
			rect.setAttribute('width', labelDom.getComputedTextLength() + 2);
			rect.setAttribute('height', this.graph.options.fontSize + 2);
			rect.setAttribute('fill', 'white');
			rect.style.cursor = 'move';
			labelDom.style.cursor = 'move';

			
			path = document.createElementNS(this.graph.ns, 'path');
			path.setAttribute('d', 'M 0 -4 l 0 8 m -4 -4 l 8 0');
			path.setAttribute('stroke-width', '1px');
			path.setAttribute('stroke', 'black');



			path.style.cursor = 'move';

			group.insertBefore(rect, labelDom);

			group.appendChild(path);

			label.labelLine = labelLine;
			label.group = group;
			label.rect = rect;
			label.labelDom = labelDom;
			label.path = path;

			label.labelY = -5;
			label.labelX = 5;

			this.bindLabelHandlers(label);
			this.repositionLabel(label, true);
		},

		bindLabelHandlers: function(label) {
			var self = this;

			function clickHandler(e) {
				if(self.graph.currentAction !== false)
					return;
				self.graph.currentAction = 'labelDragging';
				e.stopPropagation();
				label.dragging = true;

				var coords = self.graph.getXY(e);
				label.draggingIniX = coords.x;
				label.draggingIniY = coords.y;
				self.labelDragging = label;
			}

			function clickHandlerMain(e) {
				if(self.graph.currentAction !== false)
					return;
				e.stopPropagation();
				e.preventDefault();
				self.graph.currentAction = 'labelDraggingMain';
				self.labelDragging = label;
			}


			label.labelDom.addEventListener('mousedown', clickHandler);
			label.rect.addEventListener('mousedown', clickHandler);
			label.rect.addEventListener('click', function(e) {
				e.preventDefault();
				e.stopPropagation();
			});

			label.labelDom.addEventListener('click', function(e) {
				e.preventDefault();
				e.stopPropagation();
			});

			label.path.addEventListener('mousedown', clickHandlerMain);
			label.path.addEventListener('click', function(e) {
				e.preventDefault();
				e.stopPropagation();
			});
		}
	}

	var GraphSerieAxis = function() {};
	GraphSerieAxis.prototype = {

		initExtended1: function() {
			if(this.initExtended2)
				this.initExtended2();
		},

		setAxis: function(axis) {
			this.axis = axis;
		},


		kill: function(noRedraw) {
			this.getAxis().groupSeries.removeChild(this.groupMain);
			this.getAxis().series.splice(this.getAxis().series.indexOf(this), 1);
			if(!noRedraw)
				this.graph.redraw();
		},

		getAxis: function() {
			return this.axis;
		},

		getXAxis: function() {
			return this.axis;
		},

		getYAxis: function() {
			return this.axis;
		}
	};


	var GraphSerieAxisX = function() {};
	$.extend(GraphSerieAxisX.prototype, GraphSerie.prototype, GraphSerieAxis.prototype, {	
		
		getY: function(value) {
			var y = - Math.round(1000 * (((value - this.minY) / (this.maxY - this.minY)))) / 1000  * (this.axis.totalDimension - this.axis._widthLabels) - this.axis._widthLabels;
			return y;
		},

		getX: function(value) {
			//console.log(value, this.axis.getActualMin())
			var x = Math.round(1000*(((value - this.axis.getActualMin()) / (this.axis._getActualInterval())) * (this.axis.getMaxPx() - this.axis.getMinPx()) + this.axis.getMinPx())) / 1000;	
			//if((this.axis.isFlipped() && (x < this.axis.getMaxPx() || x > this.axis.getMinPx())) || (!this.axis.isFlipped() && (x > this.axis.getMaxPx() || x < this.axis.getMinPx())))
			//	return;
			return x;
		},

		bindLabelHandlers: function(label) {
			var self = this;

			function clickHandler(e) {
				if(self.axis.currentAction !== false)
					return;
				self.axis.currentAction = 'labelDragging';
				e.stopPropagation();
				label.dragging = true;
				var coords = self.graph.getXY(e);
				label.draggingIniX = coords.x;
				label.draggingIniY = coords.y;
				self.labelDragging = label;
			}


			function clickHandlerMain(e) {
				if(self.axis.currentAction !== false)
					return;
				self.axis.currentAction = 'labelDraggingMain';
				e.preventDefault();
				e.stopPropagation();
				self.labelDragging = label;
			}
			
			label.labelDom.addEventListener('mousedown', clickHandler);
			label.rect.addEventListener('mousedown', clickHandler);
			label.rect.addEventListener('click', function(e) {
				e.preventDefault();
				e.stopPropagation();
			});

			label.labelDom.addEventListener('click', function(e) {
				e.preventDefault();
				e.stopPropagation();
			});


			label.path.addEventListener('click', function(e) {
				e.preventDefault();
				e.stopPropagation();
			});

			label.path.addEventListener('mousedown', clickHandlerMain);
		}
	});

	var GraphSerieAxisY = function() {};
	$.extend(GraphSerieAxisY.prototype, GraphSerie.prototype, GraphSerieAxis.prototype, {
		
		getX: function(value) {
			
			var x = - Math.round(1000 * (((value - this.minY) / (this.maxY - this.minY)))) / 1000  * (this.axis.totalDimension - this.axis._widthLabels) - this.axis._widthLabels - 5;
			return x;
		},

		getY: function(value) {
			
			var y = Math.round(1000*(((value - this.axis.getActualMin()) / (this.axis._getActualInterval())) * (this.axis.getMaxPx() - this.axis.getMinPx()) + this.axis.getMinPx())) / 1000;
			//if((this.axis.isFlipped() && y < this.axis.getMaxPx() || y > this.axis.getMinPx()) || (!this.axis.isFlipped() && (y > this.axis.getMaxPx() || y < this.axis.getMinPx())))
		//		return;
			return y;
		},


		getMinX: function() {
			return this.minY;
		},

		getMaxX: function() {
			return this.maxY;
		},

		getMinY: function() {
			return this.minX;
		},

		getMaxY: function() {
			return this.maxX;
		}

	});

	var GraphSerieContour = function() {
		this.accumulatedDelta = 0;
		this.threshold = 0;
	};

	$.extend(GraphSerieContour.prototype, GraphSerie.prototype, {

		setData: function(data, arg, type) {

			var z = 0;
			var x, dx, arg = arg || "2D", type = type || 'float', i, l = data.length, arr, datas = [];
			if(!data instanceof Array)
				return;
			for(var i = 0; i < l; i++) {
				k =  k = data[i].lines.length;
				arr = this._addData(type, k);
				for(var j = 0; j < k; j+=2) {
					arr[j] = data[i].lines[j];
					this._checkX(arr[j]);
					arr[j+1] = data[i].lines[j+1];
					this._checkY(arr[j+1]);
				}

				datas.push({lines: arr, zValue: data[i].zValue});
			}
			this.data = datas;
		},


		draw: function(doNotRedrawZone) {


			var x, y, xpx, ypx, i = 0, l = this.data.length, j = 0, k, m, currentLine, domLine, arr;
			this.minZ = -Number.MAX_VALUE;
			this.maxZ = Number.MAX_VALUE;

			var next = this.groupLines.nextSibling;
			this.groupMain.removeChild(this.groupLines);
			this.zValues = {};

			var incrXFlip = 0;
			var incrYFlip = 1;
			if(this.getFlip()) {
				incrXFlip = 0;
				incrYFlip = 1;
			}

			for(; i < l ; i++) {

				j = 0, k = 0, currentLine = "";
				for(arr = this.data[i].lines, m = arr.length; j < m; j+=4) {

				
					xpx = this.getX(arr[j + incrXFlip]);
					ypx = this.getY(arr[j + incrYFlip]);
				
					
					currentLine += "M";
					currentLine += xpx;
					currentLine += " ";
					currentLine += ypx;


					
					xpx = this.getX(arr[j + 2 + incrXFlip]);
					ypx = this.getY(arr[j + 2 + incrYFlip]);
					
					currentLine += "L";
					currentLine += xpx;
					currentLine += " ";
					currentLine += ypx;

					k++;
				}
				domLine = this._createLine(currentLine, i, k);
				domLine.setAttribute('data-zvalue', this.data[i].zValue);
				this.zValues[this.data[i].zValue] = {dom: domLine};
				this.minZ = Math.max(this.minZ, this.data[i].zValue);
				this.maxZ = Math.min(this.maxZ, this.data[i].zValue);
			}
			i++;
			for(; i < this.lines.length; i++) {
				this.groupLines.removeChild(this.lines[i]);
				this.lines.splice(i, 1);
			}
			this.groupMain.insertBefore(this.groupLines, next);
		},

		handleMouseWheel: function(delta, e) {
			this.accumulatedDelta = Math.min(1, Math.max(-1, this.accumulatedDelta + Math.min(0.1, Math.max(-0.1, delta))));
			this.threshold = Math.max(-this.minZ, this.maxZ) * (Math.pow(this.accumulatedDelta, 3));
			for(var i in this.zValues) {
				if(Math.abs(i) < this.threshold) {
					this.zValues[i].dom.setAttribute('display', 'none');
				} else {
					this.zValues[i].dom.setAttribute('display', 'block');
				}
			}
		}
	});


	var GraphShape = function() {

	}

	GraphShape.prototype = {

		init: function(graph) {
			this.graph = graph;
			this.properties = {};
			this.saved = {};
			this.group = document.createElementNS(this.graph.ns, 'g');

			this.createDom();
			this.setEvents();
			
			this._makeLabel();

			this.rectEvent = document.createElementNS(this.graph.ns, 'rect');
			this.rectEvent.setAttribute('pointer-events', 'fill');
			this.rectEvent.setAttribute('fill', 'transparent');

			this.group.appendChild(this._dom);
			this.group.appendChild(this.rectEvent);
			this.group.appendChild(this.label);

			this.graph.shapeZone.appendChild(this.group);
		},

		setOriginalData: function(data, events) {
			this.data = data;
			this.events = events;
		},

		triggerChange: function() {
			if(this.events && this.events.onChange)
				this.events.onChange(this.data);	
		},

		setEvents: function() {},

		setBBox: function() {

			this.group.removeChild(this.rectEvent);
			var box = this.group.getBBox();
			this.rectEvent.setAttribute('x', box.x);
			this.rectEvent.setAttribute('y', box.y - 10);
			this.rectEvent.setAttribute('width', box.width);
			this.rectEvent.setAttribute('height', box.height + 20);

			this.group.appendChild(this.rectEvent);
		},

		setMouseOver: function(callback) {
			this.rectEvent.addEventListener('mouseover', callback);
		},

		kill: function() {
			if(!this._inDom)
				return;
			this.graph.shapeZone.removeChild(this.group);
		},

	/*	applyAll: function() {
			for(var i in this.properties)
				this._dom.setAttribute(i, this.properties[i]);
		},
*/
		draw: function() {

			this.setFillColor();
			this.setStrokeColor();
			this.setStrokeWidth();
			this.setDashArray();

			if(this.get('labelPosition')) {
				this.setLabelText();
				this.setLabelSize();
			}

			if(this.get('labelAnchor'))
				this._forceLabelAnchor();
		},

		redraw: function() {
		//	this.kill();
			var variable;
			this.position = this.setPosition();
			this.redrawImpl();

			if(!this.position)
				return;

			if(this.get('labelPosition')) {
				this.setLabelPosition();
//				this.group.appendChild(this.label);
			}
		
		
			if(this.afterDone)
				this.afterDone();
		//	this.done();
		},

		redrawImpl: function() {},

		done: function() {
			//this.applyAll();
			//;
			
			
		},

		setSerie: function(serie) {			this.serie = serie;								},
		set: function(prop, val) {			this.properties[prop] = val;					},
		get: function(prop) {				return this.properties[prop];					},

		getFromData: function(prop)			{ return this.data[prop]; 						},
		setDom: function(prop, val) {		this._dom.setAttribute(prop, val);				},

		setPosition: function() {
			var position = this._getPosition(this.getFromData('pos'));
			this.setDom('x', position.x);
			this.setDom('y', position.y);
		},

		setFillColor: function() {			this.setDom('fill', this.get('fillColor'));					},
		setStrokeColor: function() {		this.setDom('stroke', this.get('strokeColor'));				},
		setStrokeWidth: function() {		this.setDom('stroke-width', this.get('strokeWidth'));		},
		setDashArray: function() {			this.setDom('stroke-dasharray', this.get('strokeDashArray'));				},

		setLabelText: function() {	 		if(this.label) this.label.textContent = this.data.label.text;					},
		setLabelSize: function() {			if(this.label) this.label.setAttribute('font-size', this.get('labelSize'))		},
		setLabelPosition: function() {		if(this.label) this._setLabelPosition();										},
		
		highlight: function() {
			this.tempStrokeWidth = parseInt(this._dom.getAttribute('stroke-width').replace('px', ''));
			this.setDom('stroke-width', this.tempStrokeWidth + 2);
			this.highlightImpl();
		},

		unHighlight: function() {
			this.setDom('stroke-width', this.tempStrokeWidth);
			this.unHighlightImpl();
		},

		highlightImpl: function() {},
		unHighlightImpl: function() {},

		_getPosition: function(value, relTo) {
			var parsed, pos = {x: false, y: false};

			for(var i in pos) {
				if(value[i] === undefined && value['d' + i] === undefined) {
					if(i == 'x')
						pos[i] = relTo ? relTo[i] : this.serie[i == 'x' ? 'getXAxis' : 'getYAxis']().getPos(0);
					else {
						var closest = this.serie.searchClosestValue(value.x);
						pos[i] = closest.yMin;
					}
				} else if(value[i] !== undefined) {
					if((parsed = this._parsePx(value[i])) !== false)
						pos[i] = parsed; // return integer (will be interpreted as px)
					else if(parsed = this._parsePercent(value[i]))
						pos[i] = parsed; // returns xx%
					else if(this.serie)
						pos[i] = this.serie[i == 'x' ? 'getXAxis' : 'getYAxis']().getPos(value[i]);
				} 

				if(value['d' + i]) {

					var def = (value[i] !== undefined || relTo == undefined || relTo[i] == undefined) ? pos[i] : (this._getPositionPx(relTo[i], true) || 0);
					if((parsed = this._parsePx(value['d' + i])) !== false) { // dx in px => val + 10px
						pos[i] = def + parsed;  // return integer (will be interpreted as px)
					} else if(parsed = this._parsePercent(value['d' + i]))
						pos[i] = def + this._getPositionPx(parsed, true); // returns xx%
					else if(this.serie)
						pos[i] = def + this.serie[i == 'x' ? 'getXAxis' : 'getYAxis']().getRelPx(value['d' + i]); // px + unittopx
				}
			}
			return pos;
		},

		_getPositionPx: function(value, x) {
			if(parsed = this._parsePx(value))
				return parsed; // return integer (will be interpreted as px)
			if(parsed = this._parsePercent(value))
				return parsed / 100 * (x ? this.graph.getDrawingWidth() : this.graph.getDrawingHeight());
			else if(this.serie)
				return this.serie[x ? 'getXAxis' : 'getYAxis']().getPos(value);
		},


		_parsePx: function(px) {
			if(px && px.indexOf && px.indexOf('px') > -1)
				return parseInt(px.replace('px', ''));
			return false;
		},

		_parsePercent: function(percent) {
			if(percent && percent.indexOf && percent.indexOf('px') > -1)
				return percent;
			return false;	
		},

		_makeLabel: function() {
			var self = this;
			this.label = document.createElementNS(this.graph.ns, 'text');
			this.label.addEventListener('dblclick', function(e) {
				e.preventDefault();
				e.stopPropagation();

				$('<input type="text" />').attr('value', e.target.textContent).prependTo(self.graph._dom).css({
					position: 'absolute',
					'margin-top': (parseInt(e.target.getAttribute('y').replace('px', '')) - 10) + "px",
					'margin-left': (parseInt(e.target.getAttribute('x').replace('px', '')) - 50) + "px",
					textAlign: 'center',
					width: '100px'
				}).on('blur', function() {
					$(this).remove();
					//self.label.textContent = ;
					self.data.label.text = $(this).attr('value');
					self.triggerChange();
				}).on('keyup', function(e) {
					if(e.keyCode == 13)
						$(this).trigger('blur');
				}).focus();

			});
		},

		_setLabelPosition: function(pos) {
			var currPos = this.getFromData('pos');
			var parsedCurrPos = this._getPosition(currPos);
			if(!pos)
				var pos = this._getPosition(this.get('labelPosition'), currPos);

			this.label.setAttribute('x', pos.x);
			this.label.setAttribute('y', pos.y);
			//this.label.setAttribute('text-anchor', pos.x < parsedCurrPos.x ? 'end' : (pos.x == parsedCurrPos.x ? 'middle' : 'start'));
			this.label.setAttribute('dominant-baseline', pos.y < parsedCurrPos.y ? 'no-change' : (pos.y == parsedCurrPos.y ? 'middle' : 'hanging'));
		},

		_forceLabelAnchor: function() {
			this.label.setAttribute('text-anchor', this.get('labelAnchor'))
		}
	}

	var GraphRect = function(graph) {
		this.init(graph);
	}

	$.extend(GraphRect.prototype, GraphShape.prototype, {
		
		createDom: function() {
			this._dom = document.createElementNS(this.graph.ns, 'rect');
		},

		setWidthPx: function(px) {		this.set('width', px);	},
		setHeightPx: function(px) {		this.set('height', px);	},
		setFullWidth: function() {
			this.set('x', Math.min(this.serie.getXAxis().getMinPx(), this.serie.getXAxis().getMaxPx()));
			this.set('width', Math.abs(this.serie.getXAxis().getMaxPx() - this.serie.getXAxis().getMinPx()));
		},
		setFullHeight: function() {
			this.set('y', Math.min(this.serie.getYAxis().getMinPx(), this.serie.getYAxis().getMaxPx()));
			this.set('height', Math.abs(this.serie.getYAxis().getMaxPx() - this.serie.getYAxis().getMinPx()));
		},

		redrawImpl: function() {
			this.setDom('width', this.get('width'));
			this.setDom('height', this.get('height'));
		}
	});

	var GraphLine = function(graph) {
		this.init(graph);
	}
	$.extend(GraphLine.prototype, GraphShape.prototype, {
		createDom: function() {
			this._dom = document.createElementNS(this.graph.ns, 'line');
		},

		setPosition: function() {
			var position = this._getPosition(this.getFromData('pos'));
			this.setDom('x2', position.x);
			this.setDom('y2', position.y);
		},

		setPosition2: function() {
			var position = this._getPosition(this.getFromData('pos2'), this.getFromData('pos'));
			this.setDom('x1', position.x);
			this.setDom('y1', position.y);
		},

		redrawImpl: function() {
			this.setPosition();
			this.setPosition2();
		}
	});


	var GraphArrow = function(graph) {
		this.init(graph);
	}

	$.extend(GraphArrow.prototype, GraphLine.prototype, {
		createDom: function() {
			this._dom = document.createElementNS(this.graph.ns, 'line');
			this._dom.setAttribute('marker-end', 'url(#arrow' + this.graph._creation + ')');
		},

		setLabelPosition: function() {
			this._setLabelPosition();
			var pos = this._getPosition(this.get('labelPosition'), this.getFromData('pos'));
			this.set('x1', pos.x);
			this.set('y1', pos.y);
		}
	});

	var GraphShapeVerticalLine = function() { this.init(graph); };
	$.extend(GraphShapeVerticalLine.prototype, GraphLine.prototype, {

		setEvents: function() {

			this._dom.addEventListener('mousedown', function(e) {
				e.preventDefault();
				e.stopPropagation();
				self.handleMouseDown(e);
			});

			this._dom.addEventListener('mousemove', function(e) {
				e.preventDefault();
				e.stopPropagation();
				self.handleMouseMove(e);
			});

			this._dom.addEventListener('mouseup', function(e) {
				e.preventDefault();
				e.stopPropagation();
				self.handleMouseUp(e);
			});
		},

		handleMouseDown: function() {
			this.moving = true;
			this.graph.annotationMoving(this);
		},

		handleMouseMove: function(e) {
			if(!this.moving)
				return;
			var coords = this.graph.getXY(e),
				delta = this.serie.getXAxis().getRelPx(coords.x - this.coordsI.x),
				pos = this.getFromData('pos');
				pos.x += delta;
			this.setPosition();
/*
			if(this.graph.options.onVerticalTracking)
				this.options.onVerticalTracking(line.id, val, line.dasharray);*/
		},

		setPosition: function() {
			var position = this._getPosition(this.getFromData('pos'));
			this.setDom('x1', position.x);
			this.setDom('x2', position.x);
			this.setDom('y1', this.graph.getYAxis().getMinPx());
			this.setDom('y2', this.graph.getYAxis().getMaxPx());
		}
	})


	var GraphPeakInterval = function(graph) {
		this.init(graph);
	}
	
	$.extend(GraphPeakInterval.prototype, GraphLine.prototype, {
		createDom: function() {
			this._dom = document.createElementNS(this.graph.ns, 'line');
			this._dom.setAttribute('marker-end', 'url(#verticalline' + this.graph._creation + ')');
			this._dom.setAttribute('marker-start', 'url(#verticalline' + this.graph._creation + ')');
		},

		setLabelPosition: function() {
			var pos1 = this._getPosition(this.getFromData('pos'));
			var pos2 = this._getPosition(this.getFromData('pos2'), this.getFromData('pos'));
			this._setLabelPosition(this._getPosition(this.get('labelPosition'), {x: (pos1.x + pos2.x) / 2 + "px", y: (pos1.y + pos2.y) / 2 + "px" }));
			
		},

		afterDone: function() {
			
		}
	});


	$.extend(GraphPeakInterval.prototype, GraphLine.prototype, {
		createDom: function() {

			this._dom = document.createElementNS(this.graph.ns, 'path');

			this.handle1 = document.createElementNS(this.graph.ns, 'line');
			this.handle1.setAttribute('stroke-width', '3');
			this.handle1.setAttribute('stroke', 'transparent');
			this.handle1.setAttribute('pointer-events', 'stroke');
			this.handle1.setAttribute('cursor', 'ew-resize');

			this.handle2 = document.createElementNS(this.graph.ns, 'line');
			this.handle2.setAttribute('stroke-width', '3');
			this.handle2.setAttribute('stroke', 'transparent');
			this.handle2.setAttribute('pointer-events', 'stroke');
			this.handle2.setAttribute('cursor', 'ew-resize');

			this.setDom('cursor', 'move');
			this.doDraw = undefined;
			
		},

		setEvents: function() {
			var self = this;
			this._dom.addEventListener('mousedown', function(e) {
				e.preventDefault();
				e.stopPropagation();
				self.handleMouseDown(e);
			});

			this.handle1.addEventListener('mousedown', function(e) {
				e.preventDefault();
				e.stopPropagation();
				self.handleMouseDown(e, 1);
			});

			this.handle2.addEventListener('mousedown', function(e) {
				e.preventDefault();
				e.stopPropagation();
				self.handleMouseDown(e, 2);
			});

			this._dom.addEventListener('mousemove', function(e) {
				e.preventDefault();
				e.stopPropagation();
				self.handleMouseMove(e);
			});

			this._dom.addEventListener('mouseup', function(e) {
				e.preventDefault();
				e.stopPropagation();
				self.handleMouseUp(e);
			});
		},

		handleMouseDown: function(e, resize) {

			this.graph.shapeZone.appendChild(this.group);
			if(!resize) {
				this.coordsI = this.graph.getXY(e);
				this.moving = true;
			} else {
				this.resize = resize;
				this.resizingPosition = ((this.reversed && resize == 2) || (!this.reversed && resize == 1)) ? this.getFromData('pos') : this.getFromData('pos2');
			}

			this.graph.annotationMoving(this);
		},

		handleMouseUp: function() {
			this.moving = false;
			this.resize = false;
			this.graph.annotationMoving(false);

			this.triggerChange();
		},

		handleMouseMove: function(e) {

			if(this.moving) {
				var coords = this.graph.getXY(e);
				var delta = this.serie.getXAxis().getRelPx(coords.x - this.coordsI.x);
				var pos1 = this.getFromData('pos');
				var pos2 = this.getFromData('pos2');
				pos1.x += delta;
				pos2.x += delta;
				
				this.coordsI = coords;
				this.setPosition();
				this.redrawImpl();
			} else if(this.resize) {
				var value = this.serie.searchClosestValue(this.serie.getXAxis().getVal(this.graph.getXY(e).x - this.graph.getPaddingLeft()));
				this.setPosition();
				this.resizingPosition.x = value.xMin;
				this.redrawImpl();
			}
		},

		redrawImpl: function() {
			//var doDraw = this.setPosition();
		//	this.setDom('fill', 'url(#' + 'patternFill' + this.graph._creation + ')')
			if(this.position != this.doDraw) {
				this.group.setAttribute("visibility", this.position ? "visible" : 'hidden');
				this.doDraw = this.position;
			}
		},

		setPosition: function() {
			
			var posXY = this._getPosition(this.getFromData('pos')),
				posXY2 = this._getPosition(this.getFromData('pos2'), this.getFromData('pos')),
				w = Math.abs(posXY.x - posXY2.x),
				x = Math.min(posXY.x, posXY2.x);

			this.reversed = x == posXY2.x;

			if(w < 2 || x + w < 0 || x > this.graph.getDrawingWidth()) {
				return false;
			}

			this.group.appendChild(this.handle1);
			this.group.appendChild(this.handle2);


			var v1 = this.serie.searchClosestValue(this.getFromData(this.reversed ? 'pos2' : 'pos').x),
				v2 = this.serie.searchClosestValue(this.getFromData(this.reversed ? 'pos' : 'pos2').x),
				i, 
				j, 
				init, 
				max, 
				k, 
				x, 
				y, 
				firstX, 
				firstY, 
				currentLine;


			if(!v1 || !v2)
				return false;
			for(i = v1.dataIndex; i <= v2.dataIndex ; i++) {
				currentLine = "M ";
				init = i == v1.dataIndex ? v1.xBeforeIndexArr : 0;
				max = i == v2.dataIndex ? v2.xBeforeIndexArr : this.serie.data[j].length;
				k = 0;
				for(j = init; j <= max; j+=2) {
					x = this.serie.getX(this.serie.data[i][j + 0]),
					y = this.serie.getY(this.serie.data[i][j + 1]);
					if(j == init) {
						firstX = x;
						firstY = y;
					}
					currentLine = this.serie._addPoint(currentLine, x, y, k);
					k++;
				}

				if(!firstX || !firstY || !x || !y)
					return;

				this.handle1.setAttribute('x1', firstX);
				this.handle1.setAttribute('x2', firstX);

				this.handle2.setAttribute('x1', x);
				this.handle2.setAttribute('x2', x);

				this.handle1.setAttribute('y1', firstY);
				this.handle1.setAttribute('y2', this.serie.getY(0));

				this.handle2.setAttribute('y1', y);
				this.handle2.setAttribute('y2', this.serie.getY(0));


				currentLine += " V " + this.serie.getYAxis().getPx(0) + " H " + firstX + " z";
				this.setDom('d', currentLine);
			}
			
			return true;
		},


		setLabelPosition: function() {

			var pos1 = this._getPosition(this.getFromData('pos')),
				pos2 = this._getPosition(this.getFromData('pos2'), this.getFromData('pos'));

			this._setLabelPosition(this._getPosition(this.get('labelPosition'), {x: (pos1.x + pos2.x) / 2 + "px", y: (pos1.y + pos2.y) / 2 + "px" }));
			
		},

		afterDone: function() {
			
		}
	});



	var GraphRangeX = function(graph) { this.init(graph); };
	$.extend(GraphRangeX.prototype, GraphPeakInterval.prototype, {

		createDom: function() {
			this._dom = document.createElementNS(this.graph.ns, 'rect');
			this._dom.setAttribute('class', 'rangeRect');
			this._dom.setAttribute('cursor', 'move');
			this.handle1 = this._makeHandle();
			this.handle2 = this._makeHandle();
			
			this.setDom('cursor', 'move');
			this.doDraw = undefined;	
		},

		setPosition: function() {
			var posXY = this._getPosition(this.getFromData('pos')),
				posXY2 = this._getPosition(this.getFromData('pos2'), this.getFromData('pos')),
				w = Math.abs(posXY.x - posXY2.x),
				x = Math.min(posXY.x, posXY2.x);
			this.reversed = x == posXY2.x;

			if(w < 2 || x + w < 0 || x > this.graph.getDrawingWidth()) {
				return false;
			}

			this.group.appendChild(this.handle1);
			this.group.appendChild(this.handle2);

			this.handle1.setAttribute('transform', 'translate(' + (x - 6) + " " + ((this.graph.getDrawingHeight() - this.graph.shift[0]) / 2 - 10) + ")");
			this.handle2.setAttribute('transform', 'translate(' + (x + w - 6) + " " + ((this.graph.getDrawingHeight() - this.graph.shift[0]) / 2 - 10) + ")");
			this.setDom('x', x);
			this.setDom('width', w);
			this.setDom('y', 0);
			this.setDom('height', this.graph.getDrawingHeight() - this.graph.shift[0]);

			return true;
		},

		_makeHandle: function() {


			var rangeHandle = document.createElementNS(this.graph.ns, 'g');
			rangeHandle.setAttribute('id', "rangeHandle" + this.graph._creation);
			var r = document.createElementNS(this.graph.ns, 'rect');
			r.setAttribute('rx', 0);
			r.setAttribute('ry', 0);
			r.setAttribute('stroke', 'black');
			r.setAttribute('fill', 'white');

			r.setAttribute('width', 10);
			r.setAttribute('height', 20);
			r.setAttribute('x', 0);
			r.setAttribute('y', 0);
			r.setAttribute('shape-rendering', 'crispEdges');
			r.setAttribute('cursor', 'ew-resize');
			rangeHandle.appendChild(r);


			var l = document.createElementNS(this.graph.ns, 'line');
			l.setAttribute('x1', 4);
			l.setAttribute('x2', 4);
			l.setAttribute('y1', 4);
			l.setAttribute('y2', 18);
			l.setAttribute('stroke', 'black');
			l.setAttribute('shape-rendering', 'crispEdges');
			l.setAttribute('cursor', 'ew-resize');
			rangeHandle.appendChild(l);

			var l = document.createElementNS(this.graph.ns, 'line');
			l.setAttribute('x1', 6);
			l.setAttribute('x2', 6);
			l.setAttribute('y1', 4);
			l.setAttribute('y2', 18);
			l.setAttribute('stroke', 'black');
			l.setAttribute('shape-rendering', 'crispEdges');
			l.setAttribute('cursor', 'ew-resize');
			rangeHandle.appendChild(l);

			return rangeHandle;
		}
	});

	Graph.GraphSerie = GraphSerie;
	Graph.GraphXAxis = GraphXAxis;
	Graph.GraphYAxis = GraphYAxis;

	return Graph;
});
