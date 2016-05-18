#!/usr/bin/env node

/**
 * Module dependencies.
 */

var program = require('commander');
var client = require('./client');

function dateArg(val, defaultDate) {
  if(val) {
    return new Date(val);
  }

  return defaultDate;
}

program
  .version('0.0.1')
  .option('-u, --username <email>', 'Your email')
  .option('-p, --password <password>', 'Your password')
  .option('-l, --list', 'List all available payslips')
  .option('-i, --id <payslip-id>', 'Download the specified payslip')
  .option('-d, --date <YYYY-MM>', 'Download payslip for month', dateArg, Date.now())
  .option('-o, --output <output-path>', 'Output path')
  .parse(process.argv);

if(!program.username || !program.password) {
  console.log("Username and password are required");
  process.exit(1);
}

client.downloadLast(program.username, program.password, program.output);
