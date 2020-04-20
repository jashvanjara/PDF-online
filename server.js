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
path = './public/files/';

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
publicStreamList= {}
numberOfStreams = 0;
// Function
function newStream(name, tutor, file, pageCount) {
    // Create ID for URL
    id = uniqid();
    admin = uniqid();
    numberOfStreams += 1;

    // List of streams
    streams[id] = {id: id, name: name, tutor: tutor, viewerCount: 0,
        currentPage: 1, pageLimit: pageCount, file: file, admin: admin};


    publicStreamList[id] = {id: id, name: name, tutor: tutor, viewerCount: 0,
        currentPage: 1, pageLimit: pageCount}

    app.get('/' + id, function(req, res){
        res.render('viewer/viewer', {type: "user", file: file, streamDetails: streams[id]})
    })

    app.get('/' + id + '/' + admin, function(req, res){
        res.render('viewer/viewer', {type: "admin", file: file, streamDetails: streams[id]})
    })
    
    return {streamID: id, admimID: admin};
}

function updateStreamName(id, name){
    streams[id].name = name;
    publicStreamList[id].name = name;
}

function updateStreamViewers(id, viewerCount){
    streams[id].viewerCount = viewerCount;
    publicStreamList[id].viewerCount = viewerCount;
}

function updateStreamPage(id, page){
    streams[id].currentPage = page;
    publicStreamList[id].currentPage = page;
}


/// ---------------- SOCKETS ----------------
// Create Socket IO connection
io.on('connection', function (socket) {
    console.log('A user connected');
    
    // Index Page
    /*
    socket.on('request streamlist', function(){
        socket.join('home');
        socket.emit('send streamlist', {
            streamlist: publicStreamList
        });
    });
    */

    // Disconnect
    socket.on('disconnect', function(){
        console.log('A user disconnected')
    });
});

/// ---------------- EXPRESS ----------------
// Homepage
app.get('/', function (req, res) {
    res.render('index/index', {publicStreamList: publicStreamList, numberOfStreams: numberOfStreams})
});

/// ---------------- Start Website ----------------
// Glitch
app.listen(8080);
// Self Host
http.listen(25565, function () {
    console.log('listening on *:25565');
});