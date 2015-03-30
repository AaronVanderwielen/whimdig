(function ($, window) {
	var wControls = function (wControlsContainer) {
		var obj = this,
			socket,
			socketId,
            prodFbApi = { appId: '793549090738791', xfbml: true, version: 'v2.2' },
            testFbApi = { appId: '655662931197377', cookie: true, version: 'v2.0' },
			user,
			allTags,
			filters = {
				tags: [],
				span: 12,
				radius: 10,
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
			datetimeCasualFormat = 'ddd h:mm a',
			datetimeDateFormat = 'MM/DD/YYYY',
			datetimeStrictFormat = 'MM/DD/YYYY h:mm a',
			timeFormat = 'h:mm tt',
			fbPhotoUrl = "//graph.facebook.com/{0}/picture",
			isMobileDevice = navigator.userAgent.match(/iPad|iPhone|iPod|Android|BlackBerry|webOS/i) !== null,
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

            				header.find('> div:not(".app-logo")').hide();
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
            	//headerFilterBtn.off('click').on('click', function (e) {
            	//	if (currentPage().data('name') === pageNames.filters) {
            	//		exitOverlay();
            	//	}
            	//	else {
            	//		_map(function (m) {
            	//			m.deselect();
            	//		});
            	//		setFiltersView();
            	//	}
            	//});
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

            	//if (paging === 0) {
            	//	overlayExit.removeClass('chevron-left');
            	//	overlayExit.addClass('chevron-right');
            	//	overlayExit.off('click').on('click', exitOverlay);
            	//}
            	//else {
            	//	overlayExit.removeClass('chevron-right');
            	//	overlayExit.addClass('chevron-left');
            	//	overlayExit.off('click').on('click', function (e) {
            	//		navigatePage(-1);
            	//	});
            	//}

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
            					});
            				}
            			});

            			var tabsDiv = page.find('.tabs'),
							tabContent = page.find('.tab-content'),
            				infoTab = tabsDiv.find('.tab.info-tab'),
							chatTab = tabsDiv.find('.tab.chat-tab'),
							starTab = tabsDiv.find('.tab.star-tab');

            			// init first tab
            			eventTabChange(tabsDiv, infoTab, tabContent, renderInfoTab, event);

            			infoTab.off('click').on('click', function (e) {
            				eventTabChange(tabsDiv, $(this), tabContent, renderInfoTab, event);
            			});

            			chatTab.off('click').on('click', function (e) {
            				eventTabChange(tabsDiv, $(this), tabContent, renderChatTab, event);
            			});

            			starTab.off('click').on('click', function (e) {
            				starHandler.call(this, event);
            			});

            			starTab.find('.tab-label').html(event.users ? event.users.length : 0);
            			// should star be highlighted?
            			if (event.users) {
            				// initialize 'going' checkbox by checking if user is in event.users on client
            				if (_.some(event.users, function (u) { return u === user.facebook_id; })) {
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
			eventTabChange = function (tabContainer, tab, contentDiv, loadMethod, event) {
				if (!tab.hasClass('selected')) {
					tabContainer.find('.tab.selected').removeClass('selected');

					contentDiv.fadeOut(25, function () {
						tab.addClass('selected');

						loadMethod.call(this, event, function (div) {
							contentDiv.html('');
							contentDiv.append(div);

							contentDiv.fadeIn();
						});
					});
				}
			},
			renderInfoTab = function (event, callback) {
				getTemplate('event-detail-tab-info', event, function (html) {
					var div = $(html),
						body = div.find('.event-body'),
						when = div.find('.when'),
						where = div.find('.where'),
						what = div.find('.what'),
						connections = div.find('.connection-info'),
						numAttending = connections.find('.num-attending'),
						friendCount = connections.find('.friend-count'),
						friendsList = connections.find('.friend-list');

					// apply event detail to template
					when.html(moment(event.start).format(datetimeCasualFormat) + " - " + moment(event.end).format(datetimeCasualFormat));
					when.append($(String.format('<div class="intensity">{0}</div>', event.intensity_variable === "end" ? "show up any time before end" : "show up before start")));
					where.html(String.format('<div class="place">{0}</div><div class="address">{1}</div>', event.place.name, event.place.vicinity));
					where.data('id', event.place._id);
					where.data('created-by', event.created_by);
					what.html(event.desc);

					// click event info goes to place detail
					where.off('click').on('click', function (e) {
						var placeId = $(this).data('id');
						setPlaceDetail(placeId, 1);
					});

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

					callback(div);
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
            setGroupEventList = function (events, div) {
            	renderEventList(events, function (list) {
            		div.html(list);

            		div.find('.event').off('click').on('click', function (e) {
            			var div = $(this),
                            eventId = div.data('id'),
                            eventRef = getCdByIdInGroup(eventId);

            			//focusGroup.call(eventRef.circle);
            			setEventDetail(eventRef, 0);
            		});
            	});
            },
            starHandler = function (event) {
            	var tab = $(this),
            		glyph = tab.find('.glyph'),
					label = tab.find('.tab-label');

            	glyph.toggleClass('dislikes').toggleClass('star');
            	tab.toggleClass('active');

            	if (event.created_by !== user._id) {
            		if (tab.hasClass('active')) {
            			removeEventUser(event._id, function (response) {
            				if (response.success) {
            					//var indexOfUser = event.users.indexOf(user.facebook_id),
            					//size = getEventCircleSize(event);

            					// remove locally
            					event.users.splice(indexOfUser, 1);

            					//overlayGoing.removeClass('check');
            					//overlayGoing.removeClass('green');
            					//overlayGoing.addClass('unchecked');
            					//clearSizing(cData.circle);
            					//circleSizeTo(cData.circle, size, 0.9, null, 50);
            					label.html(parseInt(event.users.length, 10));
            					tab.removeClass('active');
            					glyph.addClass('dislikes').removeClass('star');
            				}
            			});
            		}
            		else {
            			addEventUser(event._id, function (response) {
            				if (response.success) {
            					// add locally
            					event.users.push(user.facebook_id);
            					//var size = getEventCircleSize(cData);

            					//overlayGoing.removeClass('unchecked');
            					//overlayGoing.addClass('check');
            					//overlayGoing.addClass('green');
            					//clearSizing(cData.circle);
            					//circleSizeTo(cData.circle, size, 1.1, null, 50);
            					label.html(parseInt(event.users.length, 10));
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
            								var eventId = $(this).data('id'),
                                                event = _.find(response.body, function (e) { return e._id == eventId; });

            								showOverlay(event.name);
            								setEventDetail(event, 1);
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

            								setPastEventDetail(eventId, page);
            							});
            						});
            					}
            				});
            			}
            		});
            	});
            },
            // MAIN MENU
            setMenuDetail = function () {
            	if (user) {
            		var page = navigatePage(0, pageNames.menu);

            		getTemplate('main-menu', null, function (template) {
            			page.html(template);

            			var tabsDiv = page.find('.tabs'),
							tabContent = page.find('.tab-content'),
            				findTab = tabsDiv.find('.tab.find-events-tab'),
							eventsTab = tabsDiv.find('.tab.my-events-tab'),
							socialTab = tabsDiv.find('.tab.social-tab'),
							back = page.find('.back');

            			back.off('click').on('click', exitOverlay);

            			// init first tab
            			menuTabChange(tabsDiv, findTab, tabContent, renderFindTab, "find something to do");

            			findTab.off('click').on('click', function (e) {
            				menuTabChange(tabsDiv, $(this), tabContent, renderFindTab, "find something to do");
            			});

            			eventsTab.off('click').on('click', function (e) {
            				menuTabChange(tabsDiv, $(this), tabContent, renderEventsTab, "things you'd like to do");
            			});

            			socialTab.off('click').on('click', function (e) {
            				menuTabChange(tabsDiv, $(this), tabContent, renderSocialTab, "people to do stuff with");
            			});
            		});
            	}
            },
			menuTabChange = function (tabContainer, tab, contentDiv, loadMethod, headerText) {
				if (!tab.hasClass('selected')) {
					tabContainer.find('.tab.selected').removeClass('selected');

					contentDiv.fadeOut(25, function () {
						tab.addClass('selected');
						$('.header-text').html(headerText);

						loadMethod.call(this, contentDiv);
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
						cookie = getCookie('filters');

					filters = cookie !== "" ? JSON.parse(cookie) : filters;

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
						callback(list);
					});
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
						miles = [1, 5, 10, 25, 50, 100];

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
					var event = $(this),
						eId = event.data('id'),
						lat = event.data('lat'),
						lng = event.data('lng')

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
							
							var edit = $('<span class="glyph glyphicons edit"></span>');
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
					getTemplate("create-event", tags, function (html) {
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

							exitOverlay();
							loadEventsInBounds(null, function (events) {
								_map(function (m) {
									m.clean([]);
									m.renderEvents(events, function () {
										m.select(newEvent._id);
										setEventDetail(newEvent._id, 0);
									});
								});
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
								page.find('.back').off('click').on('click', function () {
									page = navigatePage(-1);
								});
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

								page.find('.back').off('click').on('click', function () {
									page = navigatePage(-1);
								});

								var select = page.find('select[name="place"]');
								userPlacesHandler(places, select, event.place._id);
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

					if (pastEvents.length > 0) {
						getTemplate("header-list", null, function (html) {
							page.html(html);
							page.find('.header-text').html('stuff you may have went to');
							page.find('.back').off('click').on('click', function () {
								page = navigatePage(-1);
							});

							renderEventList(pastEvents, function (html) {
								page.find('.list-container').append(html);

								// event click needs to load event detail
								page.find('.event').off('click').on('click', function (e) {
									var eventId = $(this).data('id');
									setPastEventDetail(eventId, page);
								});
							});
						});
					}
					else {
						var page = navigatePage(nav, pageNames.pastEventList);
						page.html('<p>You haven\'t gone to any events!</p>');
					}
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

						numAttending.html(event.users.length);

						// click event info goes to place detail
						where.off('click').on('click', function (e) {
							var placeId = $(this).data('id');

							setPlaceDetail(placeId, 0);
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
				});
			},
			// social tab
			renderSocialTab = function (contentDiv) {
				getTemplate('menu-tab-social', null, function (html) {
					var div = $(html);

					// display friends
					var friendCountSpan = div.find('.fb-connections .friend-count'),
						friendListDiv = div.find('.fb-connections .friend-list');

					friendCountSpan.html(user.friends.length + " friend" + (user.friends > 1 ? "s " :  " "));

					for (var f in user.friends) {
						var friendId = user.friends[f],
							pic = $('<img />');

						pic.attr('src', String.format(fbPhotoUrl, friendId));

						// show friend picture in friendListDiv
						friendListDiv.append(pic);
					}

					contentDiv.html('');
					contentDiv.append(div);

					refreshFilteredList(div);

					contentDiv.fadeIn();
				});
			},
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
					var div = $('<div class="event-list"></div>');

					for (var event in eventData) {
						var e = eventData[event];

						if (e._id) {
							var eHtml = String.format(template, e._id, e.name, moment(e.start).format(datetimeCasualFormat), moment(e.end).format(datetimeCasualFormat), e.place.name, e.loc.coordinates[1], e.loc.coordinates[0]),
								item = $(eHtml);

							if (e.created_by === user._id) {
								item.addClass('editable');
							}

							div.append(item);
						}
					}
					callback(div);
				});
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
			};

		this.loadMapBoundEvents = function (bounds, callback) {
			loadEventsInBounds(bounds, callback);
		}

		this.renderEventList = function (ids, callback) {
			var pan = !container.hasClass('show-overlay');
			showOverlay();
			var page = navigatePage(0, pageNames.eventGroupDetail);

			getEvents(ids, function (events) {
				var page = navigatePage(0, pageNames.eventGroupDetail);
				selectedEvent = clicked;
				setGroupEventList(events, page);
				if (callback) {
					callback(pan ? (-container.width() * .2) : false);
				}
			});
		};

		this.renderEventDetail = function (id, callback) {
			var pan = !container.hasClass('show-overlay');
			setEventDetail(id, 0);
			if (callback) {
				var panBy = pan ? (-container.width() * .2) : 0;
				callback(panBy);
			}
		};

		this.init = function () {
			window.fbAsyncInit = function () {
				initAuthentication(function () {
					applyHeaderHandlers();

					_map(function (m) {
						loadEventsInBounds(null, function (events) {
							m.renderEvents(events);
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