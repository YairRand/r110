// TODO:
// * Clean up blanks.
// * (Long-term.) Highlight patterns in colors...
// * ...

var canvas = document.querySelector( 'canvas' ),
  ctx = canvas.getContext( '2d' ),
  hiddenCanvas = document.createElement( 'canvas' ),
  hiddenCtx = hiddenCanvas.getContext( '2d' ),
  windowWidth = window.innerWidth,
  windowHeight = window.innerHeight,
  start = { size: 1 << 11, doubles: 2 };

ctx.imageSmoothingEnabled = false;

canvas.width =  hiddenCanvas.width =  windowWidth;
canvas.height = hiddenCanvas.height = windowHeight;

// Unused. TODO: Remove, probably.
function getCanvasImageSize( width, height ) {
  hiddenCanvas.width = width;
  hiddenCanvas.height = height;
  return hiddenCanvas.getImageData( 0, 0, width, height );
}

// TODO.
// View
var view = ( () => {
  var mouseIsDown = false,
    keysdown = {},
    cData,
    delay = 400,
    // Need to separate, currently viewed offset / last full-calculated screen's offset.
    // TODO: Merge offset and lastUpdate/visOffset.
    // Need to keep track of update times so that we don't lag too far behind.
    lastUpdate = 0,
    // Last "stapled" content offset. (Captured canvas data.)
    offset = { x: 0, y: 0 },
    // Currently visible content offset
    visOffset = { x: 0, y: 0 },
    // Last requested/retrieved content offset.
    lOffset = { x: 0, y: 0 },
    // Zoom level. Larger means more zoomed out.
    zoom = 1,
    zoomAnimating = false,
    // Unused.
    canvases = [],
    started = false;
  
  function fullUpdate() {
    lastUpdate = Date.now();
    console.log( 'fullUpdate', offset.y, visOffset.y );
    //return;
    
    var rWidth = windowWidth * zoom,
      rHeight = windowHeight * zoom,
      //xDelta = visOffset.x - lOffset.x,
      xDelta = lOffset.x - visOffset.x,
      //yDelta = visOffset.y - lOffset.y,
      yDelta = lOffset.y - visOffset.y,
      movedLeft = lOffset.x > visOffset.x,
      movedUp = lOffset.y > visOffset.y;
    
    if ( started || Math.abs( xDelta ) > rWidth || Math.abs( yDelta ) > rHeight ) {
      // Doesn't work when zoomed. TODO: Fix.
      // Problem is, last update is attached to the top-left of where the screen
      // was before the zoom, I think.
      
      // New areas to the side.
      
      // Problem: Sometimes we have this situation:
      // * Move down by 1 > Request, set lOffset > Move up 2 > 
      //   recieve data, set offset, set cData which doesn't include the new 
      //   content > move down 3 > send and recieve new content, based on 
      //   lOffset, thus missing a segment.
      // Solutions:
      // * Use min() here between offset and lOffset, to avoid clipped parts.
      // * Change paint() to only set offset (or reset lOffset) when recieved
      //   data isn't actually going onto cData (or only part of it is being
      //   placed there.)
      
      dWorker.displayChunk( 
        { x: movedLeft ? visOffset.x : lOffset.x + rWidth, y: visOffset.y },
        { x: Math.abs( xDelta ) / zoom, y: yDelta / zoom + windowHeight },
        zoom
      );
      // New areas above and below.
      dWorker.displayChunk( 
        { x: visOffset.x, y: movedUp ? 
          visOffset.y : // Current top of screen
          lOffset.y + rHeight // Previous bottom of screen.
          //Math.min( lOffset.y, offset.y ) + rHeight // Previous bottom of screen.
        },
        { x: windowWidth, y: Math.abs( yDelta ) / zoom },
        zoom
      );
    } else {
      dWorker.displayChunk( 
        { x: visOffset.x, y: visOffset.y },
        { x: windowWidth, y: windowHeight },
        zoom
      );
    }
    Object.assign( lOffset, visOffset );
    started = true;
  }
  
  function fullScreenUpdate() {
    dWorker.display( visOffset, zoom );
    /*dWorker.displayChunk( 
      { x: visOffset.x, y: visOffset.y },
      { x: windowWidth, y: windowHeight },
      zoom
    );*/
  }
  
  
  function partUpdate() {
    canvas.width = canvas.width;
    ctx.putImageData( cData, ( offset.x - visOffset.x ) / zoom, ( offset.y - visOffset.y ) / zoom );
    //ctx.drawImage( hiddenCanvas, ( offset.x - visOffset.x ) / zoom, ( offset.y - visOffset.y ) / zoom );
  }
  
  function maybeUpdate() {
    if ( lastUpdate + delay < Date.now() ) {
      console.log( 'maybeUpdate calling fullUpdate', offset.y, visOffset.y)
      fullUpdate();
    }
  }
  
  function changeZoom( dir, x, y ) {
    var change = ( 2 ** dir ),
      toZoom = zoom * change,
      _cData = cData;
    
    
    if ( !zoomAnimating ) {
      zoomAnimating = true;
      
      Promise.all( [
        new Promise( resolve => {
          dWorker.cmd( 'display', { offset: {
            x: visOffset.x - x * ( toZoom - zoom ),
            y: visOffset.y - y * ( toZoom - zoom )
          }, zoom: toZoom, width: windowWidth, height: windowHeight }, resolve );
        } ),
        new Promise( resolve => {
          ( function zoomAnim( step ) {
            canvas.width = canvas.width;
            
            var scale = ( change ** ( 0.1 * step ) );
            
            // PROBLEM: Dragging then zooming has things mess up during animation.
            // Fixes after resolution...?
            
            ctx.drawImage( hiddenCanvas,
              // Center the zoom animation around the movement from the cursor.
              //( offset.x - ( visOffset.x - x * ( zoom * scale - zoom ) ) ) / zoom / scale,
              //( offset.y - ( visOffset.y - y * ( zoom * scale - zoom ) ) ) / zoom / scale,
              
              ( offset.x - ( visOffset.x - x * ( zoom * scale - zoom ) ) ) / zoom / scale,
              ( offset.y - ( visOffset.y - y * ( zoom * scale - zoom ) ) ) / zoom / scale,
              
              windowWidth / scale, windowHeight / scale
            );
            
            if ( step < 10 ) {
              setTimeout( () => zoomAnim( step + 1 ), 16 );
            } else {
              // This should probably be at the top...
              resolve();
            }
          } )( 0 )
        } )
      ] ).then( ( [ data ] ) => {
        // Keep the cell under mouse remaining in stable position on screen.
        visOffset.x -= x * ( toZoom - zoom );
        visOffset.y -= y * ( toZoom - zoom );
        
        zoom = toZoom;
        
        view.paint( data );
        
        zoomAnimating = false;
        return;
        
        if ( dir === -1 ) {
          // Zooming in. 
          fullScreenUpdate();
        } else {
          // Zooming out. Ideally, this should only request the added areas
          // around the edges, saving 25%. TODO, eventually. (Remember to 
          // update when doing so.)
          fullScreenUpdate();
        }
      } );
    }
  }

  canvas.onmousedown = function ( e ) {
    if ( mouseIsDown === false ) {
      mouseIsDown = true;
      lastUpdate = Date.now();
      //setTimeout( maybeUpdate, delay );
    }
  };

  canvas.onmouseup = function ( e ) {
    if ( mouseIsDown ) {
      mouseIsDown = false;
      fullUpdate();
    }
  };

  canvas.onmousemove = function ( e ) {
    // Scroll as necessary.
    if ( mouseIsDown ) {
      visOffset.x -= e.movementX * zoom;
      visOffset.y -= e.movementY * zoom;
      partUpdate();
      maybeUpdate();
    }
  };

  window.onkeydown = function ( e ) {
    var code = e.keyCode,
      moves = {
        37: { x: -10 },
        38: { y: -10 },
        39: { x:  10 },
        40: { y:  10 }
      };
    
    keydown = code;
    
    if ( code in moves ) {
      if ( !keysdown[ code ] || !keysdown[ code ].isPressed ) {
        keysdown[ code ] = { isPressed: true };
        ( function tick() {
          visOffset.y += ( moves[ code ].y * zoom || 0 );
          visOffset.x += ( moves[ code ].x * zoom || 0 );
          partUpdate();
          maybeUpdate();
          keysdown[ code ].timer = setTimeout( tick, 16 );
        } )();
      }
      
      // v For testing.
    } else if ( code === 81 ) {
      console.log( 'q' );
    } else if ( code === 65 ) {
      // a
      dWorker.cmd( 
        'display', 
        { offset: { x: 20, y: 20 }, zoom: 1, width: 40, height: 40 }, 
        ( { dataBlock, width, height } ) => {
          console.log( 'cccc', width );
          
          var d = ctx.createImageData( width, height );
          d.data.set( dataBlock );
          ctx.putImageData( d, 20, 20 );
        }
      );
    } else if ( code === 79 ) {
      // o
      /*
      dWorker.cmd( 
        'display', 
        { offset: {x:0,y:0}, zoom, width: windowWidth, height: windowHeight },
        ( { dataBlock, width, height } ) => {
          //view.paint( data );
          var d = ctx.createImageData( width, height );
          d.data.set( dataBlock, 0 );
          ctx.putImageData( d, 20, 20 );
        }
      );
      */
      dWorker.cmd( 'display',
        { offset: { x:1.5, y:1.5}, zoom:1, width: 4, height: 4 },
        ( { dataBlock } ) => {
          // Should equal [ ...0x3, ...255*5, ...0x8 ]
          console.log('dcheck', dataBlock );
        }
      );
    }
  };
  
  window.onkeyup = function ( e ) {
    // End movement. 
    var code = e.keyCode,
      keydown = keysdown[ code ];
    
    if ( keydown && keydown.isPressed ) {
      clearTimeout( keydown.timer );
      keydown.isPressed = false;
      fullUpdate();
    }
    
    maybeUpdate();
  };

  window.onmousewheel = function ( e ) {
    // Zoom.
    changeZoom( -Math.sign( e.wheelDelta ), e.clientX, e.clientY );
  };
  
  onresize = function () {
    // Reset windowWidth / windowHeight
    // TODO
    
    var newWidth = window.innerWidth,
      newHeight = window.innerHeight,
      xChange = windowWidth - newWidth,
      yChange = windowHeight - newHeight;
    
    // TODO: Make this work.
    if ( xChange > 0 ) {
      dWorker.cmd( 
        'display', 
        { offset: { x: visOffset.x + windowWidth, y: visOffset.y }, zoom, width: xChange, height: windowHeight }, 
        data => view.paint( data )
      );
    }
  
    if ( yChange > 0 ) {
      dWorker.cmd( 
        'display', 
        { offset: { x: visOffset.x, y: visOffset.y + windowHeight }, zoom, width: newWidth, height: yChange }, 
        data => view.paint( data )
      );
    }
    
    windowWidth = newWidth;
    windowHeight = newHeight;
    canvas.width =  windowWidth;
    canvas.height = windowHeight;
    //partUpdate();
    //fullUpdate();
  };
  
  return {
    paint( { dataBlock, offset: _offset, width, height } ) {
      console.log( 'paint', width, height, _offset, zoom, visOffset, lOffset );
      var d = ctx.createImageData( width, height );
      d.data.set( dataBlock );
      ctx.putImageData( d, ( _offset.x - visOffset.x ) / zoom, ( _offset.y - visOffset.y ) / zoom );
      
      // Outline, for testing.
      ctx.strokeStyle = 'blue';
      ctx.rect( ( _offset.x - visOffset.x ) / zoom, ( _offset.y - visOffset.y ) / zoom, width, height );
      ctx.stroke();
      
      // TODO: Replace this with copying to hiddenCtx and using .draw, which has
      // better performance (I think).
      hiddenCtx.putImageData( d, ( _offset.x - visOffset.x ) / zoom, ( _offset.y - visOffset.y ) / zoom );
      cData = ctx.getImageData( 0, 0, windowWidth, windowHeight );
      //offset = _offset;
      // PROBLEM: This causes a mismatch.
      
      // TODO: Fix.
      Object.assign( offset, visOffset );
      partUpdate();
    },
    fullUpdate,
    position( { x, y } ) {
      offset.x = visOffset.x = x;
      offset.y = visOffset.y = y;  
    }
  }
  
} )();


