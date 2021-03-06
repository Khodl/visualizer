define(['require', 'jquery'], function(require, $) {

	var SectionElement = function() {

	};

	SectionElement.defaultOptions = {
		
	};

	$.extend(SectionElement.prototype, {
		
		init: function(options) {

			this.options = $.extend({}, SectionElement.defaultOptions, options); // Creates the options
			this.splice = Array.prototype.splice;
		
			this.groupElements = {};
			this.sectionElements = {};

			this.readyDef = $.Deferred();
			this.done = 0;
		},

		fill: function( json, clearFirst ) {

			this._fillGroups( json.groups, clearFirst );
			this._fillSections( json.sections, clearFirst );

			// Check for empty shit
			if( this.done == 0 ) { // All subgroups and subsections are loaded. Let's move to the parent !
				this.readyDef.resolve();
			}

			return this.readyDef;
		},

		_fillGroups: function( groupsObj, clearFirst ) {

			// Let's make at least 1 section element
			var groups = this.section.getGroups();
	/*		for( i in groups ) {
				this.getGroupElement( groups[ i ].getName( ), 0 );
			}
*/
			this._fill( groups, this.getGroupElement, groupsObj, clearFirst );
		},

		_fillSections: function( sectionsObj, clearFirst ) {

			// Let's make at least 1 section element
			var sections = this.section.getSections();
	/*		for( i in sections ) {
				this.getSectionElement( sections[ i ].getName( ), 0 );
			}
*/
			this._fill( sections, this.getSectionElement, sectionsObj, clearFirst );
		},

		_fill: function( stackStructure, getter, stack, clearFirst ) {

			var self = this;

			if( ! stack ) {
				stack = { };
			}

			var i, j, l;
			for( i in stackStructure ) {

				if( ! ( stack[ i ] ) ) {
					stack[ i ] = { };
				}
				// i is groupname, groupsObj[i] is mixed (obj/array)
				if( ! ( stack[ i ] instanceof Array ) ) {
					stack[ i ] = [ stack[ i ] ];
				}
				
				j = 0,
				l = stack[ i ].length;

				if( l == 0 ) {
					stack[ i ][ 0 ] = { };
					l++;
				}

				for( ; j < l ; j ++) {

					self.done++;
					getter.call( this, i , j ).fill( stack[ i ][ j ] , clearFirst ).done( function() { // Returns a deferred
						self.done--;
						if( self.done == 0 ) { // All subgroups and subsections are loaded. Let's move to the parent !
							self.readyDef.resolve();
						}
					});

				}
			}

		},

		visible: function() {
			this.eachElements( function( element ) {
				element.visible();
			} );
		},

		eachGroupElements: function(groupName, callback) {
			if( ! this.groupElements[ groupName ]) {
				return;
			}

			var i = 0, 
				l = this.groupElements[ groupName ].length;

			for( ; i < l ; i ++ ) {
				callback.call( this, this.groupElements[ groupName ][ i ] )
			}
		},

		inDom: function( ) {

			this.eachElements( function( element ) {
				element.inDom();
			} );
		},

		eachElements: function( callback ) {

			var self = this;
			this.section.eachGroups( function( group ) {

				self.eachGroupElements( group.getName() , function( groupElement ) {

					callback( groupElement );					
				});
			});

			this.section.eachSections( function( section ) {

				self.eachSectionElements( section.getName() , function( sectionElement ) {

					callback( sectionElement );
				});
			});
		},

		redoTabIndices: function() {
			this.eachElements( function( element ) {
				element.redoTabIndices();
			} );
		},

		eachSectionElements: function(sectionName, callback) {
			if( ! this.sectionElements[ sectionName ]) {
				return;
			}

			var i = 0, 
				l = this.sectionElements[ sectionName ].length;

			for( ; i < l ; i ++ ) {
				callback.call( this, this.sectionElements[ sectionName ][ i ] )
			}
		},


		getGroupElement: function( groupName, groupInternalId ) {

			return this._getElement(this.groupElements, this.section.getGroup, this.section, groupName, groupInternalId);
		},


		getSectionElement: function( sectionName, sectionInternalId ) {

			return this._getElement(this.sectionElements, this.section.getSection, this.section, sectionName, sectionInternalId);
		},
		

		_getElement: function(stack, getter, scope, name, id) {

			var el;
			stack[ name ] = stack[ name ] || [];
			
			if( ! stack[ name ][ id ] ) {

				el = getter.call( scope, name ).makeElement( );
				el.sectionElement = this;
				stack[ name ][ id ] = el;
			}

			return stack[ name ][ id ];
		},

		getSectionElements: function() {
			return this.sectionElements;
		},

		getGroupElements: function() {
			return this.groupElements;
		},

		getValue: function() {

			var groupEls = this.getGroupElements(),
				sectionEls = this.getSectionElements(),
				json = { sections: {}, groups: {} };

			this._getValue(sectionEls, json.sections);
			this._getValue(groupEls, json.groups);

			return json;
		},

		_getValue: function(stackFrom, stackTo) {

			var i, j, l;

			for( i in stackFrom ) {

				j = 0, 
				l = stackFrom[ i ].length,
				stackTo[ i ] = [];

				for( ; j < l ; j ++) {
					stackTo[ i ].push( stackFrom[ i ][ j ].getValue( ) );
				}
			}

			return stackTo;
		},

		getTitle: function() {
			return this.section.options.title || 'No title';
		},

		getTitleIcon: function() {
			var html = '';
			if(this.section.options.icon) {
				html += '<img src="' + require.toUrl('./images/' + this.section.options.icon + '.png') + '" />';
			}
			html += '<div>' + this.getTitle() + '</div>';
			return html;
		},

		makeDom: function() {

			var self = this,
				dom = $("<div />"),
				i,
				h,
				j,
				l;

			switch( this.section.form.tplMode ) {
				case 1:
				
					if( this.section.sectionLevel == 1 ) {
						this.section.form.sectionLvl1Buttons.append('<div data-section-name="' + this.section.getName() + '" class="form-section-select">' + this.getTitleIcon( ) + '</div>');	
						dom.hide();
					} else {
						h = $('<h' + (this.section.sectionLevel) + '>' + this.getTitle( ) + '</h' + (this.section.sectionLevel) + '>')
						if( this.section.options.multiple ) {
							var spanDupl = $('<div class="form-duplicator-wrapper"><span class="form-duplicator form-duplicator-add">duplicate</span> - <span class="form-duplicator form-duplicator-remove">remove</span></div>').on('click', 'span', function() {
								var dupl = $(this).hasClass('form-duplicator-add');
								// Call parent
								self.sectionElement[ dupl ? 'duplicateSectionElement' : 'removeSectionElement']( self );
							});
							h.append(spanDupl);
						}

						dom.append(h);
					}
					
				break;

				default:
					dom.append('<h' + (this.section.sectionLevel) + '>' + this.getTitle( ) + '</h' + (this.section.sectionLevel) + '>');
				break;

			}

			for( i in this.groupElements ) {
				l = this.groupElements[ i ].length;
				for( j = 0; j < l ; j++) {
					dom.append( this.groupElements[ i ][ j ].makeDom( ) );
				}
			}

			for( i in this.sectionElements ) {
				l = this.sectionElements[ i ].length;
				for( j = 0 ; j < l ; j++) {
					dom.append( this.sectionElements[ i ][ j ].makeDom( ) );
				}
			}
			
	
			return (this.dom = dom);
		},


		getSectionIndex: function( sectionElement ) {

			var name = sectionElement.section.getName();

			if( ! this.sectionElements[ name ]) {
				return this.form.throwError("Cannot get section index. Section name " + name + " doesn't exist");
			}

			var index = this.sectionElements[ name ].indexOf( sectionElement );

			if( index < 0 ) {
				return this.form.throwError("Cannot get section index. Cannot find section element");
			}

			return index;
		},

		removeSectionElement: function( sectionElement ) {

			var self = this,
				name = sectionElement.section.getName( ),
				sectionIndex = this.getSectionIndex( sectionElement );

			if(sectionIndex === false) {
				return;
			}

			if( this.sectionElements[ name ].length == 1 ) {
				this.duplicateSectionElement( sectionElement );
			}

			this.sectionElements[ name ].splice( sectionIndex, 1 ); // Remove the element from the stack
			sectionElement.dom.remove();
			sectionElement.dom = null;
			sectionElement = null;
		},


		duplicateSectionElement: function( sectionElement ) {

			var self = this,
				name = sectionElement.section.getName( ),
				sectionIndex = this.getSectionIndex( sectionElement );

			if(sectionIndex === false) {
				return;
			}

			var newSectionEl = this
								.section
								.getSection( name )
								.makeElement();

			newSectionEl.sectionElement = this; // Sets the parent element as being this

			this.sectionElements[ name ].splice( sectionIndex + 1, 0, newSectionEl ); // Add the section in the stack
			
			newSectionEl.fill( { } ); // Fill the section with empty stuff
			
			newSectionEl.readyDef.then( function() { // Only when all fields have loaded we can trigger a dom creation

				if( sectionElement && sectionElement.dom ) { // If it exists, we add it right after
					sectionElement.dom.after( newSectionEl.makeDom( ) );	
				} else { // Else we add it at the end
					self.dom.append( newSectionEl.makeDom( ) );
				}
			
				newSectionEl.inDom( );
			});
		
			return newSectionEl;
		},

		ready: function() {
			return $.when.apply( $.when, this.deferreds );
		}
	});



/*
	Object.defineProperty(SectionElement.prototype, 'sectionElement', {
		
		enumerable: true,
		configurable: false,
		
		get: function() {
			return this._sectionElement;
		},

		set: function(section) {
			this._sectionElement = section;
		}
	
	});*/


	return SectionElement;
});