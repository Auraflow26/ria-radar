import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { parseMonthlySources } from '../src/lib/monthly-sources.js'
import { isFresh } from '../src/lib/freshness.js'
import { unsupportedFigures } from '../src/lib/grounding.js'
import { computeScore } from '../src/lib/scoring.js'
import { skeletonBrief } from '../src/lib/brief.js'
import { fetchMonthlyRoster, setOffline } from '../src/lib/sec-client.js'
import { fetchHomepageViaApify } from '../src/lib/apify-client.js'
let passed = 0
function check(name: string, condition: unknown) { assert.ok(condition, name); passed++; console.log(`PASS ${name}`) }
const root = process.cwd()
const index = '<a href="/files/new-irregular-name.zip">Registered Investment Advisers, October 2026</a><a href="/files/prior.zip">Registered Investment Advisers, September 2026</a><a href="/files/exempt.zip">Exempt Investment Advisers, November 2026</a>'
const sources = parseMonthlySources(index)
check('discover real published filenames',sources.current.url.endsWith('/new-irregular-name.zip'))
check('ignore exempt roster', sources.current.label === '2026-10')
check('prior consecutive month', sources.prior.label === '2026-09')
assert.throws(()=>parseMonthlySources(index.replace('September','August')));passed++
check('reject undated cache',!isFresh(undefined))
check('reject stale cache',!isFresh('2026-06-28',Date.parse('2026-10-09')))
check('reject future cache',!isFresh('2026-10-10',Date.parse('2026-10-09')))
check('accept current acquisition',isFresh('2026-10-08',Date.parse('2026-10-09')))
check('reject million-billion switch',unsupportedFigures('Assets $1.2B','Assets $1.2M').length===1)
check('accept equivalent full amount',unsupportedFigures('Assets $1,200,000','Assets $1.2M').length===0)
check('reject substring figure',unsupportedFigures('Assets $12','Assets $120').length===1)
check('require missing source',unsupportedFigures('Assets $12',undefined).length===1)
check('keep percentage unit',unsupportedFigures('mix 50%','score 50/100').length===1)
check('accept grounded share',unsupportedFigures('mix 50%','HNW share 50%').length===0)
const firm: any = {crd:1,name:'Demo',raumTotal:2e9,raumHnw:1e9,raumDiscretionary:1.8e9,advisesPrivateFunds:true,privateFundCount:null,clientsHnw:null,clientsIndividual:null,pctSmaPooledVehicles:null}
check('unknown fund count stays unknown',skeletonBrief(computeScore(firm)).current_alts_footprint.includes('count not reported'))
const e: any={custodians:[{name:'Schwab',tier:1}],custodianSource:'adv-pdf',pdfFetchedAt:'2026-06-28',structureHits:['interval fund'],competitorHits:[],websiteFetchedAt:'2026-06-28'}
const scored=computeScore(firm,{enrichment:e})
check('stale website not scored',scored.components.find(c=>c.key==='web_language')?.status==='missing')
check('stale PDF not scored',scored.components.find(c=>c.key==='custodian')?.status==='missing')

