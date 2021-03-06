define(['modules/defaultview', 
		'util/util',
		'util/datatraversing',
		"libs/jsmol/JSmol.min.nojq"
		], 



function(Default, UTIL, DataTraversing) {
	
	function view() {};
	view.prototype = $.extend(true, {}, Default, {

	 	init: function() {	
	 		this.jsmolid = UTIL.getNextUniqueId();
	 		this.dom = $('<div id="' + this.jsmolid + '"></div>');
	 		this.module.getDomContent().html(this.dom);
	 		this._highlights = this._highlights || [];

	 		this.onReady = $.Deferred();
	 	},

	 	inDom: function() {
	 		var useSignedApplet = false, self = this;
			var info = {
				width: 700,
				height: 300,
				debug: false,
				color: "0xF0F0F0",
				addSelectionOptions: false,
				serverURL: "http://chemapps.stolaf.edu/jmol/jsmol/jsmol.php",
				use: "HTML5",
			  //language: "fr", // NOTE: LOCALIZATION REQUIRES <meta charset="utf-8"> (see JSmolCore Jmol.featureDetection.supportsLocalization)
				jarPath: "java",
				j2sPath: "scripts/libs/jsmol/j2s",

				jarFile: (useSignedApplet ? "JmolAppletSigned.jar" : "JmolApplet.jar"),
				isSigned: useSignedApplet,
				disableJ2SLoadMonitor: true,
				disableInitialConsole: true,
				readyFunction: function() {
					self.onReady.resolve();
				},
			    allowjavascript: true,
				script: "set antialiasDisplay"
				//,defaultModel: ":dopamine"
			  //,noscript: true
				//console: "none", // default will be jmolApplet0_infodiv
				//script: "set antialiasDisplay;background white;load data/caffeine.mol;"
			  //delay 3;background yellow;delay 0.1;background white;for (var i = 0; i < 10; i+=1){rotate y 3;delay 0.01}"
			};

			Jmol._XhtmlElement = this.dom.get(0);
			Jmol._XhtmlAppendChild = true;
			this.applet = Jmol.getApplet(this.jsmolid, info);

	 	},

	 	onResize: function(w, h) {
	 		if(!this.applet)
	 			return;

	 		Jmol.resizeApplet(this.applet, [w - 8,h - 15]);
	 	},

	 	blank: function() {
	 		
	 		
	 	},

	 	update: {

	 		data: function(data) {

	 			if(!data)
	 				return;
	 			data = data.get();
	 			var actions = [];
    			actions.push("load data 'model'");
    			actions.push(data);
    			actions.push("end 'model';");	



				var cfg = $.proxy(this.module.getConfiguration, this.module);
				if (cfg('script')) {
        			actions.push(cfg('script'));
        		}

    			if(this.applet)
    				Jmol.script(this.applet, actions.join('\r\n')); 
	 		}
		},


		getDom: function() {
			return this.dom;
		},

		onActionReceive:  {
			jsmolscript : function(a) {
				self = this;
				self.module.controller.onJSMolScriptRecieve(a);
			}
		},

		executeScript : function(src){
			if(this.applet){
    			Jmol.script(this.applet, src); 
    		}
		},

		typeToScreen: {

		}
	});

	return view;
});