var node_port, webroot, http, io, express, app, server, ws, clients;

node_port = process.env.PORT || 8888;
webroot = '/public';
http = require('http');
io = require('socket.io');
express = require('express');

// configure express
app = module.exports = express();
app.configure(function() {
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(app.router);
	app.use(express.static(__dirname + webroot));
});

server = http.createServer(app);

// Keep track of the chat clients
clients = {};

// translate proxy to google translate api to keep our apikey secret and to
// avoid jsonp hacks
app.get('/username/available', function(req, res) {
	if (!req.param('q') || req.param('q').length > 20
			|| clients[req.param('q')]) {
		res.send('no');
	} else {
		res.send('yes');
	}
});

app.get('/status', function(req, res) {
	res.send(Object.keys(clients).length + ' users online');
});

// web sockets handling
ws = io.listen(server, {
	'flash policy port' : -1
});

ws.configure(function() {
	// ws.set('transports', ['websocket', 'flashsocket', 'htmlfile',
	// 'xhr-polling', 'jsonp-polling']);
	ws.set("transports", [ "xhr-polling" ]);
	ws.set("polling duration", 10);
	ws.set("log level", 2);

	// blocked send/listen not from our domain
	ws.set('authorization', function(handshakeData, callback) {
		if (handshakeData.xdomain) {
			callback('Cross-domain connections are not allowed');
		} else {
			callback(null, true);
		}
	});
});

// when a client connect
ws.sockets.on('connection', function(client) {

	// when a new user join
	client.on('join', function(data) {

		// set client preferences
		client.username = data.username;

		// Put this new client in the list
		clients[client.username] = {
			uid : client.id,
			username : client.username
		};

		// echo to client they've connected
		client.emit('msg', {
			uid : client.id,
			username : client.username,
			text : ' has entered the channel.'
		});

		// broadcast new user joining
		client.broadcast.emit('msg', {
			uid : client.id,
			username : client.username,
			text : ' has entered the channel.'
		});

		client.broadcast.emit('userjoin', {
			uid : client.id,
			username : client.username
		});

		// update the list of users in chat, client-side
		client.emit('onlineusers', clients);

		// ws.sockets.emit('msg', {uid: client.id, username: client.username,
		// text: ' has entered the channel.'});
	});

	// when user send a chat msg
	client.on('msg', function(data) {
		// broadcast msg
		ws.sockets.emit('msg', {
			uid : data.uid,
			username : data.username,
			text : data.text
		});
	});

	client.on("private", function(data) {
		
		// send private msg to receiver
		if (data.receiver != 'chatroom' && clients[data.receiver]) {
			
			var receiver_uid = clients[data.receiver].uid;
			
			ws.sockets.sockets[receiver_uid].emit("private", {
				uid: data.uid,
				from : data.username,
				receiver : data.receiver,
				text : data.text
			});

			// show private msg to self
			client.emit("private", {
				uid: data.uid,
				from : client.username,
				receiver : data.receiver,
				text : data.text
			});
		}
	});

	// when a user leave the chat
	client.on('disconnect', function() {
		// remove from lists
		delete clients[client.username];
		// update the list of users in chat, client-side
		ws.sockets.emit('userleft', client.username);
		// broadcast msg
		ws.sockets.emit('msg', {
			uid : client.id,
			username : client.username,
			text : 'left the channel.'
		});
	});

});

// start getting connection from clients
server.listen(node_port, function() {
	console.log('> listening on http://127.0.0.1:' + node_port + '/');
});
