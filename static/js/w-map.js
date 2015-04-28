(function ($, window) {
	var wMap = function (wMapContainer) {
		var obj = this,
			gMap,
			mapLoaded = false,
			resizeTimer,
			debug = false,
            prodGoogleKey = 'AIzaSyDEQiAImA3u9GB8EiF0NFMZH9Wy10AVTWg',
            testGoogleKey = 'AIzaSyB9EARriTjyHo7LupKAHvazcG245a04c54',
			settings = {
				key: debug ? testGoogleKey : prodGoogleKey,
				initialZoom: 16,
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
			boundChange,
            prevZoom,
			selectedEvent,
			circleData = {
				events: [],
				groups: []
			},
			isMobileDevice = navigator.userAgent.match(/iPhone|iPod|Android|BlackBerry|webOS/i) !== null,
			// elements
			container = $('.container'),
			overlay = $('.overlay'),
			// METHODS
			_controls = function (callback) {
				var el = $('.w-controls');
				if (el.length > 0) {
					var plugin = el.data('wControls');
					if (plugin) {
						callback(plugin);
					}
				}
				return false;
			},
			// google map api
			initializeMap = function (loc, afterLoad) {
				var mapOptions = {
					center: new google.maps.LatLng(loc.lat, loc.lng),
					zoom: loc.zoom ? loc.zoom : settings.initialZoom
				};

				gMap = new google.maps.Map(wMapContainer[0], mapOptions);
				gMap.setOptions({ styles: settings.styleArray });

				prevZoom = mapOptions.zoom;

				google.maps.event.addListener(gMap, 'zoom_changed', zoom_changed);
				google.maps.event.addListener(gMap, 'bounds_changed', bounds_changed);
				// after finish load
				google.maps.event.addListener(gMap, 'tilesloaded', function () {
					mapLoaded = true;
				});

				$(window).off('resize').on('resize', function () {
					clearTimeout(resizeTimer);
					resizeTimer = setTimeout(resizeGoogleMap, 500);
				});

				window.setInterval(function () {
					_controls(function (c) {
						c.loadMapBoundEvents(getBoundsSquare(), function (events) {
							receivedMapEvents(events);
						});
					});
				}, 50000);
			},
            bounds_changed = function () {
            	if (mapLoaded) {
            		window.clearTimeout(boundChange);

            		if (gMap.getZoom() > 12) {
            			boundChange = window.setTimeout(function () {
            				moveBoundsToAllowed();

            				_controls(function (c) {
            					c.loadMapBoundEvents(getBoundsSquare(), function (events) {
            						receivedMapEvents(events, null, true);
            					});
            				});

            				var center = gMap.getCenter(),
								config = {
									lat: center.lat(),
									lng: center.lng(),
									zoom: gMap.getZoom()
								};

            				setCookie('loc', JSON.stringify(config));
            			}, 1000);
            		}
            	}
            },
            zoom_changed = function (e) {
            	var zoom = gMap.getZoom(),
					dir = prevZoom == zoom ? 0 : (prevZoom > zoom ? 0.1 : -0.1);

            	prevZoom = gMap.getZoom();
            	resizeCircles(dir);
            },
			resizeGoogleMap = function () {
				google.maps.event.trigger(gMap, 'resize');
			},
			centerOffset = function (latlng, x) {
				var point1 = gMap.getProjection().fromLatLngToPoint(latlng),
					point2 = new google.maps.Point(x / Math.pow(2, gMap.getZoom())),
					newPoint = new google.maps.Point(point1.x - point2.x, point1.y);

				gMap.setCenter(gMap.getProjection().fromPointToLatLng(newPoint));
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
						var key = multis[g][0],
							events = multis[g][1],
							groupExists = _.some(circleData.groups, function (g) { return g._id === key; }),
							group = {
								_id: key,
								circle: null,
								events: events
							};

						if (groupExists) {
							// group already exists, add each event to existing group. function will check if the event is already in the group or not before adding
							for (var e in group.events) {
								addToGroup(group._id, group.events[e]);
							}
						}
						else {
							// check to see if event exists with shared location
							var eventSameLoc = _.find(circleData.events, function (e) { return createGroupKey(e) === key; });
							if (eventSameLoc) {
								transformToGroup(eventSameLoc);

								for (var e in group.events) {
									addToGroup(key, group.events[e]);
								}
							}
							else {
								drawGroup(group);
							}
						}
					}
				}
			},
			drawGroup = function (group) {
				var circleSize = getGroupCircleSize(group),
					stroke = circleSize / 10,
					c = {
						id: group._id,
						sizing: false,
						isGroup: true,
						strokeColor: "rgb(250, 200, 250)",
						strokeOpacity: 1,
						strokeWeight: stroke > 5 ? 5 : stroke < 2 ? 2 : stroke,
						fillColor: "rgb(150, 50, 150)",
						fillOpacity: settings.blurOpacity,
						map: gMap,
						center: new google.maps.LatLng(group.events[0].loc[1], group.events[0].loc[0]),
						radius: isMobileDevice ? circleSize : circleSize / 10
					};

				var circle = new google.maps.Circle(c);
				group.circle = circle;

				// events within group need to share group circle reference
				for (var e in group.events) {
					// reference to parent
					group.events[e].group = group._id;
					group.events[e].circle = circle;
				}

				if (!isMobileDevice) {
					circleSizeTo(circle, circleSize, 1.6, 0.9);
				}

				circleData.groups.push(group);

				google.maps.event.addListener(circle, 'mouseover', focusGroup);

				google.maps.event.addListener(circle, 'mouseout', function (e) {
					if (this !== selectedEvent) {
						blurCircle.call(this, e);
					}
				});

				google.maps.event.addListener(circle, 'click', function (e) {
					clickGroup.call(this, e);
				});
			},
			addToGroup = function (groupId, event) {
				var existingGroup = _.find(circleData.groups, function (g) { return g._id === groupId; }),
					eventExistsInGroup = _.some(existingGroup.events, function (e) { return e._id === event._id; });

				if (!eventExistsInGroup) {
					event.group = existingGroup._id;
					existingGroup.events.push(event);
				}
			},
			transformToGroup = function (event) {
				destroyCdata(event._id, false);
				var key = createGroupKey(event),
					group = {
						_id: key,
						circle: null,
						events: []
					};

				group.events.push(event);
				drawGroup(group);
				return key;
			},
			drawEvents = function (data) {
				for (var d in data) {
					var key = createGroupKey(data[d]),
					existingEvent = _.find(circleData.events, function (e) { return e._id === data[d]._id; }),
					existingGroup = _.find(circleData.groups, function (g) { return g._id === key; }),
					eventSameLoc = _.find(circleData.events, function (e) { return e._id !== data[d]._id && createGroupKey(e) === key; });

					if (!existingEvent && !existingGroup) {
						drawEvent(data[d]);
					}
					else if (existingGroup) {
						// function will check if event exists in the group before adding
						addToGroup(key, data[d]);
					}
					else if (eventSameLoc) {
						var newGroupId = transformToGroup(eventSameLoc);
						addToGroup(newGroupId, data[d]);
					}
				}
			},
			drawEvent = function (event) {
				var colorArray = colorByTime(event[event.intensity_variable]),
					circleSize = getEventCircleSize(event),
					stroke = circleSize / 10,
					c = {
						id: event._id,
						sizing: false,
						strokeColor: arrayToRGB(getShade(colorArray, -20)),
						strokeOpacity: 1,
						strokeWeight: stroke > 5 ? 5 : stroke < 2 ? 2 : stroke,
						fillColor: arrayToRGB(colorArray),
						fillOpacity: settings.blurOpacity,
						map: gMap,
						center: new google.maps.LatLng(event.loc[1], event.loc[0]),
						radius: isMobileDevice ? circleSize : circleSize / 10
					};

				var circle = new google.maps.Circle(c);

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

				if (!isMobileDevice) {
					circleSizeTo(circle, circleSize, 1.6, 0.9);
				}

				event.color = colorArray;
				event.circle = circle;
				circleData.events.push(event);
			},
			//// bounds
			getBoundsSquare = function () {
				var bounds = gMap.getBounds(),
					ne = bounds.getNorthEast(),
					sw = bounds.getSouthWest(),
					nw = new google.maps.LatLng(ne.lat(), sw.lng()),
					se = new google.maps.LatLng(sw.lat(), ne.lng()),
					square;

				square = [
					[nw.lng(), nw.lat()],
					[ne.lng(), ne.lat()],
					[se.lng(), se.lat()],
					[sw.lng(), sw.lat()],
					[nw.lng(), nw.lat()]
				];

				return square;
			},
			getAllowedBounds = function () {
				var swBounds = new google.maps.LatLng(46.089838, -125.631207),
					neBounds = new google.maps.LatLng(48.993225, -117.053631),
					waBounds = new google.maps.LatLngBounds(swBounds, neBounds);
				//checkLoc = new google.maps.LatLng(lat, lng);

				return waBounds;
			},
			moveBoundsToAllowed = function () {
				return;
				// defunct for now
				var center = gMap.getCenter(),
					allowed = getAllowedBounds();

				if (!allowed.contains(center)) {
					var lat = center.lat(),
						lng = center.lng();

					var maxLng = allowed.getNorthEast().lng();
					var maxLat = allowed.getNorthEast().lat();
					var minLng = allowed.getSouthWest().lng();
					var minLat = allowed.getSouthWest().lat();;

					if (lng < minLng) { lng = minLng; }
					if (lng > maxLng) { lng = maxLng; }
					if (lat < minLat) { lat = minLat; }
					if (lat > maxLat) { lat = maxLat; }

					gMap.setCenter(new google.maps.LatLng(lat, lng));
				}
			},
			// circle utility
			clickGroup = function (e) {
				var clicked = this,
					ref = getCdById(clicked.id, true);

				if (selectedEvent && selectedEvent !== clicked) {
					blurCircle.call(selectedEvent);
					selectedEvent = null;
				}

				focusGroup.call(clicked, ref);
				highlightCircle.call(clicked);

				selectedEvent = clicked;

				// load in referenced documents
				var ids = _.map(ref.events, function (e) { return e._id; });

				_controls(function (c) {
					c.renderEventList(ids, function (pan) {
						centerOffset(clicked.center, pan);
					});
				});
			},
			focusGroup = function (e, cd) {
				var circle = this,
					ref = cd ? cd : getCdById(circle.id, true);

				this.setOptions({
					zIndex: 1,
					strokeColor: "rgb(250, 230, 250)",
				});

				circleHover(circle, ref);
			},
			focusCircle = function (e, cd) {
				var circle = this,
					ref = cd ? cd : getCdById(circle.id, circle.isGroup);

				this.setOptions({
					zIndex: 1,
					fillOpacity: settings.focusOpacity,
					fillColor: arrayToRGB(getShade(ref.color, 20)),
				});

				circleHover(circle);
			},
			highlightCircle = function (e) {
				this.setOptions({
					strokeColor: "#ffffaa"
				});
			},
			blurCircle = function (e) {
				var circle = this,
					ref = getCdById(circle.id, circle.isGroup),
					defaultSize = circle.isGroup ? getGroupCircleSize(ref) : getEventCircleSize(ref);

				clearSizing(circle)

				// set back to default
				if (circle.isGroup) {
					circle.setOptions({
						radius: defaultSize,
						zIndex: 0,
						strokeColor: "rgb(250, 200, 250)",
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

				focusCircle.call(this, ref);
				highlightCircle.call(this);

				_controls(function (c) {
					c.renderEventDetail(ref._id, function (pan) {
						centerOffset(clicked.center, pan);
					});
				});
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
				return false;
			},
			circleSizeTo = function (el, targetSize, rate, secondRate, interval, callback) {
				el.sizing = window.setInterval(function () {
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

					var stroke = newRad / 10;
					el.setOptions({
						radius: newRad,
						strokeWeight: stroke > 5 ? 5 : stroke < 2 ? 2 : stroke,
					});

					if (newRad === targetSize) {
						// circle hit requested size exactly
						clearSizing(el);

						if (callback) {
							callback();
						}
					}
					else {
						var tooFar = rate > 1 ? (el.radius > targetSize) : (el.radius < targetSize);

						if (tooFar) {
							clearSizing(el);
							// circle has gone above requested size, scale back
							if (secondRate) {
								circleSizeTo(el, targetSize, secondRate, null, 100, callback);
							}
							else if (callback) {
								callback();
							}
						}
					}
				}, interval ? interval : 50);
			},
			circleHover = function (el, cd) {
				if (!el.sizing) {
					var cd = cd ? cd : getCdById(el.id, el.isGroup),
						originalSize = el.isGroup ? getGroupCircleSize(cd) : getEventCircleSize(cd),
						growTo = el.radius + (el.radius / 10);

					circleSizeTo(el, growTo, 1.3, null, 100, function () {
						circleSizeTo(el, originalSize, .9, 1.1, 100, function () {
							clearSizing(el);
						});
					});
				}
			},
			clearSizing = function (circle) {
				// clear sizing events
				if (circle.sizing) {
					window.clearInterval(circle.sizing);
					circle.sizing = false;
				}
			},
			resizeCircles = function () {
				for (var e in circleData.events) {
					var cd = circleData.events[e],
						newRad = getEventCircleSize(cd),
						newStroke = newRad / 10;

					clearSizing(cd.circle);
					cd.circle.setOptions({
						radius: newRad,
						strokeWeight: newStroke > 5 ? 5 : newStroke < 2 ? 2 : newStroke,
					});
				}
				for (var g in circleData.groups) {

				}
			},
			getGroupCircleSize = function (cData) {
				var total = _.reduce(cData.events, function (sum, e) { return sum + e._users.length; }, 0);
				return getCircleSize(total);
			},
			getEventCircleSize = function (cData) {
				return getCircleSize(cData._users.length);
			},
			getCircleSize = function (length) {
				var min = 5, max = 400,
					calc = (19 - gMap.getZoom() + length) * 10;

				return calc < min ? min : (calc > max ? max : calc);
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
			createGroupKey = function (event) {
				var loc = event.loc;
				return String.format("{0},{1}", loc[0], loc[1]);
			},
			// events
			receivedMapEvents = function (events, callback, keepOld) {
				if (container.width() === overlay.width()) return;

				var ids = _.map(events, function (e) { return e._id; }),
					grouped = {};

				if (keepOld) {
					// add cData ids to keepIds
					for (var e in circleData.events) {
						if (ids.indexOf(circleData.events[e]._id) === -1) {
							ids.push(circleData.events[e]._id);
						}
					}
					for (var g in circleData.groups) {
						var group = circleData.groups[g];

						for (var e in group.events) {
							if (ids.indexOf(group.events[e]._id) === -1) {
								ids.push(group.events[e]._id);
							}
						}
					}
				}

				// convert to grouped format, group by location
				for (var e in events) {
					var key = createGroupKey(events[e]),
						existing = grouped[key];

					if (existing) {
						existing.push(events[e]);
					}
					else {
						grouped[key] = [];
						grouped[key].push(events[e]);
					}
				}

				// wipe cdata that is not returned by query
				cleanCData(ids);
				drawGroupedData(grouped);

				if (callback) {
					callback(events);
				}
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
			cleanCData = function (keepIds) {
				for (var e in circleData.events) {
					var eventGone = !_.some(keepIds, function (keepId) { return circleData.events[e]._id === keepId; });
					if (eventGone) {
						destroyCdata(circleData.events[e]._id);
					}
				}

				// loop through old cData groups
				for (var g in circleData.groups) {
					// loop through events in group
					for (var e in circleData.groups[g].events) {
						var eventGone = !_.some(keepIds, function (keepId) { return circleData.groups[g].events[e]._id === keepId; });
						if (eventGone) {
							// splice event from group
							circleData.groups[g].events.splice(e, 1);
						}
					}
					if (circleData.groups[g].events.length <= 1) {
						// if group is empty (or has one left, will get redrawn as event later) destroy
						destroyCdata(circleData.groups[g]._id, true);
					}
					//else if (circleData.groups[g].events.length === 1) {
					// if group has one event left, transform to event
					//transformToEvent(circleData.groups[g])
					//}
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
				if (callback) {
					clearSizing(cd.circle);
					circleSizeTo(cd.circle, 0, 0.7, null, 50, function () {
						// blur
						if (selectedEvent && cd && selectedEvent === cd.circle) {
							blurCircle.call(cd.circle);
							selectedEvent = null;
						}
						// remove circle and cdata
						cd.circle.setMap(null);

						if (callback) {
							callback();
						}
					});
				}
				else {
					cd.circle.setMap(null);
				}
			},
			// utility
			getCookie = function (cname) {
				var name = cname + "=";
				var ca = document.cookie.split(';');
				for (var i = 0; i < ca.length; i++) {
					var c = ca[i];
					while (c.charAt(0) == ' ') c = c.substring(1);
					if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
				}
				return "";
			},
			setCookie = function (cname, cvalue) {
				var d = new Date(),
					days = 2;

				d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
				var expires = "expires=" + d.toUTCString();
				document.cookie = cname + "=" + cvalue + "; " + expires;
			};

		this.clean = function (keepers) {
			cleanCData(keepers);
		};

		this.goToNoLoad = function (loc, pan) {
			var latlng = new google.maps.LatLng(loc.lat, loc.lng);

			google.maps.event.clearListeners(gMap, 'bounds_changed');
			window.clearTimeout(boundChange);

			centerOffset(latlng, pan);

			google.maps.event.addListener(gMap, 'bounds_changed', bounds_changed);
		};

		this.goTo = function (loc, pan, afterEventLoad) {
			var latlng = new google.maps.LatLng(loc.lat, loc.lng);

			if (afterEventLoad) {
				google.maps.event.clearListeners(gMap, 'bounds_changed');
				window.clearTimeout(boundChange);

				if (gMap.getZoom() <= 12) {
					gMap.setZoom(13);
					google.maps.event.addListenerOnce(gMap, 'idle', function () {
						centerOffset(latlng, pan);
						google.maps.event.addListenerOnce(gMap, 'idle', function () {
							_controls(function (c) {
								c.loadMapBoundEvents(getBoundsSquare(), function (events) {
									google.maps.event.addListener(gMap, 'bounds_changed', bounds_changed);
									receivedMapEvents(events, function () {
										afterEventLoad();
									});
								});
							});
						});
					});
				}
				else {
					centerOffset(latlng, pan);
					google.maps.event.addListenerOnce(gMap, 'idle', function () {
						_controls(function (c) {
							c.loadMapBoundEvents(getBoundsSquare(), function (events) {
								google.maps.event.addListener(gMap, 'bounds_changed', bounds_changed);
								receivedMapEvents(events, function () {
									afterEventLoad();
								});
							});
						});
					});
				}
			}
			else {
				centerOffset(latlng, pan);
			}
		};

		this.renderEvents = function (events, callback, keepOld) {
			receivedMapEvents(events, callback, keepOld);
		};

		this.select = function (id) {
			// check if new event is in cData, if so, trigger click
			var cd = getCdById(id);
			if (cd) {
				focusCircle.call(cd.circle, cd);
				highlightCircle.call(cd.circle);

				if (selectedEvent && selectedEvent !== cd.circle) {
					blurCircle.call(selectedEvent);
				}

				selectedEvent = cd.circle;
			}
			if (!cd) {
				cd = getCdByIdInGroup(id);
				if (cd) {
					var circle = _.find(circleData.groups, function (g) { return g._id === cd.group; }).circle;
					focusGroup.call(circle, cd);
					highlightCircle.call(circle);
				}
			}
		};

		this.deselect = function () {
			if (selectedEvent) {
				blurCircle.call(selectedEvent);
			}
		};

		this.resize = function () {
			google.maps.event.trigger(gMap, 'resize');
		};

		this.getBounds = function () {
			return getBoundsSquare();
		};

		this.getPosition = function (callback) {
			navigator.geolocation.getCurrentPosition(function (pos) {
				var loc = {
					lat: pos.coords.latitude,
					lng: pos.coords.longitude
				};
				callback(loc);
			});
		};

		this.getNearbyPlaces = function (data, callback) {
			var request = {
				location: new google.maps.LatLng(data.lat, data.lng),
				radius: '5000',
				keyword: data.keyword,
				//types: ['store'],
				rankyBy: google.maps.places.RankBy.DISTANCE
			};

			service = new google.maps.places.PlacesService(gMap);
			service.nearbySearch(request, callback);
		};

		this.init = function () {
			if (navigator.geolocation) {
				navigator.geolocation.getCurrentPosition(function (pos) {
					var loc = {
						lat: pos.coords.latitude,
						lng: pos.coords.longitude
					},
						lastLoc = getCookie("loc");

					if (lastLoc !== "") {
						loc = JSON.parse(lastLoc);
					}

					initializeMap(loc);
				});
			}

			wMapContainer.data('wMap', obj);
		};
	};

	$.fn.wMap = function () {
		return this.each(function () {
			var el = $(this);

			if (!el.data('wMap')) {
				var plugin = new wMap(el).init();
			}
		});
	};
})(jQuery, window);