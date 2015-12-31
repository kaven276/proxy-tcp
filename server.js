#!/usr/bin/env node

"use strict"

var net = require('net')
  , http = require('http')
  , https = require('https')
  , fs = require('fs')
  , debug = require('debug')
  , log = debug('local mirror')
  ;

/**
 * configuration.json structure
 * mapping : {
 *   local_listen_address : {
 *     http_tunnel_address,
 *     remote_listen_address
 * }
 */

var cfgPath = process.argv[2]
  , mapping = require(cfgPath).mapping
  ;
debug(mapping);

Object.keys(mapping).forEach(function(laddr){
  var item = mapping[laddr]
    , tmp = laddr.split(':')
    , lport = parseInt(tmp[1])
    , lhost = tmp[0] || '0.0.0.0'
    ;
  net.createServer(function(c){
    log('a client connected to %d for %j', laddr, mapping[laddr]);

    if (item.proxy) {
      log('tunnel by http');
      var proxy = item.proxy.split(':')
        , proxyHost = proxy[0]
        , proxyPort = proxy[1]
        ;
      var options = {
        hostname: proxyHost,
        port: proxyPort,
        method: 'CONNECT',
        path: item.target
      };
      log(options);
      http.request(options)
        .on('connect', function(res, tc, head){
          log('connected to tunnel');
          tc.unshift(head);
          tc.pipe(c).pipe(tc);
        })
        .end();
    } else {
      log('tunnel directly');
      var targets = item.target.split(':')
        , tarHost = targets[0]
        , tarPort = parseInt(targets[1])
        ;
      var tc = net.connect(tarPort, tarHost, function(){
        tc.pipe(c).pipe(tc);
      });
    }

  }).listen(lport, lhost, function(){
    log('listening at %d', laddr);
  });
});
