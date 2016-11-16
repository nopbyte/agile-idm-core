var IdmCore = require('../index');
var clone = require('clone');
var assert = require('assert');
var deepdif = require('deep-diff');
var createError = require('http-errors');
var fs = require('fs');
var EntityStorage = require('../lib/storage/level-storage');
var db;
//conf for the API (components such as storage and authentication for the API may be replaced during tests)
var dbName = "./database";
var rmdir = require('rmdir');
var conf = {
  "storage": {
    "dbName": dbName
  },
  "authentication": {
    "web-server": "nowhere...",

  },
  "schema-validation": [{
    "id": "/Sensor",
    "type": "object",
    "properties": {
      "name": {
        "type": "string"
      },
      "token": {
        "type": "string"
      }
    },
    "required": ["name"]
  }]
};

//default data for the tests
var token = "6328602477442473";
var action = "create";
var entity_type = "/Sensor";
var entity_id = "323";
var entity_1 = {
  "name": "Barack Obam2a",
  "token": "DC 20500"
};
var group_name = "group";
//mock ups to make unit instead of integration tests.
var authMockOK = {
  authenticateEntityPromise: function (credentials) {
    var that = this;
    return new Promise(function (resolve, reject) {
      var result = {
        "user_id": credentials,
        "auth_type": "auth_type",
        "scope": ["1"]
      };
      resolve(result);
    });
  }
}

function cleanDb(done) {
  db.close().then(function () {
    rmdir(dbName + "_entities", function (err, dirs, files) {
      rmdir(dbName + "_groups", function (err, dirs, files) {
        db = null;
        done();
      });
    });
  }, function () {
    throw Error("not able to close database");
  });
}

//NOTE connection is mocked to have a connection that is reset after each test (but only after each test!) A bit different that level-storage test.
var dbconnection = function (conf) {
  return new Promise(function (resolve, reject) {
    if (db)
      resolve(db);
    else { //this happens at the beginning (and only at the beginning) of every test
      db = new EntityStorage();
      db.init(conf.storage, function (result) {
        return resolve(db);
      });
    }
  });
}

var PdpMockOk = {
  canRead: function (userInfo, entityInfo) {
    return new Promise(function (resolve, reject) {
      resolve(entityInfo);
    });
  },
  canDelete: function (userInfo, entityInfo) {
    return new Promise(function (resolve, reject) {
      resolve(entityInfo);
    });
  },
  canReadArray: function (userInfo, entities) {
    return new Promise(function (resolve, reject) {
      //console.log('resolving with entities '+JSON.stringify(entities));
      resolve(entities);
    });
  },
  canWriteToAttribute: function (userInfo, entities, attributeName, attributeValue) {
    return new Promise(function (resolve, reject) {
      //console.log('resolving with entities '+JSON.stringify(entities));
      resolve();
    });
  },
  canUpdate: function (userInfo, entityInfo) {
    return new Promise(function (resolve, reject) {
      //console.log('resolving with entities '+JSON.stringify(entities));
      resolve(entityInfo);
    });
  }

};

//Tests!
describe('Groups Api', function () {

  describe('#createGroup  and readGroup()', function () {

    afterEach(function (done) {
      cleanDb(done);
    });

    it('should reject with 404 error when group is not there', function (done) {
      var idmcore = new IdmCore(conf);
      var owner = token + "!@!" + "auth_type";
      idmcore.setMocks(authMockOK, null, null, PdpMockOk, dbconnection);
      idmcore.readGroup(token, group_name, owner)
        .then(function (read) {}, function handlereject(error) {
          if (error.statusCode == 404) {
            done();
          }
        }).catch(function (err) {
          throw err;
        });

    });

    it('should create a group by id and return the same afterwards', function (done) {
      var idmcore = new IdmCore(conf);
      idmcore.setMocks(authMockOK, null, null, PdpMockOk, dbconnection);
      var entity = clone(entity_1);
      var owner = token + "!@!" + "auth_type";
      idmcore.createGroup(token, group_name)
        .then(function (data) {
          if (group_name === data.group_name && data.owner === owner) {
            return idmcore.readGroup(token, group_name, owner);
          }
        }).then(function (read) {
          if (group_name == read.group_name && read.owner === owner) {
            done();
          }
        }, function handlereject(r) {
          throw r;
        }).catch(function (err) {
          throw err;
        });
    });
  });

  describe('#delete and read Group()', function () {

    afterEach(function (done) {
      cleanDb(done);
    });

    it('should reject with 404 error when attemtpting to delete data is not there', function (done) {
      var idmcore = new IdmCore(conf);
      idmcore.setMocks(authMockOK, null, null, PdpMockOk, dbconnection);
      idmcore.deleteGroup(token, group_name, "unesistent owner")
        .then(function (read) {}, function handlereject(error) {
          if (error.statusCode == 404) {
            done();
          }
        }).catch(function (err) {
          throw err;
        });
    });

    it('should delete a group  by id', function (done) {

      var idmcore = new IdmCore(conf);
      idmcore.setMocks(authMockOK, null, null, PdpMockOk, dbconnection);
      var owner = token + "!@!" + "auth_type";
      idmcore.createGroup(token, group_name)
        .then(function (data) {
          if (group_name === data.group_name && data.owner === owner)
            return idmcore.deleteGroup(token, group_name, owner);
        }).then(function () {
          return idmcore.readGroup(token, group_name, owner);
        }).then(function () {
          throw new Error("should not return anything");
        }, function handlereject(error) {
          if (error.statusCode == 404) {
            done();
          }
        });

    });
  });

  describe('#add entity to group', function () {

    afterEach(function (done) {
      cleanDb(done);
    });

    it('should reject with 404 error when attempting to add a non existing entity to a group', function (done) {
      var idmcore = new IdmCore(conf);
      idmcore.setMocks(authMockOK, null, null, PdpMockOk, dbconnection);
      var owner = token + "!@!" + "auth_type";
      idmcore.createGroup(token, group_name)
        .then(function (read) {
          return idmcore.addEntityToGroup(token, group_name, owner, entity_id, entity_type);
        }).then(function (res) {

        }, function handlereject(error) {
          if (error.statusCode == 404) {
            done();
          }
        });
    });

    it('should reject with 404 error when attempting to add an exiting entity to a non existing group', function (done) {
      var idmcore = new IdmCore(conf);
      idmcore.setMocks(authMockOK, null, null, PdpMockOk, dbconnection);
      var owner = token + "!@!" + "auth_type";
      idmcore.createEntity(token, entity_id, entity_type, entity_1)
        .then(function (read) {
          return idmcore.addEntityToGroup(token, group_name, owner, entity_id, entity_type);
        }).then(function (res) {

        }, function handlereject(error) {
          if (error.statusCode == 404) {
            done();
          }
        });
    });

    it('should resolve with a modified entity after adding it to a gorup', function (done) {
      var idmcore = new IdmCore(conf);
      idmcore.setMocks(authMockOK, null, null, PdpMockOk, dbconnection);
      var owner = token + "!@!" + "auth_type";
      var ps = [idmcore.createEntity(token, entity_id, entity_type, entity_1), idmcore.createGroup(token, group_name)];
      Promise.all(ps)
        .then(function (read) {
          return idmcore.addEntityToGroup(token, group_name, owner, entity_id, entity_type);
        }).then(function (res) {
          return idmcore.readEntity(token, entity_id, entity_type);
        }).then(function (entityFinal) {
          if (entityFinal.groups.filter(function (v) {
              return (group_name == v.group_name && v.owner == owner);
            }).length == 1)
            done();
        }, function handlereject(error) {});
    });

  });
});