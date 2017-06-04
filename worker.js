function calcContent() {
  
}


function process( { dataBlock, offset, zoom, windowWidth, windowHeight } ) {
  var m = map,
    xOffset = offset.x || 0, yOffset = offset.y || 0;
  
  // Are offsets actual cell offsets, or visible pixel offsets?
  
  function addToCanvas( block, xOffset, yOffset ) {
    // TODO: Fix so that things partly offscreen to the left or top are still displayed.
    if ( ( xOffset < windowWidth * zoom && xOffset + block.size > 0 ) && ( yOffset < windowHeight * zoom && yOffset + block.size > 0 ) ) {
      if ( block.size > zoom ) {
        block.contents.forEach( ( ( subblock, i ) => {
          addToCanvas( subblock, xOffset + ( ( i & 1 ) && ( subblock.size ) ), yOffset + ( ( i & 2 ) && ( subblock.size ) ) );
        } ) );
      } else {
        dataBlock.set( cellFilled( block ), ( ( ( xOffset / zoom ) | 0 ) + ( ( yOffset / zoom ) | 0 ) * windowWidth ) * 4 );
        //dataBlock.set( cellFilled( block ), ( ( ( xOffset ) | 0 ) + ( ( yOffset ) | 0 ) * windowWidth ) * 4 );
      }
    }
  }
  
  addToCanvas( m, xOffset || 0, yOffset || 0 );
  //blankCanvas.data.set( blackCell, 100 * 4 + 100 * windowWidth * 4 );
  postMessage( [ 'paint', { dataBlock, offset } ] );
}

onmessage = function ( e ) {
  var [ type, data ] = e.data;
  console.log( 'data', type, data );
  process( data );
};

var cellFills = { 1: [ 255, 255, 255, 255 ], 0: [ 0, 0, 0, 255 ] };

function cellFilled( block ) {
  var c = block.c,
    f = cellFills[ c ];
  if ( f ) {
    return f;
  } else {
    return cellFills[ c ] = [ 0, 0, 0, 255 ].fill( 255 * c, 0, 3 );
  }
}

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

function initMap() {
  // TODO: Systems for randoms, set patterns, single dot, etc.
  // Maybe move doubleMap in here? Still might need to be called if expand on-demand
  // is added.
  function randomMap( size ) {
    var x = Array.from( { length: size }, () => Math.round( Math.random() ) ),
      c = x.reduce( ( x, y ) => x + y ) / size;
    // Create blocks with lots of newBlanks.
    // TODO.
    return {
      size, n: ++maxKey, c
    };
  }
}

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
      size, c: 1, 
      // Shouldn't this have adifferent key, not duplicate baseEmpty?
      n: 0, 
      contents: Array( 4 ).fill( newBlank( size >> 1 ) ),
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
    // We cache all parent blocks each type of block has ever had, using each
    // block's unique ids for mapping.
    pKey = tr.n + '_' + bl.n + '_' + br.n;
  
  // If we've ever had this block before, use the same one.
  if ( tl[ 'P' + pKey ] ) {
    return tl[ 'P' + pKey ];
  }
  
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

// Getting "max call stack exceeded" errors.
// TODO: Rework to avoid that. Probably use array of things to do, when reaching stack max.
for ( var i = 0; i < 31; i++ ) {
  doubleMap();
}
