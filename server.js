/// Modules
var express = require('express');
var app = express();
var http = require('http').Server(app);
const bodyParser = require('body-parser');
var io = require('socket.io')(http);
var fs = require('fs');
var serveIndex = require('serve-index');
const fileUpload = require('express-fileupload');
const getPageCount = require('docx-pdf-pagecount');
var uniqid = require('uniqid');
var findRemoveSync = require('find-remove');
var CloudmersiveConvertApiClient = require('cloudmersive-convert-api-client');


/// ---------------- Initialise
// Variables:
var port = process.env.PORT || 3000;
var path = './public/files/';

// Express:
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/views'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(fileUpload());
app.use('/files', 
express.static(__dirname + '/public/files'), 
serveIndex(__dirname + '/public/files'));

// PPT to PDF Client
var defaultClient = CloudmersiveConvertApiClient.ApiClient.instance;
var Apikey = defaultClient.authentications['Apikey'];
Apikey.apiKey = process.env.cccToken;
var ccClient = new CloudmersiveConvertApiClient.ConvertDocumentApi();



/// ---------------- File Parsing ----------------
// Conversion Function:
function ConvertFile(currentFile, newFile, callback) {
    // Open File
    var inputFile = Buffer.from(fs.readFileSync(path + currentFile).buffer);
    // Call API
    ccClient.convertDocumentPptxToPdf(inputFile, function(err, data, res) {
        if(err) {
            console.error(err);
        } else {
            // Successful conversion
            console.log("CC API File conversion: " + currentFile);
            fs.writeFileSync(path + newFile, data);
            fs.unlink(path + currentFile, function (err) { 
                if (err) {
                    console.error(err)
                }
            }); 
            callback();
        }
    });
}

// Reading files
function ReadFiles(callback) {
    fs.readdir(path, function(err, files)
    {
        // Delete files older then a week:
        var result = findRemoveSync(path, {age: {seconds: 60*60*24*14}, extensions: ".pdf"});
        console.log("Deleted old files:");
        console.log(result);

        // Parse all files
        currentFiles = []
        files.forEach(function(file, index){

            var result = findRemoveSync('/tmp', {age: {seconds: 3600}, extensions: '.jpg', limit: 100})
            
            // Old powerpoints
            if(file.endsWith(".ppt")) {
                newName = file.slice(0, -3).replace(/ /g, '_') + 'pdf';
                ConvertFile(file, newName);
                currentFiles.push({name: file.replace(/ /g, "_"), url: newName.slice(0, -4)})            
            }

            // New Powerpoints
            if(file.endsWith(".pptx")) {
                newName = file.slice(0, -4).replace(/ /g, '_') + 'pdf';
                ConvertFile(file, newName);
                currentFiles.push({name: file.replace(/ /g, "_"), url: newName.slice(0, -4)})   
            }

            // Existing PDFs
            if(file.endsWith(".pdf"))
            {
                newName = file.replace(/ /g, "_")
                currentFiles.push({name: file.replace(/ /g, "_"), url: newName.slice(0, -4)})   
            }
        });

        // Log files available
        console.log(currentFiles);
        callback(currentFiles);
    })
};

// Update New Page data
app.get('/new', function (req, res) {
    // Load file directory using ReadFiles function
    ReadFiles(function(currentFiles) {
        res.render('new/new', {currentFiles: currentFiles});
    })

});

// Return Stream:
function ReturnStream(req, file, callback)
{
    getPageCount(path + file).then(pages => {
        newID = newStream(req.body.streamName, req.body.tutorName, file, pages);
        callback('/' + newID.streamID + '/' + newID.admimID);
    });
}

// Create new Stream
app.post('/new', function(req, res){
    if(req.body.file == ".newfile."){
        req.files.fileUpload.mv(path + req.files.fileUpload.name,
        function(err) {
            if(err) {
                console.error(err);
            }
            // Convert
            // Old powerpoints
            if(req.files.fileUpload.name.endsWith(".ppt")) {
                newName = req.files.fileUpload.name.slice(0, -3).replace(/ /g, '_') + 'pdf';
                ConvertFile(req.files.fileUpload.name, newName, 
                    function() {
                        ReturnStream(req, newName,
                            function(url){
                                res.redirect(url);
                            });
                    });      
            }
            // New Powerpoints
            if(req.files.fileUpload.name.endsWith(".pptx")) {
                newName = req.files.fileUpload.name.slice(0, -4).replace(/ /g, '_') + 'pdf';
                ConvertFile(req.files.fileUpload.name, newName, 
                    function() {
                        ReturnStream(req, newName,
                        function(url){
                            res.redirect(url);
                        });
                    });
            }
            if(req.files.fileUpload.name.endsWith(".pdf")) {
                ReturnStream(req, req.files.fileUpload.name,
                    function(url){
                        res.redirect(url);
                    });
            }
        })
    } else {
        ReturnStream(req, req.body.file,
            function(url){
                res.redirect(url);
        });
    }
});

/// ---------------- Streams ----------------
// Variables
streams = {};
publicStreamList= {};
viewers = {};
numberOfStreams = 0;
// Function
function newStream(name, tutor, file, pageCount) {
    // Create ID for URL
    id = uniqid();
    admin = uniqid();
    numberOfStreams += 1;

    // List of streams
    streams[id] = {id: id, name: name, tutor: tutor, viewerCount: 0,
        currentPage: 1, pageLimit: pageCount, file: file, admin: admin,
        streamers: {}, currentColor: 0};


    publicStreamList[id] = {id: id, name: name, tutor: tutor, viewerCount: 0,
        currentPage: 1, pageLimit: pageCount}

    app.get('/' + id, function(req, res){
        res.render('viewer/viewer', {type: "user", streamDetails: streams[id]})
    })

    app.get('/' + id + '/' + admin, function(req, res){
        res.render('viewer/viewer', {type: "admin", streamDetails: streams[id]})
    })
    
    return {streamID: id, admimID: admin};
}

