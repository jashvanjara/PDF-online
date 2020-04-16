
// If absolute URL from the remote server is provided, configure the CORS
// header on that server.

//var url = '//cdn.mozilla.net/pdfjs/tracemonkey.pdf';
var url = './pdfs/' + data;

var socket = io();

// The workerSrc property shall be specified.
var PDFJS = window['pdfjs-dist/build/pdf'];
PDFJS.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.3.200/pdf.worker.js';
//PDFJS.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.js';
// <script src="//mozilla.github.io/pdf.js/build/pdf.js"></script>

var pdfDoc = null,
    pageNum = 1,
    pageRendering = false,
    pageNumPending = null,
    scale = 1.5,
    canvas = document.getElementById('canvas-1'),
    ctx = canvas.getContext('2d');
var zoom = 1;
var height;
/**
 * Get page info from document, resize canvas accordingly, and render page.
 * @param num Page number.
 */
function renderPage(num) {
    pageRendering = true;
    // Using promise to fetch the page
    pdfDoc.getPage(num).then(function (page) {
        var normalviewport = page.getViewport({ scale: 1, });
        scale = (height - 100) * zoom / normalviewport.height;
        console.log('Rendering, scaled at: ' + scale);
        var viewport = page.getViewport({ scale: scale, });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        var cursorCanvas = document.getElementById("cursor");
        cursorCanvas.height = viewport.height;
        cursorCanvas.width = viewport.width;
        /*
        var viewport = page.getViewport(scale);
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        */

        // Render PDF page into canvas context
        var renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        var renderTask = page.render(renderContext);

        // Wait for rendering to finish
        renderTask.promise.then(function () {
            pageRendering = false;
            if (pageNumPending !== null) {
                // New page rendering is pending
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        });
    });

    // Update page counters
    document.getElementById('page_num').textContent = num;
}

/**
 * If another page rendering in progress, waits until the rendering is
 * finised. Otherwise, executes rendering immediately.
 */
function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

/**
 * Displays previous page.
 */

function changePage(num) {
    socket.emit('page', num);
}
function onPrevPage() {
    if (pageNum <= 1) {
        return;
    }
    pageNum--;
    //queueRenderPage(pageNum);
    changePage(pageNum);
}
document.getElementById('prev').addEventListener('click', onPrevPage);

/**
 * Displays next page.
 */
function onNextPage() {
    if (pageNum >= pdfDoc.numPages) {
        return;
    }
    pageNum++;
    //queueRenderPage(pageNum);
    changePage(pageNum);
}
document.getElementById('next').addEventListener('click', onNextPage);

/*
 * Change Zoom
 */

var oldZoom = 1;
function safeZoom(pageNum, callback) {
    if((zoom > 2.5 && oldZoom === 2.5) || zoom < 0.4 && oldZoom === 0.4) {
        return;
    }
    if (zoom >= 2.5) {
        zoom = 2.5;
    }
    if (zoom <= 0.4) {
        zoom = 0.4;
    }
    oldZoom = zoom;
    callback(pageNum);
}
function onPlusZoom() {
    zoom += 0.1;
    safeZoom(pageNum, queueRenderPage);
    //queueRenderPage(pageNum);
}
document.getElementById('plus').addEventListener('click', onPlusZoom);
function onMinusZoom() {
    zoom -= 0.1;
    safeZoom(pageNum, queueRenderPage);
}
document.getElementById('minus').addEventListener('click', onMinusZoom);


/* DOWNLOAD PROGRESS */
function progress(fraction) {
    var percent = Math.round(fraction * 100);
    document.getElementById('loaded').setAttribute("style", `width:${percent}%`);
    if (percent === 100) {
        document.getElementById('loaded').setAttribute('style', 'display: none');
        document.getElementById('loadingbar').setAttribute('style', 'height: 2px');
    }
}

/**
 * Asynchronously downloads PDF.
 */
var loading = PDFJS.getDocument(url)
loading.onProgress = ({ loaded, total, }) => {
    progress(loaded / total);
};
loading.promise.then(function (pdfDoc_) {
    pdfDoc = pdfDoc_;
    document.getElementById('page_count').textContent = pdfDoc.numPages;
    // Initial/first page rendering
    renderPage(pageNum);
});

document.addEventListener("DOMContentLoaded", function (event) {
    var body = document.body,
        html = document.documentElement;
    height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
});

var id = -1;
socket.on('goto page', function (data) {
    pageNum = data.page;
    if (pdfDoc) {
        queueRenderPage(data.page);
    } else {
        console.log('Still loading pdf');
    }
    console.log(data);
});
// ["AliceBlue","AntiqueWhite","Aqua","Aquamarine","Azure","Beige","Bisque","Black","BlanchedAlmond","Blue","BlueViolet","Brown","BurlyWood","CadetBlue","Chartreuse","Chocolate","Coral","CornflowerBlue","Cornsilk","Crimson","Cyan","DarkBlue","DarkCyan","DarkGoldenRod","DarkGray","DarkGrey","DarkGreen","DarkKhaki","DarkMagenta","DarkOliveGreen","Darkorange","DarkOrchid","DarkRed","DarkSalmon","DarkSeaGreen","DarkSlateBlue","DarkSlateGray","DarkSlateGrey","DarkTurquoise","DarkViolet","DeepPink","DeepSkyBlue","DimGray","DimGrey","DodgerBlue","FireBrick","FloralWhite","ForestGreen","Fuchsia","Gainsboro","GhostWhite","Gold","GoldenRod","Gray","Grey","Green","GreenYellow","HoneyDew","HotPink","IndianRed","Indigo","Ivory","Khaki","Lavender","LavenderBlush","LawnGreen","LemonChiffon","LightBlue","LightCoral","LightCyan","LightGoldenRodYellow","LightGray","LightGrey","LightGreen","LightPink","LightSalmon","LightSeaGreen","LightSkyBlue","LightSlateGray","LightSlateGrey","LightSteelBlue","LightYellow","Lime","LimeGreen","Linen","Magenta","Maroon","MediumAquaMarine","MediumBlue","MediumOrchid","MediumPurple","MediumSeaGreen","MediumSlateBlue","MediumSpringGreen","MediumTurquoise","MediumVioletRed","MidnightBlue","MintCream","MistyRose","Moccasin","NavajoWhite","Navy","OldLace","Olive","OliveDrab","Orange","OrangeRed","Orchid","PaleGoldenRod","PaleGreen","PaleTurquoise","PaleVioletRed","PapayaWhip","PeachPuff","Peru","Pink","Plum","PowderBlue","Purple","Red","RosyBrown","RoyalBlue","SaddleBrown","Salmon","SandyBrown","SeaGreen","SeaShell","Sienna","Silver","SkyBlue","SlateBlue","SlateGray","SlateGrey","Snow","SpringGreen","SteelBlue","Tan","Teal","Thistle","Tomato","Turquoise","Violet","Wheat","White","WhiteSmoke","Yellow","YellowGreen"];
var CSS_COLOR_NAMES = ["Blue", "BlueViolet", "Brown", "BurlyWood", "CadetBlue", "Chartreuse", "Chocolate", "Coral", "CornflowerBlue", "Cornsilk", "Crimson", "Cyan", "DarkBlue", "DarkCyan", "DarkGoldenRod", "DarkGray", "DarkGrey", "DarkGreen", "DarkKhaki", "DarkMagenta", "DarkOliveGreen", "Darkorange", "DarkOrchid", "DarkRed", "DarkSalmon", "DarkSeaGreen", "DarkSlateBlue", "DarkSlateGray", "DarkSlateGrey", "DarkTurquoise", "DarkViolet", "DeepPink", "DeepSkyBlue", "DimGray", "DimGrey", "DodgerBlue", "FireBrick", "FloralWhite", "ForestGreen", "Fuchsia", "Gainsboro", "GhostWhite", "Gold", "GoldenRod", "Gray", "Grey", "Green", "GreenYellow", "HoneyDew", "HotPink", "IndianRed", "Indigo", "Ivory", "Khaki", "Lavender", "LavenderBlush", "LawnGreen", "LemonChiffon", "LightBlue", "LightCoral", "LightCyan", "LightGoldenRodYellow", "LightGray", "LightGrey", "LightGreen", "LightPink", "LightSalmon", "LightSeaGreen", "LightSkyBlue", "LightSlateGray", "LightSlateGrey", "LightSteelBlue", "LightYellow", "Lime", "LimeGreen", "Linen", "Magenta", "Maroon", "MediumAquaMarine", "MediumBlue", "MediumOrchid", "MediumPurple", "MediumSeaGreen", "MediumSlateBlue", "MediumSpringGreen", "MediumTurquoise", "MediumVioletRed", "MidnightBlue", "MintCream", "MistyRose", "Moccasin", "NavajoWhite", "Navy", "OldLace", "Olive", "OliveDrab", "Orange", "OrangeRed", "Orchid", "PaleGoldenRod", "PaleGreen", "PaleTurquoise", "PaleVioletRed", "PapayaWhip", "PeachPuff", "Peru", "Pink", "Plum", "PowderBlue", "Purple", "Red", "RosyBrown", "RoyalBlue", "SaddleBrown", "Salmon", "SandyBrown", "SeaGreen", "SeaShell", "Sienna", "Silver", "SkyBlue", "SlateBlue", "SlateGray", "SlateGrey", "Snow", "SpringGreen", "SteelBlue", "Tan", "Teal", "Thistle", "Tomato", "Turquoise", "Violet", "Wheat", "White", "WhiteSmoke", "Yellow", "YellowGreen"];
socket.on('draw_cursor', function (data) {
    var ccanvas = document.getElementById("cursor");
    var ctx = ccanvas.getContext("2d");

    //ctx.fillRect(data.x, data.y, 10, 10);
    ctx.clearRect(0, 0, ccanvas.width, ccanvas.height);
    data.forEach(c => {
        ctx.fillStyle = CSS_COLOR_NAMES[c.id - 1];
        ctx.fillRect(c.x * scale, c.y * scale, 10, 10);
    });
});

socket.on('id', function (data) {
    id = data;
});

function findScreenCoords(mouseEvent) {
    var xpos;
    var ypos;
    //var test = new MouseEvent('adad');
    if (mouseEvent) {
        //FireFox
        xpos = mouseEvent.clientX;
        ypos = mouseEvent.clientY;
    }
    else {
        //IE
        xpos = window.event.screenX;
        ypos = window.event.screenY;
    }
    ypos -= document.getElementById("canvas-1").offsetTop - window.pageYOffset + 75;
    xpos -= document.getElementById("canvas-1").offsetLeft - window.pageXOffset + 15;
    ypos /= scale;
    xpos /= scale;
    if (id !== -1) {
        socket.emit('draw_cursor', { x: xpos, y: ypos, id: id });
    }
}
$(window).bind('mousewheel DOMMouseScroll', function (event) {
    if (event.ctrlKey == true) {
        //alert('disabling zooming');
        event.preventDefault();
        var delta;
        if (event.originalEvent.wheelDelta) {
            delta = event.originalEvent.wheelDelta;
        } else {
            delta = -1 * event.originalEvent.deltaY;
        }
        if (delta < 0) {
            zoom -= 0.2;
            safeZoom(pageNum, queueRenderPage);
        } else if (delta > 0) {
            zoom += 0.2;
            safeZoom(pageNum, queueRenderPage);
        }
    }
});

document.onmousemove = findScreenCoords;
document.onmousewheel = findScreenCoords;
//document.onmousedown = findScreenCoords;