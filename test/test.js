var assert = require( 'assert' );
var worker = require( '../worker.js' ),
  pending = [];

function message( d, callback ) {
  pending.push( callback || ( () => {} ) );
  worker.onmessage( { data: d } );
}

worker.postMessage = function ( [ type, data ] ) {
  var callback = pending.shift();
  if ( type === 'complete' ) {
    if ( !callback ) {
      throw new Error( "postMessage called without callback to run")
    } else {
      callback( data );
    }
  } else {
    throw new Error( data );
  }
}

describe( 'test', function () {
  it( 'should have simple cell', function () {
    var { map, baseFilled } = worker;
    // Color
    assert.equal( baseFilled.c, 0 );
    assert.equal( map.size, 1 );
    assert.equal( map.contents, null );
  } );
  
  it( 'should double and display', function () {
    message( [ 'double' ] );
    message( [ 'double' ] );
    //worker.onmessage( [ 'double' ] );
    var { map, baseFilled } = worker;
    //console.log( worker.onmessage );
    // Color
    message( [ 'display', { offset: { x: 0, y: 0 }, zoom: 1, width: 4, height: 4 } ], function ( re ) {
      var { dataBlock } = re,
        pixels = dataBlock.filter( ( _, i ) => i % 4 === 0 ).map( x => x / 255 ),
        numberOfBlackDots = pixels.filter( x => x === 0 ).length;
      assert.equal( re.dataBlock.length, 64 );
      assert.deepEqual( pixels, 
        [
          0, 1, 1, 1,
          0, 0, 1, 1,
          0, 0, 0, 1,
          0, 1, 0, 0
        ]
      );
      assert.equal( numberOfBlackDots, 9 );
    } );
  } );
  
  it( 'should allow X-offset', function () {
    // Test X offset
    message( [ 'display', { offset: { x: 1, y: 0 }, zoom: 1, width: 4, height: 4 } ], function ( re ) {
      var { dataBlock } = re,
        pixelsBinary = dataBlock.filter( ( _, i ) => i % 4 === 0 ).map( x => x / 255 );
      assert.deepEqual( pixelsBinary, 
        [
          1, 1, 1, 1,
          0, 1, 1, 1,
          0, 0, 1, 1,
          1, 0, 0, 1
        ]
      );
    } );
  } );
  
  it( 'should allow zoom in and out', function () {
    // Zoom out.
    message( [ 'display', { offset: { x: 0, y: 0 }, zoom: 2, width: 2, height: 2 } ], function ( re ) {
      var { dataBlock } = re,
        pixels = [ ...dataBlock ].filter( ( _, i ) => i % 4 === 0 );
      assert.deepEqual( pixels, 
        [
          63, 255,
          63, 63
        ]
      );
    } );
    // Zoom in.
    message( [ 'display', { offset: { x: 0, y: 0 }, zoom: 0.5, width: 4, height: 4 } ], function ( re ) {
      var { dataBlock } = re,
        pixels = [ ...dataBlock ].filter( ( _, i ) => i % 4 === 0 );
      assert.deepEqual( pixels, 
        [
          0, 0, 255, 255,
          0, 0, 255, 255,
          0, 0, 0, 0,
          0, 0, 0, 0
        ]
      );
    } );
    // Zoom in with y-offset.
    message( [ 'display', { offset: { x: 0, y: 2 }, zoom: 0.5, width: 4, height: 4 } ], function ( re ) {
      var { dataBlock } = re,
        pixels = [ ...dataBlock ].filter( ( _, i ) => i % 4 === 0 );
      assert.deepEqual( pixels, 
        [
          0, 0, 0, 0,
          0, 0, 0, 0,
          0, 0, 255, 255,
          0, 0, 255, 255
        ]
      );
    } );
  } );
} );
