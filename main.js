// TODO:
// * Clean up blanks.
// * (Long-term.) Highlight patterns in colors...
// * ...

// TODO: Move some of this to a separate init function.
var canvas = document.querySelector( 'canvas' ) || document.createElement( 'canvas' ),
  ctx = canvas.getContext( '2d' ),
  hiddenCanvas = document.createElement( 'canvas' ),
  hiddenCtx = hiddenCanvas.getContext( '2d' ),
  windowWidth = window.innerWidth,
  windowHeight = window.innerHeight,
  start = { size: 1 << 11, doubles: 2 };

ctx.imageSmoothingEnabled = false;

hiddenCanvas.width =  ( canvas.width =  windowWidth ) * 3;
hiddenCanvas.height = ( canvas.height = windowHeight ) * 3;

// Unused. TODO: Remove, probably.
function getCanvasImageSize( width, height ) {
  hiddenCanvas.width = width;
  hiddenCanvas.height = height;
  return hiddenCanvas.getImageData( 0, 0, width, height );
}

function setCanvasSize() {
  windowWidth = window.innerWidth;
  windowHeight = window.innerHeight;
  hiddenCanvas.width =  ( canvas.width =  windowWidth ) * 3;
  hiddenCanvas.height = ( canvas.height = windowHeight ) * 3;
}

