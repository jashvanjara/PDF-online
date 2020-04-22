// id=session id (code)
// accessType=access type (user/admin)
// fileName=url
var socket = io();

// ------------------------------------------------------------------------- 
// ----------------------------- PDF Variables -----------------------------
var PDFJS = window['pdfjs-dist/build/pdf'];
PDFJS.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.3.200/pdf.worker.js';

// Base Variables
var pdfDoc = null,
    pageNum = 1,
    pageRendering = false,
    pageNumPending = null,
    scale = 1.5,
    canvas = document.getElementById('the-canvas'),
    ctx = canvas.getContext('2d');

// Extra Variables
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


// Change Page Function
function changePage(num) {
    socket.emit('page', {id: id, number: num});
}
/**
 * Displays previous page.
 */
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
    document.getElementById('loaded').setAttribute("style", `width:${percent}-0.01%`);
    if (percent === 100) {
        document.getElementById('loaded').setAttribute('style', 'display: none');
        document.getElementById('loadingbar').setAttribute('style', 'height: 2px');
    }
}

// ------------------------------------------------------------------
// ----------------------------- SET UP -----------------------------
var loading = PDFJS.getDocument("/files/" + fileName);

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

if(accessType != "admin")
{
    document.getElementById('prev').className = "hide";
    document.getElementById('next').className = "hide";
} else {
    document.onmousemove = findScreenCoords;
    document.onmousewheel = findScreenCoords;
}

socket.emit('subscribe', {id: id, type: accessType});

socket.on('update', function(data){
    LoadPage(data);
});

// -------------------------------------------------------------------
// ----------------------------- Viewers -----------------------------
socket.on('viewer_count', function(data){
    document.getElementById('viewers').textContent = data + ' viewers';
});

// -----------------------------------------------------------------
// ----------------------------- PAGES -----------------------------
function LoadPage(page)
{
    pageNum = page;
    if (pdfDoc) {
        queueRenderPage(page);
    } else {
        console.log('Still loading pdf');
    }
    console.log("Changing page to: " + page);
}

socket.on('goto_page', function (data) {
    console.log(data);
    LoadPage(data);
});

// -----------------------------------------------------------------
// ----------------------------- CURSOR ----------------------------
// Scroll Wheel
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

// Mouse Move
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
    ypos -= document.getElementById("the-canvas").offsetTop - window.pageYOffset + 75;
    xpos -= document.getElementById("the-canvas").offsetLeft - window.pageXOffset + 15;
    ypos /= scale;
    xpos /= scale;
    socket.emit('move_cursor', { id: id, x: xpos, y: ypos });
    draw_cursor([{ id: id, x: xpos, y: ypos, colour: my_color }]);
}

// Draw
my_color = "Blue";
socket.on('streamer_color', function(color) {
    my_color = color;
})

function draw_cursor(data) {
    var ccanvas = document.getElementById("cursor");
    var ctx = ccanvas.getContext("2d");

    //ctx.fillRect(data.x, data.y, 10, 10);
    ctx.clearRect(0, 0, ccanvas.width, ccanvas.height);
    Object.keys(data).forEach(function (key){
        ctx.fillStyle = data[key].colour;
        // Rectange
        //ctx.fillRect(data[key].x * scale, data[key].y * scale, 10, 10);

        // Circle 
        /*
        size = 5;
        ctx.beginPath();
        ctx.arc(data[key].x * scale + size, data[key].y * scale + size, size, 0, 2 * Math.PI, false);
        ctx.fill();
        */
        

        // Point
        ctx.beginPath();
        ctx.moveTo(data[key].x * scale, data[key].y * scale);
        ctx.lineTo((data[key].x + 11) * scale, (data[key].y + 4) * scale);
        ctx.lineTo((data[key].x + 4) * scale, (data[key].y + 11) * scale);
        ctx.fill();
    });
}

socket.on('draw_cursor', function (data) {
    draw_cursor(data);
});
