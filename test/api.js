'use strict';

describe('The es-sequence API', function() {

  var util = require('util');
  var Promise = require('bluebird');

  var esClient = require('elasticsearch').Client();
  var sequence = require('..');


  function expectIndexToExist(name, expectedToExist, done) {
    esClient.indices.exists({
      index: name
    }, function (err, response, status) {
      expect(err).toBeUndefined();
      expect(response).toBe(expectedToExist);
      done();
    });
  }

  function expectIndexToHaveCorrectSettings(name, done) {
    esClient.indices.getSettings({
      index: name
    }, function (err, response, status) {
      expect(err).toBeUndefined();
      console.log(util.inspect(response, { showHidden: true, depth: null }));
      expect(response).toBeDefined();
      expect(response[name]).toBeDefined();
      expect(response[name].settings).toBeDefined();
      expect(response[name].settings.index).toBeDefined();
      expect(response[name].settings.index.auto_expand_replicas).toEqual("0-all");
      expect(response[name].settings.index.number_of_shards).toEqual("1");
      done();
    });
  }

  function expectIndexToHaveCorrectMappingForType(nameIndex, nameType, done) {
    esClient.indices.getMapping({
      index: nameIndex,
      type: nameType
    }, function (err, response, status) {
      expect(err).toBeUndefined();
      console.log(util.inspect(response, { showHidden: true, depth: null }));
      expect(response).toBeDefined();
      expect(response[nameIndex]).toBeDefined();
      expect(response[nameIndex].mappings).toBeDefined();
      expect(response[nameIndex].mappings[nameType]).toBeDefined();
      expect(response[nameIndex].mappings[nameType]._source).toBeDefined();
      expect(response[nameIndex].mappings[nameType]._source.enabled).toBe(false);
      expect(response[nameIndex].mappings[nameType]._all).toBeDefined();
      expect(response[nameIndex].mappings[nameType]._all.enabled).toBe(false);
      expect(response[nameIndex].mappings[nameType]._type).toBeDefined();
      expect(response[nameIndex].mappings[nameType]._type.index).toEqual('no');
      expect(response[nameIndex].mappings[nameType].enabled).toBe(false);
      done();
    });
  }


  it('should throw missing init', function (done) {
    expect(function () {
      sequence.get("userId");
    }).toThrow();
    done();
  });

  it('should throw invalid parameters for init', function (done) {
    expect(function () { sequence.init();               }).toThrow();
    expect(function () { sequence.init(undefined);      }).toThrow();
    expect(function () { sequence.init(null);           }).toThrow();
    expect(function () { sequence.init({});             }).toThrow();
    expect(function () { sequence.init(function () {}); }).toThrow();
    done();
  });

  it ('should throw invalid parameters for get', function (done) {
    expect(function () { sequence.get(undefined, function () {} ); }).toThrow();
    expect(function () { sequence.get();                           }).toThrow();
    expect(function () { sequence.get(null);                       }).toThrow();
    expect(function () { sequence.get(null, null);                 }).toThrow();
    expect(function () { sequence.get("x");                        }).toThrow();
    expect(function () { sequence.get("x", null);                  }).toThrow();
    expect(function () { sequence.get(null, function () {} );      }).toThrow();
    expect(function () { sequence.get(false, function () {} );     }).toThrow();
    expect(function () { sequence.get("x", false );                }).toThrow();
    expect(function () { sequence.get("", function () {} );        }).toThrow();
    done();
  });

  it('should init without options', function (done) {
    // I do not expect the default "sequences" index not to be existing to be able to execute the tests on my test db.
    sequence.init(esClient)
      .then(function () {
        expectIndexToExist('sequences', true, done);
      });
  });

  it('should init with options for a new index', function (done) {
    expectIndexToExist('testsequences', false, function () {

      sequence.init(esClient, { esIndex: 'testsequences' })
        .then(function () {
          expectIndexToExist('testsequences', true, function () {
            expectIndexToHaveCorrectSettings('testsequences', function () {
              expectIndexToHaveCorrectMappingForType('testsequences', 'sequence', done);
            });
          });
        });
    });
  });

  it('should retrieve the value for a new sequence', function (done) {
    sequence.get("userId", function (id) {
      expect(id).toBe(1);
      done();
    });
  });

  it('should retrieve the value for an existing sequence', function (done) {
    sequence.get("userId", function (id) {
      expect(id).toBe(2);
      done();
    });
  });

  it('should retrieve the value for another new sequence', function (done) {
    sequence.get("anotherId", function (id) {
      expect(id).toBe(1);
      done();
    });
  });

  it('should keep different sequences separate', function (done) {
    sequence.get("userId", function (id) {
      expect(id).toBe(3);
      done();
    });
  });

  it('should be able to retrieve a thousand ids from a sequence', function (done) {

    function getNextId(lastId, i, done) {
      sequence.get("userId", function (id) {
        expect(id).toBe(lastId+1);
        if (i < 1000) {
          getNextId(id, i+1, done);
        } else {
          done();
        }
      });
    }

    getNextId(3, 0, done);
  });

  it('should keep different sequences separate even after cache refreshes', function (done) {

    function getNextId(lastId, i, done) {
      sequence.get("anotherId", function (id) {
        expect(id).toBe(lastId+1);
        if (i < 1000) {
          getNextId(id, i+1, done);
        } else {
          done();
        }
      });
    }

    getNextId(1, 0, done);
  });

  it('should reinit with same options', function (done) {

    sequence.init(esClient);

    sequence.get("anotherId", function (id) {
      expect(id).toBeGreaterThan(1);
      done();
    });
  });

  it('should reinit with same index but different type', function (done) {

    sequence.init(esClient, { esType: 'sequence2' })
      .then(function () {
        expectIndexToHaveCorrectMappingForType('testsequences', 'sequence2', done);
      });
  });

  it('should count a sequence with the same name but other type from 1', function (done) {
    sequence.get("userId", function (id) {
      expect(id).toBe(1);
      done();
    });
  });

  it('should allow sequences names with special characters', function (done) {

    function getNextId(lastId, i, done) {
    sequence.get("^°!\"§$%&/()=?*+'#-_.:,;<>|\\…÷∞˛~›˘∫‹√◊≈‡≤≥‘’@ﬂ∆ˆºıªƒ∂‚•π∏⁄Ω†€‰∑¿˙≠{}·˜][ﬁ“”„“ ¡¢£¤¥¦§¨©ª«¬®¯°±²³´`µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖŒ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøœùúûüýþÿ™", function (id) {
        expect(id).toBe(lastId+1);
        if (i < 1000) {
          getNextId(id, i+1, done);
        } else {
          done();
        }
      });
    }

    getNextId(0, 0, done);
  });

  it('should keep order while cache is filled', function (done) {

    // Intercept the bulk method which is used to get new ids so it takes longer
    var bulkOrig = esClient.bulk;
    esClient.bulk = function() {
      return bulkOrig.apply(this, arguments).delay(100);
    };

    var count = 3;
    function countdown() {
      count -= 1;
      if (count === 0) {
        expect(sequence._internal.getCacheSize("cachefilltest")).toBe(100-3);
        esClient.bulk = bulkOrig;
        done();
      }
    }

    // First call that triggers filling the cache
    sequence.get("cachefilltest", function (id) {
      expect(id).toBe(1);
      countdown();
    });

    sequence.get("cachefilltest", function (id) {
      expect(id).toBe(2);
      countdown();
    });

    sequence.get("cachefilltest", function (id) {
      expect(id).toBe(3);
      countdown();
    });

  });

  it('should handle queueing gets with multiple cache fills required', function (done) {

    // Intercept the bulk method which is used to get new ids so it takes longer
    var bulkOrig = esClient.bulk;
    esClient.bulk = function() {
      return bulkOrig.apply(this, arguments).delay(100);
    };

    var count = 1000;
    function countdown() {
      count -= 1;
      if (count === 0) {
        expect(sequence._internal.getCacheSize("cachefilltest2")).toBe(10*100 - 1000);
        esClient.bulk = bulkOrig;
        done();
      }
    }

    function executeGet(expectedValue) {
      sequence.get("cachefilltest2", function (id) {
        expect(id).toBe(expectedValue);
        countdown();
      });
    }

    for ( var i = 0; i < 1000; i+=1 ) {
      executeGet(i+1);
    }

  });

  it('should throw reinit on pending cache fill', function (done) {

    // Intercept the bulk method which is used to get new ids so it takes longer
    var bulkOrig = esClient.bulk;
    esClient.bulk = function() {
      return bulkOrig.apply(this, arguments).delay(50);
    };

    var count = 2;
    function countdown() {
      count -= 1;
      if (count === 0) {
        esClient.bulk = bulkOrig;
        done();
      }
    }

    sequence.get("cachefilltest3", function (id) {
      expect(id).toBe(1);
      countdown();
    });

    expect(function () {
      sequence.init(esClient);
    }).toThrow();
    countdown();

  });

  it('should defer get request while init creates the index', function (done) {

    // Intercept the method to create an index so it takes longer
    var createOrig = esClient.indices.create;
    esClient.indices.create = function() {
      var _arguments = arguments;
      return Promise.resolve().delay(50).then(function () {
        return createOrig.apply(esClient.indices, _arguments);
      });
    };

    var count = 2;
    function countdown() {
      count -= 1;
      if (count === 0) {
        esClient.indices.create = createOrig;
        done();
      }
    }

    sequence.init(esClient, { esIndex: 'testsequences2', esType: 'sequence' })
      .then(function () {
        expectIndexToExist('testsequences2', true, function () {
          expectIndexToHaveCorrectSettings('testsequences2', function () {
            expectIndexToHaveCorrectMappingForType('testsequences2', 'sequence', countdown);
          });
        });
      });

    sequence.get("defertest", function (id) {
      expect(id).toBe(1);
      countdown();
    });

  });

  it('should defer get request while init creates new mapping', function (done) {

    // Intercept the method to create an index so it takes longer
    var putMappingOrig = esClient.indices.putMapping;
    esClient.indices.putMapping = function() {
      var _arguments = arguments;
      return Promise.resolve().delay(50).then(function () {
        return putMappingOrig.apply(esClient.indices, _arguments);
      });
    };

    var count = 2;
    function countdown() {
      count -= 1;
      if (count === 0) {
        esClient.indices.putMapping = putMappingOrig;
        done();
      }
    }

    sequence.init(esClient, { esIndex: 'testsequences2', esType: 'sequence2' })
      .then(function () {
        expectIndexToExist('testsequences2', true, function () {
          expectIndexToHaveCorrectSettings('testsequences2', function () {
            expectIndexToHaveCorrectMappingForType('testsequences2', 'sequence2', countdown);
          });
        });
      });

    sequence.get("defertest", function (id) {
      expect(id).toBe(1);
      countdown();
    });

  });


  it('cleanup index testsequences', function (done) {
    esClient.indices.delete({ index: 'testsequences' }, done);
  });

  it('cleanup index testsequences2', function (done) {
    esClient.indices.delete({ index: 'testsequences2' }, done);
  });

});
