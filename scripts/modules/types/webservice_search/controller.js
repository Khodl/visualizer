
define(['modules/defaultcontroller', 'util/api', 'util/datatraversing', 'util/urldata'], function(Default, API, Traversing, URL) {
	
	function controller() {};
	controller.prototype = $.extend(true, {}, Default, {

		initimpl: function() { 
			this.searchTerms = {};
			this.result = null;
			this.request = null;
		},
		
		doSearch: function(name, val) {

		/*	if(this.request)
				this.request.abort();
*/
			var self = this,
				url = this.module.getConfiguration().url,
				reg,
				toPost = this.module.getConfiguration().postvariables || [],
				l = toPost.length,
				i = 0,
				data = {};

			if(name !== undefined)
				this.searchTerms[name] = val;

			// Replace all search terms in the URL
			var reg = /\<([a-zA-Z0-9]+)\>/;
			while(val = reg.exec(url)) {
				url = url.replace('<' + val[1] + '>', (encodeURIComponent(this.searchTerms[val[1]] || '')));
			}
			

			// Replace all variables in the URL
			var reg = /\<var:([a-zA-Z0-9]+)\>/;
			while(val = reg.exec(url)) {
				variable = API.getRepositoryData.get(val[1]) || [''];
				variable = variable[1];
				url = url.replace('<var:' + val[1] + '>', encoreURIComponent(variable));
			}
			
			for(; i < l; i++) {
				data[toPost[i][0]] = API.getVar(toPost[i][1]);
			}

			if(this.request && this.request.abort)
				this.request.abort();

			if(l == 0) {
				this.request = URL.get(url, 30, data);	
			} else {
				this.request = URL.post(url, data);	
			}
			
			this.request.done(function(data) {
				self.request = null;
				self.onSearchDone(data);
			});
		},


		onSearchDone: function(elements) {
			var self = this;
			self.result = elements;
			self.module.data = elements;
			
			this.setVarFromEvent('onSearchReturn', elements);
		},

		configurationSend: {

			events: {

				onSearchReturn: {
					label: 'A search has been completed',
					description: ''
				}
				
			},
			
			rels: {
				'results': {
					label: 'Results',
					description: ''
				}
			}
		},
		
		configurationReceive: {

			"vartrigger": {
				type: [],
				label: 'A variable to trigger the search',
				description: ''
			},

		},
		
		moduleInformations: {
			moduleName: 'Webservice Lookup'
		},

		
		doConfiguration: function(section) {
			var data = Traversing.getValueIfNeeded(this.result),
				jpaths = [];
			Traversing.getJPathsFromElement(data, jpaths);
			
			return {
				groups: {
					'cfg': {
						config: {
							type: 'list'
						},

						fields: [
							{
								type: 'Text',
								name: 'url',
								title: 'Search URL'
							}
						]
					},

					'searchparams': {
						config: {
							type: 'table'
						},

						fields: [
							{
								type: 'Text',
								name: 'name',
								title: 'Term name'
							},

							{
								type: 'Text',
								name: 'label',
								title: 'Term label'
							},

							{
								type: 'Text',
								name: 'defaultvalue',
								title: 'Default value'
							}

						]
					},

				},

				sections: {
					'sendvariables': {
						config: {
							multiple: false,
							title: 'POST variables'
						},

						groups: {
							'sendvariables': {
								config: {
									type: 'table'
								},

								fields: [
									{
										type: 'Text',
										name: 'variable',
										title: 'Variable'
									},

									{
										type: 'Text',
										name: 'name',
										title: 'Name'
									}
								]
							},
						}

					}

				}
			}
		},
		
		doFillConfiguration: function() {
			
			var searchparams = this.module.getConfiguration().searchparams;
			var names = [];
			var labels = [],
				postvariables = [],
				postnames = [];
				
			var defaultvalue = [];
			for(var i in searchparams) {
				names.push(i);
				labels.push(searchparams[i].label);
				defaultvalue.push(searchparams[i].defaultvalue || '');
			}

			var _postvariables = this.module.getConfiguration().postvariables || [];
			for(var i = 0, l = _postvariables.length; i < l; i++) {
				postvariables.push(_postvariables[i][1]);
				postnames.push(_postvariables[i][0]);
			}

			return {	

				groups: {
					
					cfg: [{
						url: [this.module.getConfiguration().url]
				//		jpatharray: [this.module.getConfiguration().jpatharray]
					}],

					searchparams: [{
						name: names,
						label: labels,
						defaultvalue: defaultvalue 
					}]
				},

				sections: {
					sendvariables: [{
						groups: {
							sendvariables: [{
								variable: postvariables,
								names: postnames		
							}]
						}
					}]
				}
			}
		},
		
		doSaveConfiguration: function(confSection) {
			var group = confSection[0].searchparams[0];
			var searchparams = {};
			for(var i = 0; i < group.length; i++)
				searchparams[group[i].name] = {label: group[i].label, defaultvalue: group[i].defaultvalue};

			var group = confSection[0].sendvariables[0].sendvariables[0];
			var postvariables = [];
			for(var i = 0; i < group.length; i++)
				postvariables.push([group[i].name, group[i].variable]);

			this.module.getConfiguration().searchparams = searchparams;
			this.module.getConfiguration().postvariables = postvariables;
			this.module.getConfiguration().url = confSection[0].cfg[0].url[0];
		//	this.module.getConfiguration().jpatharray = confSection[0].cfg[0].jpatharray[0];
		},

		"export": function() {
		}

	});

	return controller;
});

