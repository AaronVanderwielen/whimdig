var //local
	ControllerBundle = require('controller-bundle'),
	ControllerData = require('controller-data'),
	BusinessLogic = require('business-logic'),
	FB = require('facebook'),
	Schema = require('schema'),
	// modules
	Https = require('https'),
	Http = require('http'),
	Path = require('path'),
	Express = require('express'),
	Busboy = require('connect-busboy'), // middleware for form/file upload
	CSV = require('fast-csv'), // middleware for parsing csv files
	BodyParser = require('body-parser'),
	Socket = require("socket.io"),
	Cons = require('consolidate'),
	Session = require('express-session'),
	MongoStore = require('connect-mongo')(Session),
	Mongoose = require('mongoose'),
	Server = require('mongodb').Server,
	ObjectID = require('mongodb').ObjectID,
	u = require("underscore"),
	// objects
	app = Express(),
	cBundle = new ControllerBundle(),
	schema,
	server,
	io,
	db,
	bl,
	sessionMiddleware,
	logJson = function (json) {
		console.log(JSON.stringify(json, null, 2));
	};

Mongoose.connect('mongodb://localhost/whimdig');
db = Mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function (callback) {
	console.log("connected");
	init();
});

function init() {
	// initialize Mongoose schema
	schema = Schema(Mongoose);

	// initialize business logic
	bl = new BusinessLogic({
		database: db, 
		objectID: ObjectID,
		https: Https, 
		underscore: u, 
		facebook: FB,
		schema: schema
	});

	// initialize session middleware
	sessionMiddleware = Session({
		secret: "4lkknfpoj4509yvojn3q4-9udfvkl;m",
		store: new MongoStore({
		    db: 'whimdig',
			host: 'localhost',
			port: 27017,
			collection: 'sessions'
		})
	});

	// server and socket io
	server = Http.Server(app);
	io = Socket(server);

	// initialize session storage in mongo and usable in socketio
	io.use(function (socket, next) {
		sessionMiddleware(socket.request, socket.request.res, next);
	});
	app.use(sessionMiddleware);

	// socket.io connection
	io.on("connection", function (socket) {
		console.log("socket connection " + socket.id);
		var session = socket.request.session;

		socket.on("chat", function (data) {
		    if (session && session.user) {
		        bl.addMsgToEvent(data.text, data.eventId, session.user.facebook_id, function () {
		            socket.emit('message', { eventId: data.eventId, text: data.text, facebook_id: session.user.facebook_id });
		        });
		    }
		});
	});

	// form file upload
	app.use(Busboy());

	// initialize static file directory
	app.use(Express.static(Path.join(__dirname, '/static')));

	// initialize viewengine
	app.engine('html', Cons.swig);
	app.set('view engine', 'html');
	app.set('views', __dirname + "/views");

	// form parser
	app.use(BodyParser.json());       // to support JSON-encoded bodies
	app.use(BodyParser.urlencoded()); // to support URL-encoded bodies

	// register controllers, routes
	cBundle.loadControllers(app, ControllerData(bl, CSV));
	app.get('*', function (req, res) {
		res.status(404).send("404 Not Found");
	});

	// start server
	server.listen(1337);
	console.log("Express listening on 1337");
}