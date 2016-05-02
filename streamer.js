const WebSocket = require('ws');
const Docker = require('dockerode');
var merge2 = require('merge2');
var Readable = require('readable-stream').Readable
var Writable = require('stream').Writable;

const Promise = require('bluebird');

const WebSocketServer = WebSocket.Server,
  wss = new WebSocketServer({
    port: process.env.PORT || 8080
  });

var docker = new Docker();


function attach_container(docker, container_id, cb) {
  return new Promise((resolve, reject) => {
    const container = docker.getContainer(container_id);
    container.attach({stream: true, stdout: true, stderr: true}, function (err, stream) {
      if (err) return reject(err);
      return resolve(stream);
    });
  });
}


function containers_to_logstream(docker, containers) {
  var attach = attach_container.bind(null, docker);
  return Promise.map(containers.map(container => container.Id), attach)
  .then((streams) => {
    return merge2(streams);
  });
}


var version = 0;

var logstream = Readable({
  read: function(n) {

  }
});

function mutable_logstream () {
  docker.listContainers(function (err, containers) {
    containers_to_logstream(docker, containers)
    .then(stream => {
      const k = version;
      stream.on('data', (data) => {
        // Only push logstream forward if the container state is still same
        if(version == k) return logstream.push(data)
        stream.end();
      });
    });
  });
}

// Get new streams if something changes on docker host
docker.getEvents((err, stream) => {
  if (err) console.error(err);
  stream.on('data', (data) => {
    const evt = JSON.parse(data.toString());
    if (evt.status != 'attach') {
      version++;
      mutable_logstream();
    }
  });
});

// Start streaming
mutable_logstream();


function WSStream(ws) {
  var client = Writable();
  ws.on('close', function() {
    client.end();
  });
  client._write = (chunk, enc, next) => {
    ws.send(chunk);
    next();
  };
  return client;
}


// SERVER
wss.on('connection', function connection(ws) {
  // For new connection open up client stream and start to pipe logstream to it
  const client = WSStream(ws);
  logstream.pipe(client);
});
