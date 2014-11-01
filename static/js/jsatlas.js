if (!String.format) {
	String.format = function (format) {
		var args = Array.prototype.slice.call(arguments, 1);
		return format.replace(/{(\d+)}/g, function (match, number) {
			return typeof args[number] != 'undefined'
              ? args[number]
              : match
			;
		});
	};
}

(function ($, window) {
	var jsAtlas = function (element) {
		var obj = this,
            div = element,
            gMap,
            settings = {
            	key: "AIzaSyB9EARriTjyHo7LupKAHvazcG245a04c54",
            	initialZoom: 16,
            	initialCenter: {
            		lat: 48.745555,
            		lng: -122.478132,
            	},
            	styleArray: [
					{
						stylers: [
							{ hue: "#00aaff" },
							{ saturation: 0 },
							{ lightness: 0 },
							{ gamma: 0 },
							//{ color: "#0000ff" },
							{ weight: 3 }
						]
					},
                    {
                    	featureType: "poi",
                    	stylers: [{ visibility: "off" }]
                    },
                    {
                    	featureType: "landscape",
                    	stylers: [{ visibility: "on" }]
                    },
                    {
                    	featureType: "water",
                    	stylers: [{ visibility: "on" }]
                    },
                    {
                    	featureType: "road.local",
                    	stylers: [{ visibility: "on" }]
                    }
            	],
            	focusOpacity: .7,
            	blurOpacity: .5
            },
			user,
            selectedEvent,
			urls = {
				// map
				mapPlaces: '/map/places',
				// places
				placesSearch: '/places',
				placesNames: '/places/names',
				userPlaces: '/places/user',
				searchAllPlaces: '/places/searchAll',
				// events
				events: '/event',
				eventsForSpan: '/event/span',
				eventAddUser: '/event/addUser',
				eventRemoveUser: '/event/removeUser',
				eventCreate: '/event/create',
				// views
				renderTemplate: '/template'
			},
			templates = {},
			currentSpan = 0,
			reAuthAttempts = 0,
			sizing = {
				count: 0
			},
			circleData = {
				count: 0
			},
			datetimeFormat = 'ddd h:mm a',
			timeFormat = 'h:mm tt',
			// elements
			container = $('.container'),
			//// header 
			header = $('.header'),
			headerUserControls = header.find('.user-controls'),
			headerFilterBtn = headerUserControls.find('.filter .glyph'),
			headerMenuBtn = headerUserControls.find('.menu .glyph'),
			headerDaySelect = header.find('.day-select'),
			headerDaySelectPrev = headerDaySelect.find('.prev'),
			headerDaySelectCurrent = headerDaySelect.find('.current'),
			headerDaySelectNext = headerDaySelect.find('.next'),
			//// overlay elements
			overlay = $('.detail-overlay'),
			overlayHeader = overlay.find('.overlay-header'),
			overlayExit = overlayHeader.find('> .overlay-exit'),
			overlayTitle = overlayHeader.find('> .overlay-title'),
			overlayGoing = overlayHeader.find('> .going'),
			overlayBody = overlay.find('.overlay-body'),
			overlayFirstPage = overlayBody.find('.first-page'),
			overlaySecondPage = overlayBody.find('.second-page'),
			overlayThirdPage = overlayBody.find('.third-page'),
			overlayMenu = overlayFirstPage.find('.main-menu'),
			overlayEvent = overlayFirstPage.find('.event-detail'),
			overlayFilters = overlayFirstPage.find('.filters'),
			// methods
			//// map actions
			initializeMap = function () {
				var mapOptions = {
					center: new google.maps.LatLng(settings.initialCenter.lat, settings.initialCenter.lng),
					zoom: settings.initialZoom
				};
				gMap = new google.maps.Map(div[0], mapOptions);
				gMap.setOptions({ styles: settings.styleArray });
			},
			circleSizeTo = function (el, targetSize, rate, secondRate, interval, callback) {
				sizing[el.id].event = window.setInterval(function () {
					var newRad = Math.round(rate * el.radius),
						increase = newRad - el.radius;

					if (increase === 0) {
						if (rate > 1) {
							newRad++;
						}
						else {
							newRad--;
						}
					}

					el.setOptions({
						radius: newRad
					});

					if (newRad === targetSize) {
						// circle hit requested size exactly
						window.clearInterval(sizing[el.id].event);
						sizing[el.id].event = null;

						if (callback) {
							callback();
						}
					}
					else {
						var tooFar = rate > 1 ? (el.radius > targetSize) : (el.radius < targetSize);

						if (tooFar) {
							window.clearInterval(sizing[el.id].event);
							sizing[el.id].event = null;
							// circle has gone above requested size, scale back
							if (!sizing[el.id].waver.trigger) {
								if (secondRate) {
									circleSizeTo(el, targetSize, secondRate, null, 100, callback);
								}
								else if (callback) {
									callback();
								}
							}
							else if (callback) {
								callback();
							}
						}
					}
				}, interval ? interval : 50);
			},
			setWaver = function (el) {
				// init if not there
				sizing[el.id].waver.trigger = true;

				if (sizing[el.id].waver.event) {
					window.clearInterval(sizing[el.id].waver.event);
					sizing[el.id].waver.event = null;
				}
				var sizingRunning = false;
				sizing[el.id].waver.event = window.setInterval(function () {
					if (!sizingRunning && !sizing[el.id].event) {
						sizingRunning = true;

						var sizeTo = el.radius + (sizing[el.id].waver.sw * (el.radius / 20)),
							rate = sizing[el.id].waver.sw === 1 ? 1.01 : .99;

						circleSizeTo(el, sizeTo, rate, null, 100, function () {
							sizing[el.id].waver.sw = sizing[el.id].waver.sw > 0 ? -1 : 1;
							sizingRunning = false;
						});
					}
				}, 100);
			},
			clearSizing = function (id, defaultSize) {
				if (defaultSize) {
					circleData[id].circle.radius = circleData[id].users.length * 10;
				}
				if (sizing[id].event) {
					window.clearInterval(sizing[id].event);
					sizing[id].event = null;
				}
				if (sizing[id].waver.event) {
					window.clearInterval(sizing[id].waver.event);
					sizing[id].waver.event = null;
				}
			},
			drawEvents = function (data) {
				for (var d in data) {
					drawEvent(data[d]);
				}
			},
			drawEvent = function (event) {
				// only draw event if it is in the selected time window
				if (withinSelectedSpan(event) && !circleData[event._id]) {
					var colorArray = colorByTime(event[event.intensity_variable]),
						circleSize = getEventCircleSize(event),
						c = {
							id: event._id,
							strokeColor: arrayToRGB(getShade(colorArray, -20)),
							strokeOpacity: 1,
							strokeWeight: getEventCircleSize(event) / 10,
							fillColor: arrayToRGB(colorArray),
							fillOpacity: settings.blurOpacity,
							map: gMap,
							center: new google.maps.LatLng(event.place.loc.coordinates[1], event.place.loc.coordinates[0]),
							radius: circleSize
						};

					circle = new google.maps.Circle(c);

					event.color = colorArray;
					event.circle = circle;
					circleData[circle.id] = event;
					circleData.count++;

					// init sizing
					sizing[circle.id] = {
						event: null,
						waver: {
							trigger: false,
							sw: 1
						}
					}
					sizing.count++;

					circleSizeTo(circle, circleSize, 1.2, .9);

					google.maps.event.addListener(circle, 'mouseover', function (e) {
						focusCircle.call(this, e);
					});

					google.maps.event.addListener(circle, 'mouseout', function (e) {
						if (this !== selectedEvent) {
							blurCircle.call(this, e);
						}
					});

					google.maps.event.addListener(circle, 'click', function (e) {
						circleClick.call(this, e);
					});
				}
			},
			focusCircle = function (e) {
				var circle = this,
					ref = circleData[circle.id],
					defaultSize = getEventCircleSize(ref);

				this.setOptions({
					zIndex: 1,
					fillOpacity: settings.focusOpacity,
					fillColor: arrayToRGB(getShade(ref.color, 20)),
				});

				if (defaultSize >= 20) {
					setWaver(circle);
				}
			},
			highlightCircle = function (e) {
				this.setOptions({
					strokeColor: "#ffffaa"
					//strokeColor: arrayToRGB(getShade(circleData[this.id].color, 80))
				});
			},
			blurCircle = function (e) {
				var circle = this,
					ref = circleData[circle.id],
					defaultSize = getEventCircleSize(ref);

				if (sizing[this.id]) {
					window.clearInterval(sizing[this.id].event);
					sizing[this.id].event = null;

					// stop waver
					if (sizing[this.id].waver) {
						window.clearInterval(sizing[this.id].waver.event);
						sizing[this.id].waver.event = null;
					}
				}

				// set back to default
				circle.setOptions({
					radius: defaultSize,
					zIndex: 0,
					fillOpacity: settings.blurOpacity,
					fillColor: arrayToRGB(ref.color),
					strokeColor: arrayToRGB(getShade(ref.color, -20)),
					fillOpacity: settings.blurOpacity
				});
			},
			circleClick = function (e) {
				var clicked = this;

				if (selectedEvent && selectedEvent !== clicked) {
					blurCircle.call(selectedEvent);
					selectedEvent = null;
				}

				selectedEvent = clicked;

				highlightCircle.call(this);
				setEventDetail(this.id);
			},
			offsetCenter = function (latlng, offsetx, offsety) {

				// latlng is the apparent center-point
				// offsetx is the distance you want that point to move to the right, in pixels
				// offsety is the distance you want that point to move upwards, in pixels
				// offset can be negative
				// offsetx and offsety are both optional

				var scale = Math.pow(2, GoogleMap.getZoom());
				var nw = new google.maps.LatLng(
					GoogleMap.getBounds().getNorthEast().lat(),
					GoogleMap.getBounds().getSouthWest().lng()
				);

				var worldCoordinateCenter = GoogleMap.getProjection().fromLatLngToPoint(latlng);
				var pixelOffset = new google.maps.Point((offsetx / scale) || 0, (offsety / scale) || 0)

				var worldCoordinateNewCenter = new google.maps.Point(
					worldCoordinateCenter.x - pixelOffset.x,
					worldCoordinateCenter.y + pixelOffset.y
				);

				var newCenter = GoogleMap.getProjection().fromPointToLatLng(worldCoordinateNewCenter);

				GoogleMap.setCenter(newCenter);
			},
			//// circle utility
			getEventCircleSize = function (cData) {
				return cData.users.length * 20;
			},
			getShade = function (rgb, delta) {
				var newRGB = new Array();
				for (var i in rgb) {
					if (delta > 0) {
						newRGB[i] = rgb[i] + delta <= 255 ? rgb[i] + delta : 255;
					}
					else {
						newRGB[i] = rgb[i] >= delta ? rgb[i] - delta : 0;
					}
				}
				return newRGB;
			},
			colorByTime = function (isoDate) {
				var localDate = moment(isoDate).toDate(),
					now = new Date(),
					hoursTillStart = Math.round((localDate.getTime() - now.getTime()) / 1000 / 60 / 60),
					c = [
						[255, 0, 0],
						[255, 0, 0],
						[255, 69, 0],
						[255, 69, 0],
						[255, 215, 0],
						[255, 215, 0],
						[173, 255, 47],
						[173, 255, 47],
						[0, 255, 127],
						[0, 255, 127],
						[0, 255, 212],
						[0, 255, 212],
						[0, 255, 255]
					],
					borderDiff = -20;

				hoursTillStart = hoursTillStart < 0 ? 0 : hoursTillStart;
				c = hoursTillStart >= c.length ? c[c.length - 1] : c[hoursTillStart];

				return c;
			},
			arrayToRGB = function (c) {
				return String.format("rgb({0}, {1}, {2})", c[0], c[1], c[2]);
			},
			//// map API calls
			applySearchHandlers = function () {
				var searches = $('.map-search');

				searches.each(function () {
					var tb = $(this).find('input'),
						glyph = $(this).find('glyph');

					glyph.off('click').on('click', function () {

					});
				});
			},
			mapPlacesTest = function (name) {
				var loc = gMap.getCenter(),
					data = {
						key: settings.key,
						lat: loc.lat(),
						lng: loc.lng(),
						radius: 1000,
						name: name
					};

				$.get(urls.mapPlaces, data, function (response) {
					console.log(response);
				});
			},
			//// session/data
			reAuthenticate = function (callback, callbackArgs) {
				console.log("attempting to re-authenticate");
				fbInitLogin(callback, callbackArgs);
			},
			initializeUser = function (auth, callback, callbackArgs) {
				// check our db for this user, if doesn't exist, create
				$.post('/account/authenticate/', auth, function (response) {
					// load user-related events
					if (response.body) {
						user = response.body;
						callback.apply(this, callbackArgs);
					}
					else {
						console.error('user session not initialized');
					}
				});
			},
			loadEvents = function () {
				// destroy old event sizing handlers
				if (sizing.count > 0) {
					for (var s in sizing) {
						if (s !== "count") {
							if (sizing[s].event) {
								window.clearTimeout(sizing[s].event);
							}
							if (sizing[s].waver.event) {
								window.clearTimeout(sizing[s].waver.event);
							}
						}
					};
				}

				// destroy old event ui and data
				if (circleData.count > 0) {
					// get new events
					loadEventsInSpan(function (data) {
						// destroy old
						var numDestroyed = 0,
							dataIds = _.map(data, function (d) {
								return d._id;
							}),
							destroy = _.filter(circleData, function (i, cD) {
								return cD !== "count" && !_.some(dataIds, function (d) { return d === cD; });
							});

						for (var d in destroy) {
							var dId = destroy[d]._id;

							circleSizeTo(circleData[dId].circle, 0, .7, null, 50, function () {
								circleData[dId].circle.setMap(null);
								numDestroyed++;

								if (numDestroyed === circleData.count) {
									sizing = {
										count: 0
									};
									circleData = {
										count: 0
									};
								}
								if (selectedEvent === circleData[dId].circle) {
									blurCircle.call(circleData[dId].circle);
									selectedEvent = null;
									setMenuDetail();
								}
								delete circleData[dId];
								circleData.count--;
							});
						}
					});
				}
				else {
					// get new events
					loadEventsInSpan();
				}
			},
			loadEventsInSpan = function (callback) {
				$.get(urls.eventsForSpan, { span: currentSpan }, function (response) {
					if (response.success) {
						drawEvents(response.body);
						if (callback) {
							callback(response.body);
						}
					}
					else if (response.statusCode === 401) {
						reAuthenticate(loadEvents);
					}
				});
			},
			getUserEvents = function (callback) {
				$.get('/event/userEvents', function (response) {
					if (response.success) {
						callback(response);
					}
					else if (response.statusCode === 401) {
						reAuthenticate(getUserEvents, [callback]);
					}
				});
			},
			getCurrentUser = function () {
				$.get('/account/user', function (user) {
					console.log(JSON.stringify(user));
				});
			},
			addEventUser = function (id, callback) {
				$.ajax({
					url: urls.eventAddUser,
					type: 'POST',
					data: {
						eventId: id
					},
					success: function (response) {
						if (response.success) {
							callback(response);
						}
						else if (response.statusCode === 401) {
							reAuthenticate(addEventUser, [id, callback]);
						}
					}
				});
			},
			removeEventUser = function (id, callback) {
				$.ajax({
					url: urls.eventRemoveUser,
					type: 'POST',
					data: {
						eventId: id
					},
					success: function (response) {
						if (response.success) {
							callback(response);
						}
						else if (response.statusCode === 401) {
							reAuthenticate(addEventUser, [id, callback]);
						}
					}
				});
			},
			//// facebook authentication
			initAuthentication = function () {
				FB.init({
					appId: '655662931197377',
					cookie: true,
					version: 'v2.0'
				});

				fbInitLogin(loadEvents);
			},
			fbInitLogin = function (callback, callbackArgs) {
				FB.getLoginStatus(function (auth) {
					if (auth.status === 'connected') {
						var data = {
							token: auth.authResponse.accessToken,
							id: auth.authResponse.userID
						}
						initializeUser(data, callback, callbackArgs);
					}
					else {
						FB.login(function (response) {
							var data = {
								token: response.authResponse.accessToken,
								id: response.authResponse.userID
							}

							initializeUser(data, callback, callbackArgs);
						}, { scope: 'public_profile,email,user_friends' });
					}
				});
			},
			//// header
			applyHeaderHandlers = function () {
				headerMenuBtn.off('click').on('click', function (e) {
					setMenuDetail();
				});
				headerFilterBtn.off('click').on('click', function (e) {
					switchOverlay(overlayFilters, "Event Filters");
				});
				headerDaySelectPrev.off('click').on('click', function (e) {
					gotoPrevSpan();
				});
				headerDaySelectNext.off('click').on('click', function (e) {
					gotoNextSpan();
				});
			},
			gotoPrevSpan = function () {
				if (currentSpan === 0) {
					return false;
				}
				else {
					currentSpan--;
					headerDaySelectNext.removeClass('disabled');
					if (currentSpan === 0) {
						headerDaySelectCurrent.html('12 hour');
						headerDaySelectPrev.addClass('disabled');
					}
					else {
						headerDaySelectCurrent.html('24 hour');
					}
					loadEvents();
				}
			},
			gotoNextSpan = function () {
				if (currentSpan === 2) {
					return false;
				}
				else {
					currentSpan++;
					headerDaySelectPrev.removeClass('disabled');
					if (currentSpan === 2) {
						headerDaySelectCurrent.html('48 hour');
						headerDaySelectNext.addClass('disabled');
					}
					else {
						headerDaySelectCurrent.html('24 hour');
					}
					loadEvents();
				}
			},
			//// overlay
			exitOverlay = function () {
				if (selectedEvent) {
					blurCircle.call(selectedEvent);
					selectedEvent = null;
				}
				clearOverlays();
				container.removeClass('show-overlay');
			},
			switchOverlay = function (to, headerTitle, callback) {
				container.addClass('show-overlay');

				clearOverlays(function () {
					if (callback) {
						callback();
					}
					overlayTitle.html(headerTitle);
					overlayHeader.fadeIn();
					to.fadeIn();
				});
			},
			clearOverlays = function (callback) {
				var finished = 0,
					count = 4;

				// header
				overlayHeader.fadeOut(200, function () {
					finished++;
					if (finished === count && callback) {
						callback();
					}
				});

				// event detail
				overlayGoing.off('mouseover').off('mouseleave').off('click');
				overlayEvent.fadeOut(200, function () {
					overlayGoing.hide();
					gotoFirstPage();
					finished++;
					if (finished === count && callback) {
						callback();
					}
				});

				// main menu
				overlayMenu.find('.schedule .events').off('click');
				overlayMenu.fadeOut(200, function () {
					finished++;
					if (finished === count && callback) {
						callback();
					}
				});

				// filters
				overlayFilters.fadeOut(200, function () {
					finished++;
					if (finished === count && callback) {
						callback();
					}
				});
			},
			gotoFirstPage = function () {
				overlayBody.removeClass('paged');
				overlayBody.removeClass('two');
				overlayBody.removeClass('three');
				overlayExit.removeClass('chevron-left');
				overlayExit.addClass('chevron-right');
				overlayExit.off('click').on('click', exitOverlay);
				overlaySecondPage.html('');
			},
			gotoSecondPage = function () {
				overlayBody.removeClass('three');
				overlayBody.addClass('paged');
				overlayBody.addClass('two');
				overlayExit.removeClass('chevron-right');
				overlayExit.addClass('chevron-left');
				overlayExit.off('click').on('click', gotoFirstPage);
				overlayThirdPage.html('');
			},
			gotoThirdPage = function () {
				overlayBody.removeClass('two');
				overlayBody.addClass('three');
				overlayBody.addClass('paged');
				overlayExit.removeClass('chevron-right');
				overlayExit.addClass('chevron-left');
				overlayExit.off('click').on('click', gotoSecondPage);
			},
			////// event detail
			applyGoingHandlers = function (cData) {
				var connections = overlayEvent.find('.connection-info'),
					numAttending = connections.find('.num-attending');

				overlayGoing.off('mouseover').on('mouseover', function () {
					if (!overlayGoing.hasClass('green')) {
						overlayGoing.removeClass('unchecked');
						overlayGoing.addClass('check');
					}
				});
				overlayGoing.off('mouseleave').on('mouseleave', function () {
					if (!overlayGoing.hasClass('green')) {
						overlayGoing.removeClass('check');
						overlayGoing.addClass('unchecked');
					}
				});
				overlayGoing.off('click').on('click', function () {
					if (overlayGoing.hasClass('green')) {
						removeEventUser(cData._id, function (response) {
							if (response.success) {
								var indexOfUser = cData.users.indexOf(user._id),
									size = getEventCircleSize(cData);

								// remove locally
								cData.users.splice(indexOfUser, 1);

								overlayGoing.removeClass('check');
								overlayGoing.removeClass('green');
								overlayGoing.addClass('unchecked');
								clearSizing(cData._id);
								circleSizeTo(cData.circle, size, .9, null, 50, function () {
									setWaver(cData.circle);
								});
								numAttending.html(parseInt(cData.users.length));
							}
						});
					}
					else {
						addEventUser(cData._id, function (response) {
							if (response.success) {
								// add locally
								cData.users.push(user._id);
								var size = getEventCircleSize(cData);

								overlayGoing.removeClass('unchecked');
								overlayGoing.addClass('check');
								overlayGoing.addClass('green');
								clearSizing(cData._id);
								circleSizeTo(cData.circle, size, 1.1, null, 50, function () {
									setWaver(cData.circle);
								});
								numAttending.html(parseInt(cData.users.length));
							}
						});
					}
				});
			},
			setEventDetail = function (id) {
				getTemplate('event-detail', function (template) {
					overlayEvent.html(template);

					var cData = circleData[id],
						body = overlayEvent.find('.event-body'),
						when = overlayEvent.find('.when'),
						where = overlayEvent.find('.where'),
						what = overlayEvent.find('.what'),
						connections = overlayEvent.find('.connection-info'),
						numAttending = connections.find('.num-attending');

					// make sure cData.users exists
					if (cData.users) {
						// initialize 'going' checkbox by checking if user is in event.users on client
						if (_.some(cData.users, function (u) { return u === user._id; })) {
							overlayGoing.removeClass('unchecked');
							overlayGoing.addClass('check');
							overlayGoing.addClass('green');
						}
						else {
							overlayGoing.removeClass('check');
							overlayGoing.addClass('unchecked');
							overlayGoing.removeClass('green');
						}
					}

					switchOverlay(overlayEvent, cData.name, function () {
						// apply event detail to template
						when.html(moment(cData.start).format(datetimeFormat) + " - " + moment(cData.end).format(datetimeFormat));
						when.append($(String.format('<div class="intensity">{0}</div>', cData.intensity_variable === "end" ? "show up any time before end" : "show up before start")));
						where.html(String.format('<div class="place">{0}</div><div class="address">{1}</div>', cData.place.name, cData.place.vicinity));
						where.data('created-by', cData.created_by);
						what.html(cData.desc);

						// going checkbox event handlers
						overlayGoing.show();
						applyGoingHandlers(cData);
						numAttending.html(cData.users.length);

						gMap.setCenter(cData.circle.center);
						gMap.panBy(overlay.width() / 2, 0);
					});
				});
			},
			////// main menu
			setMenuDetail = function () {
				getTemplate('main-menu', function (template) {
					overlayMenu.html(template);
					applyMenuHandlers();

					getUserEvents(function (response) {
						var data = response.body,
							eventsDiv = overlayMenu.find('.schedule .events');

						renderMenuEvents(data, function (html) {
							eventsDiv.html(html);
							applyMenuScheduleEventHandlers();
						});

						switchOverlay(overlayMenu, user.first_name + " " + user.last_name);
					});
				});
			},
			applyMenuHandlers = function () {
				var createEventBtn = overlayMenu.find('.create-event');
				createEventBtn.off('click').on('click', function (e) {
					getTemplate("create-event", function (html) {
						overlaySecondPage.html(html);
						bindUi(overlaySecondPage);
						gotoSecondPage();

						// create submit click handler
						overlaySecondPage.find('input[type="button"]').off('click').on('click', createEvent);

						// load in user's places
						getUserPlaces(userPlacesHandler);
					});
				});
			},
			applyMenuScheduleEventHandlers = function () {
				// clicking an event in schedule
				var menuScheduleEvents = overlayMenu.find('.schedule .events .event');
				menuScheduleEvents.off('click').on('click', function (e) {
					var eId = $(this).data('id'),
						cData = circleData[eId];

					gMap.setCenter(new google.maps.LatLng(cData.place.loc.coordinates[1], cData.place.loc.coordinates[0]));
					gMap.panBy(overlay.width() / 2, 0);
					circleClick.call(cData.circle, e);
				});
			},
			createEvent = function (e) {
				var form = overlaySecondPage.find('form'),
					formData = form.serialize();

				// clear previous errors, if any
				form.find('input, select, textarea').removeClass('error');
				form.find('.error').html('');

				$.ajax({
					url: urls.eventCreate,
					type: 'POST',
					data: formData,
					success: function (response) {
						if (response.success) {
							var newEvent = response.body[0];
							drawEvent(newEvent);
							highlightCircle.call(circleData[newEvent._id].circle);
							setEventDetail(newEvent._id);
						}
						else {
							var errorHtml = "";
							// display error messages
							for (var i in response.body) {
								var input = form.find('[name="' + i + '"]');
								input.addClass('error');
								errorHtml = response.body[i];
							}
							form.find('.error').html(errorHtml);
						}
					}
				});
			},
			userPlacesHandler = function (places) {
				var placeSelect = overlaySecondPage.find('select[name="place"]'),
					newOption = $('<option value="new">- add another place -</option>');

				// add options
				if (places) {
					for (var p in places) {
						var option = $(String.format('<option value="{0}">{1}</option>', places[p]._id, places[p].name));
						placeSelect.append(option);
					}
				}
				placeSelect.append(newOption);

				// add place to user
				placeSelect.selectmenu({
					change: function () {
						if ($(this).val() === "new") {
							gotoThirdPage();
							placeSelect.val('');
							getTemplate('add-user-place', function (template) {
								overlayThirdPage.html(template);
								overlayThirdPage.find('input[type=button]').off('click').on('click', addUserPlaceHandler);
							});
						}
					}
				});
			},
			addUserPlaceHandler = function () {
				var placeName = overlayThirdPage.find('input[name="place"]').val(),
					resultsDiv = overlayThirdPage.find('.results');

				resultsDiv.html('');

				var loc = gMap.getCenter(),
					data = {
						key: settings.key,
						lat: loc.lat(),
						lng: loc.lng(),
						name: placeName
					};

				$.post(urls.searchAllPlaces, data, function (response) {
					if (response.success) {
						for (var p in response.body) {
							var place = $(String.format('<div class="result selectable" data-id="{0}" data-name="{1}"><div class="heading">{1}</div><span>{2}</span></div>', response.body[p]._id, response.body[p].name, response.body[p].vicinity));

							place.off('click').on('click', function () {
								var placeId = $(this).data('id'),
									name = $(this).data('name');
								// add place to user
								$.ajax({
									url: urls.userPlaces,
									type: 'POST',
									data: { placeId: placeId },
									success: function (response) {
										if (response.success) {
											var placeSelect = overlaySecondPage.find('select[name="place"]'),
												place = response.body;

											placeSelect.append(String.format('<option value="{0}" selected="selected">{1}</option>', placeId, name));
											placeSelect.selectmenu("refresh");

											gotoSecondPage();
										}
									}
								});
							});

							resultsDiv.append(place);
						}
					}
				});
			},
			getUserPlaces = function (callback) {
				$.ajax({
					url: urls.userPlaces,
					type: 'GET',
					success: function (response) {
						if (response.success) {
							callback(response.body.places);
						}
					}
				});
			},
			////// filters
			//// views
			getTemplate = function (template, callback) {
				if (!templates[template]) {
					// template hasn't been loaded by server yet, load and cache locally
					$.ajax({
						url: urls.renderTemplate,
						type: 'GET',
						data: { template: template },
						success: function (html) {
							templates[template] = html;
							callback(templates[template]);
						}
					});
				}
				else {
					callback(templates[template]);
				}
			},
			renderMenuEvents = function (eventData, callback) {
				getTemplate("menu-events", function (template) {
					var formatted = "";
					for (var event in eventData) {
						var e = eventData[event];
						var eHtml = String.format(template, e._id, e.name, moment(e.start).format(datetimeFormat), moment(e.end).format(datetimeFormat), e.place.name);
						formatted += eHtml;
					}
					callback(formatted);
				});
			},
			popup = function (html, opts) {
				$(html).dialog(opts);
			},
			// utility
			withinSelectedSpan = function (event) {
				var now = moment(),
					hours = currentSpan === 0 ? 12 : (currentSpan === 1 ? 24 : 48),
					high = moment().add(hours, 'h'),
					startDate = moment(event.start),
					endDate = moment(event.end);

				return startDate.isBefore(high) && endDate.isAfter(now);
			},
			bindUi = function (div) {
				div.find('.datepicker').each(function () {
					var input = $(this);
					if (!input.data('bound')) {
						input.datetimepicker({
							timeFormat: timeFormat
						});
						input.data('bound', true);
					}
				});

				div.find('select').each(function () {
					var input = $(this);
					if (!input.data('bound')) {
						div.find('select').selectmenu();
						input.data('bound', true);
					}
				});

				div.find('.autocomplete').each(function () {
					var input = $(this),
						type = input.data('type'),
						url;

					if (!input.data('bound')) {
						if (type === "place") {
							url = urls.placesNames;
						}

						if (url !== null) {
							// get options
							$.ajax({
								url: url,
								type: 'GET',
								cache: true,
								success: function (response) {
									if (response.success) {
										input.autocomplete({
											source: response.body
										});
										input.data('bound', true);
									}
								}
							});
						}
					}
				});
			};

		this.init = function () {
			initializeMap();
			applyHeaderHandlers();
			applySearchHandlers();
			overlayExit.on('click', exitOverlay);
			bindUi($('body'));
			window.fbAsyncInit = initAuthentication;
		};
	};

	$.fn.jsatlas = function () {
		return this.each(function () {
			var el = $(this);

			if (!el.data('jsatlas')) {
				var plugin = new jsAtlas(el).init();
			}
		});
	};
})(jQuery, window);