'use strict';
function recPoint(ll, acc){
if (acc > 40) { rec.weak = true; return; }
rec.weak = false;
var last = rec.coords[rec.coords.length-1];
if (last && dist(last, ll) < 5) return;
var p = [r6(ll[0]), r6(ll[1])];
rec.coords.push(p); rec.line.addLatLng(p);
ls.set(K.rec, {coords:rec.coords, t0:rec.t0});
}
function updateRec(){
if (!rec) return;
var sec = (Date.now() - rec.t0) / 1000;
var s = rec.coords.length > 1 ? fmtDist(pathLen(rec.coords)) + ' · ' + fmtTime(sec) : 'Жду сигнал GPS… ' + fmtTime(sec);
if (rec.weak) s += ' · слабый сигнал';
setModeSub(s + '. Держи экран включённым.');
}
function endRecord(){
if (!rec) return;
clearInterval(rec.timer); map.removeLayer(rec.line);
var r = rec; rec = null; wake(false); setMode('idle');
return r;
}
function cancelRecord(){ endRecord(); ls.del(K.rec); toast('Запись удалена'); }
function stopRecord(){
var r = endRecord();
if (!r) return;
if (r.coords.length < 2) { ls.del(K.rec); toast('Запись слишком короткая, GPS почти не успел поймать точки'); return; }
offerSaveTrack(r.coords, Math.round((Date.now() - r.t0) / 1000), 'Сохранить запись');
}
function offerSaveTrack(coords, duration, title){
L.polyline(coords, {color:DRAFT_COLOR, weight:5, interactive:false}).addTo(tmpLayer);
map.fitBounds(L.latLngBounds(coords), {paddingTopLeft:[40,80], paddingBottomRight:[40,340], maxZoom:18});
openForm({type:'path', coords:coords, source:'gps', duration:duration, cat:'walk'}, {
title:title, cancelLabel:'Не сохранять',
onSave:function(){ ls.del(K.rec); },
onCancel:function(){
ls.del(K.rec);
toast('Запись не сохранена', {label:'Вернуть', on:function(){ ls.set(K.rec, {coords:coords}); offerSaveTrack(coords, duration, title); }});
}
});
}
function startPin(){
closeSheet();
setMode('pin');
setModebar('Новая точка', 'Нажми на карту, где её поставить.', [
{label:'Отмена', cls:'ghost', on:function(){ setMode('idle'); }},
{label:'Где я сейчас', cls:'primary', on:pinHere}
]);
}
function pinHere(){
if (lastPos && Date.now() - lastPos.t < 60000) { placePin({lat:lastPos.ll[0], lng:lastPos.ll[1]}); return; }
if (ensureWatch()) { pendingPinHere = true; toast('Определяю, где ты…'); }
}
function placePin(ll){
var p = [r6(ll.lat), r6(ll.lng)];
var marker = L.marker(p, {icon:pinIcon(CATS.place), interactive:false}).addTo(tmpLayer);
if (!map.getBounds || !map.getBounds().pad(-0.1).contains(p)) map.panTo(p);
openForm({type:'pin', latlng:p}, {
onCat:function(k){ marker.setIcon(pinIcon(cat(k))); },
onSave:function(){ setMode('idle'); }
});
}
map.on('click', function(e){
if (mode === 'draw') addDraftPoint(e.latlng);
else if (mode === 'pin') placePin(e.latlng);
else if (mode === 'idle' && sheetKind === 'details') closeSheet();
});
function onItemTap(id, latlng){
if (mode === 'draw') addDraftPoint(latlng);
else if (mode === 'pin') placePin(latlng);
else if (mode === 'idle') openDetails(id);
}
var sheetKind = null, scrimCloses = false;
function openSheet(kind, html, opt){
opt = opt || {};
if (kind !== 'form') tmpLayer.clearLayers();
if (kind !== 'details') clearSel();
sheetKind = kind; scrimCloses = !!opt.scrimCloses;
$('#sheetBody').innerHTML = html;
$('#scrim').hidden = !opt.scrim;
var s = $('#sheet'); s.hidden = false; s.scrollTop = 0;
void s.offsetHeight;
s.classList.add('open');
}
function closeSheet(){
var s = $('#sheet');
if (s.hidden) return;
var was = sheetKind;
sheetKind = null;
s.classList.remove('open');
$('#scrim').hidden = true;
tmpLayer.clearLayers();
if (was === 'details') clearSel();
if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
setTimeout(function(){ if (!sheetKind) s.hidden = true; }, 230);
}
$('#scrim').onclick = function(){ if (scrimCloses) closeSheet(); };
function chip(k, cls, extra){
return '<button class="chip ' + (cls||'') + '" data-k="' + k + '" style="--c:' + CATS[k].color + '"><span class="d"></span>' + esc(CATS[k].name) + (extra||'') + '</button>';
}
function openForm(src, o){
o = o || {};
var isNew = !src.id, isPath = src.type === 'path';
var it = Object.assign({name:'', note:'', cat: isPath ? 'shortcut' : 'place'}, src);
var sel = CATS[it.cat] ? it.cat : 'note';
var title = o.title || (isNew ? (isPath ? 'Новый путь' : 'Новая точка') : 'Изменить');
openSheet('form',
'<h2>' + esc(title) + '</h2>' +
'<label class="f" for="fName">Название</label>' +
'<input id="fName" type="text" maxlength="80" autocomplete="off" placeholder="' + (isPath ? 'Например: через парковку за магазином' : 'Например: бесплатная парковка после 18:00') + '">' +
'<div class="f">Тип</div><div class="chips" id="fCats">' + CAT_KEYS.map(function(k){ return chip(k, k === sel ? 'sel' : ''); }).join('') + '</div>' +
'<label class="f" for="fNote">Заметка</label>' +
'<textarea id="fNote" rows="3" placeholder="Когда удобно, что учесть, часы работы…"></textarea>' +
(isPath ? '<div class="meta" id="fMeta"></div>' : '') +
'<div class="row"><button class="btn ghost" id="fCancel">' + esc(o.cancelLabel || 'Отмена') + '</button><button class="btn primary" id="fSave">Сохранить</button></div>',
{scrim:true});
$('#fName').value = it.name || '';
$('#fNote').value = it.note || '';
function meta(){ if (isPath) $('#fMeta').textContent = pathMeta(it.coords, sel, it.duration); }
meta();
$('#fCats').onclick = function(e){
var b = e.target.closest('.chip'); if (!b) return;
sel = b.getAttribute('data-k');
Array.prototype.forEach.call($('#fCats').children, function(c){ c.classList.toggle('sel', c.getAttribute('data-k') === sel); });
meta();
if (o.onCat) o.onCat(sel);
};
$('#fCancel').onclick = function(){ closeSheet(); if (o.onCancel) o.onCancel(); };
$('#fSave').onclick = function(){
var now = Date.now(), name = $('#fName').value.trim();
var out = Object.assign({}, it, {name: name || (CATS[sel].name + ' · ' + fmtDate(now)), note: $('#fNote').value.trim(), cat: sel, updated: now});
if (isNew) { out.id = uid(); out.created = now; data.items.push(out); }
else { for (var i=0;i<data.items.length;i++) if (data.items[i].id === out.id) data.items[i] = out; }
if (hidden.has(sel)) { hidden.delete(sel); ls.set(K.hidden, Array.from(hidden)); }
persist(); renderAll(); closeSheet();
if (o.onSave) o.onSave(out);
toast(isNew ? 'Сохранено' : 'Изменения сохранены');
};
}
