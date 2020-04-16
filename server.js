// Modules
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var findRemoveSync = require('find-remove');
var CloudmersiveConvertApiClient = require('cloudmersive-convert-api-client');



// Initizalise Variables:
path = './public/files/';



// Initialise Express:
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));



// Initialise PPT to PDF Client
var defaultClient = CloudmersiveConvertApiClient.ApiClient.instance;
var Apikey = defaultClient.authentications['Apikey'];
Apikey.apiKey = process.env.cccToken;
var ccClient = new CloudmersiveConvertApiClient.ConvertDocumentApi();



// File Parsing
// Conversion Function:
function ConvertFile(currentFile, newFile) {
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
        }
    });
}

var ReadFiles = function(err, files) {
    // Check for folder
    if (err) {
        console.error("Could not list the directory.", err);
        process.exit(1);
    }

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
            newName = file.slice(0, -3).replace(' ', '_') + 'pdf';
            ConvertFile(file, newName);
            currentFiles.push({name: file, url: newName.slice(0, -4)})            
        }

        // New Powerpoints
        if(file.endsWith(".pptx")) {
            newName = file.slice(0, -4).replace(' ', '_') + 'pdf';
            ConvertFile(file, newName);
            currentFiles.push({name: file, url: newName.slice(0, -4)})   
        }

        // Existing PDFs
        if(file.endsWith(".pdf"))
        {
            newName = file.replace(' ', "_")
            currentFiles.push({name: file, url: newName.slice(0, -4)})   
        }
    });

    // Log files available
    console.log(currentFiles);

    // Update New Page data
    app.get('/new', function (req, res) {
        res.render('new', {data: currentFiles})
    });
};


// Load file directory
fs.readdir(path, ReadFiles)


// Homepage
app.get('/', function (req, res) {
    res.render('index')
});

// Start Website
http.listen(25565, function () {
    console.log('listening on *:25565');
});