/// <reference path="declarations/node.d.ts"/>
/// <reference path="types.ts"/>

import stream = require('stream');
import fs = require('fs');
import transformers = require('./types');

var liner = new transformers.LineTransformer();
var scraper = new transformers.ScrapeTransformer();
var filter = new transformers.FilterTransformer();
var source = fs.createReadStream('../scraping-data');

source.pipe(liner).pipe(scraper).pipe(filter).on('data', function(chunk: any) {
  console.log(chunk);
});
