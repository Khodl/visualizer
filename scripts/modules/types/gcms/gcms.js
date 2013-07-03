
define(['jquery', 'libs/plot/plot'], function($, Graph) {

	



	var gcms = function() {




	}

	gcms.prototype = {

		inDom: function(domGc, domMs) {

			var self = this;
			var optionsGc = {

				paddingTop: 5,
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
				zoomMode: 'x',
				defaultMouseAction: 'rangeX',
				defaultWheelAction: 'none',
				lineToZero: false,

				onRangeX: function(xStart, xEnd) {
					var indexStart = self.gcSerie.searchClosestValue(xStart).xBeforeIndex;
					var indexEnd = self.gcSerie.searchClosestValue(xEnd).xBeforeIndex;
					var indexMin = Math.min(indexStart, indexEnd);
					var indexMax = Math.max(indexStart, indexEnd);


					var obj = {}, allMs = [];

					for(var i = indexMin; i <= indexMax; i++) {
						
						for(var j = 0; j < self.msData[i].length; j+=2) {

							if(obj[self.msData[i][j]] !== undefined)
								obj[self.msData[i][j]] += self.msData[i][j+1];
							else {
								obj[self.msData[i][j]] = self.msData[i][j+1];
								allMs.push(self.msData[i][j]);

							}
						}
					}
					
					allMs.sort(function(a, b) { return a -b; });

					var finalMs = [];
					for(var i = 0; i < allMs.length; i++) {
						finalMs.push(allMs[i]);
						finalMs.push(obj[allMs[i]] / Math.abs(indexMax - indexMin));
					}

					if(self.msSerieAv) {
						self.msSerieAv.kill();
						self.msSerieAv = null;
					}

					self.msSerieAv = self.ms.newSerie('av');
					self.msSerieAv.autoAxis();
					self.msSerieAv.setYAxis(self.ms.getRightAxis());
					self.msSerieAv.setData(finalMs);
					self.msSerieAv.setLineColor('blue');

					self.ms.redraw(true);
					self.ms.drawSeries();
				},	

				onMouseMoveData: function(e, val) {
					if(!val.gc)
						return;

					var x = val.gc.xBeforeIndex;
					var ms = self.msData[x];

					if(self.msSerie) {
						self.msSerie.kill();
						self.msSerie = false;
					}

					if(!ms)
						return;

					self.msSerie = self.ms.newSerie();
					self.msSerie.autoAxis();
					self.msSerie.setData(ms);

					self.ms.redraw(true);
					self.ms.drawSeries();
				}
			};


			var axisGc = {

				bottom: [
					{
						labelValue: 'Time',
						unitModification: 'time',
						
						primaryGrid: false,
						nbTicksPrimary: 10,
						secondaryGrid: false,
						axisDataSpacing: { min: 0, max: 0.1 },
					}
				],

				left: [
					{
						labelValue: 'Intensity (-)',
						ticklabelratio: 1,
						primaryGrid: true,
						secondaryGrid: false,
						nbTicksPrimary: 3,
						exponentialFactor: -7,
						forcedMin: 0,
						display: false
					}
				]
			};

			
			var optionsMs = {

				paddingTop: 5,
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
				zoomMode: 'xy',
				defaultMouseAction: 'zoom',
				defaultWheelAction: 'zoomY',
				lineToZero: false
			};


			var axisMs = {

				bottom: [
					{
						labelValue: 'm/z',
						unitModification: false,
						
						primaryGrid: false,
						nbTicksPrimary: 10,
						nbTicksSecondary: 4,
						secondaryGrid: false,
						axisDataSpacing: { min: 0, max: 0.1 },
					}
				],

				left: [
					{
						labelValue: 'Intensity (-)',
						ticklabelratio: 1,
						primaryGrid: true,
						nbTicksSecondary: 4,
						secondaryGrid: false,
						scientificTicks: true,
						nbTicksPrimary: 3,
						forcedMin: 0
					}
				],

				right: [
					{
						primaryGrid: false,
						secondaryGrid: false,
						nbTicksSecondary: 5
					}
				]
			};

			this.gc = new Graph(domGc, optionsGc, axisGc);
			this.ms = new Graph(domMs, optionsMs, axisMs);

		},

		resize: function(width, height) {
			this.gc.resize(width - 10, height / 2 - 10);
			this.ms.resize(width - 10, height / 2 - 10);

			this.gc.redraw();
			this.gc.drawSeries();
			this.ms.drawSeries();
		},

		setGC: function(gc) {

			if(!this.gc)
				return;
			if(this.gcSerie)
				this.gcSerie.kill();

			this.gcSerie = this.gc.newSerie('gc', {

			});

			this.gcSerie.setData(gc);
			this.gcSerie.autoAxis();
			this.gc.redraw();
			this.gc.drawSeries();
		},

		setMS: function(ms) {
			this.msData = ms;
			
		}
	}

	return gcms;
});