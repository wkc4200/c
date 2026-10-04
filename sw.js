// HTML 실행기 서비스 워커
// - 실행기 화면 파일: 인터넷이 되면 최신, 안 되면 저장해 둔 것
// - run/<앱id>/... 주소: 실행기에 보관한 html·파일을 꺼내 준다 (인터넷 없이도 열림)
// 실행기 파일을 고치면 VERSION 숫자를 하나 올려 주세요.
const VERSION = 'launcher-v1';
const APPS = 'html-apps'; // 보관한 앱 파일 (VERSION 이 바뀌어도 지우지 않음)
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

const SCOPE = self.registration.scope; // 끝이 '/'
const RUN = SCOPE + 'run/';
const RUN_PATH = new URL(RUN).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== APPS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(RUN_PATH)) {
    event.respondWith(serveApp(url));
    return;
  }
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches
          .match(req, { ignoreSearch: true })
          .then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)),
      ),
  );
});

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function keyFor(rel) {
  return RUN + rel.split('/').map((seg) => encodeURIComponent(safeDecode(seg))).join('/');
}

async function serveApp(url) {
  let rel = url.pathname.slice(RUN_PATH.length);
  const cache = await caches.open(APPS);
  const tries = [];
  if (rel === '' || rel.endsWith('/')) tries.push(rel + 'index.html');
  else tries.push(rel, rel + '.html', rel + '/index.html');
  let res = null;
  for (const t of tries) {
    res = await cache.match(keyFor(t));
    if (res) break;
  }
  if (!res) return notFound(rel);
  const type = res.headers.get('Content-Type') || '';
  if (!type.startsWith('text/html')) return res;
  const html = await res.text();
  return new Response(inject(html), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function notFound(rel) {
  const name = safeDecode(rel.split('/').slice(1).join('/'));
  const body = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>파일 없음</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#141416;color:#E4E3DF;font:16px -apple-system,system-ui,sans-serif;text-align:center">
<div><p style="font-size:20px;margin:0 0 8px">이 파일이 실행기에 없습니다</p>
<p style="color:#8f8d88;margin:0 0 20px">${name.replace(/[&<>]/g, '')}</p>
<a href="${SCOPE}" style="color:#141416;background:#C9AE7C;padding:10px 18px;border-radius:10px;text-decoration:none">목록으로</a></div>`;
  return new Response(body, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// 실행하는 html 맨 앞에 넣는 작은 스크립트:
// 1) 그 앱의 서비스 워커 등록을 막는다(실행기 것과 부딪히지 않게)
// 2) 실행기 목록으로 돌아가는 떠 있는 버튼(끌어서 옮길 수 있음)
function injectedScript() {
  return `(function(){
var HOME=${JSON.stringify(SCOPE)};
try{if(navigator.serviceWorker){navigator.serviceWorker.register=function(){return Promise.reject(new Error('HTML 실행기 안에서는 앱 자체 서비스 워커를 쓰지 않습니다'));};}}catch(e){}
function mount(){
if(document.getElementById('__html_launcher__'))return;
var host=document.createElement('div');host.id='__html_launcher__';
host.style.cssText='position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;';
var root=host.attachShadow?host.attachShadow({mode:'open'}):host;
root.innerHTML='<style>'+
'.fab{position:fixed;width:40px;height:40px;margin:0;padding:0;border-radius:50%;border:1px solid rgba(201,174,124,.6);background:rgba(28,28,31,.78);color:#C9AE7C;display:flex;align-items:center;justify-content:center;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;box-shadow:0 4px 14px rgba(0,0,0,.45);opacity:.72;cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}'+
'.fab:active,.fab.drag{opacity:1}'+
'.fab svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}'+
'.menu{position:fixed;min-width:150px;padding:6px;border-radius:14px;background:#1f1f23;border:1px solid #34343a;box-shadow:0 12px 32px rgba(0,0,0,.55);font:15px -apple-system,BlinkMacSystemFont,\\'Apple SD Gothic Neo\\',system-ui,sans-serif}'+
'.menu[hidden]{display:none}'+
'.menu button{display:block;width:100%;margin:0;padding:11px 14px;border:0;border-radius:9px;background:transparent;color:#E4E3DF;font:inherit;text-align:left;cursor:pointer}'+
'.menu button:active{background:#2c2c32}'+
'.menu button.home{color:#C9AE7C;font-weight:600}'+
'</style>'+
'<button class="fab" type="button" aria-label="HTML 실행기 메뉴"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg></button>'+
'<div class="menu" hidden><button class="home" data-a="home" type="button">실행기 목록으로</button><button data-a="reload" type="button">새로고침</button><button data-a="cancel" type="button">닫기</button></div>';
(document.documentElement||document.body).appendChild(host);
var fab=root.querySelector('.fab'),menu=root.querySelector('.menu');
var KEY='__html_launcher__.fab',pos={x:1,y:.62};
try{var s=JSON.parse(localStorage.getItem(KEY));if(s&&typeof s.x==='number')pos=s;}catch(e){}
function place(){var W=window.innerWidth,H=window.innerHeight,m=8;
var x=Math.round(pos.x*(W-40-2*m))+m,y=Math.round(pos.y*(H-40-2*m))+m;
fab.style.left=x+'px';fab.style.top=y+'px';}
place();window.addEventListener('resize',place);
var start=null,moved=false;
fab.addEventListener('pointerdown',function(e){start={x:e.clientX,y:e.clientY,l:fab.offsetLeft,t:fab.offsetTop};moved=false;try{fab.setPointerCapture(e.pointerId);}catch(_){}});
fab.addEventListener('pointermove',function(e){if(!start)return;var dx=e.clientX-start.x,dy=e.clientY-start.y;
if(!moved&&Math.abs(dx)+Math.abs(dy)<8)return;moved=true;fab.classList.add('drag');menu.hidden=true;
var W=window.innerWidth,H=window.innerHeight,m=8;
var l=Math.min(W-40-m,Math.max(m,start.l+dx)),t=Math.min(H-40-m,Math.max(m,start.t+dy));
fab.style.left=l+'px';fab.style.top=t+'px';
pos={x:(l-m)/Math.max(1,W-40-2*m),y:(t-m)/Math.max(1,H-40-2*m)};});
fab.addEventListener('pointerup',function(){if(!start)return;start=null;fab.classList.remove('drag');
if(moved){pos.x=pos.x<.5?0:1;place();try{localStorage.setItem(KEY,JSON.stringify(pos));}catch(e){}return;}
if(!menu.hidden){menu.hidden=true;return;}
menu.hidden=false;var W=window.innerWidth,H=window.innerHeight,r=fab.getBoundingClientRect();
var mw=menu.offsetWidth,mh=menu.offsetHeight;
var l=r.left>W/2?r.left-mw-8:r.right+8;var t=Math.min(H-mh-8,Math.max(8,r.top+r.height/2-mh/2));
menu.style.left=Math.max(8,l)+'px';menu.style.top=t+'px';});
fab.addEventListener('pointercancel',function(){start=null;fab.classList.remove('drag');});
menu.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var a=b.getAttribute('data-a');menu.hidden=true;
if(a==='home'){try{window.dispatchEvent(new Event('pagehide'));}catch(e){}fab.style.opacity='1';setTimeout(function(){location.href=HOME;},350);}else if(a==='reload')location.reload();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();`;
}

function inject(html) {
  const tag = `<script>${injectedScript()}</script>`;
  for (const re of [/<head(\s[^>]*)?>/i, /<html(\s[^>]*)?>/i, /<!doctype[^>]*>/i]) {
    const m = html.match(re);
    if (m) {
      const at = m.index + m[0].length;
      return html.slice(0, at) + tag + html.slice(at);
    }
  }
  return tag + html;
}
