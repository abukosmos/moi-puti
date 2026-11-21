'use strict';
var $ = function(s){ return document.querySelector(s); };
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
if (typeof L === 'undefined') {
document.body.innerHTML = '<div style="padding:40px 24px;font:16px/1.5 -apple-system,sans-serif;color:#f8fafc">Не загрузилась библиотека карты. Проверь интернет и обнови страницу.</div>';
throw new Error('Leaflet not loaded');
}
var CATS = {
shortcut: {name:'Короткий путь', color:'#16a34a', g:'»'},
walk:     {name:'Пешком',        color:'#2563eb', g:'•'},
drive:    {name:'На машине',     color:'#ea580c', g:'▲'},
parking:  {name:'Парковка',      color:'#7c3aed', g:'P'},
entrance: {name:'Вход / проход', color:'#0891b2', g:'→'},
place:    {name:'Хорошее место', color:'#ca8a04', g:'★'},
avoid:    {name:'Не ходить',     color:'#dc2626', g:'!'},
note:     {name:'Заметка',       color:'#64748b', g:'i'}
};
var CAT_KEYS = Object.keys(CATS);
function cat(k){ return CATS[k] || CATS.note; }
var K = {data:'moiputi.data.v1', view:'moiputi.view', base:'moiputi.base', hidden:'moiputi.hidden', rec:'moiputi.rec', welcomed:'moiputi.welcomed'};
var ls = {
get: function(k, d){ try{ var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } },
set: function(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } },
del: function(k){ try{ localStorage.removeItem(k); }catch(e){} }
};
var data = ls.get(K.data, null);
if (!data || !Array.isArray(data.items)) data = {version:1, items:[]};
var hidden = new Set(ls.get(K.hidden, []));
function persist(){
data.saved = Date.now();
if (!ls.set(K.data, data)) toast('Не получилось сохранить: память браузера недоступна. Сохрани копию в «Списке».');
}
function byId(id){ for (var i=0;i<data.items.length;i++) if (data.items[i].id === id) return data.items[i]; return null; }
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function r6(x){ return Math.round(x*1e6)/1e6; }
function dist(a,b){
var R=6371000, t=Math.PI/180, dLat=(b[0]-a[0])*t, dLng=(b[1]-a[1])*t;
var s=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a[0]*t)*Math.cos(b[0]*t)*Math.sin(dLng/2)*Math.sin(dLng/2);
return 2*R*Math.asin(Math.min(1,Math.sqrt(s)));
}
function pathLen(c){ var d=0; for (var i=1;i<c.length;i++) d+=dist(c[i-1],c[i]); return d; }
function fmtDist(m){
var km = m < 1000 ? Math.round(m) + ' м' : (m/1000).toFixed(m < 10000 ? 2 : 1) + ' км';
return km + ' · ' + (m/1609.344).toFixed(2) + ' mi';
}
function fmtTime(sec){
sec = Math.max(0, Math.round(sec));
var h=Math.floor(sec/3600), m=Math.floor(sec%3600/60), s=sec%60;
var p=function(n){ return (n<10?'0':'')+n; };
return h ? h+':'+p(m)+':'+p(s) : m+':'+p(s);
}
function fmtDate(t){ try{ return new Date(t).toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'}); }catch(e){ return ''; } }
function pathMeta(coords, k, duration){
var m = pathLen(coords), drive = k === 'drive';
var min = Math.max(1, Math.round(m / (drive ? 583 : 83.3)));
var s = fmtDist(m) + ' · ~' + min + ' мин ' + (drive ? 'на машине' : 'пешком');
if (duration) s += ' · запись ' + fmtTime(duration);
return s;
}
var saved = ls.get(K.view, null);
var map = L.map('map', {zoomControl:false, maxZoom:20, worldCopyJump:true})
.setView(saved ? saved.c : [41.8781,-87.6298], saved ? saved.z : 12);
L.control.scale({position:'bottomleft', metric:true, imperial:true}).addTo(map);
map.createPane('sel'); map.getPane('sel').style.zIndex = 390;
var BASES = {
map: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxNativeZoom:19, maxZoom:20, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}),
sat: L.layerGroup([
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxNativeZoom:19, maxZoom:20, zIndex:1, attribution:'Снимки &copy; Esri, Maxar'}),
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {maxNativeZoom:19, maxZoom:20, zIndex:2, opacity:.85}),
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {maxNativeZoom:19, maxZoom:20, zIndex:3})
])
};
var base = null;
function setBase(k){
if (!BASES[k]) k = 'map';
if (base && BASES[base]) map.removeLayer(BASES[base]);
BASES[k].addTo(map); base = k; ls.set(K.base, k);
$('#baseLbl').textContent = k === 'map' ? 'Спутник' : 'Схема';
}
map.on('moveend', function(){ var c = map.getCenter(); ls.set(K.view, {c:[r6(c.lat), r6(c.lng)], z:map.getZoom()}); });
var itemsLayer = L.layerGroup().addTo(map);
var tmpLayer = L.layerGroup().addTo(map);
var selLayer = null;
function pinIcon(c){
return L.divIcon({className:'pin-wrap', html:'<div class="pin" style="--c:'+c.color+'"><span>'+esc(c.g)+'</span></div>', iconSize:[30,30], iconAnchor:[15,36]});
}
function renderItem(it){
var c = cat(it.cat), layer;
if (it.type === 'path') {
var o = {bubblingMouseEvents:false, lineCap:'round', lineJoin:'round'};
layer = L.featureGroup([
L.polyline(it.coords, Object.assign({color:'#ffffff', weight:9, opacity:.85, interactive:false}, o)),
L.polyline(it.coords, Object.assign({color:c.color, weight:5, opacity:1, dashArray: it.cat === 'avoid' ? '10 9' : null, interactive:false}, o)),
L.circleMarker(it.coords[0], {radius:5, color:'#fff', weight:2, fillColor:c.color, fillOpacity:1, interactive:false}),
L.polyline(it.coords, Object.assign({color:'#000', weight:26, opacity:0}, o))
]);
} else {
layer = L.marker(it.latlng, {icon:pinIcon(c), keyboard:false});
}
layer.on('click', function(e){ onItemTap(it.id, e.latlng); });
itemsLayer.addLayer(layer);
}
function renderAll(){
itemsLayer.clearLayers();
data.items.forEach(function(it){ if (!hidden.has(it.cat)) renderItem(it); });
var n = data.items.length;
$('#count').textContent = n ? '· ' + n : '';
}
function setSel(it){
clearSel();
if (!it) return;
selLayer = it.type === 'path'
? L.polyline(it.coords, {pane:'sel', color:'#fde047', weight:16, opacity:.6, lineCap:'round', lineJoin:'round', interactive:false})
: L.circleMarker(it.latlng, {pane:'sel', radius:24, color:'#fde047', weight:3, fillColor:'#fde047', fillOpacity:.25, interactive:false});
selLayer.addTo(map);
}
function clearSel(){ if (selLayer) { map.removeLayer(selLayer); selLayer = null; } }
