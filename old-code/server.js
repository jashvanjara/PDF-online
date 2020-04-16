// Express Variables
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');

app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/views'));

fs.readdir('./views/pdfs/', function (err, files) {
    if (err) {
        console.error("Could not list the directory.", err);
        process.exit(1);
    }

    pdfFiles = []
    files.forEach(function (file, index) {
        if (file.endsWith(".pdf"))
        {
            console.log("Found file: " + file);
            pdfFiles.push({name: file, url: file.split('.')[0].replace(' ', "_"), viewers: 0})            
        }
    })

    app.get('/', function (req, res) {
        res.render('index', {data: pdfFiles})
    });

    pdfFiles.forEach(function (file, index) {
        app.get('/' + file.url, function (req, res) {
            res.render('view', {data: file})
        });
    })
})

var cursors = [];
var socketCursor = {};
var id = 0;
var curentPage = 1;
io.on('connection', function (socket) {
    console.log('a user connected');
    socket.emit('id', id);
    socketCursor[socket.id] = id;
    id++;
    socket.emit('goto page', { page: curentPage });
    socket.on('msg', function (msg) { 
        console.log(msg);
    })
    socket.on('disconnect', function () {
        for (var i = 0; i < cursors.length; i++) {
            if (cursors[i].id === socketCursor[socket.id]) {
                cursors.splice(i, 1);
            }
        }
        console.log('user disconnected');
    });

    socket.on('page', function (data) {
        curentPage = data;
        io.emit('goto page', { page: data, id: socketCursor[socket.id]});
    });
    socket.on('draw_cursor', function (data) {
        var update = -1;
        for (var i = 0; i < cursors.length; i++) {
            if (cursors[i].id === data.id) {
                update = i;
            }
        }
        if (update > -1) {
            cursors[update] = { x: data.x, y: data.y, id: data.id };
        } else {
            cursors.push({ x: data.x, y: data.y, id: data.id });
        }
        io.emit('draw_cursor', cursors);
    });
});


http.listen(25565, function () {
    console.log('listening on *:25565');
});