// TODO: Consider WebAssembly for this.
// TODO: Consider more direct searching for patterns, recognizing ether to dump 
// more ether everywhere without having to manually place it places. Maybe map
// basic patterns, angles, how they interact, and just remember offsets of each
// distinct common pattern.
// Ether is a clean 4x4, BUT it's not a straight tesselation. And the blocks overlap.
// (Bottom-left blacks are also top-rights.)

// Maybe make every very large block (say, 64x64) have an analysis, and 
// successors don't need full processing? Can be fully processed/parsed when
// zoomed in on or when interacting with other complex.

// The system itself should figure out the patterns, though. Prefer not to 
// manually write in even ether.
// Blocks can calculate contents from patterns on-demand when visible for
// necessary zoom level.

// TODO: WebWorkers detect idle system, only ancestors of visible need calculating, pattern recognizing.

// Soo... technically, the *start* of a block shouldn't matter towards what its
// successors are, only the *ends* (single last line). Any way to make use of that, maybe?
// Maybe parallel cache horizontal-parent? Dot parent > { two dots, p: { four dots } }?
// Could include successor full blocks, even.
// Regular blocks could link to rows to parents... Or alternatively, burden could
//  be put at setting, and set parents directly to all blocks with the ending.
//  Or could use block = Object.create( row ), use .constructor for link.
// TODO: Do a statistical analysis to see if this would be at all useful. Track
// number of dup ends, percentage.

// Idea: For rows, a "shift-left/right" prop for linking to rows with offset in
// a direction, specifying for whether the gap is filled by white or black.
// Also maybe "first"/"last" single-dot props.

/*

block = {
  etherOffset: 0,
  patterns: [
    {
      type: { ... },
      offset: 0,
      step: 0
    }
  ],
  size: 1024
}

pattern = {
  angleData...,
  steps: ...,
  
}

Need to avoid duplicating patterns and blocks.
Need a system for figuring out whether blocks are "complicated" enough to use 
  a pattern system instead of manual calculating. Maybe something like if all 
  subblocks are new, and size > x?
Need to be able to match patterns in the first place.
  Maybe something like patternIndex = { 0: { 1: { 1: ... } } }?

*/

'use strict';

// Trackers.
var cc = { nB: 0, nBC:0, gB: 0 };

/**
 * Get a visible representation of an area, to place on a canvas.
 *
 * @param {object} offset Offset (in cells) of the content to be displayed (from
   the corner) of the content, not the screen.
 * @param {number} zoom Number of cells per pixel. (Note that higher is more 
   zoomed-out.)
 * @param {number} width In pixels.
 * @param {number} height ^
 */
