'use strict';
function toGPX(items){
var x = function(s){ return esc(s); };
var out = '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Moi puti" xmlns="http://www.topografix.com/GPX/1/1">\n';
items.forEach(function(it){
if (it.type === 'pin') out += '<wpt lat="' + it.latlng[0] + '" lon="' + it.latlng[1] + '"><name>' + x(it.name) + '</name>' + (it.note ? '<desc>' + x(it.note) + '</desc>' : '') + '<type>' + x(cat(it.cat).name) + '</type></wpt>\n';
});
items.forEach(function(it){
if (it.type !== 'path') return;
out += '<trk><name>' + x(it.name) + '</name>' + (it.note ? '<desc>' + x(it.note) + '</desc>' : '') + '<type>' + x(cat(it.cat).name) + '</type><trkseg>';
it.coords.forEach(function(c){ out += '<trkpt lat="' + c[0] + '" lon="' + c[1] + '"/>'; });
out += '</trkseg></trk>\n';
});
return out + '</gpx>\n';
}
function catFromName(n){ for (var i=0;i<CAT_KEYS.length;i++) if (CATS[CAT_KEYS[i]].name === n) return CAT_KEYS[i]; return null; }
function childText(el, tag){
for (var i=0;i<el.children.length;i++) if (el.children[i].localName === tag) return el.children[i].textContent.trim();
return '';
}
function parseGPX(text){
var doc = new DOMParser().parseFromString(text, 'application/xml');
if (doc.getElementsByTagName('parsererror').length) throw new Error('bad gpx');
var out = [], now = Date.now();
var pt = function(e){ return [r6(parseFloat(e.getAttribute('lat'))), r6(parseFloat(e.getAttribute('lon')))]; };
Array.prototype.forEach.call(doc.getElementsByTagName('wpt'), function(w){
out.push({type:'pin', latlng:pt(w), name:childText(w,'name') || 'Точка', note:childText(w,'desc') || childText(w,'cmt'), cat:catFromName(childText(w,'type')) || 'place', created:now, updated:now});
});
var tracks = function(tag, ptTag){
Array.prototype.forEach.call(doc.getElementsByTagName(tag), function(t){
var pts = [];
Array.prototype.forEach.call(t.getElementsByTagName(ptTag), function(p){
var q = pt(p), last = pts[pts.length-1];
if (!last || dist(last, q) >= 3) pts.push(q);
});
if (pts.length >= 2) out.push({type:'path', coords:pts, source:'gpx', name:childText(t,'name') || 'Путь из GPX', note:childText(t,'desc') || childText(t,'cmt'), cat:catFromName(childText(t,'type')) || 'walk', created:now, updated:now});
});
};
tracks('trk', 'trkpt'); tracks('rte', 'rtept');
return out;
}
function okNum(n){ return typeof n === 'number' && isFinite(n); }
function okPt(p){ return Array.isArray(p) && p.length >= 2 && okNum(p[0]) && okNum(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180; }
function normalize(it){
if (!it || typeof it !== 'object') return null;
var base = {id: typeof it.id === 'string' && it.id ? it.id : uid(), name: String(it.name || '').slice(0,120), note: String(it.note || ''), cat: CATS[it.cat] ? it.cat : 'note', created: okNum(it.created) ? it.created : Date.now(), updated: okNum(it.updated) ? it.updated : Date.now()};
if (it.type === 'path' && Array.isArray(it.coords)) {
var c = it.coords.filter(okPt).map(function(p){ return [r6(p[0]), r6(p[1])]; });
if (c.length < 2) return null;
return Object.assign(base, {type:'path', coords:c, source: it.source === 'gps' || it.source === 'gpx' ? it.source : 'draw', duration: okNum(it.duration) ? it.duration : undefined});
}
if (it.type === 'pin' && okPt(it.latlng)) return Object.assign(base, {type:'pin', latlng:[r6(it.latlng[0]), r6(it.latlng[1])]});
return null;
}
$('#fileIn').onchange = function(){
var f = this.files && this.files[0]; var input = this;
if (!f) return;
var rd = new FileReader();
rd.onload = function(){
var text = String(rd.result || ''), items;
try {
if (/\.gpx$/i.test(f.name) || /^\s*</.test(text)) items = parseGPX(text);
else { var d = JSON.parse(text); items = Array.isArray(d) ? d : (d && d.items) || []; }
} catch(e) { toast('Не получилось прочитать файл. Нужен .json из «Сохранить копию» или .gpx'); input.value = ''; return; }
var ids = new Set(data.items.map(function(i){ return i.id; })), added = 0, skipped = 0;
items.forEach(function(raw){
var it = normalize(raw);
if (!it) { skipped++; return; }
if (ids.has(it.id)) { skipped++; return; }
ids.add(it.id); data.items.push(it); added++;
});
persist(); renderAll(); listCats(); listItems();
toast('Добавлено: ' + added + (skipped ? ' · пропущено: ' + skipped + ' (уже есть или пустые)' : ''));
input.value = '';
};
rd.onerror = function(){ toast('Не получилось открыть файл'); input.value = ''; };
rd.readAsText(f);
};
async function shareOrDownload(name, text, type){
try {
var file = new File([text], name, {type:type});
if (navigator.canShare && navigator.canShare({files:[file]}) && matchMedia('(pointer:coarse)').matches) {
await navigator.share({files:[file], title:name});
return;
}
} catch(e) { if (e && e.name === 'AbortError') return; }
try {
var url = URL.createObjectURL(new Blob([text], {type:type}));
var a = document.createElement('a'); a.href = url; a.download = name;
document.body.appendChild(a); a.click(); a.remove();
setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
toast('Файл сохранён: ' + name);
} catch(e) { toast('Не получилось сохранить файл'); }
}
var toastTimer = null;
function toast(msg, action){
var t = $('#toast'); t.innerHTML = '';
var s = document.createElement('span'); s.textContent = msg; t.appendChild(s);
if (action) {
var b = document.createElement('button'); b.textContent = action.label;
b.onclick = function(){ hideToast(); action.on(); };
t.appendChild(b);
}
t.classList.add('show');
clearTimeout(toastTimer);
toastTimer = setTimeout(hideToast, action ? 6000 : 2800);
}
function hideToast(){ $('#toast').classList.remove('show'); }
function showWelcome(){
openSheet('welcome',
'<h2>Мои пути</h2>' +
'<p class="lead">Твоя карта коротких путей и полезных мест, которых нет в обычных картах.</p>' +
'<div class="w-item"><b>Путь</b>: ставишь точки пальцем. Проход через парковку, двор, калитку.</div>' +
'<div class="w-item"><b>Запись</b>: просто идёшь или едешь, GPS сам рисует путь.</div>' +
'<div class="w-item"><b>Точка</b>: парковка, вход, хорошее место или куда лучше не ходить.</div>' +
'<p class="hint">Совет: включи спутник кнопкой справа вверху. На снимке видны тропинки и проезды, которых нет на схеме.</p>' +
'<div class="row"><button class="btn primary" id="wGo">Начать</button></div>',
{scrim:true});
$('#wGo').onclick = function(){ ls.set(K.welcomed, true); closeSheet(); locate(); };
}
