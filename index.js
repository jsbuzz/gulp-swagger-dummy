'use strict';

var gutil = require('gulp-util')
var through2 = require('through2');

module.exports = function () {
	return through2.obj(function (file, enc, done) {
		if (file.isBuffer()) {
			var json = JSON.parse(file.contents);
			createTemplates(json, this, done);
		}
	    return done();
    });
};

function createTemplates(json, stream, done) {
	for(var modelName in json.models) {
		var model = json.models[modelName];
		var enums = {};
		var template = '{\n';
		var propertyMap = {
			boolean : 'boolean',
			integer : 'number 1 99',
			string  : 'word'
		};
		var dependencies = [];
		dependencies.add = function(item) {
			if(dependencies.indexOf(item) < 0) {
				dependencies.push(item);
			}
		}

		var fieldMap = {
			'/^id|[a-zA-Z0-9]+_id$/' : 'hash',
			day : 'number 1 28',
			month : 'number 1 12',
			year : 'number 1900 2020',
			pages : 'number 10 100',
			'/^date|[a-z]+_date|joined|created|modified|[a-z]+_modified$/' : 'date',
			surname: 'lastName',
			forename: 'firstName'
		};

		var properties = 0;
		for(var prop in model.properties) {
			var tab = function(depth){
				return (new Array(1 + 4 * depth)).join(' ');
			};
			var property = model.properties[prop];
			template += (properties++ ? ',\n' : '') + tab(1) + '"' + prop + '": ';

			var processed = false;

			// fieldmap matching
			for(var pattern in fieldMap) {
				var regexp;
				if(pattern[0] === '/') {
					regexp = new RegExp(pattern.slice(1,-1))
				} else {
					regexp = new RegExp('^' + pattern + '$');
				}
				if(regexp.test(prop)) {
					template += '{{' + fieldMap[pattern] + '}}';
					processed = true;
					break;
				}
			}

			// default fields
			if(processed) {
				;
			}
			else if(property.type in propertyMap) {
				template += '{{' + propertyMap[property.type] + '}}';
			} else if(property.type === 'array') {
				var itemType;
				if(property.items['$ref']) {
					itemType = property.items['$ref'];
					dependencies.add(property.items['$ref']);
				} else {
					itemType = property.items.type;
					itemType = itemType in propertyMap ? propertyMap[itemType] : itemType;
				}
				template += '[\n' + tab(3) + '{{repeat 0 10}}\n';
				template += '' + tab(3) + '{{' + itemType + '}}';
				template += '\n' + tab(3) + '{{/repeat}}\n' + tab(2) + ']';
			} else if (property.enum) {
				var enumName = modelName + '_' + prop;
				enums[enumName] = property.enum;
				template += '{{' + enumName + '}}';
			} else if(property['$ref']) {
				dependencies.add(property['$ref']);
				template += '{{' + property['$ref'] + '}}';
			}
		}
		template += '\n}';


		var file = new gutil.File();
		var output = {
			name: modelName,
			template: template,
			dependencies: dependencies
		};
		for(var e in enums) {
			output.enums = enums;
			break;
		}

		file.contents = new Buffer(JSON.stringify(output, null, '\t'));
		file.path = modelName + '.json';
		stream.push(file);
	}

	return "Template";
}