// Nested boxes. 8x8, 4x4, 2x2, 1x1, each box holding:
// * Links to its 4 subboxes.
// * Percent of boxes which are black.
// * Size
// * Links to recorded later-boxes.

var dWorker = ( () => {
  
  var worker = new Worker( './worker.js' ),
    pending = [],
    pendingCount = 0;
  
  // When multiple requests pending, sometimes we need to merge them somehow.
  
  worker.onmessage = function ( e ) {
    // Recieved data.
    var [ type, data ] = e.data,
      c = pending.shift();
    
    console.log( 'message', type, data );
    
    pendingCount--;
    
    switch ( type ) {
      case 'complete':
        if ( c.callback ) {
          c.callback( data );
        }
        //view.paint( data );
        break;
      case 'error':
        console.error( 'from worker (2)', data );
        c.onerror && c.onerror();
        break;
    }
  };
  
  function cmd( type, data, callback ) {
    pendingCount++;
    pending.push( { callback } );
    worker.postMessage( [ type, data ] );
  }
  
  return {
    display( offset, zoom = 1 ) {
      console.log( '.display' );
      cmd( 'display', { offset, zoom, width: windowWidth, height: windowHeight }, data => view.paint( data ) );
    },
    // offset measured in cells, size in pixels.
    displayChunk( offset, size, zoom = 1 ) {
      console.log( '.displayChunk', arguments );
      if ( size.x !== 0 && size.y !== 0 ) {
        cmd( 'display', { offset, zoom, width: size.x, height: size.y }, data => view.paint( data ) );
      }
    },
    cmd,
    onready( tag, callback ) {
      // Override any previous listener with same tag, if !!tag.
    }
  };
} )();

//dWorker.cmd( 'init', { type: 'random', size: start.size } );
dWorker.cmd( 'init', { type: 'dot' } );

//view.position( { x: 0, y: -start.size })

for ( var i = 0; i < start.doubles; i++ ) {
  dWorker.cmd( 'double', {} );
}

dWorker.cmd( 'checkd16', {} );

view.fullUpdate();
