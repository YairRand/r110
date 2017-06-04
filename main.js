// TODO:
// * Drag to scroll.
// * Zoom.
// * Clean up blanks.
// * ...

var canvas = document.querySelector( 'canvas' ),
  ctx = canvas.getContext( '2d' ),
  windowWidth = window.innerWidth,
  windowHeight = window.innerHeight,
  blankCanvas;

ctx.imageSmoothingEnabled = false;

canvas.width =  windowWidth;
canvas.height = windowHeight;

//blankCanvas = ctx.createImageData( windowWidth, windowHeight );
blankCanvas = ctx.getImageData( 0, 0, windowWidth, windowHeight );

// TODO.
// View
var view = ( () => {
  var down = false,
    xStart,
    yStart,
    cData,
    delay = 400,
    offset = { x: 0, y: 0 },
    // Need to separate, currently viewed offset / last full-calculated screen's offset.
    // TODO: Merge offset and lastUpdate/visOffset.
    // Need to keep track of update times so that we don't lag too far behind.
    lastUpdate = 0,
    visOffset = { x: 0, y: 0 },
    // Larger means more zoomed out.
    zoom = 1;
  
  function fullUpdate() {
    lastUpdate = Date.now();
    displayContent( visOffset, zoom );
  }
  
  function partUpdate() {
    canvas.width = canvas.width;
    ctx.putImageData( cData, ( visOffset.x - offset.x ) / zoom, ( visOffset.y - offset.y ) / zoom );
  }
  
  function maybeUpdate() {
    if ( lastUpdate + delay < Date.now() ) {
      console.log( 'fullUpdate')
      fullUpdate();
    }
  }

  canvas.onmousedown = function ( e ) {
    if ( down === false ) {
      down = true;
      cData = ctx.getImageData( 0, 0, windowWidth, windowHeight );
      xStart = e.clientX;
      yStart = e.clientY;
      lastUpdate = Date.now();
      //setTimeout( maybeUpdate, delay );
    }
  };

  canvas.onmouseup = function ( e ) {
    if ( down ) {
      down = false;
      fullUpdate();
    }
  };

  canvas.onmousemove = function ( e ) {
    // Scroll as necessary.
    if ( down ) {
      //canvas.width = canvas.width;
      //ctx.putImageData( cData, e.clientX - xStart, e.clientY - yStart );
      visOffset.x += e.movementX * zoom;
      visOffset.y += e.movementY * zoom;
      partUpdate();
      maybeUpdate();
    }
  };

  onkeydown = function ( e ) {
    // Use arrow keys to scroll quickly. TODO.
    if ( e.keyCode === 40 ) {
      
    }
  };
  
  onkeyup = function ( e ) {
    
  };

  onmousewheel = function ( e ) {
    // Zoom.
    var dir = -Math.sign( e.wheelDelta ),
      change = ( 2 ** dir ),
      toZoom = zoom * change,
      x = e.clientX,
      y = e.clientY;
    if ( zoom > 1 || dir !== -1 ) {
      // TODO: Zoom towards/away from x/y mouse coords.
      
      // Idea is that cell under mouse remains in stable position.
      // If zooming in, offset += ( mouse - offset ) / 2?
      // Note that visOffset is number of cells, so zoom matters here.
      
      visOffset.x += x * ( toZoom - zoom );
      visOffset.y += y * ( toZoom - zoom );
      
      
      
      zoom = toZoom;
      fullUpdate();
    }
  };
  
  onresize = function () {
    // Reset windowWidth / windowHeight
    // TODO.
  };
  
  return {
    paint( { dataBlock, offset: _offset } ) {
      canvas.width = canvas.width;
      blankCanvas.data.set( dataBlock );
      ctx.putImageData( blankCanvas, 0, 0 );
      cData = ctx.getImageData( 0, 0, windowWidth, windowHeight );
      offset = _offset;
      partUpdate();
    }
  }
  
} )();


// Nested boxes. 8x8, 4x4, 2x2, 1x1, each box holding:
// * Links to its 4 subboxes.
// * Percent of boxes which are black.
// * Size
// * Links to recorded later-boxes.

function displayContent( offset = { x: 0, y: 0 }, zoom = 1 ) {
  
  // Blank the canvas.
  blankCanvas.data.fill( 0 );
  
  canvasWorker.process( blankCanvas.data, offset, zoom );
}

var canvasWorker = ( () => {
  
  var worker = new Worker( './worker.js' ),
    pending = { paint: [] };
  
  worker.onmessage = function ( e ) {
    // Recieved data.
    var [ type, data ] = e.data;
    
    if ( type === 'paint' ) {
      view.paint( data );
    }
  };
  
  function cmd( type, data ) {
    worker.postMessage( [ type, data ] );
  }
  
  return {
    process( dataBlock, offset, zoom = 1 ) {
      worker.postMessage( [ 'display', { dataBlock, offset, zoom, windowWidth, windowHeight } ] );
    }
  };
} )();

displayContent();
