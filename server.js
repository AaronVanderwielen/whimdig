var //local
	ControllerBundle = require('controller-bundle'),
	ControllerData = require('controller-data'),
	BusinessLogic = require('business-logic'),
	FB = require('facebook'),
	// modules
	Https = require('https'),
	Path = require('path'),
	Express = require('express'),
	BodyParser = require('body-parser'),
	Cons = require('consolidate'),
	MongoClient = require('mongodb').MongoClient,
	Session = require('express-session'),
	MongoStore = require('connect-mongo')(Session),
	Server = require('mongodb').Server,
	ObjectID = require('mongodb').ObjectID,
	u = require("underscore"),
	// objects
	app = Express(),
	mongoClient = new MongoClient(new Server('localhost', 27017, { 'native_parser': true })),
	db = mongoClient.db('wiegos'),
	bl = new BusinessLogic({db: db, objectID: ObjectID}, Https, u, FB),
	cBundle = new ControllerBundle();

// initialize static file directory
app.use(Express.static(Path.join(__dirname, '/static')));

// initialize session storage in mongo
app.use(Session({
	secret: "asdifj0w3jfowimrjv0i2m50moimgojh2980j",
	store: new MongoStore({
		db: 'wiegos',
		host: 'localhost',
		port: 27017,
		collection: 'sessions'
	})
}));

// initialize viewengine
app.engine('html', Cons.swig);
app.set('view engine', 'html');
app.set('views', __dirname + "/views");

// form parser
app.use(BodyParser.json());       // to support JSON-encoded bodies
app.use(BodyParser.urlencoded()); // to support URL-encoded bodies

// register controllers, routes
cBundle.loadControllers(app, ControllerData(bl));
app.get('*', function (req, res) {
	res.status(404).send("404 Not Found");
});

// mongo connection
mongoClient.open(function (err, mongoClient) {
	if (!err) {
		//initialize web app
		app.listen(1337);
		console.log("Express listening on 1337");
	}
	else {
		console.log("ERR on mongo open");
	}
});