function showArea( { offset, zoom, width, height } ) {
  var xOffset = offset.x || 0, yOffset = offset.y || 0,
    // Real width/height, measured in cells not pixels.
    rWidth = width * zoom,
    rHeight = height * zoom,
    m,
    dataBlock;
  
  try {
    dataBlock = new Uint8ClampedArray( width * height * 4 );
  } catch ( e ) {
    //console.error( e, width, height );
    throw new Error( e, width, height );
  }
  
  console.log( 'c', xOffset, yOffset, yOffset + rHeight, 'size: '+width+'x'+height, map.size )
  for ( ; xOffset + rWidth > map.size || yOffset + rHeight > map.size; ) {
    doubleMap();
  }
  
  m = map;
  
  if ( width === 0 ) {
    console.error( 'showArea, width = 0' );
    return;
  }
  
  function _addToCanvas( block, _x, _y, size ) {
    
    if ( _x - xOffset === 25 && _y - yOffset === 25 ) {
      //console.log( 'ccc', _x, xOffset, _y, yOffset );
    }
    if ( yOffset === 1 && xOffset === 1 ) {
      console.log('aaa', _x, _y );
    }
    
    if ( _x + size > xOffset && _x < xOffset + rWidth && _y + size > yOffset && _y < yOffset + rHeight ) {
      if ( size > zoom ) {
        var sSize = size / 2;
        if ( size > 1 ) {
          return block.contents.forEach( ( ( subblock, i ) => {
            _addToCanvas( subblock, _x + ( ( i & 1 ) && sSize ), _y + ( ( i & 2 ) && sSize ), sSize );
          } ) );
        } else {
          for ( var i = 0; i < 4; i++ ) {
            // TODO: Merge this and the earlier line somehow.
            _addToCanvas( block, _x + ( ( i & 1 ) && sSize ), _y + ( ( i & 2 ) && sSize ), sSize );
          }
        }
      } else {
        try {
          //
          dataBlock.set( cellFilled( block ), ( ( ( ( _x - xOffset ) / zoom ) | 0 ) + ( ( ( _y - yOffset ) / zoom ) | 0 ) * width ) * 4 );
        } catch ( e ) {
          
          console.error( e, xOffset, yOffset, zoom, width, cellFilled( block ), 
            ( ( ( xOffset / zoom ) | 0 ) + ( ( yOffset / zoom ) | 0 ) * width ) * 4
          );
          
        }
      }
    }
  }
  
  /**
   * @param {object} block Collection of cells to display.
   * @param {number} xOffset Offset from edge of cell group to edge of all content. In cells, not pixels.
   */
  function addToCanvas( block, xOffset, yOffset, size ) {
    // Only add to canvas if at least partly visible.
    
    //if ( ( xOffset < rWidth && xOffset + size > 0 ) && ( yOffset < rHeight && yOffset + size > 0 ) ) {
    if ( (
      xOffset < rWidth && // Too far to the right?
      xOffset + size >= 0 // Too far to the left?
    ) && (
      yOffset < rHeight && 
      yOffset + size > 0
    ) ) {
      if ( size > zoom ) {
        if ( size > 1 ) {
          return block.contents.forEach( ( ( subblock, i ) => {
            addToCanvas( subblock, xOffset + ( ( i & 1 ) && ( size / 2 ) ), yOffset + ( ( i & 2 ) && ( size / 2 ) ), size / 2 );
          } ) );
        } else {
          for ( var i = 0; i < 4; i++ ) {
            addToCanvas( block, xOffset + ( ( i & 1 ) && size / 2 ), yOffset + ( ( i & 2 ) && size / 2 ), size / 2 );
          }
        }
        /*
        var contents = block.contents, size = contents[ 0 ].size;
        addToCanvas( contents[ 0 ], xOffset, yOffset );
        addToCanvas( contents[ 1 ], xOffset + size, yOffset );
        addToCanvas( contents[ 2 ], xOffset, yOffset + size );
        addToCanvas( contents[ 3 ], xOffset + size, yOffset + size );
        */
      } else {
        // Getting source is too large errors here.
        // Somehow ( ( ( xOffset / zoom ) | 0 ) + ( ( yOffset / zoom ) | 0 ) * width ) > width * height
        try {
          dataBlock.set( cellFilled( block ), ( ( ( xOffset / zoom ) | 0 ) + ( ( yOffset / zoom ) | 0 ) * width ) * 4 );
        } catch ( e ) {
          console.error( e, xOffset, yOffset, zoom, width, cellFilled( block ), 
            ( ( ( xOffset / zoom ) | 0 ) + ( ( yOffset / zoom ) | 0 ) * width ) * 4
          );
        }
        //dataBlock.set( cellFilled( block ), ( ( ( xOffset ) | 0 ) + ( ( yOffset ) | 0 ) * width ) * 4 );
      }
    }
  }
  
  //addToCanvas( m, xOffset || 0, yOffset || 0, m.size );
  _addToCanvas( m, 0, 0, m.size );
  //dataBlock.set( [ 0, 255, 0, 255 ], ( 20 * width + 20 ) * 4 );
  console.log( 'cc', xOffset, yOffset );
  return { dataBlock, offset, width, height };
}



