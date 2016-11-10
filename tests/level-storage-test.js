var assert = require('assert');
var deepdif = require('deep-diff');
var clone = require('clone');
var LevelStorage = require('../lib/storage/level-storage.js');
var fs = require("fs");
var dbName = "database";
var onlydb;

function createLevelStorage(finished) {
  if (onlydb) {
    return onlydb;
  } else {

    //we put the cleanDb so it can be used at the end of each test
    LevelStorage.prototype.cleanDb = function cleanDb(cb) {
      that = this;

      function clean(that, action_type) {
        return new Promise(function (resolve, reject) {
          that[action_type].createKeyStream()
            .on('data', function (data) {
              that[action_type].del(data);
            })
            .on('end', function () {
              resolve();
            });
        });
      }
      Promise.all([clean(this, 'entities'), clean(this, 'groups')]).then(function (data) {
        console.log('calling done')
        cb();
      }, function () {
        console.log('storage rejection');
      });
    };
    onlydb = new LevelStorage();
    onlydb.init({
      "dbName": dbName
    });
    return onlydb;
  }
}

describe('LevelStorage', function () {
  describe('#read and create Entity()', function () {

    it('should reject with 404 error when data is not there', function (done) {

      var storage = createLevelStorage();
      storage.readEntityPromise("unexistent-stuff", "user")
        .then(function (result) {
          throw Error("should not give results");
        }, function reject(error) {
          if (error.statusCode == 404) {
            storage.cleanDb(done);
          }
        });
    });

    it('should return the  data by an id, if it has been previously stored', function (done) {
      var storage = createLevelStorage();
      var owner = "1";
      var entity_id = "2";
      var entity_type = "user";
      var data = {
        "data": "string",
        "item": 123
      };
      var p = storage.createEntityPromise(entity_id, entity_type, owner, data);
      p.then(function (d) {
        storage.readEntityPromise(entity_id, entity_type)
          .then(function (result) {
            if (result.id == entity_id && result.type == entity_type && result.owner == owner) {
              delete result.id; //id is included so remove it to check
              delete result.type; //entity type is included so remove it to check
              delete result.owner; //owner is included so remove it to check
              if (deepdif.diff(data, result) == undefined)
                storage.cleanDb(done);
            }
          });
      }, function rej(r) {
        console.error('a' + r);
        throw r;
      });
    });

    it('executing promises with Promise.all during creation should work, i.e., data stored in paralell should be present when querying by id', function (done) {
      var storage = createLevelStorage();
      var owner = "1";
      var entity_type = "user";
      var data = {
        "data": "string",
        "item": 123
      };
      var ids = ["1", "2", "3", "4", "5"];
      var ps = [];
      for (i in ids) {
        var c = clone(data);
        c.item = ids[i];
        ps.push(storage.createEntityPromise(ids[i], entity_type, owner, c));
      }
      Promise.all(ps).then(function (d) {
        var queries = [];
        for (i in ids) {
          queries.push(storage.readEntityPromise(ids[i], entity_type));
        }
        Promise.all(queries).then(function (results) {
          for (i in results) {
            var result = results[i];
            delete result.id; //id is included so remove it to check
            delete result.type; //entity type is included so remove it to check
            delete result.owner; //owner is included so remove it to check
            var x =clone(data);
            x.item = ids[i];
            if (deepdif.diff(x, result) != undefined)
              throw new Error("unexpected piece of data as result " + JSON.stringify(result));
          }
          storage.cleanDb(done);
        });
      });
    });
  });

  describe('#update and read Entity()', function () {

    it('should reject with 404 error when pdating data by and id and entity type that is not there', function (done) {
      var storage = createLevelStorage();
      storage.updateEntityPromise("unexistent-stuff", "user", {})
        .then(function (result) {
          throw Error("should not give results");
        }, function reject(error) {
          if (error.statusCode == 404) {
            storage.cleanDb(done);
          }
        });

    });

    it('should update the  data by an id and entity type', function (done) {
      var storage = createLevelStorage();
      var owner = "1";
      var entity_id = "2";
      var entity_type = "user";
      var data = {
        "data": "string",
        "item": 123
      };
      var data2 = {
        "data": "string222",
        "item": 8554
      };
      var p = storage.createEntityPromise(entity_id, entity_type, owner, data);
      p.then(function (data) {
        storage.updateEntityPromise(entity_id, entity_type, data2)
          .then(function (result) {
            if (result.id == entity_id && result.type == entity_type && result.owner == owner) {
              delete result.id; //id is included so remove it to check
              delete result.type; //entity type is included so remove it to check
              delete result.owner; //owner is included so remove it to check
              if (deepdif.diff(data2, result) == undefined) {
                storage.readEntityPromise(entity_id, entity_type)
                  .then(function (result) {
                    if (result.id == entity_id && result.type == entity_type && result.owner == owner) {
                      delete result.id; //id is included so remove it to check
                      delete result.type; //entity type is included so remove it to check
                      delete result.owner; //owner is included so remove it to check
                      if (deepdif.diff(data2, result) == undefined) {
                        storage.cleanDb(done);
                      }
                    }
                  });
              }
            }
          });
      }, function rej(r) {
        throw r;
      })
    });
  });
  describe('#delete and read Entity()', function () {

    it('should reject with 404 error when deleting and entity by and id and entity type that is not there', function (done) {
      var storage = createLevelStorage();
      storage.deleteEntityPromise("unexistent-stuff", "user")
        .then(function (result) {
          throw Error("should not give results");
        }, function reject(error) {
          if (error.statusCode == 404) {
            storage.cleanDb(done);
          }
        });

    });

    it('should delete the  data by an id and entity type', function (done) {
      var storage = createLevelStorage();
      var owner = "1";
      var entity_id = "2";
      var entity_type = "user";
      var data = {
        "data": "string",
        "item": 123
      };
      var data2 = {
        "data": "string222",
        "item": 8554
      };

      var p = storage.createEntityPromise(entity_id, entity_type, owner, data);
      p.then(function (data) {
        storage.deleteEntityPromise(entity_id, entity_type).then(function () {
          return storage.readEntityPromise(entity_id, entity_type);
        }).then(function (result) {}, function rej(r) {
          if (r.statusCode == 404)
            storage.cleanDb(done);

        });
      });

    });
  });

  describe('#listEntitiesByAttribute()', function () {
    //called after each test to delete the database
    afterEach(function () {

    });

    it('should resolve with and empty array when attempting to find entity by type and id that is not there', function (done) {

      var storage = createLevelStorage();
      storage.listEntitiesByAttributeValueAndType("unexistent-stuff", "user")
        .then(function (result) {
          if (result instanceof Array && result.length == 0)
            storage.cleanDb(done);
        }, function reject(error) {
          throw error;
        });

    });

    it('should return one data by an id and type, if it has been previously stored', function (done) {
      var storage = createLevelStorage();
      var owner = "1";
      var entity_id = "2";
      var entity_type = "user";
      var data = {
        "name": "string",
        "token": "123"
      };
      var datasecond = {
        "name": "mysecond attribute",
        "token": "123"
      };

      var p = storage.createEntityPromise(entity_id, entity_type, owner, data);
      p.then(function (d) {
        return storage.createEntityPromise("otherentity", entity_type, owner, datasecond);
      }).then(function (created) {
        storage.listEntitiesByAttributeValueAndType("name", "string")
          .then(function (result) {
            if (result.length == 1) {
              result = result[0];
              if (result.id == entity_id && result.type == entity_type && result.owner == owner) {
                delete result.id; //id is included so remove it to check
                delete result.type; //entity type is included so remove it to check
                delete result.owner; //owner is included so remove it to check
                if (deepdif.diff(data, result) == undefined)
                  storage.cleanDb(done);
              }
            }

          });
      }, function rej(r) {
        console.error('a' + r);
        throw r;
      })

    });

    it('should return more than one entity by an id and type, if it has been previously stored (case with two elements with the same attribute type and value)', function (done) {
      var storage = createLevelStorage();
      var owner = "1";
      var entity_id = "2";
      var entity_type = "user";
      var data = {
        "name": "string",
        "token": "123"
      };
      var datasecond = {
        "name": "string",
        "token": "123"
      };
      var p = storage.createEntityPromise(entity_id, entity_type, owner, data);
      p.then(function (d) {
        return storage.createEntityPromise("otherentity", entity_type, owner, datasecond);
      }).then(function (created) {
        storage.listEntitiesByAttributeValueAndType("name", "string")
          .then(function (array) {
            if (array.length == 2 && deepdif.diff(array[1], array[2])) {
              var count = 0;
              for (var i in array) {
                result = array[i];
                if ((result.id == entity_id || result.id == "otherentity") && result.type == entity_type && result.owner == owner) {
                  delete result.id; //id is included so remove it to check
                  delete result.type; //entity type is included so remove it to check
                  delete result.owner; //owner is included so remove it to check
                  if (deepdif.diff(data, result) == undefined || deepdif.diff(datasecond, result) == undefined)
                    count++;
                }
              }
              if (count == 2)
                done();
            }
          });
      }, function rej(r) {
        console.error('a' + r);
        throw r;
      })
    });

  });

  describe('#Create amd Read Group()', function () {
    //called after each test to delete the database
    afterEach(function () {

    });

    it('should return a group, if it has been previously stored', function (done) {
      var storage = createLevelStorage();
      var owner = "1";
      var group_name = "mygroup";
      var tmp;
      var p = storage.createGroupPromise(group_name, owner);
      p.then(function (d) {
        tmp = d;
        return storage.readGroupPromise(group_name, owner);
      }).then(function (data) {
        if (data.group_name === group_name && data.owner === owner && deepdif.diff(data, tmp) == undefined) {
          storage.cleanDb(done);
        }
      }, function rej(r) {
        console.error('a' + r);
        throw r;
      })

    });

    it('should reject with 404 if a non existent group is attempt to be read', function (done) {
      var storage = createLevelStorage();
      storage.readGroupPromise("unexistent-stuff", "user")
        .then(function (result) {
          throw Error("should not give results");
        }, function reject(error) {
          if (error.statusCode == 404) {
            storage.cleanDb(done);
          }
        });

    });

  });

  describe('#delete and read group()', function () {

    it('should reject with 404 error when deleting and entity by and id and entity type that is not there', function (done) {

      var storage = createLevelStorage();

      storage.deleteGroupPromise("unexistent-stuff", "user")
        .then(function (result) {
          throw Error("should not give results");
        }, function reject(error) {
          if (error.statusCode == 404) {
            storage.cleanDb(done);
          }
        });

    });

    it('should delete the  data by an id and entity type', function (done) {
      var storage = createLevelStorage();
      var owner = "1";
      var group_name = "group_name1";
      var p = storage.createGroupPromise(group_name, owner, owner);
      p.then(function (data) {
        storage.deleteGroupPromise(group_name, owner).then(function () {
          return storage.readGroupPromise(group_name, owner);
        }).then(function (result) {}, function rej(r) {
          if (r.statusCode == 404)
            storage.cleanDb(done);

        });
      });

    });
  });

  describe('#Add  in a Group and readEntity()', function () {
    //called after each test to delete the database
    afterEach(function () {

    });

    it('should reject with 404 error when attempting to place an unexistent entity in a group that exists', function (done) {
      var owner = "1";
      var group_name = "mygroup";
      var storage = createLevelStorage();
      storage.createGroupPromise(group_name, owner)
        .then(function (group) {
          return storage.addEntityToGroupPromise(group.group_name, group.owner, "unexistent-stuff", "user");
        }).then(function (result) {

          throw Error("should not give results");
        }, function rejection(error) {
          if (error.statusCode == 404) {
            storage.cleanDb(done);
          }
        });
    });

    it('should reject with 404 error when attempting to place an exitent entity in a group is not there', function (done) {
      var storage = createLevelStorage();
      var owner = "1";
      var entity_id = "2";
      var entity_type = "user";
      var data = {
        "name": "string",
        "token": "123"
      };
      storage.createEntityPromise(entity_id, entity_type, owner, data)
        .then(function (entity) {
          return storage.addEntityToGroupPromise("unexistent-group", owner, entity.id, entity.type);
        }).then(function (result) {
          throw Error("should not give results");
        }, function reject(error) {
          if (error.statusCode == 404) {
            storage.cleanDb(done);
          }
        });
    });

    it('should return the group as part of the entity when it has been added to a group', function (done) {
      var storage = createLevelStorage();
      var owner = "1";
      var entity_id = "2";
      var entity_type = "user";
      var data = {
        "name": "string",
        "token": "123"
      };
      var group;
      var group_name = "mygroup";
      storage.createGroupPromise(group_name, owner)
        .then(function (g) {
          group = g;
          return storage.createEntityPromise(entity_id, entity_type, owner, data)
        })
        .then(function (entity) {
          return storage.addEntityToGroupPromise(group.group_name, group.owner, entity_id, entity_type);
        }).then(function (result) {
          return storage.readEntityPromise(entity_id, entity_type);
        }).then(function (entityFinal) {
          if (entityFinal.groups.filter(function (v) {
              return (group.group_name == v.group_name && v.owner == group.owner);
            }).length == 1)
            storage.cleanDb(done);
        }, function reject(error) {
          throw error;
        });
    });

    it('should reject with 409 when attempting to add an entity to a group where it has been already  added ', function (done) {
      var storage = createLevelStorage();
      var owner = "1";
      var entity_id = "2";
      var entity_type = "user";
      var data = {
        "name": "string",
        "token": "123"
      };
      var group;
      var group_name = "mygroup";
      storage.createGroupPromise(group_name, owner)
        .then(function (g) {
          group = g;
          return storage.createEntityPromise(entity_id, entity_type, owner, data)
        })
        .then(function (entity) {
          console.log("_--------------------------=")
          return storage.addEntityToGroupPromise(group.group_name, group.owner, entity_id, entity_type);
        }).then(function (result) {
          console.log("_--------------------------=")
          return storage.addEntityToGroupPromise(group.group_name, group.owner, entity_id, entity_type);
        }).then(function (result) {
          throw Error("should not give results");
        }, function reject(error) {
          console.log("_--------------------------=")

          console.log("code" + error.statusCode)
          if (error.statusCode == 409) {
            storage.cleanDb(done);
          }
        });
    });

  });

  describe('#List entities  in  a Group', function () {
    //called after each test to delete the database
    afterEach(function () {

    });

    it('should reject with 404  when attempting to list entities  in an non existent  group', function (done) {
      var owner = "1";
      var group_name = "mygroup";
      var storage = createLevelStorage();
        storage.listEntitiesByGroup("nonexistentgroup","owner")
          .then(function (data) {
            throw new Error("shouldn't return anything here@");
          }, function reject(error) {
            if (error.statusCode == 404) {
              storage.cleanDb(done());
            } else throw error;
          });
    });

    it('should resolve with empty array when attempting to list entities  in an empty  group', function (done) {
      var owner = "1";
      var group_name = "mygroup";
      var storage = createLevelStorage();
        storage.createGroupPromise(group_name, owner)
          .then(function (group) {
            return storage.listEntitiesByGroup(group.group_name, group.owner);
          }).then(function (result) {
            if (result instanceof Array && result.length === 0) {
              storage.clean(done());
            } else throw new Error("strange result after querying existing empty group" + JSON.stringify(result));
          }, function reject(error) {
            throw error;
          });
    });
  });

/*  it('should resolve with the list continaing only the  array of entities that are in a  group', function (done) {
    var storage = createLevelStorage();
    var owner = "1";
    var entity_type = "user";
    var data = {
      "data": "string",
      "item": 123
    };
    var ids = ["1", "2", "3", "4", "5"];
    var ps = [];
    for (i in ids)
      ps.push(storage.createEntityPromise(ids[i], entity_type, owner, data));

    ps.push(storage.createGroupPromise("0", owner));
    ps.push(storage.createGroupPromise("1", owner));

    Promise.all(ps).then(function (d) {
      console.log("DONE!")
      var addingps = [];
      for (i in ids){
          console.log('             adding '+(i%2).toString()+' , '+ owner+ ' , ' + ids[i] + ' , ' + entity_type);
          addingps.push(storage.addEntityToGroupPromise((i%2).toString(), owner, ids[i], entity_type));
      }


      return Promise.all(addingps);
    }).then(function(results) {
            console.log("DONE2!")
      return storage.listEntitiesByGroup("0", owner);
    }).then(function(entitiesGroup0){
      console.log("ok"+JSON.stringify(entitiesGroup0))
      storage.cleanDb(done);
    });
  },function f(r){
    throw r;
  });*/

  });