// Maybe move canvas stuff into its own object?


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
    // Currently visible content offset. (Measured in cells??? TODO: Clarify.)
    visOffset = { x: 0, y: 0 },
    // Last requested/retrieved content offset.
    lOffset = { x: 0, y: 0 },
    // Zoom level. Larger means more zoomed out.
    // Divide by zoom to convert cells -> px, Multiply for px -> cells.
    zoom = 1,
    zoomAnimating = false,
    started = false,
    hiddenCanvases;
  
  function blankCanvas( _canvas = canvas ) {
    _canvas.width = _canvas.width;
  }
  
  hiddenCanvases = ( () => {
    // Top-left, top-right, bottom-left, bottom-right
    var canvases = Array.from( { length:  4 }, () => document.createElement( 'canvas' ) ),
      contexts = canvases.map( canvas => canvas.getContext( '2d' ) ),
      // Where are we caching stuff?
      // Offset gets changed in blocks of windowSize*2 whenever we shift tiles.
      // Offset of top-left canvas from 0,0, in cells.
      cOffset = { x: -windowWidth, y: -windowHeight },
      size = { x: 0, y: 0 },
      zoom = 1,
      
      cWidth = windowWidth * 3,
      cHeight = windowHeight * 3;
    
    canvases.forEach( canvas => {
      canvas.width = cWidth;
      canvas.height = cHeight;
    } );
    
    function shiftTiles( xAxis, directionIsForward ) {
      // directionIsForward = true means rightward/downward movement, so the top row or
      // left column is being moved to the right/bottom and cleared.
      
      // Reorder canvases.
      canvases = canvases.map( ( canvas, i, canvases ) => {
        if ( !( xAxis ? i & 1 : i & 2 ) === directionIsForward ) {
          blankCanvas( canvas );
        }
        return canvases[ xAxis ? i ^ 1 : i ^ 2 ];
      } );
      contexts = contexts.map( ( _, i, contexts ) => contexts[ xAxis ? i ^ 1 : i ^ 2 ] );
      
      cOffset[ xAxis ? 'x' : 'y' ] += ( xAxis ? cWidth : cHeight ) * zoom * ( directionIsForward || -1 );
    }
    
    var forTesting = function () {
      var testCanvas = document.body.appendChild( document.createElement( 'canvas' ) ),
        ctx = testCanvas.getContext( '2d' );
      //document.body.appendChild( canvases[ 0 ] );
      //canvases[ 0 ].style.cssText = "transform: scale(0.5); transform-origin: 0 0;";
      testCanvas.width = windowWidth / 2;
      testCanvas.height = windowHeight / 2;
      testCanvas.style.cssText = 'position: absolute; right: 0; top: 0;';
      function q() {
        blankCanvas( testCanvas );
        canvases.forEach( ( canvas, i ) => {
          ctx.drawImage( canvas, 
            ( i & 1 ) && windowWidth / 4,
            ( i & 2 ) && windowHeight / 4,
            windowWidth / 4,
            windowHeight / 4
          );
        } );
        for ( var i = 1; i < 7; i++ ) {
          // rows
          ctx.fillRect( 0, windowHeight / 12 * i, windowWidth / 2, 1 );
          // cols
          ctx.fillRect( windowWidth / 12 * i, 0, 1, windowHeight / 2 );
        }
        /*
        ctx.moveTo( 0, windowHeight / 4 );
        ctx.lineTo( windowWidth / 2, windowHeight / 4 );
        ctx.moveTo( windowWidth / 4, 0 );
        ctx.lineTo( windowWidth / 4, windowHeight / 2 );
        ctx.stroke();
        */
        // outline current view
        ctx.strokeRect(
          ( visOffset.x - cOffset.x ) / zoom / 12,
          ( visOffset.y - cOffset.y ) / zoom / 12,
          windowWidth / 12,
          windowHeight / 12
        );
      }
      addEventListener( 'mousemove', q );
    }
    forTesting();
    
    return {
      // Store data in the cached canvases.
      // All arg units are in cells, not pixels.
      storeTile( data, { x, y, width, height, zoom }, visible ) {
        console.log( 'STORETILE', x, y, cOffset.y, zoom );
        
        // Dimensions of each canvas, in cells.
        var ccWidth = cWidth * zoom,
          ccHeight = cHeight * zoom;
        
        contexts.forEach( ( ctx, i ) => {
          
          // Coordinates of the canvas, relative to absolute 0,0 of the map. In cells.
          var cX = cOffset.x + ( ( i & 1 ) && ccWidth  ),
            cY = cOffset.y + ( ( i & 2 ) && ccHeight );
          
          // Some issues with cells vs pixels, here. TODO: Fix.
          if ( x < cX + ccWidth && x + width >= cX && y < cY + cHeight && y + height >= cY ) {
            console.log( 'storing in tile ', i );
            // In range.
            ctx.putImageData(
              data,
              // Note that this starts from the edge of the data, not from the edge of the crop start.
              ( x - cX ) / zoom, ( y - cY ) / zoom
              // Four args for cropping the data, so that we don't overflow the context.
              // MDN seems to claim that overfilling doesn't actualy result in errors,
              // so this is unnecessary, though perhaps might be good for performance.
            );
          }
          
        } );
        
        if ( visible ) {
          // Shift the cache tiles when within one screen width/height of the edge.
          let xPixelsDiff = ( x - cOffset.x ) / zoom,
            yPixelsDiff = ( y - cOffset.y ) / zoom;
          if ( xPixelsDiff < windowWidth ) {
            shiftTiles( true, false );
          }
          if ( xPixelsDiff + width * zoom > cWidth * 2 - windowWidth ) {
            shiftTiles( true, true );
          }
          if ( yPixelsDiff < windowHeight ) {
            shiftTiles( false, false );
          }
          if ( yPixelsDiff + height * zoom > cHeight * 2 - windowHeight ) {
            shiftTiles( false, true );
          }
        }
      },
      isRangeInCache() {
        
      },
      getCacheBoundaries() {
        
      },
      
      printFromCache( targetContext, x, y ) {
        console.log( 'PRINT', x, y, cOffset, cWidth, zoom );
        
        // Dimensions of each canvas, in cells.
        var ccWidth = cWidth * zoom,
          ccHeight = cHeight * zoom;
        
        // TODO: Maybe don't print overflow.
        canvases.forEach( ( canvas, i ) => {
          if ( 
            ( ( i & 1 ) ?
              x + windowWidth > cOffset.x + ccWidth :
              x < cOffset.x + ccWidth )
            &&
            ( ( i & 2 ) ?
              y + windowHeight > cOffset.y + ccHeight :
              y < cOffset.y + ccHeight
              )
          ) {  
            targetContext.drawImage( canvas,
              ( cOffset.x - x ) / zoom + ( ( i & 1 ) && cWidth ), ( cOffset.y - y ) / zoom + ( ( i & 2 ) && cHeight )
            );
          }
        } );
      }
      
      // So, how does the script interact with this?
      // Need to know when to shift. Can that be determined just from the requests?
      // How about this: 
      // * Split requests for needed stuff, and requests to fill the cache for later use.
      //   When need-now request for anything within size*1 of the edge, shift.
      //   By default, start in the middle?
      // So, we need these functions:
      // * storeTile, with arg for needed-now. Stores stuff.
      // * getContent, uhh... Wait. Sometimes stuff is cached, sometimes not.
      //   Should this be calling webworker, and working as a promise? Yikes.
      //   Or maybe the blankCanvas should be really dumb, with the complex 
      //   stuff done elsewhere.
      //   Could have a function/property returning "cached boundaries", for use in view.
      
      // View does this, upon movement:
      // * Checks cached boundaries. If cached, use that. Else, get from worker, send to cache.
      // * Background: Retrieve "gaps", areas where cache can be extended easily, get that
      //   and send to cache with arg indicating not immediately needed.
    };
    
  } )();
  
  function fullUpdate() {
    lastUpdate = Date.now();
    console.log( 'fullUpdate', offset.y, visOffset.y );
    
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
  
  // Move cached image.
  function partUpdate() {
    blankCanvas();
    // TODO: Deprecate cData, use drawImage from hiddenCanvas.
    //ctx.putImageData( cData, ( offset.x - visOffset.x ) / zoom, ( offset.y - visOffset.y ) / zoom );
    // ctx.drawImage( hiddenCanvas, ( offset.x - visOffset.x ) / zoom, ( offset.y - visOffset.y ) / zoom );
    
    hiddenCanvases.printFromCache( ctx, visOffset.x, visOffset.y );
    return;
    ctx.drawImage( hiddenCanvas,
      windowWidth, windowHeight, windowWidth, windowHeight,
      ( ( offset.x - visOffset.x ) / zoom ), ( ( offset.y - visOffset.y ) / zoom ),
      windowWidth, windowHeight
    );
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
      // Unused.
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
            blankCanvas();
            
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
    
    if ( code in moves ) {
      if ( !keysdown[ code ] || !keysdown[ code ].isPressed ) {
        keysdown[ code ] = { isPressed: true };
        ( function tick() {
          visOffset.y += ( moves[ code ].y * zoom || 0 );
          visOffset.x += ( moves[ code ].x * zoom || 0 );
          partUpdate();
          maybeUpdate();
          // This timer will be cancelled by clearTimeout in onkeyup.
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
  
  // Init
  setCanvasSize();
  
  return {
    /**
     * @param {Object} offset ???
     * @param {Number} width, height Size of retrieved box in pixels.
     */
    paint( { dataBlock, offset: _offset, width, height } ) {
      console.log( 'paint', width, height, _offset, zoom, visOffset, lOffset );
      var d = ctx.createImageData( width, height );
      d.data.set( dataBlock );
      
      var canvasCoords = { x: ( _offset.x - visOffset.x ) / zoom, y: ( _offset.y - visOffset.y ) / zoom };
      
      //ctx.putImageData( d, canvasCoords.x, canvasCoords.y );
      
      // Outline, for testing.
      ctx.strokeStyle = 'blue';
      ctx.rect( canvasCoords.x, canvasCoords.y, width, height );
      ctx.stroke();
      
      // TODO: Replace this with copying to hiddenCtx and using .draw, which has
      // better performance (I think).
      //hiddenCtx.putImageData( d, ( _offset.x - visOffset.x ) / zoom, ( _offset.y - visOffset.y ) / zoom );
      //hiddenCtx.putImageData( d, canvasCoords.x + windowWidth, canvasCoords.y + windowHeight );
      
      hiddenCanvases.storeTile( d, { x: _offset.x, y: _offset.y, width: width * zoom, height: height * zoom, zoom }, true );
      //hiddenCanvases.printFromCache( ctx, _offset.x, _offset.y );
      
      //cData = ctx.getImageData( 0, 0, windowWidth, windowHeight );
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

// Should this be reworked to use promises instead of callbacks?

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
    pending.push( { callback } ); // Can change this to use a promise instead.
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
    maintainDisplay: ( () => {
      // Okay, how does this work.
      // Need to display, then check if idle and wait if necessary, and repeat?
      // If, after noLongerIdle, update isn't necessary, don't pass anything to worker.
      // If we have a maintain cycle running (either waiting for response or for idle or whatever),
      // don't add a duplicate cycle.
      // So... what are the basic things here?
      // Should displayChunk be maintained as a separate thing? Use callbacks?
      // If so, I really need to replace things with promises, so that I can attach
      // callbacks from multiple places.
      // Maybe use async functions? Default returns promises. Could make things simpler.
      
      // Need to maintain separation of concerns between worker and view. Worker 
      // shouldn't call view, view should pass its own callback.n
      
      // ...How does the current system work?
      var inprogress = false;
      
      // View has current loc.
      
      return function maintainDisplay( data, callback ) {
        var promise = new Promise( ( complete, err ) => {
          cmd( 'display', { offset, zoom, width: size.x, height: size.y }, complete );
        } );
        
        promise.then( () => {
          
        } );
        
        
      }
    } )(),
    cmd,
    isIdle() {
      return pendingCount === 0;
    },
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
