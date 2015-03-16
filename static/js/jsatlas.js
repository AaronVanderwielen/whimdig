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
			socket,
			socketId,
			div = element,
			gMap,
			mapLoaded = false,
			resizeTimer,
            prodGoogleKey = 'AIzaSyB-COXOajhbFyq4fRpnbXOvwJJ97ghKrkE', testGoogleKey = 'AIzaSyB9EARriTjyHo7LupKAHvazcG245a04c54', prodFbApi = { appId: '793549090738791', xfbml: true, version: 'v2.2' }, testFbApi = { appId: '655662931197377', cookie: true, version: 'v2.0' },
			settings = {
			    key: prodGoogleKey,
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
			user,
            selectedEvent,
			boundChange,
			urls = {
			    // map
			    mapPlaces: '/map/places',
			    // places
			    place: '/places',
			    placesPastEvents: '/places/pastEvents',
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
			pageNames = {
			    eventDetail: 'event-detail',
			    eventGroupDetail: 'event-group-detail',
			    createEvent: 'create-event',
			    editEvent: 'edit-event',
			    addPlace: 'add-place',
			    eventList: 'event-list',
			    pastEventList: 'past-event-list',
			    pastEventDetail: 'past-event-detail',
			    addReview: 'add-review',
			    placeDetail: 'place-detail',
			    filters: 'filters',
			    menu: 'menu'
			},
			currentSpan = 0,
			paging = 0,
			reAuthAttempts = 0,
			circleData = {
			    events: [],
			    groups: []
			},
			filters = [],
			datetimeCasualFormat = 'ddd h:mm a',
			datetimeDateFormat = 'MM/DD/YYYY',
			datetimeStrictFormat = 'MM/DD/YYYY h:mm a',
			timeFormat = 'h:mm tt',
			fbPhotoUrl = "//graph.facebook.com/{0}/picture",
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
			initializeMap = function (loc, afterLoad) {
			    var mapOptions = {
			        center: new google.maps.LatLng(loc.lat, loc.lng),
			        zoom: loc.zoom ? loc.zoom : settings.initialZoom
			    };

			    gMap = new google.maps.Map(div[0], mapOptions);
			    gMap.setOptions({ styles: settings.styleArray });

			    // Limit the zoom level
			    google.maps.event.addListener(gMap, 'zoom_changed', function (e) {
			        if (gMap.getZoom() < 13) {
			            gMap.setZoom(13);

			            var center = gMap.getCenter(),
							loc = {
							    lat: center.lat(),
							    lng: center.lng(),
							    zoom: gMap.getZoom()
							};
			            setCookie("last" + user.facebook_id, JSON.stringify(loc));
			        }
			    });

			    // after finish load
			    google.maps.event.addListener(gMap, 'tilesloaded', function (e) {
			        if (!mapLoaded) {
			            if (afterLoad) {
			                afterLoad();
			            }
			            mapLoaded = true;
			        }
			    });
			},
			resizeGoogleMap = function () {
			    google.maps.event.trigger(gMap, 'resize');
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

		            el.setOptions({
		                radius: newRad
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
                        originalSize = el.isGroup ? getEventCircleSize(_.max(cd.events, function (e) { return e.users.length; })) : getEventCircleSize(cd),
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
		        var radius = getEventCircleSize(_.max(group.events, function (e) { return e.users.length; })),
                    c = {
                        id: group._id,
                        sizing: false,
                        isGroup: true,
                        strokeColor: "rgb(150, 150, 150)",
                        strokeOpacity: 1,
                        strokeWeight: radius / 10,
                        fillColor: "rgb(250, 250, 250)",
                        fillOpacity: 1,
                        map: gMap,
                        center: new google.maps.LatLng(group.events[0].loc.coordinates[1], group.events[0].loc.coordinates[0]),
                        radius: radius
                    };

		        var circle = new google.maps.Circle(c);
		        group.circle = circle;

		        // events within group need to share group circle reference
		        for (var e in group.events) {
		            // reference to parent
		            group.events[e].group = group._id;
		            group.events[e].circle = circle;
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
		    transformToGroup = function (event, callback) {
		        destroyCdata(event._id, false, function () {
		            var key = createGroupKey(event),
                        group = {
                            _id: key,
                            circle: null,
                            events: []
                        };

		            group.events.push(event);
		            drawGroup(group);

		            if (callback) {
		                callback(key);
		            }
		        });
		    },
		    transformToEvent = function (group, callback) {
		        var event = group.events[0];

		        // remove reference to parent group
		        delete event.group;

		        // remove group circle
		        destroyCdata(group._id, true, function () {
		            drawEvent(event);

		            if (callback) {
		                callback(key);
		            }
		        });
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
		                transformToGroup(eventSameLoc, function (newGroupId) {
		                    addToGroup(newGroupId, data[d]);
		                });
		            }
		        }
		    },
		    drawEvent = function (event) {
		        var colorArray = colorByTime(event[event.intensity_variable]),
                    circleSize = getEventCircleSize(event),
                    c = {
                        id: event._id,
                        sizing: false,
                        strokeColor: arrayToRGB(getShade(colorArray, -20)),
                        strokeOpacity: 1,
                        strokeWeight: (circleSize / 10) > 5 ? 5 : (circleSize / 10),
                        fillColor: arrayToRGB(colorArray),
                        fillOpacity: settings.blurOpacity,
                        map: gMap,
                        center: new google.maps.LatLng(event.loc.coordinates[1], event.loc.coordinates[0]),
                        radius: circleSize
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

		        circleSizeTo(circle, circleSize, 1.2, 0.9);

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
                    ref = getCdById(clicked.id, true),
                    pan = !container.hasClass('show-overlay');

		        if (selectedEvent && selectedEvent !== clicked) {
		            blurCircle.call(selectedEvent);
		            selectedEvent = null;
		        }

		        focusGroup.call(clicked, ref);
		        overlayGoing.hide();

		        // load in referenced documents
		        var ids = _.map(ref.events, function (e) { return e._id; });
		        getEvents(ids, function (eventData) {
		            ref.events = eventData;
		            showOverlay(ref.events[0].place.name);
		            var page = navigatePage(0, pageNames.eventGroupDetail);
		            selectedEvent = clicked;
		            setGroupEventList(ref, page, pan);
		        });
		    },
		    focusGroup = function (e, cd) {
		        var circle = this,
                    ref = cd ? cd : getCdById(circle.id, true);

		        this.setOptions({
		            zIndex: 1,
		            strokeColor: "rgb(0, 250, 250)",
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
                    defaultSize = circle.isGroup ? getEventCircleSize(_.max(ref.events, function (e) { return e.users.length; })) : getEventCircleSize(ref);

		        clearSizing(circle)

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
                    ref = getCdById(clicked.id),
                    pan = !container.hasClass('show-overlay');

		        if (selectedEvent && selectedEvent !== clicked) {
		            blurCircle.call(selectedEvent);
		        }

		        selectedEvent = clicked;

		        focusCircle.call(this, ref);
		        highlightCircle.call(this);
		        showOverlay(ref.name);
		        var page = navigatePage(0, pageNames.eventDetail);
		        setEventDetail(ref, page, pan);
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
		        var min = 20, max = 400,
                    calc = cData.users.length * 10;

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
		        var loc = event.loc.coordinates;
		        return String.format("{0},{1}", loc[0], loc[1]);
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
		                        moveBoundsToAllowed();
		                        loadEventsInSpan();

		                        var center = gMap.getCenter(),
                                    loc = {
                                        lat: center.lat(),
                                        lng: center.lng(),
                                        zoom: gMap.getZoom()
                                    };

		                        setCookie("last" + user.facebook_id, JSON.stringify(loc));
		                    }, 1000);
		                }
		            });
		        });

		        $(window).off('resize').on('resize', function () {
		            clearTimeout(resizeTimer);
		            resizeTimer = setTimeout(resizeGoogleMap, 500);
		        });

		        // update data every 500 seconds
		        window.setInterval(function () {
		            loadEventsInSpan();
		        }, 50000);
		    },
		    loadEventsInSpan = function (callback) {
		        if ($('.jsatlas').width() === 0) {
		            return;
		        }

		        var square = getBoundsSquare();

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
		                    eventsLoaded(response, callback);
		                }
		                else if (response.statusCode === 401) {
		                    reAuthenticate(loadEventsInSpan);
		                }
		            }
		        });
		    },
		    eventsLoaded = function (response, callback) {
		        var ids = _.map(response.body, function (e) { return e._id; }),
                    grouped = {};

		        // convert to grouped format, group by location
		        for (var e in response.body) {
		            var key = createGroupKey(response.body[e]),
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
		        cleanCData(ids);
		        drawGroupedData(grouped);

		        if (callback) {
		            callback(response.body);
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

		        //var groupIds = _.map(circleData.groups, function (e) { return e._id; });
		        for (var g in circleData.groups) {
		            for (var e in circleData.groups[g].events) {
		                var eventGone = !_.some(keepIds, function (keepId) { return circleData.groups[g].events[e]._id === keepId; });
		                if (eventGone) {
		                    // splice event from group
		                    circleData.groups[g].events.splice(e, 1);
		                }
		            }
		            if (circleData.groups[g].events.length === 0) {
		                // if group is empty, destroy
		                destroyCdata(groupIds[g], true);
		            }
		            else if (circleData.groups[g].events.length === 1) {
		                // if group has one event left, transform to event
		                transformToEvent(circleData.groups[g])
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
		        clearSizing(cd.circle);
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
		    getEvents = function (ids, callback) {
		        $.get(urls.eventList, { ids: ids }, function (response) {
		            if (response.success) {
		                callback(response.body);
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
                        //if (response.success) {
                        callback(response);
                        //}
                        //else if (response.statusCode === 401) {
                        //	reAuthenticate(addEventUser, [id, callback]);
                        //}
                    }
                });
            },
            // facebook api
            //// authentication
            initAuthentication = function (callback) {
                FB.init(prodFbApi);
                fbInitLogin(callback);
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
                    if (currentPage().data('name') === pageNames.menu) {
                        exitOverlay();
                    }
                    else {
                        if (selectedEvent) {
                            blurCircle.call(selectedEvent);
                        }
                        setMenuDetail();
                    }
                });
                headerFilterBtn.off('click').on('click', function (e) {
                    if (selectedEvent) {
                        blurCircle.call(selectedEvent);
                    }
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
                }
                container.removeClass('show-overlay');
                currentPage().animate({ width: 0, padding: 0 }, 200, function () {
                    overlayBody.find('.page').remove();
                    google.maps.event.trigger(gMap, 'resize');
                });
            },
            navigatePage = function (dir, newPageName) {
                var lastPage = overlayBody.find('.page.page' + paging),
                    showProps = {
                        width: '100%'
                    },
                    hideProps = {
                        width: 0
                    },
                    speed = 200;

                if (paging + dir < 0) {
                    return;
                }

                if (dir === 0) {
                    var existingPage = $('.page.page0'),
                        newPage = $(String.format('<div class="page page{0}" data-name="{1}"></div>', 0, newPageName));

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
                        prevPage.css({
                            display: 'block',
                            float: 'left',
                        });
                        prevPage.animate(showProps, speed);
                    }
                    else {
                        // user is navigating to the next page, hide prev page, create new
                        lastPage.css('float', 'left'); // swipe <---
                        lastPage.animate(hideProps, speed, function () {
                            lastPage.css('display', 'none');
                        });
                        var newPage = $(String.format('<div class="page page{0}" data-name="{1}"></div>', paging + dir, newPageName));
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
            setEventDetail = function (event, div, pan) {
                var circle = event.group ? _.find(circleData.groups, function (g) { return g._id === event.group; }).circle : event.circle;

                getUserEvent(event._id, function (event) {
                    getTemplate('event-detail', event, function (template) {
                        div.html(template);
                        overlayTitle.html('');
                        overlayTitle.html(event.name);

                        var body = div.find('.event-body'),
                            when = div.find('.when'),
                            where = div.find('.where'),
                            what = div.find('.what'),
                            connections = div.find('.connection-info'),
                            numAttending = connections.find('.num-attending'),
                            friendCount = connections.find('.friend-count'),
                            friendsList = connections.find('.friend-list'),
                            fbPhoto = div.find('.fb-photo'),
                            chat = div.find('.chat'),
                            chatsend = chat.find('.glyph.play'),
                            chatlist = chat.find('.chat-list'),
                            chatbox = chat.find('.chat-input');

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
                        where.data('id', event.place._id);
                        where.data('created-by', event.created_by);
                        what.html(event.desc);

                        // click event info goes to place detail
                        where.off('click').on('click', function (e) {
                            var placeId = $(this).data('id'),
                                page = navigatePage(0, pageNames.placeDetail);

                            setPlaceDetail(placeId, page);
                        });

                        // going checkbox event handlers
                        overlayGoing.show();
                        applyGoingHandlers(event, div);
                        numAttending.html(event.users.length);

                        // friends
                        var attendingFriends = _.filter(user.friends, function (f) {
                            if (_.some(event.users, function (u) { return u === f; })) {
                                return f;
                            }
                        });
                        friendCount.html(attendingFriends.length + " friend" + (attendingFriends.friends === 1 ? "" : "s"));
                        for (var f in attendingFriends) {
                            var friendId = attendingFriends[f],
                                pic = $('<img>');

                            console.log(friend);
                            pic.attr('src', String.format(fbPhotoUrl, friendId));

                            // show friend picture in friendListDiv
                            friendsList.append(pic);
                        }

                        // only want to pan when the overlay just opened
                        if (pan) {
                            // center the event's circle
                            gMap.setCenter(circle.center);
                            gMap.panBy(overlay.width() / 2, 0);
                        }

                        fbPhoto.attr('src', String.format(fbPhotoUrl, user.facebook_id));

                        //event.messages = _.sortBy(event.messages, function (m) { return -moment(m.date).toDate(); });
                        for (var m in event.messages) {
                            writeMessageToChat(event.messages[m], chatlist);
                        }
                        socket.on('message', function (data) {
                            if (data.eventId === event._id) {
                                writeMessageToChat(data, chatlist);
                            }
                        });

                        chatsend.off('click').on('click', function (e) {
                            sendChat(chatbox, event._id);
                        });

                        chatbox.off('keydown').on('keydown', function (e) {
                            if (e.keyCode === 13) {
                                sendChat(chatbox, event._id);
                            }
                        });

                    });
                });
            },
            sendChat = function (input, eventId) {
                var msg = input.val();

                socket.emit('chat', { eventId: eventId, text: msg });
                input.val('');
            },
            writeMessageToChat = function (message, div) {
                if (message) {
                    var chatMsg = $('<div class="chat-msg row">'),
                        fbPic = $('<img class="chat-photo" src="' + String.format(fbPhotoUrl, message.facebook_id) + '" />'),
                        msgDate = $('<span class="message-date">'),
                        msg = $('<span class="message-text">');

                    msgDate.html(moment(message.date).format(datetimeCasualFormat));
                    msg.html(message.text);

                    chatMsg.append(fbPic);
                    chatMsg.append(msgDate);
                    chatMsg.append(msg);
                    div.prepend(chatMsg);
                }
            },
            setGroupEventList = function (ref, div, pan) {
                var events = ref.events;
                // only want to pan when the overlay just opened
                if (pan) {
                    // center the event's circle
                    gMap.setCenter(ref.circle.center);
                    gMap.panBy(overlay.width() / 2, 0);
                }

                renderEventList(events, function (list) {
                    div.html(list);

                    div.find('.event').off('click').on('click', function (e) {
                        var div = $(this),
                            eventId = div.data('id'),
                            eventRef = getCdByIdInGroup(eventId),
                            page = navigatePage(0, pageNames.eventDetail);

                        //focusGroup.call(eventRef.circle);
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
                        if (cData.created_by !== user._id) {
                            removeEventUser(cData._id, function (response) {
                                if (response.success) {
                                    var indexOfUser = cData.users.indexOf(user.facebook_id),
                                        size = getEventCircleSize(cData);

                                    // remove locally
                                    cData.users.splice(indexOfUser, 1);

                                    overlayGoing.removeClass('check');
                                    overlayGoing.removeClass('green');
                                    overlayGoing.addClass('unchecked');
                                    clearSizing(cData.circle);
                                    circleSizeTo(cData.circle, size, 0.9, null, 50);
                                    numAttending.html(parseInt(cData.users.length, 10));
                                }
                            });
                        }
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
                                clearSizing(cData.circle);
                                circleSizeTo(cData.circle, size, 1.1, null, 50);
                                numAttending.html(parseInt(cData.users.length, 10));
                            }
                        });
                    }
                });
            },
            //// place detail
            setPlaceDetail = function (id, div) {
                getTemplate('place-detail', null, function (template) {
                    // get place
                    $.get(urls.place, { placeId: id }, function (response) {
                        if (response.success) {
                            var place = response.body;
                            div.html(template);
                            showOverlay(place.name);

                            var where = div.find('.where'),
                                what = div.find('.what'),
                                pastEvents = div.find('.past-events');

                            // apply event detail to template
                            where.html(String.format('<div class="place">{0}</div><div class="address">{1}</div>', place.name, place.vicinity));
                            what.html(place.desc);

                            $.get(urls.placesPastEvents, { placeId: id }, function (response) {
                                if (response.success) {
                                    renderEventList(response.body, function (html) {
                                        pastEvents.html(html);
                                        pastEvents.find('.event').off('click').on('click', function (e) {
                                            var eventId = $(this).data('id'),
                                                page = navigatePage(1, pageNames.pastEventList),
                                                event = _.find(response.body, function (e) { return e._id == eventId; });

                                            showOverlay(event.name);
                                            setPastEventDetail(event, page);
                                        });
                                    });
                                }
                            });
                        }
                    });
                });
            },
            //// main menu
            setMenuDetail = function () {
                if (user) {
                    var username = user.first_name + " " + (user.last_name && user.last_name.length > 0 ? user.last_name.substring(0, 1) : "");
                    showOverlay(username);
                    var page = navigatePage(0, pageNames.menu);
                    overlayGoing.hide();

                    getTemplate('main-menu', null, function (template) {
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
                            var friendId = user.friends[f],
                                pic = $('<img />');

                            pic.attr('src', String.format(fbPhotoUrl, friendId));

                            // show friend picture in friendListDiv
                            friendListDiv.append(pic);
                        }
                        bindUi(page);
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
                    // first go to latlng
                    var lat = $(this).data('lat'),
                        lng = $(this).data('lng'),
                        latlng = new google.maps.LatLng(lat, lng);

                    gMap.setCenter(latlng);

                    var eId = $(this).data('id'),
                        cd = getCdById(eId);

                    if (!cd) {
                        cd = getCdByIdInGroup(eId);
                        var group = _.find(circleData.groups, function (g) { return g._id === cd.group; }),
                            circle = group ? group.circle : false;

                        //gMap.setCenter(new google.maps.LatLng(cd.place.loc.coordinates[1], cd.place.loc.coordinates[0]));
                        gMap.panBy(overlay.width() / 2, 0);

                        if (circle) {
                            var page = navigatePage(0, pageNames.eventDetail);
                            focusGroup.call(circle);
                            selectedEvent = circle;
                            setEventDetail(cd, page);
                        }
                    }
                    else {
                        //gMap.setCenter(new google.maps.LatLng(cd.place.loc.coordinates[1], cd.place.loc.coordinates[0]));
                        gMap.panBy(overlay.width() / 2, 0);
                        circleClick.call(cd.circle, e);
                    }
                });
            },
            ////// create event
            createEventHandler = function (e) {
                getAllEventTags(function (tags) {
                    getTemplate("create-event", tags, function (html) {
                        var page = navigatePage(1, pageNames.createEvent);
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
                form.find('.val-error').removeClass('val-error');
                form.find('.error-message').html('');

                $.ajax({
                    url: urls.eventCreate,
                    type: 'POST',
                    data: formData,
                    success: function (response) {
                        if (response.success) {
                            var newEvent = response.body,
                                latlng = new google.maps.LatLng(newEvent.loc.coordinates[1], newEvent.loc.coordinates[0]);

                            gMap.setCenter(latlng);
                            cleanCData([]);
                            loadEventsInSpan(function () {
                                // check if new event is in cData, if so, trigger click
                                var cd = getCdById(newEvent._id);
                                if (cd) {
                                    circleClick.call(cd.circle);
                                }
                                if (!cd) {
                                    cd = getCdByIdInGroup(newEvent._id);
                                    var circle = _.find(circleData.groups, function (g) { return g._id === cd.group; }).circle;
                                    clickGroup.call(circle);
                                    page = navigatePage(0, pageNames.eventDetail);
                                    setEventDetail(cd, page);
                                    // TODO - go straight to event detail
                                }
                            });
                        }
                        else {
                            var problems = [];
                            if (response.body.path) {
                                problems.push(response.body.path);
                            }
                            for (var p in response.body.errors) {
                                problems.push(p);
                            }

                            for (var p in problems) {
                                var input = form.find('[name="' + problems[p] + '"]'),
                                    valContainer;

                                if (input.is('[type="hidden"]') && input.data('val-el-query')) {
                                    valContainer = ancestor(input, input.data('val-el-query'))
                                }
                                else if (input.is('select')) {
                                    valContainer = input.parent().find(input.data('val-el-query'));
                                }
                                else {
                                    valContainer = input;
                                }

                                valContainer.addClass('val-error');
                                valContainer.on('click', function () {
                                    $(this).removeClass('val-error');
                                });
                            }

                            form.find('.error-message').html("Please finish entering your event information!");
                        }
                    }
                });
            },
            userPlacesHandler = function (places, placeSelect, selectedPlaceId) {
                var newOption = $('<option value="new">- add another place -</option>');

                // add options
                if (places) {
                    for (var p in places) {
                        var option = $(String.format('<option value="{0}" {2}>{1}</option>', places[p]._id, places[p].name, (selectedPlaceId && selectedPlaceId === places[p]._id) ? "selected" : ""));
                        placeSelect.append(option);
                    }
                }
                placeSelect.append(newOption);

                // add place to user
                placeSelect.selectmenu({
                    change: function () {
                        if ($(this).val() === "new") {
                            var page = navigatePage(1, pageNames.addPlace);
                            placeSelect.val('');
                            placeSelect.selectmenu('refresh');
                            getTemplate('add-user-place', null, function (template) {
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

                // check if lat/lng are within WA
                if (getAllowedBounds().contains(loc)) {
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
                }
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
                            var page = navigatePage(dir, pageNames.eventList);
                            page.html(list);

                            // event click needs to load event detail
                            page.find('.event').off('click').on('click', editEventHandler);
                        });
                    }
                    else {
                        var page = navigatePage(dir, pageNames.eventList);
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
                        getTemplate("edit-event", tags, function (html) {
                            // load in user's places
                            getUserPlaces(function (places) {
                                page = navigatePage(1, pageNames.editEvent);
                                page.html(html);

                                var select = page.find('select[name="place"]');
                                userPlacesHandler(places, select, event.place._id);
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
                            loadEventsInSpan();
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

                if (confirm("Are you sure you want to delete this event? It cannot be undone.")) {
                    $.ajax({
                        url: urls.eventDelete,
                        type: 'POST',
                        data: { eventId: eventId },
                        success: function (response) {
                            if (response.success) {
                                manageEventsHandler(-1);
                                loadEventsInSpan();
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
                }
            },
            ////// past events
            pastEventsHandler = function (e, nav) {
                getUserPastEvents(function (pastEvents) {
                    if (pastEvents.length > 0) {
                        renderEventList(pastEvents, function (html) {
                            var page = navigatePage(nav, pageNames.pastEventList);
                            page.append(html);

                            // event click needs to load event detail
                            page.find('.event').off('click').on('click', function (e) {
                                var eventId = $(this).data('id');

                                getUserEvent(eventId, function (event) {
                                    page = navigatePage(1, pageNames.pastEventDetail);
                                    setPastEventDetail(event, page);
                                })
                            });
                        });
                    }
                    else {
                        var page = navigatePage(nav, pageNames.pastEventList);
                        page.html('<p>You have not gone to any events.</p>');
                    }
                });
            },
            setPastEventDetail = function (event, div) {
                getTemplate('past-event-detail', event, function (template) {
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
                        chatlist = div.find('.chat-list');

                    overlayGoing.hide();
                    numAttending.html(event.users.length);

                    // click event info goes to place detail
                    where.off('click').on('click', function (e) {
                        var placeId = $(this).data('id'),
                            page = navigatePage(0, pageNames.placeDetail);

                        setPlaceDetail(placeId, page);
                    });

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

                    for (var m in event.messages) {
                        writeMessageToChat(event.messages[m], chatlist);
                    }
                });
            },
            addReviewHandler = function (event) {
                getTemplate('add-review', event, function (html) {
                    var page = navigatePage(1, pageNames.addReview);
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
                    filters = _.map(tags, function (t) { return t._id; });
                });
            },
            setFiltersView = function () {
                var tags = getAllEventTags(function (tags) {
                    getTemplate('set-filters', tags, function (template) {
                        overlayGoing.hide();
                        showOverlay("Filter Events");
                        var page = navigatePage(0, pageNames.filters);
                        page.html(template);

                        page.find('.tag').each(function () {
                            var div = $(this),
                                filter = div.find('span'),
                                fId = filter.data('id');

                            // check if not active, set disabled
                            if (!_.some(filters, function (f) { return f === fId; })) {
                                div.addClass('disabled');
                            }

                            // on click
                            div.off('click').on('click', function (e) {
                                var div = $(this),
                                    filter = div.find('span'),
                                    fId = filter.data('id');

                                if (div.hasClass('disabled')) {
                                    filters.push(fId);
                                    div.removeClass('disabled');
                                }
                                else {
                                    var fIndex = filters.indexOf(fId);
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
            getTemplate = function (template, modelData, callback) {
                if (modelData) {
                    modelData = JSON.stringify(modelData);
                }

                $.ajax({
                    url: urls.renderTemplate,
                    type: 'GET',
                    data: { template: template, model: modelData },
                    success: function (html) {
                        callback(html);
                    }
                });
            },
            renderEventList = function (eventData, callback) {
                getTemplate("event-list-item", null, function (template) {
                    var div = $('<div class="event-list"></div>'),
                        formatted = "";
                    for (var event in eventData) {
                        var e = eventData[event];

                        if (e._id) {
                            var eHtml = String.format(template, e._id, e.name, moment(e.start).format(datetimeCasualFormat), moment(e.end).format(datetimeCasualFormat), e.place.name, e.loc.coordinates[1], e.loc.coordinates[0]);
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
            ancestor = function (el, q) {
                while (el.parent()) {
                    if (el.parent().is(q)) {
                        return el.parent();
                    }
                    else {
                        el = el.parent();
                    }
                }
            },
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
            },
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

                    if (input.is('input[type="radio"]')) {
                        input.removeAttr('checked');
                        input.each(function () {
                            var radio = $(this);
                            if (radio.val() === model[p]) {
                                radio.attr('checked', 'checked');
                            }
                        });
                    }
                    else {
                        input.val(model[p]);
                    }
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

                div.tooltip();
            };

        this.init = function () {
            window.fbAsyncInit = function () {
                initAuthentication(function () {
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(function (pos) {
                            var loc = {
                                lat: pos.coords.latitude,
                                lng: pos.coords.longitude
                            },
								lastLoc = getCookie("last" + user.facebook_id);

                            if (lastLoc !== "") {
                                loc = JSON.parse(lastLoc);
                            }

                            initializeMap(loc, eventLoadingHandler);
                            applyHeaderHandlers();
                            //applySearchHandlers();
                            setDefaultFilters();
                            overlayExit.on('click', exitOverlay);
                            bindUi($('body'));
                        });
                    }
                });
            };

            $('.site-logo').click(function () {
                window.location.reload();
            });

            // set up socket
            socket = io.connect(document.domain);

            socket.on('connect', function () {
                socketId = socket.io.engine.id;
                console.log('Connected ' + socketId);
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