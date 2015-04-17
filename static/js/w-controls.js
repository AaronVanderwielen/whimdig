(function ($, window) {
	var wControls = function (wControlsContainer) {
		var obj = this,
			socket,
			socketId,
			debug = true, // true uses testFbApi
			prodFbApi = { appId: '793549090738791', xfbml: true, version: 'v2.2' },
            testFbApi = { appId: '655662931197377', cookie: true, version: 'v2.0' },
			user,
			cityLoc = {
				myloc: {
					label: 'My Location'
				},
				bellingham: {
					label: 'Bellingham',
					lat: 48.7524,
					lng: -122.4712
				},
				seattle: {
					label: 'Seattle',
					lat: 47.6036,
					lng: -122.3294
				}
			},
			allTags,
			filters = {
				tags: [],
				span: 12,
				radius: 5,
				loc: null
			},
			urls = {
				// map
				mapPlaces: '/map/places',
				// places
				place: '/places',
				placesUpcomingEvents: '/places/upcomingEvents',
				placesPastEvents: '/places/pastEvents',
				placesNames: '/places/names',
				userPlaces: '/places/user',
				searchAllPlaces: '/places/searchAll',
				// events
				event: '/event',
				eventsUpcoming: '/event/upcoming',
				eventList: '/event/list',
				eventsForBounds: '/event/bounds',
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
				// user
				userFriends: '/account/friends',
				userMail: '/account/mail',
				userMailMessages: '/account/mailMessages',
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
				menu: 'menu',
				mail: 'mail'
			},
			currentSpan = 0,
			paging = 0,
			reAuthAttempts = 0,
			datetimeCasualFormat = 'ddd h:mm a',
			datetimeDateFormat = 'MM/DD/YYYY',
			datetimeStrictFormat = 'MM/DD/YYYY h:mm a',
			timeFormat = 'h:mm tt',
			fbPhotoUrl = "//graph.facebook.com/{0}/picture",
			//isMobileDevice = navigator.userAgent.match(/iPad|iPhone|iPod|Android|BlackBerry|webOS/i) !== null,
			// elements
			container = $('.container'),
			//// header 
			header = $('.app-header'),
			headerUserControls = header.find('.user-controls'),
			headerUserImage = header.find('.user-image'),
			//headerFilterBtn = headerUserControls.find('.filter .glyph'),
			headerMenuBtn = headerUserControls.find('.menu .glyph'),
			headerDaySelect = header.find('.day-select'),
			headerDaySelectPrev = headerDaySelect.find('.prev'),
			headerDaySelectCurrent = headerDaySelect.find('.current'),
			headerDaySelectNext = headerDaySelect.find('.next'),
			//// overlay elements
			overlay = $('.overlay'),
			overlayBody = overlay.find('.overlay-body'),
			// METHODS
			_map = function (callback) {
				var el = $('.w-map');
				if (el.length > 0) {
					var plugin = el.data('wMap');
					if (plugin) {
						callback(plugin);
					}
				}
				return false;
			},
		    // session/data
			initAuthentication = function (callback) {
				FB.init(debug ? testFbApi : prodFbApi);
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
						var loginPopup = $('<button class="login-btn">Login</button>');

            			loginPopup.off('click').on('click', function () {
            				fbLoginPrompt(function(e) {
								location.reload();
							});
            			});

            			header.append(loginPopup);
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
			getUserFriends = function (callback) {
				FB.getLoginStatus(function (auth) {
					if (auth.status === 'connected') {
						var data = {
							token: auth.authResponse.accessToken,
							id: auth.authResponse.userID
						};

						$.get(urls.userFriends, data, function (response) {
							callback(response);
						});
					}
				});
			},
		    // events
			loadEventsInBounds = function (bounds, callback) {
				if (!bounds) {
					_map(function (m) {
						bounds = m.getBounds();
					});
				}

				$.ajax({
					url: urls.eventsForBounds,
					type: 'GET',
					data: {
						span: currentSpan,
						bounds: bounds
					},
					success: function (response) {
						if (response.success && callback) {
							callback(response.body);
						}
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
            		}
            	});
            },
            // header
            applyHeaderHandlers = function () {
            	var pic = $('<img>');
            	pic.attr('src', String.format(fbPhotoUrl, user.facebook_id));
            	headerUserImage.append(pic);

            	headerMenuBtn.off('click').on('click', function (e) {
            		if (currentPage().data('name') === pageNames.menu) {
            			exitOverlay();
            		}
            		else {
            			_map(function (m) {
            				m.deselect();
            			});
            			setMenuDetail();
            		}
            	});
            	headerDaySelectPrev.off('click').on('click', function (e) {
            		gotoPrevSpan();
            	});
            	headerDaySelectNext.off('click').on('click', function (e) {
            		gotoNextSpan();
            	});
            },
            // overlay
            showOverlay = function () {
            	container.addClass('show-overlay');
            },
            exitOverlay = function () {
            	container.removeClass('show-overlay');
            	currentPage().animate({ width: 0, padding: 0 }, 200, function () {
            		overlayBody.find('.page').remove();
            		_map(function (m) {
            			m.deselect();
            			m.resize();
            		});
            	});
            },
            navigatePage = function (dir, newPageName) {
				overlay.off('swiperight').on('swiperight', function() {
					currentPage().find('.header .back').click();
				});
				overlay.off('swipeleft');
				
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

            		container.addClass('show-overlay');

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

            	return currentPage();
            },
            currentPage = function () {
            	return overlayBody.find('> .page.page' + paging);
            },
            //// event detail
            setEventDetail = function (id, pageDir) {
            	var page = navigatePage(pageDir, pageNames.eventDetail);

            	getUserEvent(id, function (event) {
            		getTemplate('event-detail', null, function (template) {
            			page.html(template);
            			page.find('.header-text').html(event.name);

            			page.find('.back').each(function () {
            				if (pageDir == 0) {
            					$(this).addClass('chevron-right');
            					$(this).removeClass('chevron-left');
            					$(this).off('click').on('click', exitOverlay);
            				}
            				else {
            					$(this).addClass('chevron-left');
            					$(this).removeClass('chevron-right');

            					$(this).off('click').on('click', function () {
            						page = navigatePage(-1);
            						refreshFilteredList(page);
            					});
            				}
            			});

            			var tabsDiv = page.find('.tabs'),
            				infoTab = tabsDiv.find('.tab.info-tab'),
							chatTab = tabsDiv.find('.tab.chat-tab'),
							starTab = tabsDiv.find('.tab.star-tab');

						// swiping
						overlay.off('swipeRight').on('swipeRight', tabSwipeRight);
						overlay.off('swipeLeft').on('swipeLeft', tabSwipeLeft);
							
            			// init first tab
            			eventTabChange(tabsDiv, infoTab, renderInfoTab, event);

            			infoTab.off('click').on('click', function (e) {
            				eventTabChange(tabsDiv, $(this), renderInfoTab, event);
            			});

            			chatTab.off('click').on('click', function (e) {
            				eventTabChange(tabsDiv, $(this), renderChatTab, event);
            			});

            			starTab.off('click').on('click', function (e) {
            				starHandler.call(this, event);
            			});

            			starTab.find('.tab-label').html(event._users ? event._users.length : 0);
            			// should star be highlighted?
            			if (event._users) {
            				// initialize 'going' checkbox by checking if user is in event._users on client
            				if (_.some(event._users, function (u) { return u === user._id; })) {
            					starTab.addClass('active');
            					starTab.find('.glyph').addClass('star').removeClass('dislikes');
            				}
            				else {
            					starTab.removeClass('active');
            					starTab.find('.glyph').addClass('dislikes').removeClass('star');
            				}
            			}
            		});
            	});
            },
			tabSwipeRight = function (e) {
				var selectedTab = $(this).find('.tab.selected'),
					nextTab = selectedTab.prev();
				if (nextTab.length > 0) {
					nextTab.click();
				}
				else {
					currentPage().find('.header .back').click();
				}
			},
			tabSwipeLeft = function (e) {
				var selectedTab = $(this).find('.tab.selected'),
					nextTab = selectedTab.next();
				if (nextTab.length > 0) {
					nextTab.click();
				}
			},
			eventTabChange = function (tabContainer, tab, loadMethod, event) {
				var tabContent = tabContainer.parent().find('.tab-content');
				if (!tab.hasClass('selected')) {
					tabContainer.find('.tab.selected').removeClass('selected');

					tabContent.fadeOut(25, function () {
						tab.addClass('selected');

						loadMethod.call(this, event, function (div) {
							tabContent.html('');
							tabContent.append(div);

							tabContent.fadeIn();
						});
					});
				}
			},
			renderInfoTab = function (event, callback) {
				getTemplate('event-detail-tab-info', event, function (html) {
					var div = $(html),
						body = div.find('.event-body'),
						time = div.find('.when .time'),
						intensity = div.find('.when .intensity'),
						where = div.find('.where'),
						creatorImg = div.find('.creator-img'),
						invite = div.find('.invite'),
						what = div.find('.what'),
						friendCount = div.find('.friend-count'),
						friendsList = div.find('.friend-list');

					// apply event detail to template
					time.html(moment(event.start).format(datetimeCasualFormat) + " - " + moment(event.end).format(datetimeCasualFormat));
					intensity.html(event.intensity_variable === "end" ? "show up any time before end" : "show up before start");

					creatorImg.attr('src', String.format(fbPhotoUrl, event._created_by ? event._created_by.facebook_id : "undefined"));

					where.html(String.format('<div class="place">{0}</div><div class="address">{1}</div>', event._place.name, event._place.vicinity));
					where.data('id', event._place._id);

					what.html(event.desc);

					// click event info goes to place detail
					where.off('click').on('click', function (e) {
						var placeId = $(this).data('id');
						setPlaceDetail(placeId, 1);
					});

					// invite 
					invite.off('click').on('click', function (e) {

					});					

					// friends
					var attendingFriends = _.filter(user._friends, function (f) {
						if (_.some(event._users, function (u) { return u === f._id; })) {
							return f;
						}
					});
					friendCount.html(attendingFriends.length + " friend" + (attendingFriends.length === 1 ? "" : "s"));
					for (var f in attendingFriends) {
						var friendId = attendingFriends[f].facebook_id,
							pic = $('<img>');

						console.log(friendId);
						pic.attr('src', String.format(fbPhotoUrl, friendId));

						// show friend picture in friendListDiv
						friendsList.append(pic);
					}
					callback(div);
				});
			},
			renderChatTab = function (event, callback) {
				getTemplate('event-detail-tab-chat', event, function (html) {
					var div = $(html),
						fbPhoto = div.find('.fb-photo'),
						chat = div.find('.chat'),
						chatsend = chat.find('.glyph.play'),
						chatlist = chat.find('.chat-list'),
						chatbox = chat.find('.chat-input');

					fbPhoto.attr('src', String.format(fbPhotoUrl, user.facebook_id));

					for (var m in event.messages) {
						writeMessageToChat(event.messages[m], chatlist);
					}

					socket.on('eventMessage:' + event._id, function (data) {
						// TODO: instead get update = true, refresh with new ajax call
						event.messages.push(data);
						writeMessageToChat(data, chatlist);
					});

					chatsend.off('click').on('click', function (e) {
						sendChat(chatbox, event);
					});

					chatbox.off('keydown').on('keydown', function (e) {
						if (e.keyCode === 13) {
							sendChat(chatbox, event);
						}
					});

					callback(div);
				});
			},
            sendChat = function (input, event) {
            	var msg = input.val(),
            		data = { eventId: event._id, text: msg };

            	socket.emit('sendEventMessage', data);
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
            setGroupEventList = function (events, div) {
            	renderEventList(events, function (list) {
            		addStarToListedEvents(events, list);
            		div.html(list);

            		div.find('.event').off('click').on('click', function (e) {
            			var target = $(e.target),
							div = $(this),
                            eventId = div.data('id');

            			if (!target.is('.corner-glyph')) {
            				setEventDetail(eventId, 1);
            			}
            		});
            	});
            },
            starHandler = function (event) {
            	var tab = $(this),
            		glyph = tab.find('.glyph'),
					label = tab.find('.tab-label');

            	if (event._created_by !== user._id) {
            		if (tab.hasClass('active')) {
            			removeEventUser(event._id, function (response) {
            				if (response.success) {
            					var indexOfUser = event._users.indexOf(user._id);

            					// remove locally
            					event._users.splice(indexOfUser, 1);
            					label.html(parseInt(event._users.length, 10));
            					tab.removeClass('active');
            					glyph.addClass('dislikes').removeClass('star');
            				}
            			});
            		}
            		else {
            			addEventUser(event._id, function (response) {
            				if (response.success) {
            					// add locally
            					event._users.push(user._id);
            					label.html(parseInt(event._users.length, 10));
            					tab.addClass('active');
            					glyph.addClass('star').removeClass('dislikes');
            				}
            			});
            		}
            	}
            },
            //// place detail
            setPlaceDetail = function (id, pageDir) {
            	var page = navigatePage(pageDir, pageNames.placeDetail);

            	getTemplate('place-detail', null, function (template) {
            		// get place
            		$.get(urls.place, { placeId: id }, function (response) {
            			if (response.success) {
            				var place = response.body;
            				page.html(template);

            				page.find('.header-text').html(place.name);

            				page.find('.back').each(function () {
            					if (pageDir == 0) {
            						$(this).addClass('chevron-right');
            						$(this).removeClass('chevron-left');
            						$(this).off('click').on('click', exitOverlay);
            					}
            					else {
            						$(this).addClass('chevron-left');
            						$(this).removeClass('chevron-right');

            						$(this).off('click').on('click', function () {
            							page = navigatePage(-1);
            						});
            					}
            				});

            				var where = page.find('.where'),
                                what = page.find('.what'),
                                upcomingEvents = page.find('.upcoming-events'),
                                pastEvents = page.find('.past-events');

            				// apply event detail to template
            				where.html(String.format('<div class="place">{0}</div><div class="address">{1}</div>', place.name, place.vicinity));
            				what.html(place.desc);

            				$.get(urls.placesUpcomingEvents, { placeId: id }, function (response) {
            					if (response.success) {
            						renderEventList(response.body, function (html) {
            							upcomingEvents.html(html);
            							upcomingEvents.find('.event').off('click').on('click', function (e) {
            								var eventId = $(this).data('id');
            								setEventDetail(eventId, 1);
            							});
            						});
            					}
            				});

            				$.get(urls.placesPastEvents, { placeId: id }, function (response) {
            					if (response.success) {
            						renderEventList(response.body, function (html) {
            							pastEvents.html(html);
            							pastEvents.find('.event').off('click').on('click', function (e) {
            								var eventId = $(this).data('id');
            								setPastEventDetail(eventId);
            							});
            						});
            					}
            				});
            			}
            		});
            	});
            },
            // MAIN MENU
            setMenuDetail = function (defaultTab) {
            	if (user) {
            		var page = navigatePage(0, pageNames.menu);

            		getTemplate('main-menu', null, function (template) {
            			page.html(template);

            			var tabsDiv = page.find('.tabs'),
            				findTab = tabsDiv.find('.tab.find-events-tab'),
							eventsTab = tabsDiv.find('.tab.my-events-tab'),
							socialTab = tabsDiv.find('.tab.social-tab'),
							back = page.find('.back');

            			back.off('click').on('click', exitOverlay);

						// swiping
						overlay.off('swiperight').on('swiperight', tabSwipeRight);
						overlay.off('swipeleft').on('swipeleft', tabSwipeLeft);
						
            			findTab.off('click').on('click', function (e) {
            				menuTabChange(tabsDiv, $(this), renderFindTab, "find something to do");
            			});

            			eventsTab.off('click').on('click', function (e) {
            				menuTabChange(tabsDiv, $(this), renderEventsTab, "things you'd like to do");
            			});

            			socialTab.off('click').on('click', function (e) {
            				menuTabChange(tabsDiv, $(this), renderSocialTab, "people to do stuff with");
            			});

            			// init first tab
            			if (defaultTab) {
            				tabsDiv.find(defaultTab).click();
            			}
            			else {
            				findTab.click();
            			}
            		});
            	}
            },
			menuTabChange = function (tabContainer, tab, loadMethod, headerText) {
				var tabContent = tabContainer.parent().find('.tab-content');
				if (!tab.hasClass('selected')) {
					tabContainer.find('.tab.selected').removeClass('selected');

					tabContent.fadeOut(25, function () {
						tab.addClass('selected');
						$('.header-text').html(headerText);

						loadMethod.call(this, tabContent);
					});
				}
			},
			// find tab
			renderFindTab = function (contentDiv) {
				getTemplate('menu-tab-find', null, function (html) {
					var div = $(html),
						eventCount = div.find('.event-count'),
						tagFilter = div.find('.tag-filter'),
						spanFilter = div.find('.span-filter'),
						radiusFilter = div.find('.radius-filter'),
						eventList = div.find('.event-list'),
						cookie = getCookie('filters'),
						tfLabel = tagFilter.find('.glyph-label'),
						spLabel = spanFilter.find('.glyph-label'),
						rLabel = radiusFilter.find('.glyph-label');

					filters = cookie !== "" ? JSON.parse(cookie) : filters;
					setFilterTagsLabel(tfLabel);
					setFilterSpanLabel(spLabel);
					setFilterRadiusLabel(rLabel);

					// set filter handlers
					tagFilter.off('click').on('click', setFilterTags);
					spanFilter.off('click').on('click', setFilterSpan);
					radiusFilter.off('click').on('click', setFilterRadius);

					contentDiv.empty();
					contentDiv.append(div);

					refreshFilteredList(div);

					contentDiv.fadeIn();
				});
			},
			refreshFilteredList = function (div) {
				var eventCount = div.find('.event-count'),
					eventDiv = div.find('.events'),
					tagFilter = div.find('.tag-filter'),
					spanFilter = div.find('.span-filter'),
					radiusFilter = div.find('.radius-filter');

				verifyFilterData(function () {
					// set labels
					var tfLabel = tagFilter.find('.glyph-label'),
						spLabel = spanFilter.find('.glyph-label'),
						rLabel = radiusFilter.find('.glyph-label');

					setFilterTagsLabel(tfLabel);
					setFilterSpanLabel(spLabel);
					setFilterRadiusLabel(rLabel);

					renderFilteredEvents(filters, function (list) {

						setCookie('filters', JSON.stringify(filters));

						eventClickHandlers(list);
						eventCount.html(list.find('.event').length);
						eventDiv.empty();
						eventDiv.append(list);
					});
				});
			},
			verifyFilterData = function (callback) {
				// if tags = [], all tags
				getAllFilterIds(function (tagIds) {
					if (filters.tags.length === 0) {
						filters.tags = tagIds;
					}

					// get curr position
					_map(function (m) {
						m.getPosition(function (loc) {
							filters.loc = loc;
							callback();
						});
					});
				});
			},
			renderFilteredEvents = function (data, callback) {
				// load nearby events
				getUpcomingEvents(data, function (events) {
					// render nearby events as list
					renderEventList(events, function (list) {
						addStarToListedEvents(events, list);
						callback(list);
					});
				});
			},
			addStarToListedEvents = function (events, list) {
				list.find('.event').each(function () {
					var selectable = $(this),
						id = selectable.data('id'),
						eventData = _.find(events, function (e) { return e._id == id; }),
						star = $(String.format('<span class="glyph glyphicons corner-glyph" data-event-id="{0}">', eventData._id));

					if (eventData._users.indexOf(user._id) > -1) {
						star.addClass('star');
					}
					else {
						star.addClass('dislikes');
					}

					if (eventData._created_by != user._id) {
						star.off('click').on('click', function (e) {
							var glyph = $(this),
								eventId = $(this).data('event-id');

							if (glyph.hasClass('star')) {
								removeEventUser(eventId, function (response) {
									glyph.addClass('dislikes').removeClass('star');
								});
							}
							else {
								addEventUser(eventId, function (response) {
									glyph.addClass('star').removeClass('dislikes');
								});
							}
						});
					}

					selectable.prepend(star);
				});
			},			
			setFilterTags = function (e) {
				var filterEl = $(this),
					page = navigatePage(1);

				getAllEventTags(function (tags) {
					getTemplate('menu-tab-find-tags', tags, function (html) {
						page.html(html);

						page.find('.back').off('click').on('click', function () {
							page = navigatePage(-1);
							refreshFilteredList(page);
						});

						page.find('.tag').each(function () {
							var tDiv = $(this),
								fId = tDiv.find('span').data('id');

							// check if not active, set disabled
							if (!_.some(filters.tags, function (f) { return f === fId; })) {
								tDiv.addClass('disabled');
							}

							// on click
							tDiv.off('click').on('click', function (e) {
								var tag = $(this);

								// toggle disabled status
								tag.toggleClass('disabled');

								// get all tags not disabled, set filter
								filters.tags = [];
								page.find('.tag:not(.disabled)').each(function () {
									var tagId = $(this).find('span').data('id');
									filters.tags.push(tagId);
								});
							});
						});
					});
				});
			},
			setFilterSpan = function (e) {
				var filterEl = $(this),
					page = navigatePage(1);

				getTemplate('menu-tab-find-span', null, function (html) {
					page.html(html);

					var div = page.find('.menu-tab-find-span'),
						spanList = $('<div class="span-list">'),
						spans = [1, 3, 6, 12, 24, 48];

					page.find('.back').off('click').on('click', function () {
						page = navigatePage(-1);
						refreshFilteredList(page);
					});

					for (var s in spans) {
						var timespan = $('<div class="timespan selectable">'),
							label = 'the next {0} hour{1}';

						if (spans[s] === 1) {
							label = String.format(label, '', '');
						}
						else {
							label = String.format(label, spans[s], 's');
						}

						timespan.html(label);
						timespan.data('value', spans[s]);

						timespan.off('click').on('click', function (e) {
							// set filter
							filters.span = $(this).data('value');

							// go back
							page = navigatePage(-1);
							refreshFilteredList(page);
						});

						timespan.appendTo(spanList);
					}

					spanList.appendTo(div);
				});
			},
			setFilterRadius = function (e) {
				var filterEl = $(this),
					page = navigatePage(1);

				getTemplate('menu-tab-find-radius', null, function (html) {
					page.html(html);

					var div = page.find('.menu-tab-find-radius'),
						radiusList = $('<div class="radius-list">'),
						miles = [.25, .5, 1, 5, 10, 25];

					page.find('.back').off('click').on('click', function () {
						page = navigatePage(-1);
						refreshFilteredList(page);
					});

					for (var s in miles) {
						var radius = $('<div class="radius selectable">'),
							label = 'within {0} mile{1}';

						if (miles[s] === 1) {
							label = String.format(label, 1, '');
						}
						else {
							label = String.format(label, miles[s], 's');
						}

						radius.html(label);
						radius.data('value', miles[s]);

						radius.off('click').on('click', function (e) {
							var r = $(this);

							filters.radius = r.data('value');

							page = navigatePage(-1);
							refreshFilteredList(page);
						});

						radius.appendTo(radiusList);
					}

					radiusList.appendTo(div);
				});
			},
			setFilterTagsLabel = function (el) {
				var label;

				if (filters.tags.length === allTags.length)
					label = 'all types';
				else if (filters.tags.length === 1)
					label = '1 type';
				else {
					label = filters.tags.length + ' types'
				}

				el.html(label);
			},
			setFilterSpanLabel = function (el) {
				var label = "{0} hour{1}";

				if (filters.span === 1) {
					label = String.format(label, 1, '');
				}
				else {
					label = String.format(label, filters.span, 's');
				}

				el.html(label)
			},
			setFilterRadiusLabel = function (el) {
				var label = "{0} mile{1}";

				if (filters.radius === 1) {
					label = String.format(label, 1, '');
				}
				else {
					label = String.format(label, filters.radius, 's');
				}

				el.html(label);
			},
			getUpcomingEvents = function (data, callback) {
				$.get(urls.eventsUpcoming, data, function (response) {
					if (response.success) {
						callback(response.body);
					}
				});
			},
			eventClickHandlers = function (div) {
				// clicking an event in schedule
				var events = div.find('.event');
				events.off('click').on('click', function (e) {
					var target = $(e.target),
						event = $(this),
						eId = event.data('id'),
						lat = event.data('lat'),
						lng = event.data('lng');

					if (target.is('.corner-glyph')) return;

					_map(function (m) {
						var loc = {
							lat: lat,
							lng: lng
						},
							pan = -container.width() * .2;

						m.goTo(loc, pan, function () {
							m.select(eId);
						});

						if ($(e.target).is('.edit')) {
							editEvent(eId);
						}
						else {
							setEventDetail(eId, 1);
						}
					});
				});
			},
			// my events tab
			renderEventsTab = function (contentDiv) {
				getTemplate('menu-tab-events', null, function (html) {
					var div = $(html),
						eventsDiv = div.find('.events'),
						createEventBtn = div.find('.create-event'),
						pastEventsBtn = div.find('.past-events');

					createEventBtn.off('click').on('click', createEventHandler);
					pastEventsBtn.off('click').on('click', function (e) {
						pastEventsHandler(e, 1);
					});

					getUserEvents(function (response) {
						var data = response.body;

						renderEventList(data, function (list) {
							eventsDiv.empty();
							eventsDiv.append(list);
							eventClickHandlers(eventsDiv);

							var edit = $('<span class="glyph glyphicons edit corner-glyph"></span>');
							eventsDiv.find('.event.editable').append(edit);

							contentDiv.empty();
							contentDiv.append(div);
							contentDiv.fadeIn();
						});
					});
				});
			},
			createEventHandler = function (e) {
				getAllEventTags(function (tags) {
					getTemplate("menu-tab-events-create", tags, function (html) {
						var page = navigatePage(1, pageNames.createEvent);
						page.html(html);
						bindUi(page);

						page.find('.back').off('click').on('click', function (e) {
							navigatePage(-1);
						});

						// create submit click handler
						page.find('input[type="button"]').off('click').on('click', createEvent);

						// load in user's places
						getUserPlaces(function (places) {
							var select = page.find('select[name="_place"]');
							userPlacesHandler(places, select);
						});
					});
				});
			},
			createEvent = function (e) {
				postForm.call(this, function (newEvent) {
					var loc = {
							lat: newEvent.loc[1],
							lng: newEvent.loc[0]
						},
						pan = -container.width() * .2;

					_map(function (m) {
						m.goTo(loc, pan);
						setEventDetail(newEvent._id, 0);
					});
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
								var back = page.find('.back'),
									areaSelect = page.find('select[name="area"]'),
									placeInput = page.find('input[name="keyword"]'),
									btn = page.find('input[type=button]'),
									resultsDiv = page.find('.results');

								back.off('click').on('click', function () {
									page = navigatePage(-1);
								});

								areaSelect.empty();

								_map(function (m) {
									m.getPosition(function (userPos) {

										for (var c in cityLoc) {
											var option = $('<option>');
											option.html(cityLoc[c].label);
											option.data('lat', cityLoc[c].lat ? cityLoc[c].lat : userPos.lat);
											option.data('lng', cityLoc[c].lng ? cityLoc[c].lng : userPos.lng);

											areaSelect.append(option);
										}

										btn.off('click').on('click', function (e) {
											var data = {
												lat: areaSelect.find('option:selected').data('lat'),
												lng: areaSelect.find('option:selected').data('lng'),
												keyword: placeInput.val()
											};

											renderPlacesList(data, function (list) {
												resultsDiv.empty();
												resultsDiv.append(list);

												resultsDiv.find('.place').off('click').on('click', function (e) {
													addUserPlaceClick.call(this, function (op) {
														var existingOp = placeSelect.find('option[value="' + op.val() + '"]');
														if (existingOp.length === 0) {
															placeSelect.prepend(op);
														}
														else {
															placeSelect.find('option').attr('selected','');
															existingOp.attr('selected','selected');
														}
														placeSelect.selectmenu("refresh");
														// go back to previous page
														navigatePage(-1);
													});
												});
											});
										});

										bindUi(page);
									});
								});
							});
						}
					}
				});
				placeSelect.selectmenu('refresh');
			},
			renderPlacesList = function (data, callback) {
				_map(function(m) {
					m.getNearbyPlaces(data, function(places) {
						var list = $('<div class="place-list">');

						for (var p in places) {
							var place = $(String.format('<div class="place selectable"><div class="heading">{0}</div><span>{1}</span></div>', 
								places[p].name, places[p].vicinity));
							
							place.data('place', places[p]);
							list.append(place);
						}
						callback(list);
					});
				});
				// check if lat/lng are within WA
				//if (m.getAllowedBounds().contains(loc)) {
				//$.post(urls.searchAllPlaces, data, function (response) {
					//if (response.success) {
						//var list = $('<div class="place-list">');

						//for (var p in response.body) {
							//var place = $(String.format('<div class="place selectable" data-id="{0}" data-name="{1}"><div class="heading">{1}</div><span>{2}</span></div>', response.body[p]._id, response.body[p].name, response.body[p].vicinity));
							//list.append(place);
						//}
						//callback(list);
					//}
				//});
			},
			addUserPlaceClick = function (callback) {
				var googlePlace = $(this).data('place'),
					place = {
						place_id: googlePlace.place_id,
						name: googlePlace.name,
						loc: [ parseFloat(googlePlace.geometry.location.lng(), 15), parseFloat(googlePlace.geometry.location.lat(), 15) ],
						vicinity: googlePlace.vicinity
					};

				// add place to user
				$.ajax({
					url: urls.userPlaces,
					type: 'POST',
					data: { place: place },
					success: function (response) {
						if (response.success) {
							var newOption = $(String.format('<option value="{0}" selected="selected">{1}</option>', response.body._id, response.body.name));

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
							callback(response.body._places);
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
							page.find('.event').off('click').on('click', function (e) {
								editEvent($(this).data('id'));
							});
						});
					}
					else {
						var page = navigatePage(dir, pageNames.eventList);
						page.html('<p>You have not created any events.</p>');
					}
				});
			},
			editEvent = function (id) {
				getUserEvent(id, function (event) {
					getAllEventTags(function (tags) {
						// set selected status here
						for (var e in event._tags) {
							for (var t in tags) {
								if (tags[t].name === event._tags[e].name) {
									tags[t].selected = true;
								}
							}
						}
						getTemplate("edit-event", tags, function (html) {
							// load in user's places
							getUserPlaces(function (places) {
								page = navigatePage(1, pageNames.editEvent);
								page.html(html);

								page.find('.back').off('click').on('click', function () {
									page = navigatePage(-1);
								});

								var select = page.find('select[name="_place"]');
								userPlacesHandler(places, select, event._place._id);
								bindUi(page);
								bindModelToForm(event, page);

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
							setEventDetail(response.body._id, 0);
							loadEventsInBounds();
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
								loadEventsInBounds();
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
					var page = navigatePage(1, pageNames.createEvent);

					getTemplate("header-list", null, function (html) {
						page.html(html);
						page.find('.header-text').html('stuff you may have went to');
						page.find('.back').off('click').on('click', function () {
							page = navigatePage(-1);
						});

						if (pastEvents.length > 0) {
							renderEventList(pastEvents, function (html) {
								page.find('.list-container').append(html);

								// event click needs to load event detail
								page.find('.event').off('click').on('click', function (e) {
									var eventId = $(this).data('id');
									setPastEventDetail(eventId, page);
								});
							});
						}
						else {
							page.find('.list-container').html('<p>You haven\'t gone to any events!</p>');
						}
					});
				});
			},
			setPastEventDetail = function (id) {
				var page = navigatePage(1, pageNames.pastEventDetail);;

				getUserEvent(id, function (event) {
					getTemplate('past-event-detail', event, function (html) {
						page.html(html);

						page.find('.header-text').html(event.name);
						page.find('.back').off('click').on('click', function () {
							page = navigatePage(-1);
						});

						var body = page.find('.event-body'),
							when = page.find('.when'),
							where = page.find('.where'),
							what = page.find('.what'),
							connections = page.find('.connection-info'),
							numAttending = connections.find('.num-attending'),
							friendCount = connections.find('.friend-count'),
							friendsList = connections.find('.friend-list'),
							chatlist = page.find('.chat-list');

						numAttending.html(event._users.length);

						// click event info goes to place detail
						where.off('click').on('click', function (e) {
							var placeId = $(this).data('id');

							setPlaceDetail(placeId, 0);
						});

						// friends
						var attendingFriends = _.filter(user._friends, function (f) {
							if (_.some(event._users, function (u) { return u._id === f._id; })) {
								return f;
							}
						});
						friendCount.html(attendingFriends.length + " friend" + (attendingFriends.length === 1 ? "" : "s"));
						for (var f in attendingFriends) {
							var friendId = attendingFriends[f].facebook_id,
								pic = $('<img>');

							pic.attr('src', String.format(fbPhotoUrl, friendId));

							// show friend picture in friendListDiv
							friendsList.append(pic);
						}

						for (var m in event._messages) {
							writeMessageToChat(event._messages[m], chatlist);
						}
					});
				});
			},
			// social tab
			renderSocialTab = function (contentDiv) {
				getMailLight(function (mail) {
					for (var m in mail) {
						var otherUsers = _.filter(mail[m]._users, function (u) { return u._id !== user._id; }),
							toArray = _.map(otherUsers, function (u) { return u.first_name; });

						mail[m].to_label = toArray.join(", ");
						mail[m].viewed = mail[m].read_log.indexOf(user._id) > -1;
					}
					getTemplate('menu-tab-social', mail, function (html) {
						var div = $(html);

						var tabHeader = div.find('.tab-header'),
							messageItem = tabHeader.find('.create-event'),
							inviteItem = tabHeader.find('.invite'),
							mailbox = div.find('.mailbox'),
							mail = mailbox.find('.mail');

						mail.each(function () {
							var m = $(this),
								glyph = m.find('.glyph'),
								viewed = m.data('viewed');

							if (viewed) {
								glyph.addClass('message_empty');
							}
							else {
								glyph.addClass('message_flag');
							}
						});						

						messageItem.off('click').on('click', renderCreateMail);
						inviteItem.off('click').on('click', function () {
							FB.ui({
								method: 'send',
								link: 'http://www.whimdig.com',
							});
						});
						mail.off('click').on('click', openMail);

						contentDiv.html('');
						contentDiv.append(div);

						contentDiv.fadeIn();
					});
				});
			},
			getMailLight = function (callback) {
				$.get(urls.userMail, function (response) {
					if (response.success) {
						callback(response.body);
					}
				});
			},
			openMail = function () {
				var mailId = $(this).data('id'),
					glyph = $(this).find('.glyph'),
					page = navigatePage(1, pageNames.mail);

				glyph.removeClass('message_flag').addClass('message_empty');

				getMailMessages(mailId, function (mail) {
					getTemplate('mail', null, function (html) {
						page.html(html);

						page.find('.back').off('click').on('click', function () {
							page = navigatePage(-1);
						});

						var fbPhoto = page.find('.fb-photo'),
							chat = page.find('.chat'),
							chatsend = chat.find('.glyph.play'),
							chatlist = chat.find('.chat-list'),
							chatbox = chat.find('.chat-input');

						fbPhoto.attr('src', String.format(fbPhotoUrl, user.facebook_id));

						for (var m in mail.messages) {
							writeMessageToChat(mail.messages[m], chatlist);
						}

						socket.on('mailMessage:' + mailId, function (data) {
							if (data.update) {
								// refresh mail from server
							}
						});

						chatsend.off('click').on('click', function (e) {
							sendMailMessage(chatbox, chatlist, mail);
						});

						chatbox.off('keydown').on('keydown', function (e) {
							if (e.keyCode === 13) {
								sendMailMessage(chatbox, chatlist, mail);
							}
						});
					});
				});				
			},
			getMailMessages = function (mailId, callback) {
				$.get(urls.userMailMessages, { mailId: mailId }, function (response) {
					if (response.success) {
						callback(response.body);
					}
				});
			},
			sendMailMessage = function (input, chatlist, mail) {
				var msg = input.val(),
            		data = { mailId: mail._id, text: msg, date: new Date(), facebook_id: user.facebook_id, _created_by: user };

				socket.emit('sendMessage', data);
				input.val('');
				mail.messages.push(data);
				writeMessageToChat(data, chatlist);
			},
			renderCreateMail = function () {
				var page = navigatePage(1);

				getUserFriends(function (friends) {
					getTemplate('menu-tab-social-newmail', friends, function (html) {
						page.html(html);
						bindUi(page);

						page.find('.back').off('click').on('click', function () {
							page = navigatePage(-1);
						});

						var friendCountSpan = page.find('.fb-connections .friend-count'),
							friendListDiv = page.find('.fb-connections .friend-list');

						friendCountSpan.html(user._friends.length + " friend" + (user._friends.length !== 1 ? "s " : " "));

						for (var f in user._friends) {
							var friendId = user._friends[f].facebook_id,
								pic = $('<img />');

							pic.attr('src', String.format(fbPhotoUrl, friendId));

							// show friend picture in friendListDiv
							friendListDiv.append(pic);
						}

						// create submit click handler
						page.find('input[type="button"]').off('click').on('click', function (e) {
							postForm.call(this, function () {
								setMenuDetail('.tab.social-tab');
							});
						});
					});
				});
			},
			// etc
			getAllFilterIds = function (callback) {
				var tags = getAllEventTags(function (tags) {
					var tagIds = _.map(tags, function (t) { return t._id; });
					callback(tagIds);
				});
			},
			getAllEventTags = function (callback) {
				if (allTags) {
					callback(allTags);
				}
				else {
					$.ajax({
						url: urls.tags,
						type: 'GET',
						success: function (response) {
							if (response.success) {
								allTags = response.body;
								callback(allTags);
							}
						}
					});
				}
			},
			// views
			getTemplate = function (template, modelData, callback) {
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
					var div = $('<div class="event-list"></div>');

					for (var event in eventData) {
						var e = eventData[event];

						if (e._id) {
							var tagHtml = renderTagGlyphs(e._tags),
								eHtml = String.format(template, e._id, e.name, moment(e.start).format(datetimeCasualFormat), moment(e.end).format(datetimeCasualFormat), e._place.name, e.loc[1], e.loc[0], tagHtml),
								item = $(eHtml);

							if (e._created_by === user._id) {
								item.addClass('editable');
							}

							div.append(item);
						}
					}
					callback(div);
				});
			},
			renderTagGlyphs = function (tags) {
				var html = "";

				for (var t in tags) {
					if (tags[t] && tags[t].glyph) {
						html += '<span class="glyph glyphicons ' + tags[t].glyph + '">';
					}
				}

				return html;
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
						input.prop('checked', false);
						input.each(function () {
							var radio = $(this);
							if (radio.val() === model[p]) {
								radio.prop('checked', true);
							}
						});
					}
					else {
						var value = model[p];
						if (Object.prototype.toString.call(value) === '[object Array]' && value.length > 0) {
							var strVal = "";
							if (value[0]._id) {
								value = _.map(value, function (v) { return v._id; });
								strVal = value.join(',');
							}
							else {
								strVal = value.join(',');
							}
						}
						input.val(value);
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
			},
			postForm = function (callback) {
				var form = $(this).parents('form:first'),
					url = form.prop('action'),
					formData = form.serialize();

				// clear previous errors, if any
				form.find('.val-error').removeClass('val-error');
				form.find('.error-message').html('');

				$.ajax({
					url: url,
					type: 'POST',
					data: formData,
					success: function (response) {
						if (response.success) {
							callback(response.body);
						}
						else {
							var problems = [],
								errors = [];

							if (response.body.path) {
								problems.push(response.body.path);
							}
							for (var p in response.body.errors) {
								problems.push(p);
								errors.push(response.body.errors[p].message);
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

							if (errors.length > 0) {
								form.find('.error-message').html(errors.join("<br>"));
							}
						}
					}
				});
			};

		this.loadMapBoundEvents = function (bounds, callback) {
			loadEventsInBounds(bounds, callback);
		}

		this.renderEventList = function (ids, callback) {
			getEvents(ids, function (events) {
				var page = navigatePage(0, pageNames.eventGroupDetail);

				getTemplate("header-list", null, function (html) {
					page.html(html);

					var listDiv = page.find('.list-container'),
						header = page.find('.header-text');

					header.html('several events here!');
					setGroupEventList(events, listDiv);

					if (callback) {
						callback(-container.width() * .2);
					}
				});
			});
		};

		this.renderEventDetail = function (id, callback) {
			setEventDetail(id, 0);
			if (callback) {
				var panBy = (-container.width() * .2);
				callback(panBy);
			}
		};

		this.init = function () {
			var headerControls = header.find('> div:not(".app-logo")');
			headerControls.hide();
			window.fbAsyncInit = function () {
				initAuthentication(function () {
					headerControls.show();

					getAllEventTags(function () {
						applyHeaderHandlers();

						_map(function (m) {
							loadEventsInBounds(null, function (events) {
								m.renderEvents(events);
							});
						});
					});
				});
			};

			$('.app-logo').click(function () {
				window.location.reload();
			});

			// set up socket
			socket = io.connect(document.domain);

			socket.on('connect', function () {
				socketId = socket.io.engine.id;
				console.log('Connected ' + socketId);
			});

			wControlsContainer.data('wControls', obj);
		};
	};

	$.fn.wControls = function () {
		return this.each(function () {
			var el = $(this);

			if (!el.data('wControls')) {
				var plugin = new wControls(el).init();
			}
		});
	};
})(jQuery, window);