onmessage = function ( e ) {
  var [ type, data ] = e.data;
  //console.log( 'data', type, data );
  try {
    switch ( type ) {
      case "display":
        var r = showArea( data );
        complete( r );
        break;
      case "init":
        initMap( data );
        complete();
        break;
      case "double":
        console.time();
        console.profile( 'double' );
        doubleMap();
        complete();
        console.profileEnd( 'double' );
        console.timeEnd();
        break;
      case "checkd16":
        for ( var i = 0, q = [], j; i < d16.length; i++ ) {
          j = d16[ i ];
          if ( newBlock( j, j, j ) === j ) {
            q.push( j );
          }
        }
        console.log( q );
        complete();
        break;
    }
  } catch ( e ) {
    console.error( 'from worker:', e );
    postMessage( [ 'error', { type, data } ] );
  }
};

function complete( data ) {
  postMessage( [ 'complete', data ] );
}

var cellFilled = ( () => {
  var fills = { 1: [ 255, 255, 255, 255 ], 0: [ 0, 0, 0, 255 ] };
  return function cellFilled( block ) {
    var c = block.c,
      f = fills[ c ];
    if ( f ) {
      return f;
    } else {
      return fills[ c ] = [ 0, 0, 0, 255 ].fill( 255 * c, 0, 3 );
    }
  };
} )();

var baseFilled = {
    size: 1,
    // TODO: Consider redoing the "color" bit to allow more complex colors to be
    // averaged among the higher-ups.
    c: 0, // Color
    n: 1, // Unique key
    contents: null
  },
  baseEmpty = {
    size: 1,
    c: 1,
    n: 0,
    contents: null
  },
  maxKey = 1;

// Set base rules.
Object.assign( baseFilled, { "0_0": baseFilled, "0_1": baseFilled, "1_0": baseFilled, "1_1": baseEmpty  } );
Object.assign( baseEmpty,  { "0_0": baseEmpty,  "0_1": baseEmpty,  "1_0": baseFilled, "1_1": baseFilled } );

// Map holds outermost level. If outermost is a single 64x64 block, hold the one item.
// Start with a single dot.
var map = baseFilled,
  d16 = [];

function initMap( data ) {
  // TODO: Systems for randoms, set patterns, single dot, etc.
  // Maybe move doubleMap in here? Still might need to be called if expand on-demand
  // is added.
  function _randomMap( size ) {
    var x = Array.from( { length: size }, () => Math.random() > 0.5 ? 1 : 0 ),
      c = x.reduce( ( x, y ) => x + y ) / size;
    // Create blocks with lots of newBlanks.
    // TODO.
    return {
      size, n: ++maxKey, c
    };
  }
  
  // TO CONSIDER: Set every combination of 4 dots, access by list[ ( Math.random() * 16 ) | 0 ]?
  
  // Is this what's killing the performance?
  function randomMap( size ) {
    if ( size === 1 ) {
      return Math.random() > 0.5 ? baseEmpty : baseFilled;
    } else {
      return groupBlocks( newBlank( size / 2 ), newBlank( size / 2 ), randomMap( size / 2 ), randomMap( size / 2 ) );
    }
  }
  
  function randomMap2( size ) {
    // Try this: Start the map with the randoms at the top, not the bottom.
    
    // Throwing out random ideas.
    /*
    function i( size, ln, rn ) {
      if ( size === 1 ) {
        return Math.random() > 0.5 ? baseEmpty : baseFilled;
      } else {
        var tl = i( size / 2 ),
          tr = i( size / 2 );
        return groupBlocks(
          i( size / 2 ),
          i( size / 2 ),
          q( size / 2 ),
          q( size / 2 ),
        );
      }
    }
    */
    
    return presetMap( Array.from( { length: size }, () => Math.random() > 0.5 ? baseEmpty : baseFilled ) );
    
    var je = j( size / 2 );
    console.log( 131, je );
    return je;
    
  }
  
  function presetMap( data ) {
    var b = baseEmpty, size = data.length;
    function jj( arr ) {
      if ( !( arr[ 0 ].size > 0 ) ) {
        console.error( 555, arr[ 0 ].size );
      }
      
      var blank = newBlank( arr[ 0 ].size );
      for ( var i = 0, a = [], l = arr.length; i < l; i += 2 ) {
        a.push(
          groupBlocks(
            arr[ i ],
            arr[ i + 1 ],
            newBlock( arr[ i ], arr[ i - 1 ], arr[ i + 1 ] ),
            newBlock( arr[ i + 1 ], arr[ i ], arr[ i + 2 ] || b )
          )
        );
        
        
        /*a.push( 
          groupBlocks(
            blank, blank,
            newBlock( arr[ l - 1 ] ),
            blank
          )
        );*/
      }
      try {
        var qo = groupBlocks( b, blank, 
          newBlock( b, arr[ arr.length - 1 ], blank ), 
          newBlock( blank, b, blank ) );
        b = qo;
      } catch( e ) {
        console.error( e, b, a[ a.length - 1 ] );
        throw e;
      }
      
      return a.length > 1 ? jj( a ) : a[ 0 ];
    }
    
    return groupBlocks( newBlank( size ), newBlank( size ), jj( data ), b );
  }
  
  if ( data.type === 'random' ) {
    console.time( 'init' );
    console.log( 'init', data.size );
    map = randomMap2( data.size || 16 );
    doubleMap();
    console.log( 422, map.size );
    console.timeEnd( 'init' );
  }
  
}

