define(['modules/defaultview','util/datatraversing','util/domdeferred','util/api'], function(Default, Traversing, DomDeferred, API) {
	
	function view() {};
	view.prototype = $.extend(true, {}, Default, {

		init: function() {	

			var cfg = this.module.getConfiguration(), view = this;
			var html = $('<div>');
			//html.css({"background-color":"#f00","height":"100%"}) ;
			html.css("text-align","center");
			html.css("padding","1em");
			/*this.dom = $(html).css('display', 'table').css('height', '100%').css('width', '100%');*/

			view.dom = html ;
			view.module.getDomContent().html(this.dom);
			//view.fillWithScript(cfg.btnvalue);
			view.fillWithScript();
		},
		
		onResize: function() {
			
		},
		
		blank: function() {
			this.dom.empty();
		},
		
		inDom: function() {},

		update: {

			'script': function(script) {
				
				var cfg = this.module.getConfiguration(), view = this;
				cfg.script = script ;
				view.fillWithScript();

			},

			'btnvalue': function(value) {

				var cfg = this.module.getConfiguration(), view = this;
				cfg.btnvalue = value ;
				view.fillWithScript();

			}
		},
		
		fillWithScript: function() {
			
			var cfg = this.module.getConfiguration() ;
			var self = this ;
			var dom = self.dom

			dom.html("");

			var button = $('<div>').html(cfg.btnvalue).addClass("bi-form-button");
			button.on("click",function(){
				self.module.controller.onButtonClick();
				return false ;
			}) ;

			var textbox = null ;
			if(cfg.iseditable && cfg.iseditable.length > 0){
				textbox = $('<textarea>',{cols:20,rows:5}).html(cfg.script) ;
				textbox.on('input',function(e,f){
					cfg.script = $(this).val() ;
					//self.update.script($(this).val()) ;
				});				
			}

			dom.append(button);
			if(textbox)
				dom.prepend(textbox);

			
	
			DomDeferred.notify(button);
		},
		
		getDom: function() {
			return this.dom;
		},
		
		typeToScreen: {}
	});

	return view;
});