if (!String.format) {
	String.format = function (format) {
		var args = Array.prototype.slice.call(arguments, 1);
		return format.replace(/{(\d+)}/g, function (match, number) {
			return typeof args[number] !== undefined
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
				focusOpacity: 0.7,
				blurOpacity: 0.5
			},
			user,
            selectedEvent,
			boundChange,
			urls = {
				// map
				mapPlaces: '/map/places',
				// places
				placesSearch: '/places',
				placesNames: '/places/names',
				userPlaces: '/places/user',
				searchAllPlaces: '/places/searchAll',
				// events
				event: '/event',
				eventList: '/event/list',
				eventsForSpan: '/event/span',
				userEvents: '/event/userEvents',
				userOwnedEvents: '/event/userOwnedEvents',
				userPastEvents: '/event/userPastEvents',
				eventAddUser: '/event/addUser',
				eventRemoveUser: '/event/removeUser',
				eventCreate: '/event/create',
				eventUpdate: '/event/update',
				eventDelete: '/event/remove',
				tags: '/event/tags',
				review: '/event/review',
				// views
				renderTemplate: '/template'
			},
			templates = {},
			currentSpan = 0,
			paging = 0,
			reAuthAttempts = 0,
			sizing = [],
			circleData = {
				events: [],
				groups: []
			},
			filters = [],
			datetimeCasualFormat = 'ddd h:mm a',
			datetimeDateFormat = 'MM/DD/YYYY',
			datetimeStrictFormat = 'MM/DD/YYYY h:mm a',
			timeFormat = 'h:mm tt',
			isMobileDevice = navigator.userAgent.match(/iPad|iPhone|iPod|Android|BlackBerry|webOS/i) !== null,
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
			// google map api
			initializeMap = function () {
				var mapOptions = {
					center: new google.maps.LatLng(settings.initialCenter.lat, settings.initialCenter.lng),
					zoom: settings.initialZoom
				};
				gMap = new google.maps.Map(div[0], mapOptions);
				gMap.setOptions({ styles: settings.styleArray });

				// Limit the zoom level
				google.maps.event.addListener(gMap, 'zoom_changed', function (e) {
					if (gMap.getZoom() < 10) {
						gMap.setZoom(10);
					}
				});
			},
			circleSizeTo = function (el, targetSize, rate, secondRate, interval, callback) {
				var ref = _.find(sizing, function (s) { return s.id === el.id; });
				ref.event = window.setInterval(function () {
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
						window.clearInterval(ref.event);
						ref.event = null;

						if (callback) {
							callback();
						}
					}
					else {
						var tooFar = rate > 1 ? (el.radius > targetSize) : (el.radius < targetSize);

						if (tooFar) {
							window.clearInterval(ref.event);
							ref.event = null;
							// circle has gone above requested size, scale back
							if (!ref.waver.trigger) {
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
				var ref = _.find(sizing, function (s) { return s.id === el.id; });
				ref.waver.trigger = true;

				if (ref.waver.event) {
					window.clearInterval(ref.waver.event);
					ref.waver.event = null;
				}
				var sizingRunning = false;
				ref.waver.event = window.setInterval(function () {
					if (!sizingRunning && !ref.event) {
						sizingRunning = true;

						var sizeTo = el.radius + (ref.waver.sw * (el.radius / 20)),
							rate = ref.waver.sw === 1 ? 1.01 : 0.99;

						circleSizeTo(el, sizeTo, rate, null, 100, function () {
							ref.waver.sw = ref.waver.sw > 0 ? -1 : 1;
							sizingRunning = false;
						});
					}
				}, 100);
			},
			clearSizing = function (id, defaultSize) {
				var ref = _.find(sizing, function (s) { return s.id === id; });

				if (defaultSize) {
					// set circle to default size
					var cd = getCdById(id);
					if (!cd) {
						cd = getCdById(id, true);
					}
					if (cd) {
						cd.circle.radius = cd.users.length * 10;
					}
				}
				// clear sizeTo
				if (ref.event) {
					window.clearInterval(ref.event);
					ref.event = null;
				}
				// clear waver
				if (ref.waver.event) {
					window.clearInterval(ref.waver.event);
					ref.waver.event = null;
				}
			},
			drawGroupedData = function (data) {
				var singles = _.filter(data, function (g) { return g.length === 1; }),
					multis = _.map(data, function (g, k) {
						if (g.length > 1) {
							return [k, g];
						};
					});

				if (singles.length > 0) {
					// remap as single array
					singles = _.map(singles, function (a) { return a[0]; });
					drawEvents(singles);
				}
				if (multis.length > 0) {
					drawGroups(multis);
				}
			},
			drawGroups = function (multis) {
				for (var g in multis) {
					if (multis[g]) {
						// group data, lat/lng
						drawGroup(multis[g][1], multis[g][0]);
					}
				}
			},
			drawGroup = function (events, key) {
				var groupExists = _.some(circleData.groups, function (g) { return g._id === key; }),
					group = {
						_id: null,
						circle: null,
						events: events
					};

				// TODO check events in group for changes too?
				if (!groupExists) {
					var radius = getEventCircleSize(_.max(events, function (e) { return e.users.length; })),
						c = {
							id: key,
							isGroup: true,
							strokeColor: "rgb(150, 150, 150)",
							strokeOpacity: 1,
							strokeWeight: radius / 10,
							fillColor: "rgb(250, 250, 250)",
							fillOpacity: 1,
							map: gMap,
							center: new google.maps.LatLng(events[0].place.loc.coordinates[1], events[0].place.loc.coordinates[0]),
							radius: radius
						};

					var circle = new google.maps.Circle(c);
					group._id = key;
					group.circle = circle;

					// events within group need to share group circle reference
					for (var e in group.events) {
						// reference to parent
						group.events[e].group = key;
					}

					circleData.groups.push(group);

					// init sizing
					sizing.push({
						id: key,
						event: null,
						waver: {
							trigger: false,
							sw: 1
						}
					});

					google.maps.event.addListener(circle, 'mouseover', function (e) {
						focusGroup.call(this, e);
					});

					google.maps.event.addListener(circle, 'mouseout', function (e) {
						if (this !== selectedEvent) {
							blurCircle.call(this, e);
						}
					});

					google.maps.event.addListener(circle, 'click', function (e) {
						clickGroup.call(this, e);
					});
				}
			},
			drawEvents = function (data) {
				for (var d in data) {
					drawEvent(data[d]);
				}
			},
			drawEvent = function (event) {
				// only draw event if it is in the selected time window and isn't already in cdata
				if (withinSelectedSpan(event) && !getCdById(event._id)) {
					var colorArray = colorByTime(event[event.intensity_variable]),
						circleSize = getEventCircleSize(event),
						c = {
							id: event._id,
							strokeColor: arrayToRGB(getShade(colorArray, -20)),
							strokeOpacity: 1,
							strokeWeight: circleSize / 10,
							fillColor: arrayToRGB(colorArray),
							fillOpacity: settings.blurOpacity,
							map: gMap,
							center: new google.maps.LatLng(event.place.loc.coordinates[1], event.place.loc.coordinates[0]),
							radius: circleSize
						};

					var circle = new google.maps.Circle(c);

					event.color = colorArray;
					event.circle = circle;
					circleData.events.push(event);

					// init sizing
					sizing.push({
						id: circle.id,
						event: null,
						waver: {
							trigger: false,
							sw: 1
						}
					});

					circleSizeTo(circle, circleSize, 1.2, 0.9);

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
				var pixelOffset = new google.maps.Point((offsetx / scale) || 0, (offsety / scale) || 0);

				var worldCoordinateNewCenter = new google.maps.Point(
					worldCoordinateCenter.x - pixelOffset.x,
					worldCoordinateCenter.y + pixelOffset.y
				);

				var newCenter = GoogleMap.getProjection().fromPointToLatLng(worldCoordinateNewCenter);

				GoogleMap.setCenter(newCenter);
			},
			// circle utility
			focusGroup = function (e) {
				var circle = this,
					ref = getCdById(circle.id, true),
					defaultSize = getEventCircleSize(_.max(ref.events, function (e) { return e.users.length; }));

				if (defaultSize >= 20) {
					setWaver(circle);
				}
			},
			clickGroup = function (e) {
				var clicked = this,
					ref = getCdById(clicked.id, true);

				if (selectedEvent && selectedEvent !== clicked) {
					blurCircle.call(selectedEvent);
					selectedEvent = null;
				}

				this.setOptions({
					zIndex: 1,
					strokeColor: "rgb(0, 250, 250)",
				});

				selectedEvent = clicked;

				overlayGoing.hide();
				showOverlay(ref.events[0].place.name);
				var page = navigatePage(0);
				setGroupEventList(ref.events, page);
			},
			refreshCircle = function (id) {
				getUserEvent(id, function (event) {
					if (getCdById(event._id)) {
						// destroy old event sizing handlers
						destroySizing();
						destroyCdata(event._id, false, function () {
							drawEvent(event);
						});
					}
					else {
						drawEvent(event);
					}
				});
			},
			focusCircle = function (e) {
				var circle = this,
					ref = getCdById(circle.id),
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
				});
			},
			blurCircle = function (e) {
				var circle = this,
					ref = circle.isGroup ? ref = getCdById(circle.id, true) : ref = getCdById(circle.id),
					sizeRef = _.find(sizing, function (s) { return s.id === circle.id; }),
					defaultSize = circle.isGroup ? getEventCircleSize(_.max(ref.events, function (e) { return e.users.length; })) : getEventCircleSize(ref);

				if (sizeRef) {
					window.clearInterval(sizeRef.event);
					sizeRef.event = null;

					// stop waver
					if (sizeRef.waver) {
						window.clearInterval(sizeRef.waver.event);
						sizeRef.waver.event = null;
					}
				}

				// set back to default
				if (circle.isGroup) {
					circle.setOptions({
						radius: defaultSize,
						zIndex: 0,
						strokeColor: "rgb(150, 150, 150)",
					});
				}
				else {
					circle.setOptions({
						radius: defaultSize,
						zIndex: 0,
						fillOpacity: settings.blurOpacity,
						fillColor: arrayToRGB(ref.color),
						strokeColor: arrayToRGB(getShade(ref.color, -20))
					});
				}

				if (circle === selectedEvent) {
					selectedEvent = null;
				}
			},
			circleClick = function (e) {
				var clicked = this,
					ref = getCdById(clicked.id);

				if (selectedEvent && selectedEvent !== clicked) {
					blurCircle.call(selectedEvent);
				}

				selectedEvent = clicked;

				focusCircle.call(this);
				highlightCircle.call(this);
				showOverlay(ref.name);
				var page = navigatePage(0);
				setEventDetail(ref, page);
			},
			getCdById = function (id, isGroup) {
				var target = isGroup ? circleData.groups : circleData.events;
				return _.find(target, function (e) { return e._id === id; });
			},
			getCdByIdInGroup = function (id) {
				// loop through groups and events to get event data
				for (var g in circleData.groups) {
					for (var e in circleData.groups[g].events) {
						if (circleData.groups[g].events[e]._id === id) {
							return circleData.groups[g].events[e];
						}
					}
				}
			},
			getEventCircleSize = function (cData) {
				return cData.users.length * 20;
			},
			getShade = function (rgb, delta) {
				var newRGB = [];
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
			// map API calls
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
			// session/data
			reAuthenticate = function (callback, callbackArgs) {
				console.log("attempting to re-authenticate");
				fbInitLogin(callback, callbackArgs);
			},
			initializeUser = function (auth, callback, callbackArgs) {
				// check our db for this user, if doesn't exist, create
				$.post('/account/authenticate/', auth, function (response) {
					// load user-related events
					if (response.success) {
						user = response.body;
						callback.apply(this, callbackArgs);
					}
					else {
						console.error('user session not initialized');
					}
				});
			},
			// events
			eventLoadingHandler = function () {
				var bounds = gMap.getBounds();
				loadEventsInSpan(function (response) {
					google.maps.event.addListener(gMap, 'bounds_changed', function () {
						window.clearTimeout(boundChange);
						if (gMap.getZoom() > 12) {
							boundChange = window.setTimeout(function () {
								bounds = gMap.getBounds();
								loadEventsInSpan(null, true);
							}, 1000);
						}
					});
				});

				// update data every 500 seconds
				window.setInterval(function () {
					// only load new events if detail is closed (it closes it automatically otherwise)
					refreshCData();
					loadEventsInSpan(null, true);
				}, 50000);
			},
			loadEventsInSpan = function (callback, keepOld) {
				var bounds = gMap.getBounds(),
					square = [
						[bounds.wa.j, bounds.Ea.j],
						[bounds.wa.j, bounds.Ea.k],
						[bounds.wa.k, bounds.Ea.k],
						[bounds.wa.k, bounds.Ea.j],
						[bounds.wa.j, bounds.Ea.j],
					];

				$.ajax({
					url: urls.eventsForSpan,
					type: 'GET',
					data: {
						span: currentSpan,
						filters: filters,
						bounds: square
					},
					success: function (response) {
						if (response.success) {
							var ids = _.map(response.body, function (e) { return e._id; }),
								grouped = {};

							// group by location
							for (var e in response.body) {
								var loc = response.body[e].loc.coordinates,
									key = String.format("{0},{1}", loc[0], loc[1]),
									existing = grouped[key];

								if (existing) {
									existing.push(response.body[e]);
								}
								else {
									grouped[key] = [];
									grouped[key].push(response.body[e]);
								}
							}

							// wipe cdata that is not returned by query
							if (!keepOld) {
								cleanCData();
							}

							// draw returned data, add to cdata
							drawGroupedData(grouped);

							if (callback) {
								callback(response.body);
							}
						}
						else if (response.statusCode === 401) {
							reAuthenticate(loadEventsInSpan);
						}
					}
				});
			},
			refreshCData = function (serverUpdate, callback) { // TODO: test!
				var now = moment(),
					eventIds = [];

				for (var e in circleData.events) {
					var event = circleData.events[e];

					if (moment(event.end) < now) {
						destroyCdata(event._id);
					}
					else {
						// update circle color
						event.color = colorByTime(event[event.intensity_variable]);
						event.circle.strokeColor = arrayToRGB(getShade(colorArray, -20));
						event.circle.fillColor = arrayToRGB(colorArray);

						eventIds.push(event._id)
					}
				}

				for (var g in circleData.groups) {
					var group = circleData.groups[g],
						expiredIndexes = _.map(group.events, function (e, i, list) { if (moment(e.end) < now) { return i; } });

					// sort indexes descending to avoid indexes changing when deleting
					expiredIndexes = expiredIndexes.reverse();

					if (group.events.length === expiredIndexes) {
						// all are expired, delete group
						destroyCdata(group._id, true);
					}
					else if (group.events.length - expiredIndexes.length === 1) {
						// there will be one left, find event that isn't in expired, get that eventId, draw it, and blow away group
						var leftover = _.find(group.events, function (e) { return !_.some(expiredIndexes, function (i) { return e._id === i; }) });
						drawEvent(leftover);
						destroyCdata(group._id, true);
					}
					else {
						for (var i in expiredIndexes) {
							// splice from group's cdata
							circleData.groups[g].events.splice(i, 1);
						}
					}
				}

				if (serverUpdate) {
					//radius =
					//strokeWeight: circleSize / 10,
					if (callback) {
						callback();
					}
				}
			},
			cleanCData = function () {
				// destroy old event sizing handlers
				destroySizing();

				var eventIds = _.map(circleData.events, function (e) { return e._id; });
				for (var e in eventIds) {
					destroyCdata(eventIds[e]);
				}

				var groupIds = _.map(circleData.groups, function (e) { return e._id; });
				for (var g in groupIds) {
					destroyCdata(groupIds[g], true);
				}
			},
			destroySizing = function () {
				if (sizing.length > 0) {
					for (var s in sizing) {
						// sizeTo event?
						if (sizing[s].event) {
							window.clearTimeout(sizing[s].event);
						}
						// waver event
						if (sizing[s].waver.event) {
							window.clearTimeout(sizing[s].waver.event);
						}
					}
				}
			},
			destroyCdata = function (dId, isGroup, callback) {
				var cd,
					index;

				if (isGroup) {
					for (var i in circleData.groups) {
						if (circleData.groups[i]._id === dId) {
							cd = circleData.groups[i];
							index = i;
							break;
						}
					}
					circleData.groups.splice(index, 1);
				}
				else {
					for (var i in circleData.events) {
						if (circleData.events[i]._id === dId) {
							cd = circleData.events[i];
							index = i;
							break;
						}
					}
					circleData.events.splice(index, 1);
				}

				circleSizeTo(cd.circle, 0, 0.7, null, 50, function () {
					// blur
					if (selectedEvent && cd && selectedEvent === cd.circle) {
						blurCircle.call(cd.circle);
						selectedEvent = null;
						exitOverlay();
					}
					// remove circle and cdata
					cd.circle.setMap(null);

					if (callback) {
						callback();
					}
				});
			},
			getUserEvent = function (id, callback) {
				$.get(urls.event, { eventId: id }, function (response) {
					if (response.success) {
						callback(response.body);
					}
					else if (response.statusCode === 401) {
						reAuthenticate(getUserEvent, [callback]);
					}
				});
			},
			getUserEvents = function (callback) {
				$.get(urls.userEvents, function (response) {
					if (response.success) {
						callback(response);
					}
					else if (response.statusCode === 401) {
						reAuthenticate(getUserEvents, [callback]);
					}
				});
			},
			getUserOwnedEvents = function (callback) {
				$.get(urls.userOwnedEvents, function (response) {
					if (response.success) {
						callback(response.body);
					}
					else if (response.statusCode === 401) {
						reAuthenticate(getUserOwnedEvents, [callback]);
					}
				});
			},
			getUserPastEvents = function (callback) {
				$.get(urls.userPastEvents, function (response) {
					if (response.success) {
						callback(response.body);
					}
					else if (response.statusCode === 401) {
						reAuthenticate(getUserPastEvents, [callback]);
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
			// facebook api
			//// authentication
			initAuthentication = function () {
				FB.init({
					appId: '655662931197377',
					cookie: true,
					version: 'v2.0'
				});
				fbInitLogin(eventLoadingHandler);
			},
			fbInitLogin = function (callback, callbackArgs) {
				FB.getLoginStatus(function (auth) {
					if (auth.status === 'connected') {
						var data = {
							token: auth.authResponse.accessToken,
							id: auth.authResponse.userID
						};
						initializeUser(data, callback, callbackArgs);
					}
					else {
						if (isMobileDevice) {
							var loginPopupHack = $('<button id="login-popup-hack">Login</button>');

							loginPopupHack.off('click').on('click', function () {
								fbLoginPrompt(data, callback, callbackArgs);
							});

							header.find('> div:not(".site-logo")').hide();
							header.append(loginPopupHack);
						}
						else {
							fbLoginPrompt(callback, callbackArgs);
						}
					}
				});
			},
			fbLoginPrompt = function (callback, callbackArgs) {
				FB.login(function (response) {
					var data = {
						token: response.authResponse.accessToken,
						id: response.authResponse.userID
					};

					initializeUser(data, callback, callbackArgs);
				}, { scope: 'public_profile,email,user_friends' });
			},
			// header
			applyHeaderHandlers = function () {
				headerMenuBtn.off('click').on('click', function (e) {
					if (selectedEvent) {
						blurCircle.call(selectedEvent);
					}
					setMenuDetail();
				});
				headerFilterBtn.off('click').on('click', function (e) {
					setFiltersView();
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
					loadEventsInSpan();
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
					loadEventsInSpan();
				}
			},
			// overlay
			showOverlay = function (headerTitle) {
				overlayTitle.html('');
				overlayTitle.html(headerTitle);
				container.addClass('show-overlay');
			},
			exitOverlay = function () {
				if (selectedEvent) {
					blurCircle.call(selectedEvent);
					selectedEvent = null;
				}
				container.removeClass('show-overlay');
				currentPage().animate({ width: 0, padding: 0 }, 200, function () {
					overlayBody.find('.page').remove();
				});
			},
			navigatePage = function (dir) {
				var lastPage = overlayBody.find('.page.page' + paging),
					showProps = {
						width: '100%',
						padding: '0px 10px'
					},
					hideProps = {
						width: 0,
						padding: 0
					},
					speed = 200;

				if (paging + dir < 0) {
					return;
				}

				if (dir === 0) {
					var newPage = $(String.format('<div class="page page{0}"></div>', 0));
					// clear all pages
					overlayBody.find('.page').remove();
					// append new base page
					overlayBody.append(newPage);
					newPage.css('float', 'right');
					paging = 0;
					overlayBody.find('.page.page' + paging).animate(showProps, speed);
				}
				else {
					if (dir < 0) {
						// user hit back button, hide then remove the next page
						lastPage.css('float', 'right'); // swipe --->
						lastPage.animate(hideProps, speed, function () {
							$(this).remove();
						});

						// previous page coming back
						var prevPage = overlayBody.find(String.format('.page.page{0}', paging + dir));
						prevPage.css('float', 'left');
						prevPage.animate(showProps, speed);
					}
					else {
						// user is navigating to the next page, hide prev page, create new
						lastPage.css('float', 'left'); // swipe <---
						lastPage.animate(hideProps, speed);
						var newPage = $(String.format('<div class="page page{0}"></div>', paging + dir));
						overlayBody.append(newPage);
						newPage.animate(showProps, speed);
					}
					paging += dir;
				}

				if (paging === 0) {
					overlayExit.removeClass('chevron-left');
					overlayExit.addClass('chevron-right');
					overlayExit.off('click').on('click', exitOverlay);
				}
				else {
					overlayExit.removeClass('chevron-right');
					overlayExit.addClass('chevron-left');
					overlayExit.off('click').on('click', function (e) {
						navigatePage(-1);
					});
				}

				return currentPage();
			},
			currentPage = function () {
				return overlayBody.find('> .page.page' + paging);
			},
			//// event detail
			setGroupEventList = function (events, div) {
				renderEventList(events, function (list) {
					div.html(list);

					div.find('.event').off('click').on('click', function (e) {
						var div = $(this),
							eventId = div.data('id'),
							eventRef = getCdByIdInGroup(eventId),
							page = navigatePage(0);

						setEventDetail(eventRef, page);
					});
				});
			},
			applyGoingHandlers = function (cData, div) {
				var connections = div.find('.connection-info'),
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
								var indexOfUser = cData.users.indexOf(user.facebook_id),
									size = getEventCircleSize(cData);

								// remove locally
								cData.users.splice(indexOfUser, 1);

								overlayGoing.removeClass('check');
								overlayGoing.removeClass('green');
								overlayGoing.addClass('unchecked');
								clearSizing(cData._id);
								circleSizeTo(cData.circle, size, 0.9, null, 50, function () {
									setWaver(cData.circle);
								});
								numAttending.html(parseInt(cData.users.length, 10));
							}
						});
					}
					else {
						addEventUser(cData._id, function (response) {
							if (response.success) {
								// add locally
								cData.users.push(user.facebook_id);
								var size = getEventCircleSize(cData);

								overlayGoing.removeClass('unchecked');
								overlayGoing.addClass('check');
								overlayGoing.addClass('green');
								clearSizing(cData._id);
								circleSizeTo(cData.circle, size, 1.1, null, 50, function () {
									setWaver(cData.circle);
								});
								numAttending.html(parseInt(cData.users.length, 10));
							}
						});
					}
				});
			},
			setEventDetail = function (event, div) {
				var circle = event.group ? _.find(circleData.groups, function (g) { return g._id === event.group; }).circle : event.circle,
					model = jQuery.extend(true, {}, event);

				delete model.circle; // circular reference.. PUN! <- looking at this weeks later made me lol

				getTemplate('event-detail', model, false, function (template) {
					div.html(template);

					var body = div.find('.event-body'),
						when = div.find('.when'),
						where = div.find('.where'),
						what = div.find('.what'),
						connections = div.find('.connection-info'),
						numAttending = connections.find('.num-attending'),
						friendCount = connections.find('.friend-count'),
						friendsList = connections.find('.friend-list');

					// make sure cData.users exists
					if (event.users) {
						// initialize 'going' checkbox by checking if user is in event.users on client
						if (_.some(event.users, function (u) { return u === user.facebook_id; })) {
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

					// apply event detail to template
					when.html(moment(event.start).format(datetimeCasualFormat) + " - " + moment(event.end).format(datetimeCasualFormat));
					when.append($(String.format('<div class="intensity">{0}</div>', event.intensity_variable === "end" ? "show up any time before end" : "show up before start")));
					where.html(String.format('<div class="place">{0}</div><div class="address">{1}</div>', event.place.name, event.place.vicinity));
					where.data('created-by', event.created_by);
					what.html(event.desc);

					// going checkbox event handlers
					overlayGoing.show();
					applyGoingHandlers(event, div);
					numAttending.html(event.users.length);

					// friends
					var attendingFriends = _.filter(user.friends, function (f) {
						if (_.some(event.users, function (u) { return u === f.facebook_id; })) {
							return f;
						}
					});
					friendCount.html(attendingFriends.length + " friend" + (attendingFriends.friends === 1 ? "" : "s"));
					for (var f in attendingFriends) {
						var friend = attendingFriends[f],
							pic = $('<img src="' + friend.picture_url + '">');

						// show friend picture in friendListDiv
						friendsList.append(pic);
					}

					// center the event's circle
					gMap.setCenter(circle.center);
					gMap.panBy(overlay.width() / 2, 0);
				});
			},
			//// main menu
			setMenuDetail = function () {
				if (selectedEvent && circleData[selectedEvent.id]) {
					blurCircle.call(circleData[selectedEvent.id].circle);
					selectedEvent = null;
				}

				if (user) {
					var username = user.first_name + " " + (user.last_name && user.last_name.length > 0 ? user.last_name.substring(0, 1) : "");
					showOverlay(username);
					var page = navigatePage(0);
					overlayGoing.hide();

					getTemplate('main-menu', null, true, function (template) {
						page.html(template);

						applyMenuHandlers();

						getUserEvents(function (response) {
							var data = response.body,
								eventsDiv = page.find('.schedule .scheduled-events');

							renderEventList(data, function (html) {
								eventsDiv.html(html);
								applyMenuScheduleEventHandlers();
							});
						});

						// display friends
						var friendCountSpan = page.find('.fb-connections .friend-count'),
							friendListDiv = page.find('.fb-connections .friend-list');

						friendCountSpan.html(user.friends.length + " friend" + (user.friends > 1 ? "s" : ""));

						for (var f in user.friends) {
							var friend = user.friends[f],
								pic = $('<img src="' + friend.picture_url + '">');

							// show friend picture in friendListDiv
							friendListDiv.append(pic);
						}
					});
				}
			},
			applyMenuHandlers = function () {
				var page = currentPage(),
					createEventBtn = page.find('.create-event'),
					manageEventsBtn = page.find('.manage-events'),
					pastEventsBtn = page.find('.past-events');

				createEventBtn.off('click').on('click', createEventHandler);
				manageEventsBtn.off('click').on('click', function (e) {
					manageEventsHandler(1);
				});
				pastEventsBtn.off('click').on('click', function (e) {
					pastEventsHandler(e, 1);
				});
			},
			applyMenuScheduleEventHandlers = function () {
				// clicking an event in schedule
				var menuScheduleEvents = currentPage().find('.schedule .event-list .event');
				menuScheduleEvents.off('click').on('click', function (e) {
					var eId = $(this).data('id'),
						cd = getCdById(eId);

					if (!cd) {
						cd = getCdByIdInGroup(eId);
						var circle = _.find(circleData.groups, function (g) { return g._id === cd.group; }).circle;

						gMap.setCenter(new google.maps.LatLng(cd.place.loc.coordinates[1], cd.place.loc.coordinates[0]));
						gMap.panBy(overlay.width() / 2, 0);
						clickGroup.call(circle, e);
					}
					else {
						gMap.setCenter(new google.maps.LatLng(cd.place.loc.coordinates[1], cd.place.loc.coordinates[0]));
						gMap.panBy(overlay.width() / 2, 0);
						circleClick.call(cd.circle, e);
					}
				});
			},
			////// create event
			createEventHandler = function (e) {
				getAllEventTags(function (tags) {
					getTemplate("create-event", tags, true, function (html) {
						var page = navigatePage(1);
						page.html(html);
						bindUi(page);

						// create submit click handler
						page.find('input[type="button"]').off('click').on('click', createEvent);

						// load in user's places
						getUserPlaces(function (places) {
							var select = page.find('select[name="place"]');
							userPlacesHandler(places, select);
						});
					});
				});
			},
			createEvent = function (e) {
				var form = $(this).parents('form:first'),
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

							var cd = getCdById(newEvent._id);
							circleClick.call(cd.circle);
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
			userPlacesHandler = function (places, placeSelect) {
				var newOption = $('<option value="new">- add another place -</option>');

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
							var page = navigatePage(1);
							placeSelect.val('');
							placeSelect.selectmenu('refresh');
							getTemplate('add-user-place', null, true, function (template) {
								page.html(template);
								page.find('input[type=button]').off('click').on('click', function (e) {
									addUserPlaceHandler(function (op) {
										placeSelect.append(op);
										placeSelect.selectmenu("refresh");
										// go back to previous page
										navigatePage(-1);
									});
								});
							});
						}
					}
				});
				placeSelect.selectmenu('refresh');
			},
			addUserPlaceHandler = function (callback) {
				var page = currentPage(),
					placeName = page.find('input[name="place"]').val(),
					resultsDiv = page.find('.results');

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

							place.off('click').on('click', function (e) {
								addUserPlaceClick.call(this, callback);
							});

							resultsDiv.append(place);
						}
					}
				});
			},
			addUserPlaceClick = function (callback) {
				var placeId = $(this).data('id'),
					name = $(this).data('name');

				// add place to user
				$.ajax({
					url: urls.userPlaces,
					type: 'POST',
					data: { placeId: placeId },
					success: function (response) {
						if (response.success) {
							var place = response.body,
								newOption = $(String.format('<option value="{0}" selected="selected">{1}</option>', placeId, name));

							if (callback) {
								callback(newOption);
							}
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
			////// manage events
			manageEventsHandler = function (dir) {
				getUserOwnedEvents(function (userOwned) {
					if (userOwned.length > 0) {
						renderEventList(userOwned, function (html) {
							var list = $('<div class="event-list"></div>');

							list.html(html);
							var page = navigatePage(dir);
							page.html(list);

							// event click needs to load event detail
							page.find('.event').off('click').on('click', editEventHandler);
						});
					}
					else {
						var page = navigatePage(dir);
						page.html('<p>You have not created any events.</p>');
					}
				});
			},
			editEventHandler = function (e) {
				var eventId = $(this).data('id');

				getUserEvent(eventId, function (event) {
					getAllEventTags(function (tags) {
						// set selected status here
						for (var e in event.tags) {
							for (var t in tags) {
								if (tags[t].name === event.tags[e].name) {
									tags[t].selected = true;
								}
							}
						}
						getTemplate("edit-event", tags, false, function (html) {
							// load in user's places
							getUserPlaces(function (places) {
								page = navigatePage(1);
								page.html(html);

								var select = page.find('select[name="place"]');
								userPlacesHandler(places, select);
								bindModelToForm(event, page);
								bindUi(page);

								// create submit click handler
								page.find('.glyph.remove').off('click').on('click', deleteEvent);
								page.find('input[type="button"]').off('click').on('click', saveEvent);
							});
						});
					});
				})
			},
			saveEvent = function (e) {
				var form = $(this).parents('form:first'),
					formData = form.serialize();

				// clear previous errors, if any
				form.find('input, select, textarea').removeClass('error');
				form.find('.error').html('');

				$.ajax({
					url: urls.eventUpdate,
					type: 'POST',
					data: formData,
					success: function (response) {
						if (response.success) {
							manageEventsHandler(-1);
							// TODO: check if it needs to join a group
							refreshCircle(response.body);
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
			deleteEvent = function (e) {
				var form = currentPage().find('form:visible'),
					eventId = form.find('input[name="_id"]').val();

				// clear previous errors, if any
				form.find('input, select, textarea').removeClass('error');
				form.find('.error').html('');

				$.ajax({
					url: urls.eventDelete,
					type: 'POST',
					data: { eventId: eventId },
					success: function (response) {
						if (response.success) {
							manageEventsHandler(-1);
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
			////// past events
			pastEventsHandler = function (e, nav) {
				getUserPastEvents(function (pastEvents) {
					if (pastEvents.length > 0) {
						renderEventList(pastEvents, function (html) {
							var page = navigatePage(nav);
							page.append(html);

							// event click needs to load event detail
							page.find('.event').off('click').on('click', function (e) {
								var eventId = $(this).data('id');

								getUserEvent(eventId, function (event) {
									page = navigatePage(1);
									setPastEventDetail(event, page);
								})
							});
						});
					}
					else {
						var page = navigatePage(nav);
						page.html('<p>You have not gone to any events.</p>');
					}
				});
			},
			setPastEventDetail = function (event, div) {
				getTemplate('past-event-detail', event, false, function (template) {
					div.html(template);
					bindUi(div);

					var body = div.find('.event-body'),
						when = div.find('.when'),
						where = div.find('.where'),
						what = div.find('.what'),
						connections = div.find('.connection-info'),
						numAttending = connections.find('.num-attending'),
						friendCount = connections.find('.friend-count'),
						friendsList = connections.find('.friend-list'),
						addReviewLink = div.find('.add-review');

					overlayGoing.hide();

					// apply event detail to template
					//when.html(moment(event.start).format(datetimeCasualFormat) + " - " + moment(event.end).format(datetimeCasualFormat));
					//when.append($(String.format('<div class="intensity">{0}</div>', event.intensity_variable === "end" ? "show up any time before end" : "show up before start")));
					//where.html(String.format('<div class="place">{0}</div><div class="address">{1}</div>', event.place.name, event.place.vicinity));
					//where.data('created-by', event.created_by);
					//what.html(event.desc);

					numAttending.html(event.users.length);

					// friends
					var attendingFriends = _.filter(user.friends, function (f) {
						if (_.some(event.users, function (u) { return u === f.facebook_id; })) {
							return f;
						}
					});
					friendCount.html(attendingFriends.length + " friend" + (attendingFriends.friends === 1 ? "" : "s"));
					for (var f in attendingFriends) {
						var friend = attendingFriends[f],
							pic = $('<img src="' + friend.picture_url + '">');

						// show friend picture in friendListDiv
						friendsList.append(pic);
					}

					if (!_.some(event.reviews, function (r) { return r.user_id === user._id; })) {
						// add review click
						addReviewLink.off('click').on('click', function (e) {
							addReviewHandler(event);
						});
					}
					else {
						addReviewLink.hide();
					}
				});
			},
			addReviewHandler = function (event) {
				getTemplate('add-review', event, true, function (html) {
					var page = navigatePage(1);
					page.append(html);
					bindUi(page);

					var rating = page.find('input[name="rating"]'),
						submitBtn = page.find('.create-btn'),
						form = page.find('form');

					page.find('.rating').each(function () {
						var div = $(this),
							stars = div.find('.star');

						stars.each(function () {
							$(this).hover(function (e) {
								var star = $(this),
									index = stars.index(star);

								stars.removeClass('gold');

								for (var i = 0; i <= index; i++) {
									var gold = stars.eq(i);
									gold.addClass('gold');
								}
							});

							$(this).click(function (e) {
								var star = $(this),
									index = stars.index(star);

								rating.val(index + 1);
							});
						});

						div.off('mouseout').on('mouseout', function (e) {
							// set rating to input
							stars.each(function () {
								var star = $(this);

								if (stars.index(star) < rating.val()) {
									star.addClass('gold');
								}
								else {
									star.removeClass('gold');
								}
							});
						});
					});

					submitBtn.click(function () {
						$.post(urls.review, form.serialize(), function (response) {
							if (response.success) {
								pastEventsHandler(null, -1);
							}
						})
					});
				});
			},
			//// filters
			setDefaultFilters = function () {
				var tags = getAllEventTags(function (tags) {
					filters = _.map(tags, function (t) { return t.name; });
				});
			},
			setFiltersView = function () {
				var tags = getAllEventTags(function (tags) {
					getTemplate('set-filters', tags, false, function (template) {
						overlayGoing.hide();
						showOverlay("Filter Events");
						var page = navigatePage(0);
						page.html(template);

						page.find('.tag').each(function () {
							var div = $(this),
								filter = div.find('span'),
								fType = filter.data('name');

							// check if not active, set disabled
							if (!_.some(filters, function (f) { return f === fType; })) {
								div.addClass('disabled');
							}

							// on click
							div.off('click').on('click', function (e) {
								var div = $(this),
									filter = div.find('span'),
									fType = filter.data('name');

								if (div.hasClass('disabled')) {
									filters.push(fType);
									div.removeClass('disabled');
								}
								else {
									var fIndex = filters.indexOf(fType);
									if (fIndex >= 0) {
										filters.splice(fIndex, 1);
									}
									div.addClass('disabled');
								}
							});
						});

						page.find('.apply-filters').off('click').on('click', function (e) {
							loadEventsInSpan(exitOverlay);
						});
					});
				});
			},
			getAllEventTags = function (callback) {
				$.ajax({
					url: urls.tags,
					type: 'GET',
					success: function (response) {
						if (response.success) {
							callback(response.body);
						}
					}
				});
			},
			// views
			getTemplate = function (template, modelData, cache, callback) {
				if (modelData) {
					modelData = JSON.stringify(modelData);
				}
				if (!templates[template]) {
					// template hasn't been loaded by server yet, load and cache locally
					$.ajax({
						url: urls.renderTemplate,
						type: 'GET',
						data: { template: template, model: modelData },
						success: function (html) {
							if (cache) {
								templates[template] = html;
							}
							callback(html);
						}
					});
				}
				else {
					callback(templates[template]);
				}
			},
			renderEventList = function (eventData, callback) {
				getTemplate("event-list-item", null, true, function (template) {
					var div = $('<div class="event-list"></div>'),
						formatted = "";
					for (var event in eventData) {
						var e = eventData[event];

						if (e._id) {
							var eHtml = String.format(template, e._id, e.name, moment(e.start).format(datetimeCasualFormat), moment(e.end).format(datetimeCasualFormat), e.place.name);
							formatted += eHtml;
						}
					}
					div.html(formatted);
					callback(div);
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
			bindModelToForm = function (model, form) {
				for (var p in model) {
					var input = form.find(String.format('[name="{0}"]', p));

					if (p === "start" || p === "end") {
						// parse date
						model[p] = moment(model[p]).format(datetimeStrictFormat);
					}
					else if (p === "place") {
						model[p] = model[p]._id;
					}

					input.val(model[p]);
				}

				form.find('.multi').each(function () {
					var multi = $(this).data('multi');
					if (multi) {
						multi.refreshByInput();
					}
				});
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
						input.selectmenu();
						input.selectmenu('refresh');
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

				div.find('.multi').multi();

				div.find('.dateformat').each(function () {
					var span = $(this),
						date = moment(span.html()),
						format = span.data('format');

					if (format === "casual") {
						span.html(date.format(datetimeCasualFormat));
					}
					else if (format === "date") {
						span.html(date.format(datetimeDateFormat));
					}
				});
			};

		this.init = function () {
			initializeMap();
			applyHeaderHandlers();
			applySearchHandlers();
			setDefaultFilters();
			overlayExit.on('click', exitOverlay);
			bindUi($('body'));
			window.fbAsyncInit = initAuthentication;

			$('.site-logo').click(function () {
				window.location.reload();
			});

			div.data('jsatlas', obj);
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