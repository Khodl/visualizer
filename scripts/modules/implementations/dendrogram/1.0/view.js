 /*
 * view.js
 * version: dev
 *
 * Copyright 2012 Norman Pellet - norman.pellet@epfl.ch
 * Copyright 2013 Luc Patiny - luc.patiny@epfl.ch
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

 
if(typeof CI.Module.prototype._types.dendrogram == 'undefined')
	CI.Module.prototype._types.dendrogram = {};

CI.Module.prototype._types.dendrogram.View = function(module) {
	this.module = module;
}

CI.Module.prototype._types.dendrogram.View.prototype = {
	
	init: function() {
		console.log("Dendrogram: init");

		// When we change configuration the method init is called again. Also the case when we change completely of view
		if (! this.dom) {
			this._id = BI.Util.getNextUniqueId();
			this.dom = $('<div id="' + this._id + '"></div>').css('height', '100%').css('width', '100%');
			this.module.getDomContent().html(this.dom);
		}

		if (this.dom) {
			// in the dom exists and the preferences has been changed we need to clean the canvas
			this.dom.empty();
			
		}
		if (this._rgraph) { // if the dom existedd there was probably a rgraph or when changing of view
			delete this._rgraph;
		}
		this._highlighted = {};
		// this.typeToScreen.molfile2D = this.typeToScreen.dendrogram;
		this.updateOptions();
	},
	

	inDom: function() {
		console.log("Dendrogram: inDom");
		// if(this._value === undefined) return;
	},

	onResize: function(width, height) {
		console.log("Dendrogram: onResize");
		this.createDendrogram();
		this.updateDendrogram();
	},
	

	/* When a vaue change this method is called. It will be called for all 
	possible received variable of this module.
	It will also be called at the beginning and in this case the value is null !
	*/
	update2: {
		'dendrogram': function(moduleValue) {
			console.log("Dendrogram: update2");


			if (! moduleValue || ! moduleValue.value) return;

			this._value = moduleValue.value;

			if (! this._rgraph) {
				if (!document.getElementById(this._id)) return; // this is the case when we change of view
				this.createDendrogram();
			} 

			this.updateDendrogram();

			// ???????? why the following code does not work
			var view=this;
			CI.DataType.toScreen(moduleValue, this.module, this._id).done(function(dendrogram) {
				view._value = dendrogram;
				view.updateDendrogram();
			});
		}
	},
	
	updateDendrogram: function() {
		console.log("Dendrogram: updateDendrogram");
		if (!this._rgraph || !this._value) return;

	    this._rgraph.loadJSON(this._value);

	    // in each node we had the content of "label"
	    $jit.Graph.Util.each(this._rgraph.graph, function(node) {
	    	if (node.data && node.data.label) {
	    		node.name=node.data.label
	    	} else {
	    		node.name="";
	    	}
		});  

	//    this._rgraph.compute('end');

	    this._rgraph.refresh();



	},

	updateOptions: function() {
 		var cfg = this.module.getConfiguration();

		this._options={
			nodeSize: cfg.nodeSize || 1,
			nodeColor: cfg.nodeColor || "yellow",
		}
	},

	createDendrogram: function() {
		console.log("Dendrogram: createDendrogram");
		// ?????? how to put this in the model ?????
    	var actions=this.module.definition.dataSend;
    	if (! actions || actions.length==0) return;
    	var hover=function() {}
    	for (var i=0; i<actions.length; i++) {
    		if (actions[i].event=="onHover") {
    			var jpath=actions[i].jpath;
    			var name=actions[i].name;
    			hover=function(node) {
    				CI.API.setSharedVarFromJPath(name, node, jpath);
    			}
    		}
    	}


		var cfg = this.module.getConfiguration();

		this.dom.empty();

		var options=this._options;
		this._rgraph = new $jit.RGraph({
	        injectInto: this._id,
		//	withLabels: true,
	     	levelDistance: 50,
	        //Optional: create a background canvas that plots
	        //concentric circles.
	        background: {
	          CanvasStyles: {
	            strokeStyle: cfg.strokeStyle || '#555'
	          }
	        },
	        
	     	// onCreateLabel: function(domElement, node){},
			// onPlaceLabel: function(domElement, node){},
			/*
	        NodeStyles: {  
			    enable: false,  
			    type: 'Native',  
			    stylesHover: {  
			      CanvasStyles: {
			      	shadowColor: '#ccc',  
		      		shadowBlur: 10
		      	  }
			    },  
			    duration: 0  
			  },
			*/

	        //Add navigation capabilities:
	        //zooming by scrolling and panning.
	        Navigation: {
	          enable: true,
	          panning: true,
	          zooming: 50
	        },
	        //Set Node and Edge styles.
	        
	        Edge: {
	          color: cfg.lineColor || 'green',
	          lineWidth: cfg.lineWidth || 0.5
	        },
	        Label: {  
			  overridable: true,  
			  type: 'Native', //'SVG', 'Native', "HTML" 
			  size: cfg.labelSize || 10,  
			  family: 'sans-serif',  
			  textAlign: 'center',  
			  textBaseline: 'alphabetic',  
			  color: cfg.labelColor || "black"  
			},
			Node: {  
			  overridable: true,  
			  type: cfg.nodeType || "circle",  
			  color: cfg.nodeColor || "yellow",  
			  dim: cfg.nodeSize || 3,  
			  height: 20,  
			  width: 90
			},
	 	 	Events: {
	 	 		getRgraph: function(e) {
	 	 			var src=e.srcElement.id.replace(/-.*/,"");
	 	 			if ($jit.existingInstance[src]) return $jit.existingInstance[src];
	 	 			// maybe we clicked on a label
	 	 			src=e.srcElement.parentElement.id.replace(/-.*/,"");
	 	 			if ($jit.existingInstance[src]) return $jit.existingInstance[src];
	 	 			return;
	 	 		},
	 	 		enable: true,
	 	 		enableForEdges: true,
			    type: 'Native', // otherwise the events are only on the labels (if auto)
	//		    onRightClick: function(node, eventInfo, e) {},
			    onClick: function(node, eventInfo, e) {
			    	if (! node) return;
			    	var rgraph=this.getRgraph(e);
					if (node.nodeFrom) { // click on an edge
						var subgraph=$jit.json.getSubtree(rgraph.json, node.nodeFrom.id);
						rgraph.loadJSON(subgraph);
						$jit.Graph.Util.each(rgraph.graph, function(node) {
					    	if (node.data && node.data.label) {
					    		node.name=node.data.label
					    	} else {
					    		node.name="";
					    	}
						});  
		   				rgraph.refresh();
					} else {	// click on a node
						rgraph.onClick(node.id);
					}
			    },
	//		    onMouseMove: function(node, eventInfo, e) {},
			    onMouseEnter: function(node, eventInfo, e) {
			    	hover(node);
			    	this.getRgraph(e).canvas.getElement().style.cursor = 'pointer'; 
			    },
			    onMouseLeave: function(node, eventInfo, e) {
			    	this.getRgraph(e).canvas.getElement().style.cursor = '';  
			    },
	    	},
	  		Tips: {
	      		enable: false,
	     	}
	    });

 		// we store in a cache to have access to the rgraph from an ID
 		$jit.existingInstance=$jit.existingInstance || {};
 		$jit.existingInstance[this._id]=this._rgraph;



	},
	
	getDom: function() {
		console.log("Dendrogram: getDom");
		return this.dom;
	},
	
	_doHighlight: function(id, val) {
		console.log("Dendrogram: _doHighlight");
		if(this._highlighted[id] && val)
			return;
		if(!this._highlighted[id] && !val)
			return;
		this._highlighted[id] = val;
		for(var i in this._currentValue._atoms) {
			if(this._currentValue._atoms[i].indexOf(id) > -1) {
				CI.RepoHighlight.set(i, val);
			}
		}
	},

	typeToScreen: {
		// ?????????????? A quoi cela sert ????
	}
}

 