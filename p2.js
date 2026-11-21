'use strict';
function focusItem(it){
if (it.type === 'path') {
map.fitBounds(L.latLngBounds(it.coords), {paddingTopLeft:[40,80], paddingBottomRight:[40,300], maxZoom:18});
} else {
map.setView(it.latlng, Math.max(map.getZoom(), 17), {animate:false});
map.panBy([0, 130], {animate:false});
}
}
var mode = 'idle';
function setMode(m){
mode = m;
document.body.setAttribute('data-mode', m);
$('#toolbar').hidden = m !== 'idle';
$('#modebar').hidden = m === 'idle';
if (m === 'draw') map.doubleClickZoom.disable(); else map.doubleClickZoom.enable();
}
function setModebar(title, sub, actions){
$('#modeT').textContent = title;
$('#modeS').textContent = sub || '';
var box = $('#modeA'); box.innerHTML = '';
(actions || []).forEach(function(a){
var b = document.createElement('button');
b.className = 'btn ' + (a.cls || '');
b.textContent = a.label;
if (a.id) b.id = a.id;
var armed = false, timer = null;
b.onclick = function(){
if (a.confirm && !armed) {
armed = true; b.textContent = a.confirm;
timer = setTimeout(function(){ armed = false; b.textContent = a.label; }, 3000);
return;
}
clearTimeout(timer);
a.on();
};
box.appendChild(b);
});
}
function setModeSub(sub){ $('#modeS').textContent = sub; }
var draft = null;
var DRAFT_COLOR = '#f43f5e';
function startDraw(){
closeSheet();
draft = {coords:[], group:L.layerGroup().addTo(map)};
setMode('draw');
setModebar('Рисую путь', '', [
{label:'↶', cls:'sq', id:'dUndo', on:undoDraft},
{label:'Отмена', cls:'ghost', on:endDraw, confirm:'Точно отменить?'},
{label:'Готово', cls:'primary', id:'dDone', on:finishDraw}
]);
redrawDraft();
}
function redrawDraft(){
if (!draft) return;
draft.group.clearLayers();
if (draft.coords.length) {
L.polyline(draft.coords, {color:'#fff', weight:9, opacity:.8, interactive:false, lineCap:'round', lineJoin:'round'}).addTo(draft.group);
L.polyline(draft.coords, {color:DRAFT_COLOR, weight:5, interactive:false, lineCap:'round', lineJoin:'round'}).addTo(draft.group);
}
draft.coords.forEach(function(p, i){
L.circleMarker(p, {radius: i === draft.coords.length-1 ? 7 : 5, color:'#fff', weight:2, fillColor:DRAFT_COLOR, fillOpacity:1, interactive:false}).addTo(draft.group);
});
var n = draft.coords.length;
setModeSub(n === 0 ? 'Нажимай по карте вдоль пути: каждый тап — точка. Совет: включи спутник, на нём видно тропинки.'
: n === 1 ? 'Точка 1. Нажимай дальше по пути.'
: 'Точек: ' + n + ' · ' + fmtDist(pathLen(draft.coords)));
var u = $('#dUndo'), d = $('#dDone');
if (u) u.disabled = n === 0;
if (d) d.disabled = n < 2;
}
function addDraftPoint(ll){ draft.coords.push([r6(ll.lat), r6(ll.lng)]); redrawDraft(); }
function undoDraft(){ if (draft && draft.coords.length) { draft.coords.pop(); redrawDraft(); } }
function endDraw(){ if (draft) { map.removeLayer(draft.group); draft = null; } setMode('idle'); }
function finishDraw(){
if (!draft || draft.coords.length < 2) return;
openForm({type:'path', coords:draft.coords.slice(), source:'draw'}, {cancelLabel:'Назад', onSave:endDraw});
}
var watchId = null, lastPos = null, follow = false, pendingCenter = false, pendingPinHere = false, resumeWatch = false;
var meDot = null, meAcc = null, wakeLock = null, lastGeoErr = 0;
function ensureWatch(){
if (watchId != null) return true;
if (!('geolocation' in navigator)) { toast('В этом браузере нет доступа к GPS'); return false; }
watchId = navigator.geolocation.watchPosition(onPos, onGeoErr, {enableHighAccuracy:true, maximumAge:3000, timeout:30000});
return true;
}
function stopWatch(){ if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; } }
function drawMe(ll, acc){
if (!meDot) {
meAcc = L.circle(ll, {radius:acc, color:'#3b82f6', weight:1, opacity:.5, fillColor:'#3b82f6', fillOpacity:.12, interactive:false}).addTo(map);
meDot = L.circleMarker(ll, {radius:8, color:'#fff', weight:3, fillColor:'#2563eb', fillOpacity:1, interactive:false}).addTo(map);
} else {
meAcc.setLatLng(ll); meAcc.setRadius(acc); meDot.setLatLng(ll);
}
}
function onPos(p){
var ll = [p.coords.latitude, p.coords.longitude], acc = p.coords.accuracy || 0;
lastPos = {ll:ll, acc:acc, t:Date.now()};
drawMe(ll, acc);
if (pendingCenter) { pendingCenter = false; map.setView(ll, Math.max(map.getZoom(), 17)); }
else if (follow) map.panTo(ll);
if (rec) recPoint(ll, acc);
if (pendingPinHere) { pendingPinHere = false; placePin({lat:ll[0], lng:ll[1]}); }
}
function onGeoErr(err){
if (err.code === 1) {
stopWatch(); pendingCenter = false; pendingPinHere = false; follow = false; updateLocateBtn();
toast('Нет доступа к геолокации. Разреши его для этого сайта в настройках браузера.');
if (rec) setModeSub('Нет доступа к GPS. Разреши геолокацию и начни запись заново.');
return;
}
if (Date.now() - lastGeoErr > 15000) { lastGeoErr = Date.now(); toast(err.code === 3 ? 'GPS долго ищет сигнал…' : 'Не удаётся определить, где ты'); }
}
function locate(){
follow = true; updateLocateBtn();
if (lastPos && Date.now() - lastPos.t < 30000) map.setView(lastPos.ll, Math.max(map.getZoom(), 17));
else pendingCenter = true;
ensureWatch();
}
function updateLocateBtn(){ $('#btnLocate').classList.toggle('on', follow); }
map.on('dragstart', function(){ if (follow) { follow = false; updateLocateBtn(); } });
async function wake(on){
try {
if (on) {
if ('wakeLock' in navigator && !wakeLock) {
wakeLock = await navigator.wakeLock.request('screen');
wakeLock.addEventListener('release', function(){ wakeLock = null; });
}
} else if (wakeLock) { await wakeLock.release(); wakeLock = null; }
} catch(e) {}
}
document.addEventListener('visibilitychange', function(){
if (document.hidden) {
if (!rec && watchId != null) { resumeWatch = true; stopWatch(); }
} else {
if (resumeWatch) { resumeWatch = false; ensureWatch(); }
if (rec) wake(true);
}
});
var rec = null;
function startRecord(){
closeSheet();
if (!ensureWatch()) return;
rec = {coords:[], t0:Date.now(), weak:false, line:L.polyline([], {color:DRAFT_COLOR, weight:5, interactive:false, lineCap:'round', lineJoin:'round'}).addTo(map)};
rec.timer = setInterval(updateRec, 1000);
follow = true; updateLocateBtn();
if (lastPos) map.setView(lastPos.ll, Math.max(map.getZoom(), 17));
wake(true);
setMode('record');
setModebar('Запись пути', 'Жду сигнал GPS…', [
{label:'Отмена', cls:'ghost', on:cancelRecord, confirm:'Точно удалить?'},
{label:'Стоп и сохранить', cls:'danger', on:stopRecord}
]);
}
