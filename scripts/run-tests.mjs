import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const testsDirectory=new URL('../tests/',import.meta.url);
export const testFiles=readdirSync(testsDirectory)
 .filter(file=>file.endsWith('.test.mjs'))
 .sort()
 .map(file=>fileURLToPath(new URL(file,testsDirectory)));

const isMain=process.argv[1]===fileURLToPath(import.meta.url);
if(isMain){
 const result=spawnSync(process.execPath,['--test',...testFiles],{stdio:'inherit'});
 process.exit(result.status??1);
}
