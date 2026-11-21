'use strict';
$('#toolbar').onclick = function(e){
var b = e.target.closest('button'); if (!b) return;
var a = b.getAttribute('data-act');
if (a === 'draw') startDraw();
else if (a === 'record') startRecord();
else if (a === 'pin') startPin();
else if (a === 'list') openList();
};
$('#brand').onclick = function(){ if (mode === 'idle') openList(); };
$('#btnBase').onclick = function(){ setBase(base === 'map' ? 'sat' : 'map'); };
$('#btnLocate').onclick = locate;
document.addEventListener('keydown', function(e){
if (e.key !== 'Escape') return;
if (sheetKind === 'form') { $('#fCancel').click(); return; }
if (sheetKind) { if (sheetKind !== 'welcome') closeSheet(); return; }
if (mode === 'draw') endDraw(); else if (mode === 'pin') setMode('idle');
});
setBase(ls.get(K.base, 'map'));
renderAll();
setMode('idle');
if (!saved && data.items.length) {
var all = [];
data.items.forEach(function(it){ if (it.type === 'path') all = all.concat(it.coords); else all.push(it.latlng); });
map.fitBounds(L.latLngBounds(all), {padding:[50,50], maxZoom:17});
}
var pendingRec = ls.get(K.rec, null);
if (pendingRec && Array.isArray(pendingRec.coords) && pendingRec.coords.filter(okPt).length >= 2) {
offerSaveTrack(pendingRec.coords.filter(okPt), 0, 'Несохранённая запись');
} else if (!data.items.length && !ls.get(K.welcomed, false)) {
showWelcome();
}
if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist().catch(function(){}); } catch(e) {} }
window.__moiPuti = {data:function(){ return data; }, map:map};
