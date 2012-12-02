 /*
 * view.js
 * version: dev
 *
 * Copyright 2012 Norman Pellet - norman.pellet@epfl.ch
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */


if(typeof CI.Module.prototype._types.spectra_displayer == 'undefined')
	CI.Module.prototype._types.spectra_displayer = {};

CI.Module.prototype._types.spectra_displayer.View = function(module) {
	this.module = module;
}

CI.Module.prototype._types.spectra_displayer.View.prototype = {
	
	init: function() {
		
		this.colorvars = [];
		this.dom = $('<canvas id="' + BI.Util.getNextUniqueId() + '"></canvas>');
		this.module.getDomContent().html(this.dom);
	},
	
	inDom: function() {
	

	},
	
	onResize: function(width, height) {
		var data;
		if((data = this.dom.data('spectra')) != undefined) {
			data.resize(width, height - 5);
		}
	},
	
	onProgress: function() {
		this.dom.html("Progress. Please wait...");
	},

	blank: function() {
		this.dom.html("");
	},

	update2: { 

		'fromTo': function(moduleValue) {
			var view = this;

			if(moduleValue === undefined || moduleValue.value === undefined)
				return;

			if(view.dom.data('spectra'))
				view.dom.data('spectra').setBoundaries(moduleValue.value.from, moduleValue.value.to);
			return;
		},

		zoneHighlight: function(val) {
/*
			if(!val)
				return;

			this._highlightingZone = val;
			if(this._jcampValue)
				this.update2.jcamp.call(this, this._jcampValue);*/
		},

		'jcamp': function(moduleValue, varname) {
			var cfgM = this.module.getConfiguration();
			if(!(cfgM.plotcolor instanceof Array))
				cfgM.plotcolor = [cfgM.plotcolor];

			CI.RepoHighlight.kill(this.module.id + "_" + varname);
			var index;
			if((index = this.colorvars.indexOf(varname)) <= -1) {
				index = this.colorvars.length;
				this.colorvars.push(varname);
			}

			var color = cfgM.plotcolor[index] || 'black';
				
			this._jcampValue = moduleValue;
			var view = this;
			
			var cfg = {
				continuous: (cfgM.mode == 'curve'), 
				flipX: cfgM.flipX, 
				flipY: cfgM.flipY, 
				plotcolor: color,
				dom: this.dom,
				spectraid: varname
			};
			// Display the jcamp to the screen using the value and the module ref

			CI.DataType.toScreen(moduleValue, this.module, cfg).done(function(val) {
				
				if(view.dom.data('spectra'))
					view.dom.data('spectra').onZoomChange = function(minX, maxX) {
						view.module.controller.zoomChanged(minX, maxX);
					};

				view.module.updateView('fromTo');
				//view.update2.fromTo(CI.Repo.getValue(''));
				//CI.Util.ResolveDOMDeferred(view.module.getDomContent());
				CI.Grid.moduleResize(view.module);			
			});
		}
	},
	
	getDom: function() {
		return this.dom;
	},
	
	typeToScreen: {
		
		
		asString: function(val) {
			return val;
		}
		
	}
}
 