function doubleMap() {
  console.log( 'doubleMap1' );
  console.log( 'doubleMap1-', map.size );
  var oldMap = map,
    size = oldMap.size;

    // Bottom left, directly below the old block.
  var belowBlock = newBlock( oldMap ),
    // Top-right blank corner.
    blank = newBlank( size ),
    // Bottom-right.
    newCorner = newBlock( blank, oldMap );
  
  console.log( 'maxKey', maxKey );
  console.log( 'doubleMap2' );
  return map = groupBlocks( oldMap, blank, belowBlock, newCorner );
}

var newBlank = ( () => {
  var index = { 1: baseEmpty };
  return size => 
    index[ size ] || ( index[ size ] = 
      groupBlocks( ...Array( 4 ).fill( newBlank( size / 2 ) ) )
    );
} )();

function newBlock( block, leftNeighbor = newBlank( block.size ), rightNeighbor = newBlank( block.size ) ) {
  cc.nB++;
  
  var key = leftNeighbor.n + '_' + rightNeighbor.n,
    // For some reason, this line here is really heavy? Runs ~1.5m times.
    cached = block[ key ];
  if ( cached ) {
    cc.nBC++;
    return cached;
  }
  
  // Possible ways to speed this up?
  // * bl's upleft neighbor is, in theory, already calculated. Bypass the cache retrieval somehow?
  // * 
  
  var bC = block.contents,
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
  cc.gB++;
  // We cache all parent blocks each type of block has ever had, using each
  // block's unique ids for mapping.
  var pKey = /*'P' +*/ tr.n + '_' + bl.n + '_' + br.n;
  
  // If we've ever had this block before, use the same one.
  if ( tl[ pKey ] ) {
    return tl[ pKey ];
  }
  
  var r = tl[ pKey ] =
    ( {
      // Length of each side.
      size: tl.size * 2,
      // Percent of blocks which are white.
      c: ( tl.c + tr.c + bl.c + br.c ) / 4,
      // Unique ID for each unique block.
      n: ++maxKey,
      // Child blocks: top-left, top-right, bottom-left, bottom-right.
      contents: [ tl, tr, bl, br ]
    } );
  if ( r.size === 16 ) {
    d16.push( r );
  }
  return r;
}

//initMap();

console.log( baseFilled )
console.log( cc );
console.log( d16 );