function updateStreamName(id, name){
    streams[id].name = name;
    publicStreamList[id].name = name;
}

function updateStreamViewers(id, viewerCount){
    streams[id].viewerCount += viewerCount;
    publicStreamList[id].viewerCount += viewerCount;
}

function updateStreamPage(id, page){
    streams[id].currentPage = page;
    publicStreamList[id].currentPage = page;
}

// Colours
var CSS_COLOR_NAMES = ["Blue", "BlueViolet", "Brown", "BurlyWood", "CadetBlue", 
"Chartreuse", "Chocolate", "Coral", "CornflowerBlue", "Cornsilk", 
"Crimson", "Cyan", "DarkBlue", "DarkCyan", "DarkGoldenRod", "DarkGray", 
"DarkGrey", "DarkGreen", "DarkKhaki", "DarkMagenta", "DarkOliveGreen", 
"Darkorange", "DarkOrchid", "DarkRed", "DarkSalmon", "DarkSeaGreen", 
"DarkSlateBlue", "DarkSlateGray", "DarkSlateGrey", "DarkTurquoise", "DarkViolet", 
"DeepPink", "DeepSkyBlue", "DimGray", "DimGrey", "DodgerBlue", "FireBrick", 
"FloralWhite", "ForestGreen", "Fuchsia", "Gainsboro", "GhostWhite", "Gold", 
"GoldenRod", "Gray", "Grey", "Green", "GreenYellow", "HoneyDew", "HotPink", 
"IndianRed", "Indigo", "Ivory", "Khaki", "Lavender", "LavenderBlush", "LawnGreen", 
"Magenta", "Maroon", "MediumAquaMarine", "MediumBlue", "MediumOrchid",
"MediumPurple", "MediumSeaGreen", "MediumSlateBlue", "MediumSpringGreen",
"MediumTurquoise", "MediumVioletRed", "MidnightBlue", "MintCream", "MistyRose", 
"Moccasin", "NavajoWhite", "Navy", "OldLace", "Olive", "OliveDrab", "Orange", 
"OrangeRed", "Orchid", "PaleGoldenRod", "PaleGreen", "PaleTurquoise", 
"PaleVioletRed", "PapayaWhip", "PeachPuff", "Peru", "Pink", "Plum", "PowderBlue", 
"Purple", "Red", "RosyBrown", "RoyalBlue", "SaddleBrown", "Salmon", "SandyBrown", 
"SeaGreen", "SeaShell", "Sienna", "Silver", "SkyBlue", "SlateBlue", "SlateGray", 
"SlateGrey", "Snow", "SpringGreen", "SteelBlue", "Tan", "Teal", "Thistle",
 "Tomato", "Turquoise", "Violet", "Wheat", "White", "WhiteSmoke", "Yellow", 
 "YellowGreen"];

 function newStreamer(streamID, streamerID){
    col = CSS_COLOR_NAMES[streams[streamID].currentColor];
    streams[streamID].currentColor++;
    if(streams[streamID].currentColor >= CSS_COLOR_NAMES.length) {
        streams[streamID].currentColor = 0;
    }
    streams[streamID].streamers[streamerID] = {x: 0, y: 0, colour: col, id: streamerID};
    return col;
 }

/// ---------------- SOCKETS ----------------
// Create Socket IO connection
io.on('connection', function (socket) {
    console.log('A user connected');

    socket.on('subscribe', function(data){
        console.log(data);
        if(data.id in streams)
        {
            socket.join(data.id);
            if(data.type === "admin"){
                socket.emit('streamer_color', newStreamer(data.id, socket.id));
            }
            viewers[socket.id] = data.id;
            updateStreamViewers(data.id, 1);
            io.in(data.id).emit('viewer_count', streams[data.id].viewerCount);
            socket.emit('update', streams[data.id].currentPage);
        }
    })

    socket.on('page', function(data) {
        console.log(data);
        if(socket.id in streams[data.id].streamers)
        {
            updateStreamPage(data.id, data.number);
            io.in(data.id).emit('goto_page', data.number);
        }
    });

    socket.on('move_cursor', function(data) {
        if(data.id in streams)
        {
            if(socket.id in streams[data.id].streamers)
            {
                streams[data.id].streamers[socket.id].x = data.x;
                streams[data.id].streamers[socket.id].y = data.y;
                socket.to(data.id).emit('draw_cursor', streams[data.id].streamers);
            }
        }
    });

    // Disconnect
    socket.on('disconnect', function(){
        console.log('A user disconnected')
        if(socket.id in viewers) {
            updateStreamViewers(viewers[socket.id], -1);
            io.in(viewers[socket.id]).emit('viewer_count', streams[viewers[socket.id]].viewerCount);
            if(socket.id in streams[viewers[socket.id]].streamers)
            {
                delete streams[viewers[socket.id]].streamers[socket.id];
            }
            delete viewers[socket.id];
        }
    });
});

/// ---------------- EXPRESS ----------------
// Homepage
app.get('/', function (req, res) {
    res.render('index/index', {publicStreamList: publicStreamList, numberOfStreams: numberOfStreams})
});

/// ---------------- Start Website ----------------
// Start server
http.listen(port, function () {
    console.log('listening on *:' + port);
});