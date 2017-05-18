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

// Unused.
var m = [ 0, 1, 1, 1, 0, 1, 1, 0 ];

var start = [ 0, 1, 0 ];

var rows = [ start ];

var whiteCell = [ 255, 255, 255, 255 ],
  blackCell = [ 0, 0, 0, 255 ];

function paint( img ) {
  //blankCanvas.data.set( [255,0,0,255], 0);
  console.log( blankCanvas );
  ctx.putImageData( img, 0, 0 );
}

// TODO.
canvas.onmousemove = function ( e ) {
  // Scroll as necessary.
  // Use timers, I think.
  if ( e.clientX > windowWidth - 15 ) {
    // Scroll right
  }
  // TODO: Etc.
  // Run iter when scrolling down if lower rows not yet calculated.
  
  // Actually, maybe use drag-to-scroll, like gmaps.
}


// Nested boxes. 8x8, 4x4, 2x2, 1x1, each box holding:
// * Links to its 4 subboxes.
// * Percent of boxes which are black.
// * Size
// * Links to recorded later-boxes.

var baseFilled = {
    size: 1,
    c: 0, // Color
    n: 1, // Key/value
    contents: null
  },
  baseEmpty = {
    size: 1,
    c: 1,
    n: 0,
    contents: null
  },
  // TODO: Remove, after replacing the blanks stuff.
  index = { 1: { 0: baseEmpty, 1: baseFilled } },
  maxKey = 1;

// Set base rules.
Object.assign( baseFilled, { "0_0": baseFilled, "0_1": baseFilled, "1_0": baseFilled, "1_1": baseEmpty  } );
Object.assign( baseEmpty,  { "0_0": baseEmpty,  "0_1": baseEmpty,  "1_0": baseFilled, "1_1": baseFilled } );

// Map holds outermost level. If outermost is a single 64x64 block, hold the one item.
// Start with a single dot.
var map = baseFilled;

function doubleMap() {
  var oldMap = map,
    size = oldMap.size;
  
    // Bottom left, directly below the old block.
  var belowBlock = newBlock( oldMap ),
    // Top-right blank corner.
    blank = newBlank( size ),
    // Bottom-right.
    newCorner = newBlock( blank, oldMap );
  
  return map = groupBlocks( oldMap, blank, belowBlock, newCorner );
}

function newBlank( size ) {
  // TODO: Redo, replace indexing.
  return ( index[ size ] || ( index[ size ] = {} ) )[ 0 ] || 
    ( index[ size ][ 0 ] = { 
      size, c: 1, n: 0, contents: Array( 4 ).fill( newBlank( size >> 1 ) ),
      isBlank: true // temporary, for testing.
    } );
}

function newBlock( block, leftNeighbor = newBlank( block.size ), rightNeighbor = newBlank( block.size ) ) {
  var key = leftNeighbor.n + '_' + rightNeighbor.n,
    simple = block[ key ];
  if ( simple /*&& block.size === 1*/ ) {
    return simple;
  }
  var size = block.size,
    bC = block.contents,
    lC = leftNeighbor.contents,
    rC = rightNeighbor.contents,
    tl = newBlock( bC[ 2 ], lC[ 3 ], bC[ 3 ] ),
    tr = newBlock( bC[ 3 ], bC[ 2 ], rC[ 2 ] ),
    bl = newBlock( tl, 
      newBlock( lC[ 3 ], lC[ 2 ], bC[ 2 ] ), 
      tr
    ),
    br = newBlock( tr,
      tl,
      newBlock( rC[ 2 ], bC[ 3 ], rC[ 3 ] )
    );
  
  return block[ key ] = groupBlocks( tl, tr, bl, br );
}

function groupBlocks( tl, tr, bl, br ) {
  var size = tl.size,
    //shift = Math.log2( size ),
    outerSize = size * 2,
    pKey = tr.n + '_' + bl.n + '_' + br.n,
    key = 
      // How about this? Each block gets a unique id. Each block is linked to all
      // those which have it as a direct tl-child. Block 1: {"P2-3-4": {block 5}}
      'P' + tl.n + '_' + tr.n + '_' + bl.n + '_' + br.n;
  
  /*
  if ( key < 0 ) {
    throw [ "?", tl, tr, bl, br, outerSize, key, shift ];
  }
  */
  
  // If we've ever had this block before, use the same one.
  if ( tl[ 'P' + pKey ] ) {
    return tl[ 'P' + pKey ];
  }
  // For testing.
  //( index[ outerSize ] || ( index[ outerSize ] = {} ) )[ 'qq' ] = index[ outerSize ][ 'qq' ] || 0;
  //index[ outerSize ][ 'qq' ]++;
  
  return tl[ 'P' + pKey ] =
    ( {
      // Length of each side.
      size: outerSize,
      // Percent of blocks which are white.
      c: ( tl.c + tr.c + bl.c + br.c ) / 4,
      // Unique ID for each unique block.
      n: ++maxKey,
      // Child blocks: top-left, top-right, bottom-left, bottom-right.
      contents: [ tl, tr, bl, br ]
    } );
}

function displayContent( xOffset, yOffset, size ) {
  
  var m = map;
  
  addToCanvas( m, 0, 0 );
  blankCanvas.data.set( blackCell, 100 * 4 + 100 * windowWidth * 4 );
  paint( blankCanvas );
}

function addToCanvas( block, xOffset, yOffset ) {
  // TODO: Fix so that things partly offscreen to the left or top are still displayed.
  if ( ( xOffset < windowWidth ) && yOffset < windowHeight ) {
    if ( block.size > 1 ) {
      block.contents.forEach( ( ( subblock, i ) => {
        addToCanvas( subblock, xOffset + ( ( i & 1 ) && subblock.size ), yOffset + ( ( i & 2 ) && subblock.size ) );
      } ) );
    } else {
      blankCanvas.data.set( block === baseFilled ? blackCell : whiteCell, ( xOffset + yOffset * windowWidth ) * 4 )
    }
  }
}

// Getting "max call stack exceeded" errors.
// TODO: Rework to avoid that.
for ( var i = 0; i < 31; i++ ) {
  doubleMap();
}

displayContent();
