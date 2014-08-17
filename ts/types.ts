/// <reference path="declarations/node.d.ts"/>
/// <reference path="declarations/cheerio.d.ts"/>

import cheerio = require('cheerio');
import stream = require('stream');
import http = require('http');

export enum PriceType { New, Used };

export class ItemPrice {
  constructor(public type: PriceType, public value: number) {}
}

export class Prices {
  constructor(public new_price: ItemPrice, public used_price: ItemPrice) {
    
  }
}

export class WantedItem {
  wanted_prices: Prices;
  current_prices: Prices;

  constructor(public url: string, wanted_new_price: ItemPrice,
   wanted_used_price: ItemPrice) {
    this.wanted_prices = new Prices(wanted_new_price, wanted_used_price);
  }

  scrape_current_prices(stream: stream.Transform, done: Function) {
    var body: string = '';
    http.get(this.url, (res: any) => {
      res.on('data', function(chunk: any) { body += chunk.toString(); }).on('end', () => {
        var dom = cheerio.load(body);
        var body_text = dom('body').text();
        var used_price: string = /\d+\s+used\s+from\s+\$(\d+.\d+)/.exec(body_text)[1];
        var new_price: string = /\d+\s+new\s+from\s+\$(\d+.\d+)/.exec(body_text)[1];
        var current_prices = new Prices(new ItemPrice(PriceType.New, parseFloat(new_price)),
         new ItemPrice(PriceType.Used, parseFloat(used_price)));
        this.current_prices = current_prices;
        stream.push(this);
        done();
      });
    });
  }
}

export class FilterTransformer extends stream.Transform {
  constructor() { super({objectMode: true}); }

  _transform(chunk: any, encoding: string, done: Function) {
    var new_threshold = chunk.current_prices.new_price.value <= chunk.wanted_prices.new_price.value;
    var used_threshold = chunk.current_prices.used_price.value <= chunk.wanted_prices.used_price.value;
    if (new_threshold || used_threshold) {
      this.push(chunk);
    }
    done();
  }
}

export class ScrapeTransformer extends stream.Transform {
  constructor() { super({objectMode: true}); }

  _transform(chunk: any, encoding: string, done: Function): void {
    chunk.scrape_current_prices(this, done);
  }
}

export class LineTransformer extends stream.Transform {
  lastLine: string = '';

  constructor() { super({objectMode: true}); }

  _transform(chunk: any, encoding: string, done: Function): void {
    var data: string = this.lastLine + chunk.toString();
    var lines: Array<string> = data.split('\n');
    this.lastLine = lines.splice(lines.length - 1, 1)[0]

    lines.forEach((line: string) => {
      if (line[0] !== '#') {
        var components = line.split(',');
        var item = new WantedItem(components[0], new ItemPrice(PriceType.New, parseFloat(components[1])),
         new ItemPrice(PriceType.Used, parseFloat(components[2])));
        this.push(item);
      }
    });

    done();
  }

  _flush(done: Function) {
    if (this.lastLine.length > 0) {
      var components = this.lastLine.split(',');
      var item = new WantedItem(components[0], new ItemPrice(PriceType.New, parseFloat(components[1])),
       new ItemPrice(PriceType.Used, parseFloat(components[2])));
      this.push(item);
      this.lastLine = '';
    }
    done();
  }
}
