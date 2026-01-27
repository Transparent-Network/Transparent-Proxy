// 🔥 GODMODE v12 - 世界最強コンパクト版
const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const app = express();
const PROFS = [
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', vp: {width:2560,height:1440}, gpu: 'NVIDIA RTX 3080', cores: 16, mem: 32 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15', vp: {width:1728,height:1117}, gpu: 'Apple M2', cores: 10, mem: 16 }
];

class Pool {
  constructor() { this.bs = []; this.av = []; }
  async init() {
    for (let i = 0; i < 4; i++) {
      const p = PROFS[i % 2];
      const b = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', `--window-size=${p.vp.width},${p.vp.height}`, '--disable-web-security'],
        defaultViewport: p.vp
      });
      this.bs.push({b,p}); this.av.push({b,p});
    }
  }
  async get() { while(!this.av.length) await new Promise(r=>setTimeout(r,50)); return this.av.pop(); }
  put(o) { this.av.push(o); }
  async cleanup() { for(const {b} of this.bs) await b.close(); }
}
const pool = new Pool();

async function inject(pg, p) {
  await pg.evaluateOnNewDocument((pr) => {
    Object.defineProperty(navigator,'webdriver',{get:()=>undefined});
    Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>pr.cores});
    Object.defineProperty(navigator,'deviceMemory',{get:()=>pr.mem});
    window.chrome={runtime:{},loadTimes:()=>({requestTime:Date.now()/1000}),csi:()=>({pageT:Date.now()})};
    
    const s=0.00001;
    const og=CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData=function(...a){
      const d=og.apply(this,a);
      for(let i=0;i<d.data.length;i++)d.data[i]+=(Math.random()-0.5)*s*255;
      return d;
    };
    
    const gp=WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter=function(p){
      if(p===37446)return pr.gpu;
      return gp.call(this,p);
    };
  }, p);
}

function rnd(n,x){return Math.floor(n+Math.random()*(x-n));}

async function mouse(pg,x,y){
  const c=await pg.evaluate(()=>({x:window._x||500,y:window._y||500}));
  const st=80,dur=rnd(1500,3500);
  const c1x=c.x+(x-c.x)*0.25+rnd(-100,100),c1y=c.y+(y-c.y)*0.25+rnd(-100,100);
  const c2x=c.x+(x-c.x)*0.75+rnd(-100,100),c2y=c.y+(y-c.y)*0.75+rnd(-100,100);
  
  for(let i=0;i<=st;i++){
    const t=i/st;
    const e=t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
    const mt=1-e;
    const bx=mt*mt*mt*c.x+3*mt*mt*e*c1x+3*mt*e*e*c2x+e*e*e*x;
    const by=mt*mt*mt*c.y+3*mt*mt*e*c1y+3*mt*e*e*c2y+e*e*e*y;
    await pg.mouse.move(bx+rnd(-3,3),by+rnd(-3,3));
    await pg.waitForTimeout(dur/st);
  }
  await pg.evaluate((mx,my)=>{window._x=mx;window._y=my;},x,y);
}

async function scroll(pg){
  for(let i=0;i<rnd(3,7);i++){
    const amt=rnd(200,600),stp=rnd(15,40);
    for(let j=0;j<stp;j++){
      await pg.evaluate((s)=>scrollBy(0,s),amt/stp);
      await pg.waitForTimeout(rnd(10,30));
    }
    await pg.waitForTimeout(rnd(800,2500));
  }
}

async function human(pg){
  await pg.waitForTimeout(rnd(1500,4000));
  for(let i=0;i<rnd(5,12);i++){
    await mouse(pg,rnd(100,2400),rnd(100,1300));
    await pg.waitForTimeout(rnd(200,900));
  }
  await scroll(pg);
  await pg.waitForTimeout(rnd(3000,8000));
}

app.get('/test/:url', async (req,res)=>{
  let o=null,pg=null;
  try{
    const url=Buffer.from(req.params.url,'base64').toString();
    o=await pool.get();
    const {b,p}=o;
    
    pg=await b.newPage();
    await pg.setUserAgent(p.ua);
    await pg.setExtraHTTPHeaders({'Accept':'text/html,*/*;q=0.8','Sec-Fetch-Dest':'document','Sec-Fetch-Mode':'navigate','Sec-Fetch-Site':'none','Sec-Fetch-User':'?1'});
    
    await inject(pg,p);
    await pg.goto(url,{waitUntil:'networkidle2',timeout:90000});
    await human(pg);
    
    const html=await pg.content();
    res.send(html);
  }catch(e){
    res.status(500).json({error:e.message});
  }finally{
    if(pg)await pg.close();
    if(o)pool.put(o);
  }
});

app.get('/health',(req,res)=>res.json({status:'GODMODE v12',features:['Stealth','Multi-Profile','Canvas','WebGL','Bezier','Human']}));

process.on('SIGINT',async()=>{await pool.cleanup();process.exit(0);});

const PORT=process.env.PORT||10000;
app.listen(PORT,async()=>{
  console.log('🔥 GODMODE v12');
  await pool.init();
  console.log('✅ Ready');
});

module.exports=app;
