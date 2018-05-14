var path = require('path');
var express = require('express');
var app = express();
var compression = require('compression');
var request = require('request');
var hogan = require("hogan.js");
var logger = require('morgan');

// Log health checks
app.use(logger('dev'))
// Add health check endpoint before logging middleware
app.get('/healthz', function (req, res) {
  res.sendStatus(200)
});

app.use(compression());

// Setup view engine
app.set('view engine', 'html');
app.set('layout', 'index');
app.enable('view cache')
app.engine('html', require('hogan-express'));
app.set('views', __dirname + '/')

app.use('/css', express.static(path.join(__dirname, '/node_modules/reveal.js/css')));
app.use('/lib', express.static(path.join(__dirname, '/node_modules/reveal.js/lib')));
app.use('/js', express.static(path.join(__dirname, '/node_modules/reveal.js/js')));
app.use('/plugin', express.static(path.join(__dirname, '/node_modules/reveal.js/plugin')));
app.use('/md', express.static(path.join(__dirname, '/md')));
app.use('/resources', express.static(path.join(__dirname, '/resources')));

// function requireHTTPS(req, res, next) {
//   if (req.get('x-forwarded-proto') == "http") {
//       return res.redirect(301, 'https://' + req.get('host') + req.url);
//   }
//   next();
// }

app.get('/', function (req, res) {
  if (process.env.NODENAME) {
    console.log('http://localhost:8001/api/v1/nodes/' + process.env.NODENAME)
    request('http://localhost:8001/api/v1/nodes/' + process.env.NODENAME, function (err, response, body) {
      var metadata = JSON.parse(body).metadata;

      //TODO
      var zone = metadata == null
        ? ''
        : metadata.labels == null
          ? ''
          : metadata.labels['failure-domain.beta.kubernetes.io/zone'];

      res.render('index',
        {
          zone: zone
        });
    });
  } else {
    res.render('index',
      {
        zone: ''
      });
  }
});

var server = app.listen(8000, function () {
  console.log('Server started: http://localhost:%s/', server.address().port);
});
