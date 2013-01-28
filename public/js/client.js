//current session web socket holder
var ws;
function connect(name) {
	// connect client web socket
	if (!io)
		;// reload io js
	ws = io.connect('', {
		"sync disconnect on unload" : true
	});

	// send user details when joining
	ws.on('connect', function() {
		if (ws.socket.sessionid) {
			// set current session preferences
			ws.username = name;
			ws.uid = ws.socket.sessionid;
			// send join message
			ws.emit('join', {
				username : ws.username,
				uid : ws.uid
			});
		}
	});

	// notify user when reconnected
	ws.on('reconnect', function() {
		if (ws.socket.sessionid) {
			ws.uid = ws.socket.sessionid;
			addmsg(ws.uid, ws.username, "reconnected to server...", $("input#currentab").val(), null);
		}
	});

	// whenever the server emits 'onlineusers', this updates the
	// username list
	ws.on('onlineusers', function(data) {
		$('#users').empty();
		$.each(data, function(key, user) {
			if (ws.username != user.username) {
				$('#users').append(
						'<div id="user-' + user.username
								+ '"><a href="#" class="user-chat">'
								+ user.username + '</a></div>');				
			}
		});
	});

	// when a new user join, add his username to the userlist
	ws.on('userjoin', function(user) {
		$('#users').append(
				'<div id="user-' + user.username
						+ '"><a href="#" class="user-chat">' + user.username
						+ '</a></div>');		
	});

	// when a new user leaves, remove his username from the userlist
	ws.on('userleft', function(username) {
		$("#user-" + username).remove();
		if ($('#tab-' + username)[0]) {
			addmsg(ws.uid, username, 'left the channel.', username, null);			
		}
	});

	// take care of broadcasted msgs
	ws.on('msg', function(data) {
		addmsg(data.uid, data.username, data.text, 'chatroom', data.created);
	});

	// take care of private messages
	ws.on("private", function(data) {
		var receiver;
		if (data.from == ws.username) {
			receiver = data.receiver;
		} else {
			receiver = data.from;
		}
		if ($('#tab-' + receiver)[0]) {
			activetabchat(receiver);
		} else {
			addtabchat(receiver);
			activetabchat(receiver);
		}
		
		addmsg(data.uid, data.from, data.text, receiver, data.created);
	});

	// on close
	ws.on('disconnect', function() {
		addmsg(ws.uid, ws.username,
				"disconnected from server; reconnecting...", $("input#currentab").val(), null);
	});

	// current user submit chat msg
	$('#input form').submit(function(event) {
		event.preventDefault();
		var input = $('input#message');
		var tab = $("input#currentab");
		var msg = input.val().trim();
		if (msg && msg.length <= 140) {

			if (tab && tab.val() != 'chatroom') {
				// sending private messages
				ws.emit("private", {
					uid : ws.uid,
					username : ws.username,
					text : msg,
					receiver : tab.val()
				});
			} else {
				// sending public messages
				ws.emit('msg', {
					uid : ws.uid,
					username : ws.username,
					text : msg
				});
			}

			input.val('');
		} else {
			alert("text too long");
		}
	});

	// leave the channel
	$(document).on("click", '#close', function() {
		leave();
	});
}

function join(name) {
	if (!name) {
		return;
	}

	if (name.length > 20) {
		alert("name" + name + " too long");
		return;
	}

	// check name availability
	$.ajax('/username/available', {
		type : 'GET',
		data : {
			q : name
		},
		success : function(data) {
			if (data != 'yes') {
				alert("name " + name
						+ " is already picked, please choose another one.");
				return;
			}

			enterchat(name);
		},
		error : function() {
			return;
		}
	});
}

function enterchat(name) {
	// flush dirty connections
	if (ws) {
		ws.disconnect();
	}
	// connect
	connect(name);
	// open chat box
	$('#ask').hide();
	$('#close').show();
	$('#channel').show();
	$('#input').show();
	$('input#message').focus();
}

function leave() {
	// close connection
	ws.disconnect();
	// refresh page
	location.href = '';
}

function addmsg(uid, username, text, tab, time) {
	if (!uid) {
		return;
	}
	if (!text) {
		return;
	}

	// supply time if wrong
	if (!time) {
		time = new Date();
	} else if ((time instanceof Date) === false) {
		time = new Date(time);
	}

	// build a messages
	var container = $('div#msgs #tabcontent-' + tab);
	var struct = container.find('li.message:first');
	var msg = struct.clone();
	msg.find('.time').text((time).toString("HH:mm:ss"));
	msg.find('.user').text(username);
	msg.find('.message').text(' ' + text);

	if (ws.socket.sessionid == uid) {
		msg.find('.user').addClass('self');
	}

	// add the msg to the list
	container.find('ul').append(msg.show());
	container.scrollTop(container.find('ul').innerHeight());
}


function addtabchat(username) {
	$('#chat-tabs').append(
			'<li class=""><a href="#" class="tabchat" data-name="' + username + '" id="tab-' + username + '" >'
			+ username 
			+ ' <a href="#" class="tab-close" data-name="' + username + '" >[X]</a>'
			+ '</a></li>');
	
	$('#msgs').append(
			'<div class="tab-pane hidden" id="tabcontent-' + username + '">'
            	+ '<ul>'
            		+ '<li class="message" style="display: none">'
            			+ '<span class="user"></span><span class="message"></span>'
            			+ '<span class="time"></span>'
        			+ '</li>'
    			+ '</ul>'
			+ '</div>');
}

function activetabchat(username) {
	
	var currentab = $("input#currentab").val();
	
	$('#tab-' + currentab).parent().removeClass("active");
	$('#tabcontent-' + currentab).addClass("hidden");
	
	$('#tab-' + username).parent().addClass("active");
	$('#tabcontent-' + username).removeClass("hidden");
	
	$("input#currentab").val(username);
}

function closetabchat(username) {
	$('#tab-' + username).parent().remove();
	$('#tabcontent-' + username).remove();
	if ($("input#currentab").val() == username) {
		activetabchat('chatroom');
	}	
}

$(document).ready(function() {
	$('#ask').show();
	// join on enter
	$('#ask input').keydown(function(event) {
		if (event.keyCode == 13) {
			event.preventDefault();
			$('#ask button').click();
		}
	});

	// join on click
	$(document).on("click", '#ask button', function() {
		join($('#ask input').val(), $('#ask select').val());
	});
	
	$(document).on("click", '.user-chat', function() {
		var name = $(this).text();
		if ($('#tab-' + name)[0] == undefined) {
    		addtabchat(name);
    		activetabchat(name);
		}
	});
	
	$(document).on("click", '.tabchat', function() {
		activetabchat($(this).data('name'));    		
	});
	
	$(document).on("click", '.tab-close', function() {
		closetabchat($(this).data('name'));
	});
	
	
});
