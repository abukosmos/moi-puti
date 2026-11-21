'use strict';
function openDetails(id){
var it = byId(id); if (!it) return;
var c = cat(it.cat), isPath = it.type === 'path';
var dest = isPath ? it.coords[0] : it.latlng;
var drive = it.cat === 'drive';
var g = 'https://www.google.com/maps/dir/?api=1&destination=' + dest[0] + ',' + dest[1] + '&travelmode=' + (drive ? 'driving' : 'walking');
var a = 'https://maps.apple.com/?daddr=' + dest[0] + ',' + dest[1] + '&dirflg=' + (drive ? 'd' : 'w');
var go = isPath ? 'Как добраться до начала пути' : 'Как добраться сюда';
setSel(it);
openSheet('details',
'<div class="d-top"><span class="badge"><span class="d" style="--c:' + c.color + '"></span>' + esc(c.name) + '</span><button class="x" id="dClose" aria-label="Закрыть">×</button></div>' +
'<h2>' + esc(it.name) + '</h2>' +
(it.note ? '<p class="note">' + esc(it.note) + '</p>' : '') +
'<div class="meta">' + (isPath ? esc(pathMeta(it.coords, it.cat, it.duration)) + '<br>' + (it.source === 'gps' ? 'Записан по GPS' : it.source === 'gpx' ? 'Из GPX-файла' : 'Нарисован') + ' · ' : '') + esc(fmtDate(it.created || it.updated)) + '</div>' +
'<div class="acts">' +
'<div class="go-l">' + go + '</div>' +
'<a class="btn" href="' + g + '" target="_blank" rel="noopener">Google Maps</a>' +
'<a class="btn" href="' + a + '" target="_blank" rel="noopener">Apple Maps</a>' +
'<button class="btn" id="dEdit">Изменить</button>' +
(isPath ? '<button class="btn" id="dGpx">Скачать GPX</button>' : '<button class="btn" id="dCopy">Координаты</button>') +
'<button class="btn ghost red wide" id="dDel">Удалить</button>' +
'</div>');
$('#dClose').onclick = closeSheet;
$('#dEdit').onclick = function(){ clearSel(); openForm(it); };
if (isPath) $('#dGpx').onclick = function(){ shareOrDownload(fileSafe(it.name) + '.gpx', toGPX([it]), 'application/gpx+xml'); };
else $('#dCopy').onclick = function(){
var t = it.latlng[0] + ', ' + it.latlng[1];
if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function(){ toast('Скопировано: ' + t); }, function(){ toast(t); });
else toast(t);
};
$('#dDel').onclick = function(){
var idx = data.items.indexOf(it);
if (idx < 0) return;
data.items.splice(idx, 1); persist(); renderAll(); closeSheet();
toast('Удалено: ' + it.name, {label:'Вернуть', on:function(){ data.items.splice(Math.min(idx, data.items.length), 0, it); persist(); renderAll(); }});
};
}
function openList(){
openSheet('list',
'<div class="d-top"><h2>Мои пути и точки</h2><button class="x" id="lClose" aria-label="Закрыть">×</button></div>' +
'<input id="lQ" type="search" placeholder="Поиск по названию и заметкам" autocomplete="off">' +
'<div class="f">Показывать на карте (нажми, чтобы скрыть)</div><div class="chips" id="lCats"></div>' +
'<div id="lItems"></div>' +
'<div class="f">Резервная копия</div>' +
'<div class="row wrap" style="margin-top:0">' +
'<button class="btn" id="bExp">Сохранить копию</button>' +
'<button class="btn" id="bImp">Загрузить файл</button>' +
'<button class="btn" id="bGpx">Всё в GPX</button>' +
'</div>' +
'<p class="hint">Всё хранится только в этом браузере на этом устройстве и никуда не отправляется. Время от времени сохраняй копию: если очистить данные браузера, без неё всё пропадёт. Копию можно загрузить и на другом устройстве. GPX открывают Organic Maps, OsmAnd и Gaia GPS.</p>',
{scrim:true, scrimCloses:true});
$('#lClose').onclick = closeSheet;
$('#lQ').oninput = listItems;
$('#lCats').onclick = function(e){
var b = e.target.closest('.chip'); if (!b) return;
var k = b.getAttribute('data-k');
if (hidden.has(k)) hidden.delete(k); else hidden.add(k);
ls.set(K.hidden, Array.from(hidden));
renderAll(); listCats(); listItems();
};
$('#bExp').onclick = function(){ shareOrDownload('moi-puti-' + new Date().toISOString().slice(0,10) + '.json', JSON.stringify(data), 'application/json'); };
$('#bImp').onclick = function(){ $('#fileIn').click(); };
$('#bGpx').onclick = function(){
if (!data.items.length) { toast('Пока нечего сохранять'); return; }
shareOrDownload('moi-puti-' + new Date().toISOString().slice(0,10) + '.gpx', toGPX(data.items), 'application/gpx+xml');
};
listCats(); listItems();
}
function listCats(){
var box = $('#lCats'); if (!box) return;
var counts = {}; data.items.forEach(function(it){ counts[it.cat] = (counts[it.cat]||0) + 1; });
box.innerHTML = CAT_KEYS.map(function(k){ return chip(k, hidden.has(k) ? 'off' : '', ' <small>' + (counts[k]||0) + '</small>'); }).join('');
}
function listItems(){
var box = $('#lItems'); if (!box) return;
var q = ($('#lQ').value || '').trim().toLowerCase();
var list = data.items.filter(function(it){ return !q || (it.name + ' ' + (it.note||'') + ' ' + cat(it.cat).name).toLowerCase().indexOf(q) >= 0; })
.sort(function(a,b){ return (b.updated||0) - (a.updated||0); });
if (!data.items.length) { box.innerHTML = '<div class="empty">Пока пусто.<br>Нарисуй первый путь кнопкой «Путь» или поставь «Точку».</div>'; return; }
if (!list.length) { box.innerHTML = '<div class="empty">Ничего не нашлось</div>'; return; }
box.innerHTML = list.map(function(it){
var c = cat(it.cat);
var sub = c.name + (it.type === 'path' ? ' · ' + fmtDist(pathLen(it.coords)).split(' · ')[0] : '') + (hidden.has(it.cat) ? ' · скрыто' : '');
return '<button class="li' + (hidden.has(it.cat) ? ' dim' : '') + '" data-id="' + esc(it.id) + '" style="--c:' + c.color + '"><span class="bar"></span><span class="m"><b>' + esc(it.name) + '</b><small>' + esc(sub) + '</small></span></button>';
}).join('');
box.onclick = function(e){
var b = e.target.closest('.li'); if (!b) return;
var it = byId(b.getAttribute('data-id')); if (!it) return;
if (hidden.has(it.cat)) { hidden.delete(it.cat); ls.set(K.hidden, Array.from(hidden)); renderAll(); }
closeSheet();
follow = false; updateLocateBtn();
focusItem(it);
setTimeout(function(){ openDetails(it.id); }, 240);
};
}
function fileSafe(s){ return (String(s||'put').replace(/[\\/:*?"<>|]+/g,' ').trim().slice(0,60)) || 'put'; }