const scratch=mkdtempSync(join(tmpdir(),'ria-refresh-test-'));process.chdir(scratch);process.env.APIFY_TOKEN='test-only';process.env.APIFY_MAX_CHARGE_USD='0.25';
let requests: Array<{url:string;method:string}>=[]
globalThis.fetch=async (input:any,init:any)=>{
 const url=String(input);requests.push({url,method:init?.method??'GET'});
 let body:any
 if(url.includes('/acts/')) { check('token absent from URL',!url.includes('test-only'));check('token sent in Authorization header',init.headers.Authorization==='Bearer test-only');check('actor charge capped',url.includes('maxTotalChargeUsd=0.25'));body={data:{id:'run-1',defaultDatasetId:'dataset-1',status:'RUNNING'}} }
 else if(url.includes('/actor-runs/')) body={data:{id:'run-1',defaultDatasetId:'dataset-1',status:'SUCCEEDED',finishedAt:new Date().toISOString()}}
 else body=[{markdown:'Useful site content'}]
 return new Response(JSON.stringify(body),{status:200})
}
const receipt=await fetchHomepageViaApify(1,'demo.example')
check('actual run id persisted',receipt.runId==='run-1')
check('actual dataset id persisted',receipt.datasetId==='dataset-1')
check('acquisition timestamp persisted',isFresh(receipt.fetchedAt))
const count=requests.length;await fetchHomepageViaApify(1,'demo.example');check('fresh cache makes no paid call',requests.length===count)
mkdirSync('data/web',{recursive:true});writeFileSync('data/web/2.apify-pending.json',JSON.stringify({url:'https://second.example/',runId:'run-1'}));
const starts=requests.filter(r=>r.method==='POST').length;await fetchHomepageViaApify(2,'second.example');check('resume saved actor without new charge',requests.filter(r=>r.method==='POST').length===starts)
process.env.RIA_RADAR_OFFLINE='1';await assert.rejects(fetchHomepageViaApify(3,'offline.example'),/offline/);passed++
mkdirSync('data/raw/2026-10',{recursive:true});writeFileSync('data/raw/2026-10/roster.csv','crd,name');
const monthly={label:'2026-10',url:'https://www.sec.gov/files/current.zip'};
setOffline(true);
await assert.rejects(fetchMonthlyRoster(monthly),/offline/);passed++;
writeFileSync('data/raw/2026-10.receipt.json',JSON.stringify({url:monthly.url,fetchedAt:new Date().toISOString()}));
check('dated roster cache usable without false new acquisition',(await fetchMonthlyRoster(monthly)).endsWith('roster.csv'));
await assert.rejects(fetchMonthlyRoster({...monthly,url:'https://www.sec.gov/files/replaced.zip'}),/offline/);passed++;
writeFileSync('data/raw/2026-10.receipt.json',JSON.stringify({url:monthly.url,fetchedAt:'2000-01-01'}));
await assert.rejects(fetchMonthlyRoster(monthly),/offline/);passed++;
setOffline(false);
process.chdir(root)

const db=new PGlite()
await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; create function auth.role() returns text language sql as $$ select 'service_role'::text $$;")
for(const file of ['0001_kkr_ria_tables.sql','0002_kkr_ria_anon_read.sql','0003_kkr_ria_outcomes.sql','0004_kkr_ria_lockdown.sql','0005_kkr_ria_alerts.sql','0006_atomic_refresh.sql']) await db.exec(readFileSync(join(root,'migrations',file),'utf8'))
const generation='2026-10@2026-10-09T12:00:00.000Z'
const f=(crd:number)=>({crd,run_snapshot:generation,rank:1,score:70,data_completeness:.8,name:'Demo',components:[]})
const b=(crd:number)=>({crd,run_snapshot:generation,rank:1,grounded:true,brief:{},model:'skeleton',source_context:'Demo'})
const publish=async(fs:unknown,bs:unknown)=>db.query('select publish_kkr_ria_refresh($1,$2::jsonb,$3::jsonb)',[generation,JSON.stringify(fs),JSON.stringify(bs)])
await publish([f(1)],[b(1)]);check('atomic publication accepted',(await db.query<any>('select crd from kkr_ria_firms where is_current')).rows[0].crd===1)
await db.exec("insert into kkr_ria_outcomes(crd,outcome) values(1,'meeting')")
await publish([f(2)],[b(2)]);check('old firms removed from current list',(await db.query<any>('select crd from kkr_ria_firms where is_current')).rows[0].crd===2)
check('old firm and outcome preserved',(await db.query('select * from kkr_ria_outcomes where crd=1')).rows.length===1)
await assert.rejects(publish([f(3)],[{...b(3),name:'broken',model:null}]));passed++
check('failed brief insert rolls entire publication back',(await db.query<any>('select crd from kkr_ria_firms where is_current')).rows[0].crd===2)
await assert.rejects(publish(null,[]));passed++
await assert.rejects(publish([f(3)],[{...b(3),grounded:false}]));passed++
await assert.rejects(publish([f(3),f(3)],[]));passed++
const acl=await db.query<any>("select has_function_privilege('anon','publish_kkr_ria_refresh(text,jsonb,jsonb)','EXECUTE') allowed")
check('anonymous publisher refused',acl.rows[0].allowed===false)
await db.exec(readFileSync(join(root,'migrations/down/0006_atomic_refresh.down.sql'),'utf8'))
check('down removes added column',(await db.query("select column_name from information_schema.columns where table_name='kkr_ria_firms' and column_name='is_current'")).rows.length===0)
await db.exec(readFileSync(join(root,'migrations/0006_atomic_refresh.sql'),'utf8'));passed++
await db.close()
console.log(`${passed} checks passed`)
