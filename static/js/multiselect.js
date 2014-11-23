(function ($, window) {
	var Multi = function (element) {
		var obj = this,
			container = element,
			input = container.find('input[type="hidden"]'),
			label = container.find('.label'),
			optionContainer = container.find('.options'),
			options = container.find('.option'),
			// data
			valueArray = [],
			// methods
			applyClickHandlers = function () {
				label.off('click').on('click', toggleOptionContainer);
				options.off('click').on('click', optionClick);
			},
			toggleOptionContainer = function (e) {
				if (optionContainer.is(':visible')) {
					optionContainer.slideUp();
				}
				else {
					optionContainer.slideDown();
				}
			},
			optionClick = function (e) {
				var option = $(this),
					value = option.data('value');

				if (option.hasClass('selected')) {
					option.removeClass('selected');
					var index = valueArray.indexOf(value);
					if (index >= 0) {
						valueArray.splice(index, 1);
					}
				}
				else {
					if (valueArray.length === 3) {
						label.effect("highlight", { color: 'red' }, 500)
						option.effect("bounce", 500);
						return;
					}
					else {
						option.addClass('selected');
						valueArray.push(value);
					}
				}
				updateValues();
			},
			updateValues = function () {
				valueArray = [];

				var selected = container.find('.option.selected');
				selected.each(function () {
					var option = $(this),
						value = option.data('value');

					valueArray.push(value);
				});

				input.val(valueArray.toString());
				label.html(selected.length + ' selected');
			},
			updateHtml = function () {
				var selected = input.val().split(',');

				for (var s in selected) {
					optionContainer.find('.option[data-value="' + selected[s] + '"]').addClass('selected');
				}
				updateValues();
			};

		this.refreshByHtml = function () {
			updateValues();
		};

		this.refreshByInput = function () {
			updateHtml();
		};

		this.setSelected = function (values) {
			options.removeClass('selected');

			for (var v in values) {
				var op = options.find('[value="' + values[v] + '"]');
				op.addClass('selected');
			}

			updateValues();
		};

		this.init = function () {
			applyClickHandlers();

			if (input.val() !== "") {
				updateHtml();
			}

			container.data('multi', obj);
		};
	};

	$.fn.multi = function () {
		return this.each(function () {
			var el = $(this);

			if (!el.data('multi')) {
				var plugin = new Multi(el).init();
			}
		});
	};
})(jQuery, window);