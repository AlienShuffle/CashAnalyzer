import { readFileSync } from 'fs';
import process from 'process';
import dynamicSort from '../lib/dynamicSort.mjs';
console.log(JSON.stringify(JSON.parse(readFileSync(process.stdin.fd, 'utf-8')).sort(dynamicSort('-reportDate'))));