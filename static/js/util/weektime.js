(function ($, window) {
	var Weektime = function (element) {
		var obj = this,
			input = element,
			container = $('<div class="weektime">'),
			newInput = $('<input type="hidden" name="' + input[0].name + '" />').appendTo(container),
			template = {
				selectorTemplate: '<div class="{0} selector">',
				upTemplate: '<div class="select-up"><span class="glyphicons glyphicons-chevron-up up"></span></div>',
				valTemplate: '<div class="select-value"></div>',
				downTemplate: '<div class="select-down"><span class="glyphicons glyphicons-chevron-down down"></span></div>'
			},
			// data
			dateValue = moment(),
			dayOptions = [], // holds day labels
			dayValues = [], // holds day/mo/year values
			hourOptions = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
			minOptions = ['00', '15', '30', '45'],
			writeTemplate = function (tempClass) {
				var div = $(String.format(template.selectorTemplate, tempClass)),
					up = $(template.upTemplate),
					val = $(template.valTemplate),
					down = $(template.downTemplate);

				div.append(up);
				div.append(val);
				div.append(down);
				container.append(div);
				return div;
			},
			daySelect = writeTemplate('day-select').find('.select-value'),
			hourSelect = writeTemplate('hour-select').find('.select-value'),
			minSelect = writeTemplate('min-select').find('.select-value'),
			merLabel = $('<div class="mer-label">').appendTo(container),
			selectors = container.find('.selector'),
			doneBtn = container.find('.done'),
			// methods
			setInitialValue = function () {
				var minToAdd = 60 - dateValue.get('m'),
					availableDays = [];

				// set to start of next hour
				dateValue.add('m', minToAdd);

				// set defaults
				dateValue.set('s', 0);
				dateValue.set('ms', 0);

				newInput.val(dateValue.toISOString());
			},
			setOptions = function () {
				setDayOptions();

				// init hour select
				hourSelect.data('index', dateValue.hour());
				hourSelect.html(dateValue.format('h'));

				minSelect.data('index', 0);
				minSelect.html(dateValue.format('mm'));

				merLabel.html(dateValue.format('a'));
			},
			setDayOptions = function () {
				for (var i = 0; i < 7; i++) {
					var iterativeDate = moment(dateValue).add('d', i);

					dayOptions.push(iterativeDate.format('ddd, MMM Do'));
					dayValues.push({
						day: iterativeDate.date(),
						month: iterativeDate.month(),
						year: iterativeDate.year()
					})
				}
				daySelect.data('index', 0);
				daySelect.html(dayOptions[0]);
			},
			clickHandlers = function () {
				container.find('.day-select .glyphicons').on('click', function (e) {
					changeHandler.call(this, daySelect, dayOptions, setDay);
				});
				container.find('.hour-select .glyphicons').on('click', function (e) {
					changeHandler.call(this, hourSelect, hourOptions, setHour);
				});
				container.find('.min-select .glyphicons').on('click', function (e) {
					changeHandler.call(this, minSelect, minOptions, setMin);
				});
			},
			changeHandler = function (select, array, setter) {
				var index = select.data('index'),
					label = array[index];

				if ($(this).hasClass('up')) {
					index++;
					if (index === array.length) index = 0;

					label = array[index];
					setter.call(this, index);
					select.data('index', index);
				}
				else {
					index--;
					if (index < 0) index = array.length - 1;

					label = array[index];
					setter.call(this, index);
					select.data('index', index);
				}
				newInput.val(dateValue.toISOString());
				select.html(label);
			},
			setDay = function (index, val) {
				dateValue.date(dayValues[index].day);
				dateValue.set('M', dayValues[index].month);
				dateValue.set('y', dayValues[index].year);
			},
			setHour = function (index) {
				if (index > 11) {
					// set to pm
					merLabel.html('pm');
				}
				else {
					// set to pm
					merLabel.html('am');
				}
				dateValue.hour(index);
			},
			setMin = function (index) {
				var min = parseInt(minOptions[index]);
				dateValue.minute(min);
			},
			swipeHandlers = function () {
			};

		this.init = function () {
			input.replaceWith(container);
			setInitialValue();
			setOptions();
			clickHandlers();
			swipeHandlers();
			container.data('weektime', obj);
		};
	};

	$.fn.weektime = function () {
		return this.each(function () {
			var el = $(this);

			if (!el.data('weektime')) {
				var plugin = new Weektime(el).init();
			}
		});
	};
})(jQuery, window);