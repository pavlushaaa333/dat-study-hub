
'use strict';
const EXAMS = window.STUDY_EXAMS;
let currentSubject="all";
let currentExam=null, QUESTIONS=[],IDS=[],QMAP={},TOTAL=0,STORAGE_KEY='';
const el=id=>document.getElementById(id);
const LETTERS=['A','B','C','D','E','F'];
let state={responses:{},bookmarks:[],order:[],mistakes:{}};
let mode='all',topic='all',search='',current=null,draft=[],visible=[],imageOpen=false,imageZoomed=false,linger=false,toastTimer=null,reviewFresh=false;
function loadStoredState(examId){
 const info=EXAMS[examId], ids=info.questions.map(q=>q.id);
 let empty={responses:{},bookmarks:[],order:[...ids],mistakes:{}};
 for(const key of [info.storageKey, info.legacyKey]){
   try{const raw=localStorage.getItem(key);if(!raw)continue;const s=JSON.parse(raw);
       if(s&&typeof s.responses==='object'&&Array.isArray(s.order)&&Array.isArray(s.bookmarks)){{const v={...empty,...s,order:[...new Set([...s.order.filter(n=>ids.includes(n)),...ids])]};v.mistakes=v.mistakes&&typeof v.mistakes==="object"?v.mistakes:{};for(const [k,a] of Object.entries(v.responses)){if(a&&!a.ok&&Array.isArray(a.selected)&&a.selected.length&&!Array.isArray(v.mistakes[k]))v.mistakes[k]=[{selected:[...a.selected],source:"Ôn tập cũ",at:a.at||Date.now()}];}return v;}}}
   catch(e){}
 }
 return empty;
}
function updateLanding(){
 for(const [id,info] of Object.entries(EXAMS)){
   const s=loadState(id),total=info.questions.length,entries=Object.values(s.responses||{}),done=entries.length,good=Object.entries(s.responses||{}).filter(([n,v])=>v.ok&&info.questions.find(q=>q.id===Number(n))?.gradable!==false).length;
   el('homeProgress_'+id).style.width=(done/total*100)+'%';
   el('homeStats_'+id).textContent=`${done}/${total} đã làm · ${good} đúng · ${Math.round(done/total*100)}% hoàn thành`;

 }
 const counts=Object.entries(EXAMS).map(([id,info])=>({title:info.title,count:wrongPracticePending(id).length})),total=counts.reduce((n,r)=>n+r.count,0);
 el('homeWrongStats').textContent=total+' câu cần ôn · '+counts.map(r=>r.title+': '+r.count).join(' · ');
 el('homeWrongAll').textContent='Ôn tất cả '+total+' câu sai →';el('homeWrongAll').disabled=total===0;
}
function populateTopics(){
 const select=el('topic');select.innerHTML='<option value="all">Tất cả chủ đề</option>';
 [...new Set(QUESTIONS.map(q=>q.topic))].forEach(t=>{const opt=document.createElement('option');opt.value=t;opt.textContent=t;select.appendChild(opt);});
}
function showHome(){
 el('wrongPractice').hidden=true;el('mockScreen').hidden=true;
 closeDrawer();document.body.classList.add("home-view");
 if(currentExam){save();}
 currentExam=null;el('landing').hidden=false;el('appScreen').hidden=true;
 el('homeButton').hidden=true;el('topStat').hidden=true;el('appSubtitle').textContent='Chọn một đề để bắt đầu ôn tập';
 document.title='DTA301 · 180 câu FE có giải thích';
 updateLanding();window.scrollTo({top:0,behavior:'instant'});
}
function openExam(examId){resetKeywordHints();
 el('wrongPractice').hidden=true;
 closeDrawer();document.body.classList.remove("home-view");
 if(!practiceInfo(examId))return;
 if(currentExam){save();}
 const info=practiceInfo(examId);currentExam=examId;QUESTIONS=info.questions;IDS=QUESTIONS.map(q=>q.id);
 QMAP=Object.fromEntries(QUESTIONS.map(q=>[q.id,q]));TOTAL=QUESTIONS.length;STORAGE_KEY=info.storageKey;
 state=loadState(examId);reviewFresh=false;mode='all';topic='all';search='';current=state.order.find(n=>!state.responses[n])||IDS[0];draft=[];visible=[];imageOpen=false;imageZoomed=false;linger=false;
 imageOpen=!!QMAP[current]?.requiresImage;populateTopics();el('topic').value='all';el('search').value='';updateModes();
 el('landing').hidden=true;el('appScreen').hidden=false;el('homeButton').hidden=false;el('topStat').hidden=false;
 collectionPracticeLabels();
 document.title=info.title.startsWith(info.subject.toUpperCase()+' · ')?info.title:info.subject.toUpperCase()+' · '+info.title;
 el('currentExamNotice').textContent=info.notice;
 const firstMode=document.querySelector('.mode[data-mode="all"]');firstMode.textContent='Tất cả '+TOTAL+' câu';
 const cardTitle=document.querySelector('.welcome h2');cardTitle.textContent=info.title;
 applyFilters(current);window.scrollTo({top:0,behavior:'instant'});
}
const escapeHTML=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
function save(){if(COLLECTIONS[currentExam]){try{saveCollection()}catch(e){toast('Không thể lưu tiến độ trên trình duyệt này.')}return;}try{savePracticeState(currentExam,state);}catch(e){toast('Không thể lưu tiến độ trên trình duyệt này.');}}
function toast(msg){let t=el('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2600)}
function optionReasons(q){if(!q.why?.length)return studyNoteHTML(q);return studyNoteHTML(q)+ '<div class="option-reasons"><h4>Vì sao chọn / không chọn từng phương án?</h4>'+q.options.map((o,i)=>'<div class="reason '+(q.correct.includes(i)?'chosen':'')+'"><b>'+LETTERS[i]+'. '+escapeHTML(o)+'</b><p>'+escapeHTML(q.why?.[i]||'')+'</p></div>').join('')+'</div>';}
function isCorrect(q,a){if(q.gradable===false)return true;let s=[...a].sort((x,y)=>x-y),t=[...q.correct].sort((x,y)=>x-y);return s.length===t.length&&s.every((v,i)=>v===t[i]);}
function passed(n){const x=state.responses[n];return !!(x&&x.ok);}
function showMode(){return mode==='all'?'Tất cả':mode==='wrong'?'Câu sai':mode==='unanswered'?'Chưa làm':'Đánh dấu';}
function filtered(){return state.order.filter(n=>{
 const q=QMAP[n],a=state.responses[n];if(!q)return false;
 if(mode==='wrong'&&(a&&a.ok||(!a&&!(state.mistakes&&Array.isArray(state.mistakes[n])&&state.mistakes[n].length))))return false;
 if(mode==='unanswered'&&a)return false;
 if(mode==='bookmarked'&&!state.bookmarks.includes(n))return false;
 if(topic!=='all'&&q.topic!==topic)return false;
 if(search){let s=(q.stem+' '+q.options.join(' ')+' '+q.topic).toLocaleLowerCase();if(!s.includes(search.toLocaleLowerCase()))return false;}
 return true;
});}
function metrics(){let entries=Object.entries(state.responses).filter(([n])=>QMAP[n]).map(([,v])=>v);let done=entries.length,correct=Object.entries(state.responses).filter(([n,v])=>v.ok&&QMAP[n]&&QMAP[n].gradable!==false).length,wrong=entries.filter(v=>!v.ok).length;el('done').textContent=done;el('correct').textContent=correct;el('wrong').textContent=wrong;el('progressFill').style.width=(done/TOTAL*100)+'%';el('progressText').textContent=Math.round(done/TOTAL*100)+'% hoàn thành · '+correct+' câu đúng / '+done+' đã trả lời';el('status-count').textContent=done+'/'+TOTAL;el('mobileStatsLabel').textContent=done+' đã làm · '+correct+' đúng';el('mobileProgressFill').style.width=(done/TOTAL*100)+'%';}
function updateNumbers(){let container=el('numbers');container.innerHTML='';for(let n of IDS){
 let x=state.responses[n],b=document.createElement('button');b.type='button';b.className='num'+(x?(x.ok?' correct':' wrong'):'')+(n===current?' current':'')+(state.bookmarks.includes(n)?' bookmarked':'');b.textContent=n;b.title='Đi đến câu '+n;b.setAttribute('aria-label','Câu '+n+(x?(x.ok?', đã đúng':', đã sai'):', chưa làm'));b.onclick=()=>{if(!visible.includes(n)){mode='all';topic='all';search='';el('topic').value='all';el('search').value='';updateModes();visible=filtered();}setQuestion(n);closeDrawer();if(window.innerWidth<=760)window.scrollTo({top:0,behavior:'smooth'});};container.appendChild(b);
}}
function setQuestion(n){if(!QMAP[n])return;current=n;draft=[];imageOpen=!!QMAP[n]?.requiresImage;imageZoomed=false;linger=false;reviewFresh=mode==='wrong';render();}
function updateModes(){document.querySelectorAll('.mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));}
function applyFilters(preferred){linger=false;reviewFresh=mode==='wrong';draft=[];visible=filtered();if(visible.length){if(!visible.includes(preferred||current))current=visible[0];else current=preferred||current;}render();}
function render(){metrics();visible=filtered();if(linger&&!visible.includes(current))visible.unshift(current);updateNumbers();const noQuestions=visible.length===0;el('empty').hidden=!noQuestions;el('questionCard').hidden=noQuestions;el('qPosition').textContent=noQuestions?'0 câu':`Câu ${visible.indexOf(current)+1} / ${visible.length}`;el('mobileQuestionLabel').textContent=noQuestions?'Không có câu phù hợp':`Câu ${visible.indexOf(current)+1} / ${visible.length}`;el('mobilePrev').disabled=noQuestions||visible.indexOf(current)<=0;el('mobileNext').disabled=noQuestions||visible.indexOf(current)>=visible.length-1;if(noQuestions)return;
 if(!visible.includes(current))current=visible[0];
 const q=QMAP[current],a=q.gradable===false?{selected:[],ok:true}:((mode==='wrong'&&reviewFresh)?null:state.responses[current]);el('qName').textContent='CÂU HỎI '+String(current).padStart(2,'0')+(q.multiple?' · MULTICHOICE':' · SINGLECHOICE');el('qTopic').textContent=q.topic+(q.sourceLabel?' · '+q.sourceLabel:'');renderKeywordHint('prompt','keywordHint',q,currentExam+':'+q.id);el('multiNotice').textContent=q.gradable===false?'Câu cần làm rõ: đọc phân tích, không tính điểm.':q.multiple?'Có thể chọn nhiều phương án. Bấm nộp để chấm sau khi chọn xong.':'Chọn một phương án; hệ thống sẽ chấm ngay.';
 el('bookmark').textContent=state.bookmarks.includes(current)?'★':'☆';el('bookmark').classList.toggle('on',state.bookmarks.includes(current));
 let ob=el('options');ob.innerHTML='';let selected=a?a.selected:draft;
 q.options.forEach((opt,i)=>{let b=document.createElement('button');b.type='button';b.className='answer-opt';let sel=selected.includes(i),good=a&&q.correct.includes(i),bad=a&&sel&&!q.correct.includes(i);
 if(sel)b.classList.add('sel');if(good)b.classList.add('good');if(bad)b.classList.add('bad');b.disabled=!!a;b.setAttribute('aria-pressed',String(!!sel));b.innerHTML=`<span class="letter">${LETTERS[i]}</span><span class="opt-text">${escapeHTML(opt)}</span>${a&&good?'<span aria-label="Đáp án đúng">✓</span>':a&&bad?'<span aria-label="Bạn chọn sai">✕</span>':''}`;
 b.onclick=()=>{if(a)return;if(q.multiple){draft=draft.includes(i)?draft.filter(x=>x!==i):[...draft,i];render();}else grade([i]);};ob.appendChild(b);});
 showMistakeHistory(q);el('multiControls').hidden=!(q.multiple&&!a);el('submitMulti').disabled=draft.length===0;
 const fb=el('feedback');fb.className='feedback';if(a){fb.classList.add('show');if(!a.ok)fb.classList.add('wrong');el('feedbackTitle').textContent=a.ok?'✓ Chính xác! Bạn đã chọn đúng.':'✕ Chưa đúng — cùng xem lý do nhé.';el('correctLines').innerHTML='<b>Đáp án tham khảo:</b> <strong>'+q.correct.map(i=>LETTERS[i]+'. '+escapeHTML(q.options[i])).join('<br/>')+'</strong>';el('explanation').innerHTML=escapeHTML(q.detail)+optionReasons(q);if(q.gradable===false){el('feedbackTitle').textContent='ⓘ Câu cần làm rõ · Không tính điểm';el('correctLines').textContent=q.correct.length?'Các phương án được tài liệu nêu: '+q.correct.map(i=>LETTERS[i]+'. '+q.options[i]).join(' | '):'Chưa đủ căn cứ trong nguồn để chốt đáp án. Xem phân tích dưới đây.';}el('memory').textContent=q.trick;el('caution').hidden=!q.caution;el('caution').textContent=q.caution?'⚠ Lưu ý về đề: '+q.caution:'';el('source').textContent='Đối chiếu nội dung: '+q.reference+' · Đáp án tham khảo, không phải answer key chính thức.';}
 el('questionCounter').textContent='Đang ôn: '+showMode()+' · Câu số '+current;el('prev').disabled=visible.indexOf(current)<=0;el('next').disabled=visible.indexOf(current)>=visible.length-1;
 el('imageWrap').classList.toggle('show',imageOpen);el('imageWrap').classList.toggle('zoomed',imageZoomed);el('zoomImage').textContent=imageZoomed?'↙ Thu nhỏ ảnh':'🔍 Phóng to ảnh';el('imageToggle').textContent=(imageOpen?'▾ Ẩn ':'▸ Xem ')+(q.imageLabel||'ảnh chụp đề gốc');el('imageToggle').setAttribute('aria-expanded',String(imageOpen));el('imageToggle').hidden=!q.image;el('imageWrap').hidden=!q.image;el('questionImage').alt=q.imageLabel||'Ảnh đề gốc';el('imageWrap').querySelector('em').hidden=!!q.imageLabel;const imageKey=currentExam+':'+current;if(imageOpen&&q.image){if(el('questionImage').dataset.q!==imageKey){el('questionImage').src=q.image;el('questionImage').dataset.q=imageKey}}else{el('questionImage').removeAttribute('src');el('questionImage').dataset.q='';}
}
function recordMistake(target,id,selected,source){
 if(!Array.isArray(selected)||!selected.length)return;
 if(!target.mistakes||typeof target.mistakes!=="object")target.mistakes={};
 const key=String(id),past=Array.isArray(target.mistakes[key])?target.mistakes[key]:[];
 past.push({selected:[...selected],source,at:Date.now()});target.mistakes[key]=past;
 if(past.length>=2&&!target.bookmarks.includes(Number(id)))target.bookmarks.push(Number(id));
}
function showMistakeHistory(q){
 const box=el("mistakeHistory");
 const entries=state.mistakes&&Array.isArray(state.mistakes[q.id])?state.mistakes[q.id]:[];
 box.hidden=!(mode==="bookmarked"&&entries.length);if(box.hidden)return;
 box.innerHTML="<b>★ Đáp án đã chọn sai ("+entries.length+" lần)</b>"+entries.map((x,i)=>"<p style=\"margin:7px 0\">Lần "+(i+1)+": <b>"+escapeHTML(x.selected.map(j=>LETTERS[j]+". "+q.options[j]).join(" · "))+"</b> <small>"+escapeHTML(x.source||"Ôn tập")+"</small></p>").join("");
}
function grade(selected){let q=QMAP[current];if(state.responses[current]&&!(mode==='wrong'&&reviewFresh))return;let ok=isCorrect(q,selected);if(!ok)recordMistake(state,q.id,selected,'Ôn tập');state.responses[current]={selected:[...selected],ok,at:Date.now()};reviewFresh=false;linger=true;save();render();const card=el('questionCard');if(window.innerWidth<761){setTimeout(()=>el('feedback').scrollIntoView({block:'start',behavior:'smooth'}),90);} }
function go(dir){if(!visible.length)return;let idx=visible.indexOf(current)+dir;if(idx<0||idx>=visible.length)return;setQuestion(visible[idx]);window.scrollTo({top:0,behavior:'smooth'});}
function downloadText(name,text){let blob=new Blob([text],{type:'text/plain;charset=utf-8'});let u=URL.createObjectURL(blob);let a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function exportWrong(){let qs=QUESTIONS.filter(q=>state.responses[q.id]&&!state.responses[q.id].ok);if(!qs.length){toast('Chưa có câu sai cần xuất.');return;}let body=[practiceInfo(currentExam).subject.toUpperCase()+' — '+practiceInfo(currentExam).title+' — GHI CHÚ ÔN CÂU SAI','Đáp án tham khảo · Xuất từ file HTML',''];for(let q of qs){body.push(`CÂU ${q.id}: ${q.stem}`,'Đáp án: '+q.correct.map(i=>LETTERS[i]+'. '+q.options[i]).join(' | '),'Giải thích: '+q.detail,...(q.studyNote?[q.studyNote.title,...q.studyNote.rows.map(row=>row.join(': ')),q.studyNote.caption]:[]),...q.why.map((r,i)=>LETTERS[i]+': '+r),'Nguồn: '+q.reference,'Mẹo nhớ: '+q.trick,...(q.caution?['Lưu ý: '+q.caution]:[]),'');}downloadText(practiceInfo(currentExam).subject.toUpperCase()+'_'+practiceInfo(currentExam).legacyExamId+'_Ghi_Chu_Cau_Sai.txt',body.join('\n'));}

document.querySelectorAll('.mode').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;updateModes();applyFilters();closeDrawer();window.scrollTo({top:0,behavior:'smooth'});});
el('topic').onchange=e=>{topic=e.target.value;applyFilters();closeDrawer();window.scrollTo({top:0,behavior:'smooth'});};el('search').oninput=e=>{search=e.target.value.trim();applyFilters();};el('shuffle').onclick=()=>{for(let i=state.order.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[state.order[i],state.order[j]]=[state.order[j],state.order[i]];}save();applyFilters();toast('Đã trộn thứ tự câu hỏi.');};
el('resetAll').onclick=()=>{if(confirm(collectionResetMessage())){state={responses:{},bookmarks:[],order:[...IDS],mistakes:{},resetAt:Date.now()};mode='all';topic='all';search='';el('topic').value='all';el('search').value='';updateModes();save();setQuestion(IDS[0]);toast('Đã đặt lại riêng đề đang ôn.');}};
el('clearFilters').onclick=()=>{mode='all';topic='all';search='';el('topic').value='all';el('search').value='';updateModes();applyFilters();};
el('exportNotes').onclick=exportWrong;
el('backupProgress').onclick=()=>{
 const payload={app:practiceInfo(currentExam).subject.toUpperCase()+'_Quiz_Mobile',version:1,exam:practiceInfo(currentExam).legacyExamId,exportedAt:new Date().toISOString(),state};
 downloadText(practiceInfo(currentExam).subject.toUpperCase()+'_'+practiceInfo(currentExam).legacyExamId+'_Tien_Do.json',JSON.stringify(payload,null,2));
 toast('Đã tạo bản sao lưu tiến độ của đề hiện tại.');
};
el('restoreProgress').onclick=()=>el('restoreFile').click();
el('restoreFile').addEventListener('change',e=>{
 const file=e.target.files&&e.target.files[0];if(!file)return;
 const reader=new FileReader();
 reader.onload=()=>{
  try{
   const payload=JSON.parse(String(reader.result||''));
   if(![currentExam,practiceInfo(currentExam).legacyExamId].includes(payload.exam)||payload.app!==practiceInfo(currentExam).subject.toUpperCase()+'_Quiz_Mobile')throw new Error('Không đúng bộ đề đang mở.');
   const incoming=payload.state||{},ids=new Set(IDS);
   if(!Array.isArray(incoming.order)||incoming.order.length!==TOTAL||new Set(incoming.order).size!==TOTAL||incoming.order.some(n=>!ids.has(n)))throw new Error('Danh sách câu không hợp lệ.');
   const cleaned={responses:{},bookmarks:[],order:[...incoming.order],mistakes:{}};
   for(const [key,val] of Object.entries(incoming.responses||{})){
    const n=Number(key),q=QMAP[n];if(!q||!val||!Array.isArray(val.selected))continue;
    const selected=[...new Set(val.selected)];if(!selected.length||selected.some(i=>!Number.isInteger(i)||i<0||i>=q.options.length))continue;
    cleaned.responses[n]={selected,ok:isCorrect(q,selected),at:Number(val.at)||Date.now()};
   }
   cleaned.bookmarks=Array.isArray(incoming.bookmarks)?[...new Set(incoming.bookmarks.filter(n=>ids.has(n)))]:[];if(incoming.mistakes&&typeof incoming.mistakes==='object')for(const [k,v] of Object.entries(incoming.mistakes)){if(ids.has(Number(k))&&Array.isArray(v))cleaned.mistakes[k]=v.filter(x=>x&&Array.isArray(x.selected));}
   if(!confirm('Khôi phục '+Object.keys(cleaned.responses).length+' câu đã làm cho '+practiceInfo(currentExam).title+'? Tiến độ hiện tại của đề này sẽ được thay thế.'))return;
   state=cleaned;save();mode='all';topic='all';search='';el('topic').value='all';el('search').value='';updateModes();
   current=state.order.find(n=>!state.responses[n])||state.order[0];draft=[];imageOpen=false;imageZoomed=false;linger=false;
   applyFilters(current);closeDrawer();window.scrollTo({top:0,behavior:'smooth'});toast('Đã khôi phục tiến độ.');
  }catch(err){toast('Không thể khôi phục: '+(err.message||'file không hợp lệ'));}
  finally{el('restoreFile').value='';}
 };
 reader.onerror=()=>{toast('Không đọc được file.');el('restoreFile').value='';};reader.readAsText(file,'utf-8');
});
el('submitMulti').onclick=()=>{if(draft.length)grade(draft);};el('prev').onclick=()=>go(-1);el('next').onclick=()=>go(1);
el('bookmark').onclick=()=>{let n=current;if(state.bookmarks.includes(n))state.bookmarks=state.bookmarks.filter(i=>i!==n);else state.bookmarks.push(n);save();render();};
el('retake').onclick=()=>{delete state.responses[current];reviewFresh=false;linger=true;save();draft=[];render();toast('Đã mở lại câu để làm lần nữa. Lịch sử sai vẫn giữ nguyên.');};
el('imageToggle').onclick=()=>{imageOpen=!imageOpen;if(!imageOpen)imageZoomed=false;render();};
el('zoomImage').onclick=()=>{imageZoomed=!imageZoomed;el('imageWrap').classList.toggle('zoomed',imageZoomed);el('zoomImage').textContent=imageZoomed?'↙ Thu nhỏ ảnh':'🔍 Phóng to ảnh';};
el('toggleSidebar').onclick=closeDrawer;
document.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey)return;let target=e.target;if(target?.closest('.keyword-hint-toggle'))return;if(target&&(['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable))return;if(!currentExam||!QMAP[current])return;const q=QMAP[current];if(['1','2','3','4','5'].includes(e.key)&&visible.length&&(!state.responses[current]||(mode==='wrong'&&reviewFresh))){let i=+e.key-1;if(i>=q.options.length)return;e.preventDefault();if(q.multiple){draft=draft.includes(i)?draft.filter(x=>x!==i):[...draft,i];render();}else grade([i]);}else if(e.key==='ArrowRight'){e.preventDefault();go(1)}else if(e.key==='ArrowLeft'){e.preventDefault();go(-1)}else if(e.key==='Enter'&&q.multiple&&draft.length&&(!state.responses[current]||(mode==='wrong'&&reviewFresh))){e.preventDefault();grade(draft);}});


function openDrawer(){
 if(!currentExam || window.innerWidth>760)return;
 el('sidebar').classList.add('drawer-open');
 el('mobileBackdrop').classList.add('show');
 document.body.classList.add('drawer-active');
 el('mobileMenu').setAttribute('aria-expanded','true');
 el('toggleSidebar').setAttribute('aria-expanded','true');
}
function closeDrawer(){
 el('sidebar').classList.remove('drawer-open');
 el('mobileBackdrop').classList.remove('show');
 document.body.classList.remove('drawer-active');
 el('mobileMenu').setAttribute('aria-expanded','false');
 el('toggleSidebar').setAttribute('aria-expanded','false');
}
el('mobileMenu').onclick=openDrawer;
el('mobileBackdrop').onclick=closeDrawer;
el('mobilePrev').onclick=()=>go(-1);
el('mobileNext').onclick=()=>go(1);
window.addEventListener('resize',()=>{if(window.innerWidth>760)closeDrawer();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer();});
document.querySelectorAll('[data-exam]').forEach(b=>b.addEventListener('click',()=>openExam(b.dataset.exam)));
el('homeButton').addEventListener('click',showHome);

/* Thi thử: độc lập với ôn tập, không thay đổi đáp án hay tiến độ học cũ. */
let mockExam=null,mockAttempt=null,mockAt=0,mockSubmitted=false,mockPanel='exam';
const mockKey=(kind,id)=>EXAMS[id]?EXAMS[id].subject+'_mock_v2_'+kind+'_'+EXAMS[id].legacyExamId:'studyhub_mock_v2_'+kind+'_'+(id==='all'?currentSubject:id);
const mockRead=(kind,id,fallback)=>{try{const v=JSON.parse(localStorage.getItem(mockKey(kind,id)));return v??fallback;}catch(e){return fallback;}};
const mockStore=(kind,id,value)=>{try{const key=mockKey(kind,id);if(value&&typeof value==='object'&&kind==='draft')value.updatedAt=Date.now();localStorage.setItem(key,JSON.stringify(value));if(typeof cloudSchedule==='function')cloudSchedule(key);}catch(e){toast('Trình duyệt không hỗ trợ lưu dữ liệu.')}};
const mockInfo=()=>EXAMS[mockExam];
const mockCurrentQ=()=>mockInfo().questions[mockAt];
const mockChosen=id=>(mockAttempt.answers[id]||[]);
function mockNew(){
 return {startedAt:Date.now(),answers:{},submittedAt:null};
}
function mockStart(examId){resetKeywordHints();if(EXAMS[examId]?.mockEnabled===false){toast('Ngân hàng đang bổ sung, chưa ghép đề 60 câu.');return;}
 el('wrongPractice').hidden=true;
 if(!EXAMS[examId])return;
 if(currentExam)save();
 currentExam=null;mockExam=examId;
 document.body.classList.remove('home-view');el('landing').hidden=true;el('appScreen').hidden=true;
 el('mockScreen').hidden=false;el('topStat').hidden=true;el('homeButton').hidden=true;
 el('appSubtitle').textContent='Thi thử · Chỉ chấm khi nộp';
 mockAttempt=mockRead('draft',examId,null);
 if(!mockAttempt||mockAttempt.submittedAt||!mockAttempt.answers)mockAttempt=mockNew();
 mockAt=0;mockSubmitted=false;mockPanel='exam';mockRender();window.scrollTo(0,0);
}
function mockSave(){if(mockExam&&!mockSubmitted)mockStore('draft',mockExam,mockAttempt);}
function mockExit(){
 if(!mockSubmitted)mockSave();
 mockExam=null;el('mockScreen').hidden=true;showHome();
}
function mockSetAnswer(index){
 if(mockSubmitted)return;
 const q=mockCurrentQ(),old=mockChosen(q.id);
 let sel=q.multiple?(old.includes(index)?old.filter(x=>x!==index):[...old,index]):[index];
 if(sel.length)mockAttempt.answers[q.id]=sel;else delete mockAttempt.answers[q.id];
 mockSave();mockRender();
}
function mockScoreCurrent(){
 const qs=mockInfo().questions,missing=qs.filter(q=>!mockChosen(q.id).length).length;
 if(missing&&!confirm('Bạn còn '+missing+' câu chưa trả lời. Nộp bài và tính những câu này là sai?'))return;
 mockAttempt.submittedAt=Date.now();mockSubmitted=true;
 const history=mockRead('history',mockExam,[]);
 const correct=qs.filter(q=>q.gradable!==false&&isCorrect(q,mockChosen(q.id))).length;
 history.unshift({at:mockAttempt.submittedAt,total:qs.filter(q=>q.gradable!==false).length,correct});
 mockStore('history',mockExam,history.slice(0,100));
 const wrong=mockRead('wrong',mockExam,[]);
 const bank=new Set(Array.isArray(wrong)?wrong:[]);
 const practiceState=loadState(mockExam);
qs.forEach(q=>{const answer=mockChosen(q.id);if(!isCorrect(q,answer)){bank.add(q.id);practiceState.responses[q.id]={selected:[...answer],ok:false,at:Date.now()};if(answer.length)recordMistake(practiceState,q.id,answer,'Thi thử');}});
try{savePracticeState(mockExam,practiceState);}catch(e){toast('Không thể đồng bộ câu đánh dấu.');}
 mockStore('wrong',mockExam,[...bank]);
 mockStore('last',mockExam,mockAttempt);
 try{localStorage.removeItem(mockKey('draft',mockExam));if(typeof cloudDelete==='function')cloudDelete(mockKey('draft',mockExam));}catch(e){}
 mockPanel='results';mockRender();window.scrollTo(0,0);
}
function mockRender(){
 const qs=mockInfo().questions,q=mockCurrentQ(),count=qs.filter(v=>mockChosen(v.id).length).length;
 el('mockTitle').textContent=mockInfo().title;
 el('mockSubtitle').textContent=mockSubmitted?'Đã nộp bài · Có thể xem đáp án và Trick học':'Thi thử: Không hiện đáp án, giải thích hoặc Trick học trước khi nộp';
 el('mockCount').textContent=qs.length+' câu';
 el('mockProgress').textContent=count+'/'+qs.length+' câu đã trả lời';
 el('mockSubmit').hidden=mockSubmitted;
 el('mockPalette').innerHTML='';
 qs.forEach((item,i)=>{
   const b=document.createElement('button');b.type='button';
   b.className='mock-num'+(i===mockAt?' current':'')+(mockChosen(item.id).length?' answered':'');
   if(mockSubmitted)b.className+=' '+(isCorrect(item,mockChosen(item.id))?'correct':'wrong');
   b.textContent=item.id;b.title='Câu '+item.id;b.onclick=()=>{mockAt=i;mockPanel='exam';mockRender();};
   el('mockPalette').appendChild(b);
 });
 const examPanel=mockPanel==='exam',resultPanel=mockPanel==='results',wrongPanel=mockPanel==='wrong';
 el('mockQuestion').classList.toggle('mock-hidden',!examPanel);
 el('mockResults').classList.toggle('mock-hidden',!resultPanel);
 el('mockWrongBank').classList.toggle('mock-hidden',!wrongPanel);
 if(examPanel){
   el('mockQLabel').textContent='CÂU '+q.id+' · '+(mockAt+1)+'/'+qs.length+(q.sourceLabel?' · '+q.sourceLabel:'');
   el('mockTopic').textContent=q.topic;
   renderKeywordHint('mockStem','mockKeywordHint',q,mockExam+':'+q.id);
   el('mockMultiNotice').textContent=q.multiple?'Chọn nhiều đáp án (chỉ tính đúng khi chọn đủ và không chọn thừa).':'Chọn một đáp án.';
   el('mockOptions').innerHTML='';
   q.options.forEach((option,i)=>{
     const b=document.createElement('button');b.type='button';b.className='mock-opt'+(mockChosen(q.id).includes(i)?' selected':'');
     b.disabled=mockSubmitted;
     b.innerHTML='<span><b>'+LETTERS[i]+'.</b></span><span>'+escapeHTML(option)+'</span><span style="margin-left:auto">'+(mockChosen(q.id).includes(i)?'●':'○')+'</span>';
     b.onclick=()=>mockSetAnswer(i);
     el('mockOptions').appendChild(b);
   });
   const exp=el('mockExplanation');exp.classList.toggle('mock-hidden',!mockSubmitted);
   if(mockSubmitted){
      const correct=isCorrect(q,mockChosen(q.id));
      exp.innerHTML='<p class="'+(correct?'mock-green':'mock-red')+'"><b>'+(q.gradable===false?'ⓘ Không tính điểm':correct?'✓ Chính xác':'✕ Cần ôn lại')+'</b></p>'
       +'<p><b>'+(q.gradable===false?'Không có đáp án duy nhất. ':'Đáp án đúng: ')+'</b>'+q.correct.map(i=>LETTERS[i]+'. '+escapeHTML(q.options[i])).join('; ')+'</p>'
       +'<p><b>Giải thích: </b>'+escapeHTML(q.detail)+'</p>'+optionReasons(q)+'<p><b>💡 Trick học: </b>'+escapeHTML(q.trick)+'</p>'
       +(q.caution?'<p><b>Lưu ý: </b>'+escapeHTML(q.caution)+'</p>':'')
       +'<details><summary>Xem ảnh đề gốc</summary><img style="width:100%;height:auto" loading="lazy" src="'+q.image+'" alt="Ảnh đề gốc"></details><p class="mock-note">Nguồn: '+escapeHTML(q.reference)+' · Đáp án tham khảo, chưa phải đáp án chính thức.</p>';
   }
   el('mockPrev').disabled=mockAt===0;el('mockNext').disabled=mockAt===qs.length-1;
 }
 if(resultPanel){
   const missed=wrongPracticeLast(mockExam).ids.length;el('mockReviewWrong').textContent='↻ Làm lại '+missed+' câu sai / bỏ trống';el('mockReviewWrong').disabled=missed===0;
   const correct=qs.filter(q=>q.gradable!==false&&isCorrect(q,mockChosen(q.id))).length;
   el('mockScore').innerHTML='<b style="font-size:27px">'+correct+'/'+qs.filter(q=>q.gradable!==false).length+' câu được chấm · '+Math.round(correct/qs.filter(q=>q.gradable!==false).length*100)+'%</b>';
   el('mockScoreSub').textContent=(qs.filter(q=>q.gradable!==false).length-correct)+' câu chưa đúng (gồm bỏ trống). '+qs.filter(q=>q.gradable===false).length+' câu không tính điểm vì thiếu điều kiện.';
   el('mockWrongItems').innerHTML='';
   qs.filter(q=>!isCorrect(q,mockChosen(q.id))).forEach(item=>{
     const div=document.createElement('article');div.innerHTML='<b>Câu '+item.id+': '+escapeHTML(item.stem)+'</b><p class="mock-note">Đáp án: '+item.correct.map(i=>LETTERS[i]).join(', ')+'</p><p>'+escapeHTML(item.detail)+'</p>'+optionReasons(item)+'<p>💡 <b>Trick:</b> '+escapeHTML(item.trick)+'</p>';
     el('mockWrongItems').appendChild(div);
   });
   if(correct===qs.filter(q=>q.gradable!==false).length)el('mockWrongItems').textContent='Không có câu sai.';
   const history=mockRead('history',mockExam,[]);
   el('mockHistory').textContent=history.map(h=>new Date(h.at).toLocaleString('vi-VN')+' · '+h.correct+'/'+h.total).join(' | ')||'Chưa có lịch sử.';
 }
 if(wrongPanel){
   const bank=mockRead('wrong',mockExam,[]);
   const previous=loadState(mockExam);
   el('mockSavedWrongItems').innerHTML='';
   qs.filter(q=>bank.includes(q.id)).forEach(item=>{
     const div=document.createElement('article');const mistakes=Array.isArray(previous.mistakes[item.id])?previous.mistakes[item.id]:[];div.innerHTML='<b>Câu '+item.id+': '+escapeHTML(item.stem)+'</b><p><b>Đáp án: </b>'+item.correct.map(i=>LETTERS[i]+'. '+escapeHTML(item.options[i])).join('; ')+'</p><p>'+escapeHTML(item.detail)+'</p>'+optionReasons(item)+'<p>💡 <b>Trick:</b> '+escapeHTML(item.trick)+'</p><p><b>Đã từng chọn sai: </b>'+mistakes.map(v=>escapeHTML(v.selected.map(i=>LETTERS[i]+'. '+item.options[i]).join(' · '))).join(' | ')+'</p>';
     el('mockSavedWrongItems').appendChild(div);
   });
   if(!el('mockSavedWrongItems').children.length)el('mockSavedWrongItems').textContent='Chưa có câu sai.';
 }
}
el('mockSubmit').onclick=mockScoreCurrent;
el('mockExit').onclick=mockExit;
el('mockPrev').onclick=()=>{mockAt=Math.max(0,mockAt-1);mockRender();};
el('mockNext').onclick=()=>{mockAt=Math.min(mockInfo().questions.length-1,mockAt+1);mockRender();};
el('mockReviewWrong').onclick=()=>{mockPanel='wrong';mockRender();window.scrollTo(0,0);};
el('mockRetakeWrong').onclick=()=>{const id=mockExam;el('mockScreen').hidden=true;mockExam=null;openExam(id);mode='wrong';updateModes();const numbers=filtered();if(numbers.length){current=numbers[0];applyFilters(current);}else{mode='all';updateModes();applyFilters();toast('Không còn câu sai.');}};
el('mockBackResults').onclick=()=>{mockPanel='results';mockRender();};
el('mockNewAttempt').onclick=()=>{
 if(!confirm('Bắt đầu lượt thi mới? Lịch sử và danh sách câu sai vẫn được giữ lại.'))return;
 mockAttempt=mockNew();mockSubmitted=false;mockPanel='exam';mockAt=0;mockSave();mockRender();
};
document.querySelectorAll('[data-mock]').forEach(b=>b.addEventListener('click',()=>mockStart(b.dataset.mock)));

document.querySelectorAll('[data-exam="fe_mock"]').forEach(b=>b.addEventListener('click',()=>openExam('fe_mock')));

/* 5 image ZIP answer-key reference. Do not auto-grade unverified answer choices. */
const ZIP_KEYS=[{"id":"dta301_su26_267","title":"DTA301 · Đề 4 · SU26 FE 267 · 60 câu","subject":"dta301","info":"Bộ luyện riêng từ DTA301 SU26 FE mã 267, gồm 60 câu. Nội dung trùng bộ SU26 đã có; tiến độ bộ này được lưu riêng. Giữ 5 đáp án sửa theo giáo trình ở câu 6, 15, 38, 53 và 60."},{"id":"bps301_fa26_805603","title":"BPS301 · FA26 · FE 805603 · 50 câu","subject":"bps301","info":"Đề FA26 FE mã 805603 có đủ 50 câu để luyện và thi thử, kèm giải thích, mẹo nhớ và ảnh gốc. Câu 13 và 22 có lưu ý về cách diễn đạt trong phần giải thích. Giữ số câu gốc; câu 39 và 47 chọn 3 phương án. Đáp án được giải để ôn tập, không phải key chính thức của trường."},{"id":"mln131_de01","title":"MLN131 · Đề ôn tập 01 · 60 câu đã đối chiếu","subject":"mln131","info":"Đề tổng hợp 60 câu đã đối chiếu giáo trình từ các nhóm ảnh, không lặp nguyên câu. Có ôn từng câu, thi thử và ôn lại câu sai. Hai câu có nhiều đáp án được ghi rõ cách chọn; mỗi câu giữ nhóm ảnh và số câu gốc."},{"id":"mln131_extra","title":"MLN131 · Đề ôn tập 02 · 60 câu đã đối chiếu","subject":"mln131","info":"Đề tổng hợp tiếp theo gồm 60 câu đã xác minh, không lặp câu của Đề 01. Giữ nguyên tiến độ các câu từng nằm ở phần bổ sung; mỗi câu có số gốc, giải thích, gợi ý từ khóa và trang giáo trình."},{"id":"mln131_supplement","title":"MLN131 · Câu bổ sung · 13 câu có đáp án","subject":"mln131","info":"12 câu đã đối chiếu giáo trình; 1 câu có đáp án do bạn xác nhận. Dành cho đề tiếp theo."},{"id":"dta301_fa24","title":"DTA301 · FA 2024 · FE — 58 câu luyện","subject":"dta301","info":"58 câu đã có đáp án để luyện tập và thi thử. 2 câu còn cần làm rõ được chuyển sang danh sách Câu cần xác minh. Giữ số câu gốc, giải thích, nguồn và mẹo nhớ."},{"id":"dta301_su26","title":"DTA301 · SU26 · FE — 60 câu luyện","subject":"dta301","info":"60 câu từ ảnh đề gốc. Mỗi câu có giải thích từng lựa chọn, nguồn và Trick nhớ. Đã sửa 5 key khác tài liệu: câu 6, 15, 38, 53, 60."},{"id":"dta301_su24","title":"DTA301 · SU24 · FE — 57 câu luyện","subject":"dta301","info":"57 câu đã có đáp án để luyện tập và thi thử. 3 câu còn cần làm rõ được chuyển sang danh sách Câu cần xác minh. Giữ số câu gốc, giải thích, nguồn và mẹo nhớ."},{"id":"bps301_fa26","title":"BPS301 · FA26 · 60 câu","subject":"bps301","info":"Đề FA26 gồm 60 câu. Chọn đáp án để được chấm ngay, xem giải thích, mẹo nhớ và ảnh đề gốc."},{"id":"bps301_su26","title":"BPS301 · SU26 · FE · 50 câu","subject":"bps301","info":"Đề SU26 FE đã đối chiếu đủ 50 câu theo bộ BPS_SU26(1).zip. Bộ nguồn có 51 ảnh vì câu 28 lặp hai lần; mỗi câu chỉ xuất hiện một lần trong đề luyện. Có ảnh gốc câu 39, giải thích và mẹo nhớ. Ôn tập chấm ngay; thi thử chấm khi nộp. Đáp án phục vụ ôn tập, chưa phải key chính thức của trường."},{"id":"su","title":"BPS301 · SU26 · Bảng đáp án cũ · 49 câu","data":{"1":"B","2":"A","3":"B","4":"B","5":"C","6":"B","7":"C","8":"C","9":"B","10":"B","11":"B","12":"C","13":"B","14":"C","15":"C","16":"B","17":"C","18":"C","19":"C","20":"C","21":"C","22":"C","23":"C","24":"A","25":"C","26":"C","27":"C","28":"A","29":"D","30":"B","31":"B","32":"C","33":"B","34":"A","35":"C","36":"B","37":"B","38":"B","40":"B","41":"B","42":"C","43":"C","44":"C","45":"B","46":"B","47":"A","48":"A","49":"C","50":"C"},"count":50,"missing":[39],"info":"Tra theo số Question trong ảnh, không theo tên file.","subject":"bps301","referenceOnly":true},{"id":"de1","title":"BPS301 · Tham khảo ảnh · Bộ 01","data":{"1":"D","2":"D","3":"C","4":"BCD","5":"ACD","6":"ACD","7":"D","8":"ADE","11":"A","13":"D","14":"B","15":"C","16":"A","18":"A","22":"A","28":"D"},"count":50,"info":"Ảnh 1 và 2 trùng câu. Nhiều ảnh thiếu thành phần minh họa hoặc chưa đủ cơ sở để xác định.","subject":"bps301","referenceOnly":true},{"id":"de2","title":"BPS301 · Tham khảo ảnh · Bộ 02","data":{"1":"C","2":"D","3":"D","4":"E","5":"B","6":"ACD","7":"AC","8":"C","9":"ABCD","10":"B","11":"BD","12":"E","13":"D","14":"B","15":"D","18":"C","19":"A","20":"D","21":"A","22":"B","23":"A","24":"B","25":"ABCE","26":"ABCDE","27":"C","28":"D","29":"A","30":"D","31":"D","32":"C","33":"B","35":"D","37":"A","39":"B","40":"A","41":"D","42":"D","43":"D","45":"C","46":"D","47":"B","48":"A","50":"D"},"count":50,"info":"Một số câu ArchiMate/BPMN cần sơ đồ gốc nên chưa có đáp án.","subject":"bps301","referenceOnly":true},{"id":"de3","title":"BPS301 · Tham khảo ảnh · Bộ 03","data":{"1":"B","2":"C","3":"BCD","4":"ACD","5":"C","6":"ACD","7":"BCD","9":"C","10":"AB","11":"B","12":"ACD","13":"ACD","14":"BD","15":"ADE","16":"C","17":"B","18":"B","22":"CE","23":"AB","24":"D","25":"ACD","28":"BDE","30":"ABC","31":"BD","32":"ABC","33":"B","34":"D","35":"A","36":"ABC","37":"D","39":"CEF","40":"DE","41":"B","42":"B","43":"D","44":"D","45":"B","46":"C","48":"B","49":"ABD","50":"ABCD"},"count":50,"info":"Một số câu yêu cầu phân tích sơ đồ BPMN nhưng ảnh nguồn chỉ có chữ.","subject":"bps301","referenceOnly":true},{"id":"fa25","title":"BPS301 · FA25 · FE · 47 ảnh","data":{"1":"B","2":"CD","3":"D","4":"C","5":"B","6":"B","7":"C","8":"ABD","9":"B","10":"B","11":"B","12":"C","13":"A","14":"B","15":"A","16":"A","17":"A","18":"A","19":"B","20":"A","21":"B","22":"C","23":"B","24":"C","25":"ABC","26":"ABC","27":"ABC","28":"CEF","29":"A","30":"B","31":"B","32":"D","33":"BD","34":"ABC","35":"BDE","36":"D","37":"B","38":"C","39":"B","40":"BCD","41":"ACD","42":"C","43":"B","44":"B","45":"ACD","46":"D","47":"C"},"count":47,"info":"Có chữ viết tay trên ảnh. Đáp án được dùng làm tham khảo, không xem như key chính thức.","subject":"bps301","referenceOnly":true}];
function zipRender(){const set=ZIP_KEYS[Number(el('zipSelect').value)||0];if(set.referenceOnly){el('zipStatus').textContent=set.info+' · Chỉ là bảng đáp án tham khảo cũ, chưa có bộ câu hỏi tương tác đầy đủ.';el('zipRows').innerHTML=Array.from({length:set.count},(_,i)=>i+1).filter(i=>!set.missing?.includes(i)).map(i=>'<article><b>Ảnh / Câu '+i+'</b> · '+(set.data[i]?'Đáp án tham khảo: '+escapeHTML(set.data[i]):'Chưa đủ dữ kiện để chấm')+'</article>').join('');return;}el('zipStatus').textContent=set.info;const box=el('zipRows');box.innerHTML='';for(const q of EXAMS[set.id].questions){const row=document.createElement('article');row.innerHTML='<details><summary><b>Câu '+q.id+' · '+(q.gradable?q.correct.map(i=>LETTERS[i]).join(', '):'Không tính điểm')+'</b> · '+escapeHTML(q.stem)+(q.keyChanged?' <strong style="color:#b83243">Đã sửa đáp án nguồn</strong>':'')+'</summary><p>'+escapeHTML(q.detail)+'</p>'+optionReasons(q)+'<p><b>💡 Trick: </b>'+escapeHTML(q.trick)+'</p>'+(q.caution?'<p class="notice">'+escapeHTML(q.caution)+'</p>':'')+'<p class="mock-note">'+escapeHTML(q.reference)+'</p>'+(q.image?'<details><summary>'+escapeHTML(q.imageLabel||'Ảnh đề gốc')+'</summary><img loading="lazy" style="max-width:100%;height:auto" src="'+q.image+'" alt="Ảnh gốc câu '+q.id+'"></details>':'')+'</details>';box.appendChild(row);}}
function zipShow(){if(currentExam)save();if(mockExam&&!mockSubmitted)mockSave();currentExam=null;mockExam=null;el('landing').hidden=true;el('appScreen').hidden=true;el('mockScreen').hidden=true;el('zipReview').hidden=false;el('homeButton').hidden=true;el('topStat').hidden=true;zipRender();window.scrollTo(0,0);}
function zipHide(){el('zipReview').hidden=true;showHome();}
el('zipOpen').addEventListener('click',zipShow);el('zipBack').addEventListener('click',zipHide);
ZIP_KEYS.unshift({"id":"bps301_supplement","title":"BPS301 · Ôn luyện bổ sung · BPM & EA","subject":"bps301","info":"104 câu đã đối chiếu để ôn luyện từ bộ câu tổng hợp; có gợi ý, giải thích và ôn lại câu sai. Đã gộp 35 mục lặp; 39 câu thiếu hình hoặc chưa đủ căn cứ nằm ở Câu cần xác minh. Không gắn kỳ thi hoặc mã đề cho bộ tổng hợp này."});
ZIP_KEYS.find(x=>x.id==='bps301_supplement').info=EXAMS.bps301_supplement.notice;
ZIP_KEYS.forEach((x,i)=>{const o=document.createElement('option');o.value=i;o.textContent=x.title;el('zipSelect').appendChild(o)});el('zipSelect').addEventListener('change',zipRender);

/* DTA301 cloud progress, password authentication, RLS: only publishable key in browser. */
const CLOUD_ORIGIN = "https://phamnkkrlhxlymermxdj.supabase.co";
const CLOUD_KEY = "sb_publishable_Wsi3nWCxX2nZht7EmnDolg_72Yp0PvS";
const CLOUD_SESSION_KEY='studyhub_auth_v1';
const cloudAllowedKey=k=>/^(dta301|bps301|mln131)_(unified_|fe_mock_|mock_v2_)/.test(k)||k.startsWith('studyhub_mock_v2_');
const CLOUD_ALLOWED=()=>Object.keys(localStorage).filter(cloudAllowedKey);
let cloudSession=null,cloudTimer=null,cloudBusy=false,cloudReady=false,cloudDirty=new Set(),cloudInflight=null,cloudInterval=null;
const cloudMsg=(s)=>{const e=el('syncMessage');if(e)e.textContent=s};
const cloudIndicator=(s)=>{const e=el('syncStatus');if(e)e.textContent=s};
function cloudStatus(){const isIn=!!cloudSession?.access_token;el('syncAccount').hidden=!isIn;el('syncLogin').hidden=isIn;el('syncVerify').hidden=true;el('syncAccountText').textContent=isIn?'Đã đăng nhập: '+(cloudSession.user?.email||'Tài khoản Supabase'):'';cloudIndicator(isIn?'☁️ Đã đăng nhập · '+(cloudReady?'Đồng bộ sẵn sàng':'Đang đồng bộ'):'💾 Đang lưu trên thiết bị · Chưa đồng bộ online');el('syncToggle').textContent=isIn?'☁️ Quản lý đồng bộ':'Đăng nhập để đồng bộ';}
function cloudSessionSave(value){cloudSession=value;cloudReady=false;if(value){localStorage.setItem(CLOUD_SESSION_KEY,JSON.stringify(value))}else{localStorage.removeItem(CLOUD_SESSION_KEY)}cloudStatus();}
async function cloudFetch(path,{method='GET',body=null,auth=true}={}){
 if(auth&&!cloudSession?.access_token)throw Error('Bạn chưa đăng nhập');
 const headers={'apikey':CLOUD_KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'};
 if(auth)headers.Authorization='Bearer '+cloudSession.access_token;
 const response=await fetch(CLOUD_ORIGIN+path,{method,headers,body:body==null?null:JSON.stringify(body),cache:'no-store'});
 const raw=await response.text();let data;try{data=raw?JSON.parse(raw):null}catch(e){data={message:raw.slice(0,350)}}
 if(!response.ok){const err=new Error(data?.msg||data?.message||data?.error_description||data?.error||'HTTP '+response.status);err.status=response.status;throw err}
 return data;
}
async function cloudRefresh(){
 if(!cloudSession?.refresh_token)throw Error('Phiên đăng nhập hết hạn');
 const x=await cloudFetch('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:cloudSession.refresh_token},auth:false});
 cloudSessionSave(x);return x;
}
async function cloudCall(path,opts){try{return await cloudFetch(path,opts)}catch(e){if(e.status===401&&cloudSession?.refresh_token){await cloudRefresh();return cloudFetch(path,opts)}throw e}}
function cloudObject(key){try{const v=JSON.parse(localStorage.getItem(key));return v&&typeof v==='object'?v:null}catch(e){return null}}
function cloudMerge(key,local,remote){
 if(!local)return remote;if(!remote)return local;
 if(/_mock_v2_wrong_/.test(key))return [...new Set([...(Array.isArray(local)?local:[]),...(Array.isArray(remote)?remote:[])])];
 if(/_mock_v2_history_/.test(key)){
 const m=new Map();for(const x of [...(Array.isArray(local)?local:[]),...(Array.isArray(remote)?remote:[])])if(x&&x.at)m.set(String(x.at),x);
 return [...m.values()].sort((a,b)=>b.at-a.at).slice(0,100);
 }
 if(/_mock_v2_draft_/.test(key))return (Number(local.updatedAt||local.startedAt)||0)>=(Number(remote.updatedAt||remote.startedAt)||0)?local:remote;
 if(/_mock_v2_last_/.test(key))return Number(local.submittedAt||0)>=Number(remote.submittedAt||0)?local:remote;
 if(/_mock_v2_/.test(key))return (local.at||0)>=(remote.at||0)?local:remote;
 if(!local.responses||!remote.responses)return local;
 const base=Number(local.resetAt||0)>=Number(remote.resetAt||0)?local:remote;
 const result={...base,responses:{},bookmarks:[...new Set([...(local.bookmarks||[]),...(remote.bookmarks||[])])],mistakes:{},resetAt:Math.max(Number(local.resetAt)||0,Number(remote.resetAt)||0)};
 const ids=new Set([...(local.order||[]),...(remote.order||[])]);
 result.order=Array.isArray(base.order)&&base.order.length?base.order:[...ids];
 for(const id of ids){
   const x=local.responses[id],y=remote.responses[id];
   const eligible=[x,y].filter(v=>v&&Number(v.at||0)>=result.resetAt);
   if(eligible.length)result.responses[id]=eligible.sort((a,b)=>Number(b.at||0)-Number(a.at||0))[0];
   const histories=[...(local.mistakes?.[id]||[]),...(remote.mistakes?.[id]||[])];
   const distinct=new Map();
   for(const x of histories)if(x&&Array.isArray(x.selected)&&Number(x.at||0)>=result.resetAt)distinct.set(JSON.stringify([x.at,x.selected,x.source]),x);
   if(distinct.size)result.mistakes[id]=[...distinct.values()].sort((a,b)=>Number(a.at||0)-Number(b.at||0));
   if((result.mistakes[id]||[]).length>=2&&!result.bookmarks.includes(Number(id)))result.bookmarks.push(Number(id));
 }
 return result;
}
async function cloudUpsert(key,body){
 return cloudCall('/rest/v1/bps301_user_state?on_conflict=user_id,state_key',{method:'POST',body:{user_id:cloudSession.user.id,state_key:key,payload:body,updated_at:new Date().toISOString()},auth:true,});
}
async function cloudSync(){
 if(!cloudSession?.user?.id||cloudBusy)return;
 cloudBusy=true;cloudIndicator('☁️ Đang đồng bộ…');
 try{
  const rows=await cloudCall('/rest/v1/bps301_user_state?select=state_key,payload&order=updated_at.desc&limit=1000');
  const remote=new Map((rows||[]).map(x=>[x.state_key,x.payload]));
  const keys=new Set([...remote.keys(),...CLOUD_ALLOWED()]);
  let changed=false;
  for(const key of keys){
   if(!cloudAllowedKey(key))continue;
   const local=cloudObject(key),server=remote.get(key)||null;
   if(!local&&!server)continue;
   const combined=cloudMerge(key,local,server);
   if(!combined)continue;
   const was=JSON.stringify(local);const next=JSON.stringify(combined);
   if(was!==next){localStorage.setItem(key,next);changed=true;}
   if(JSON.stringify(server)!==next){await cloudUpsert(key,combined);}
  }
  if(typeof migrateMlnProgress==='function'){for(const key of migrateMlnProgress()){await cloudUpsert(key,cloudObject(key));changed=true;}}
  cloudReady=true;cloudDirty.clear();
  cloudIndicator('✅ Đã đồng bộ · '+(cloudSession.user.email||'tài khoản'));
  cloudMsg('Đã gộp dữ liệu từ thiết bị này với Supabase. Các câu trả lời, lịch sử sai và đề thi được giữ theo từng đề.');
  if(changed){if(currentExam){state=loadState(currentExam);render()}else if(!mockExam&&el('landing')&&!el('landing').hidden)updateLanding();}
 }catch(e){cloudIndicator('⚠️ Chưa đồng bộ: '+e.message);cloudMsg('Tiến độ trên thiết bị vẫn được giữ. '+e.message)}
 finally{cloudBusy=false}
}
function cloudSchedule(key){
 if(!cloudSession?.user?.id)return;
 cloudDirty.add(key);clearTimeout(cloudTimer);
 cloudTimer=setTimeout(()=>{cloudSync()},1200);
}
async function cloudDelete(key){
 if(!cloudSession?.access_token)return;
 try{await cloudCall('/rest/v1/bps301_user_state?state_key=eq.'+encodeURIComponent(key),{method:'DELETE'})}catch(e){cloudMsg('Không thể xóa bản nháp cũ trên server: '+e.message)}
}
async function cloudLogin(e){
 e.preventDefault();cloudMsg('Đang đăng nhập…');
 const email=el('syncEmail').value.trim(),password=el('syncPassword').value;
 try{const data=await cloudFetch('/auth/v1/token?grant_type=password',{method:'POST',auth:false,body:{email,password}});
 cloudSessionSave(data);await cloudSync();}
 catch(err){cloudMsg('Đăng nhập không thành công: '+err.message)}
}
async function cloudSignup(){
 const email=el('syncEmail').value.trim(),password=el('syncPassword').value;
 if(!email||password.length<6){cloudMsg('Nhập email và mật khẩu tối thiểu 6 ký tự.');return}
 cloudMsg('Đang tạo tài khoản…');
 try{
  const data=await cloudFetch('/auth/v1/signup?redirect_to='+encodeURIComponent('https://bps301-exam-practice.vercel.app/'),{method:'POST',auth:false,body:{email,password}});
  if(data.access_token){cloudSessionSave(data);await cloudSync();return}
  cloudMsg('Đã gửi email xác nhận (nếu dịch vụ email được bật). Kiểm tra Inbox/Spam, nhập mã OTP bên dưới. Nếu nhận được link, hãy mở link trên thiết bị này.');
  el('syncVerify').hidden=false;
 }catch(e){cloudMsg('Không thể tạo tài khoản: '+e.message)}
}
async function cloudConfirm(e){
 e.preventDefault();const email=el('syncEmail').value.trim(),token=el('syncOtp').value.trim();
 cloudMsg('Đang xác nhận…');
 try{const d=await cloudFetch('/auth/v1/verify',{method:'POST',auth:false,body:{type:'signup',email,token}});if(d.access_token){cloudSessionSave(d);await cloudSync()}else{cloudMsg('Xác nhận thành công. Hãy đăng nhập bằng mật khẩu.')}}catch(e){cloudMsg('Xác nhận không thành công: '+e.message)}
}
async function cloudLogout(){
 try{if(cloudSession?.access_token)await cloudCall('/auth/v1/logout',{method:'POST'})}catch(e){}
 cloudSessionSave(null);cloudMsg('Đã đăng xuất. Dữ liệu cục bộ vẫn còn trên thiết bị.');cloudStatus();
}
el('syncToggle').addEventListener('click',()=>{el('syncPanel').hidden=!el('syncPanel').hidden});
el('syncLogin').addEventListener('submit',cloudLogin);
el('syncSignup').addEventListener('click',cloudSignup);
el('syncVerify').addEventListener('submit',cloudConfirm);
el('syncLogout').addEventListener('click',cloudLogout);
el('syncNow').addEventListener('click',cloudSync);
(async()=>{
 try{
  cloudSession=JSON.parse(localStorage.getItem(CLOUD_SESSION_KEY)||'null');
  if(cloudSession?.refresh_token){await cloudRefresh();await cloudSync();}
  else{cloudSession=null;cloudStatus();}
 }catch(e){cloudStatus();cloudMsg('Cần đăng nhập lại: '+e.message)}
})();
window.addEventListener('focus',()=>{if(cloudSession?.access_token)cloudSync()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&cloudSession?.access_token)cloudSync()});
cloudInterval=setInterval(()=>{if(cloudSession?.access_token&&document.visibilityState==='visible')cloudSync()},45000);

/* A fresh answer set for exam-error practice; original exam attempts stay intact. */
let wpSession=null,wpAt=0,wpDraft=[],wpReturnToResult=false,wpOriginExam=null;
function wrongPracticePending(examId){
 const info=EXAMS[examId];if(!info)return [];
 const s=loadState(examId),raw=mockRead('wrong',examId,[]);
 const known=new Set((Array.isArray(raw)?raw:[]).map(Number));
 for(const [id,r] of Object.entries(s.responses||{}))if(r&&!r.ok)known.add(Number(id));
 return info.questions.filter(q=>q.gradable!==false&&known.has(q.id)&&!s.responses[q.id]?.ok&&(s.responses[q.id]||(!s.resetAt&&!s.questionResetAt?.[q.id]))).map(q=>q.id);
}
function wrongPracticeLast(examId){
 const attempt=mockExam===examId&&mockSubmitted?mockAttempt:mockRead('last',examId,null);
 if(!attempt?.submittedAt)return {ids:[],token:0};
 return {ids:EXAMS[examId].questions.filter(q=>q.gradable!==false&&!isCorrect(q,attempt.answers?.[q.id]||[])).map(q=>q.id),token:attempt.submittedAt};
}
function wpRef(key){const [examId,n]=String(key).split(':');return {examId,id:Number(n)};}
function wpKey(examId,id){return examId+':'+id;}
function wrongPracticeAll(){return mergeUniqueKeys(Object.keys(EXAMS).flatMap(id=>wrongPracticePending(id).map(n=>wpKey(id,n))));}
function wpSave(){if(!wpSession)return;wpSession.at=Date.now();mockStore('review',wpSession.examId,wpSession);}
function startWrongPractice(examId='all',scope='saved',returnToResult=false,forcedIds=null){resetKeywordHints();
 if(examId!=='all'&&!EXAMS[examId])return;
 const last=examId==='all'?{ids:[],token:0}:wrongPracticeLast(examId);
 const candidates=forcedIds||(examId==='all'?wrongPracticeAll():(scope==='last'?last.ids:wrongPracticePending(examId)).map(id=>wpKey(examId,id)));
 const ids=mergeUniqueKeys([...new Set(candidates.map(id=>String(id).includes(':')?String(id):wpKey(examId,id)))]).filter(key=>{const r=wpRef(key);return EXAMS[r.examId]?.questions.some(q=>q.id===r.id&&q.gradable!==false);});
 if(!ids.length){toast('Không còn câu sai hoặc bỏ trống cần ôn.');return;}
 const token=scope==='last'?last.token:0,old=mockRead('review',examId,null);
 // Keep an unfinished round when solved questions have left the pending queue.
 const canResume=!forcedIds&&old?.version===2&&old.examId===examId&&old.scope===scope&&old.token===token&&!old.finishedAt&&Array.isArray(old.ids)&&old.answers&&old.ids.some(key=>!old.answers[key])&&ids.every(key=>old.ids.includes(key));
 wpSession=canResume?old:{version:2,examId,scope,token,ids,answers:{},startedAt:Date.now(),at:Date.now()};
 wpSession.ids=mergeUniqueKeys(wpSession.ids.filter(key=>{const r=wpRef(key);return EXAMS[r.examId]?.questions.some(q=>q.id===r.id&&q.gradable!==false);}));
 wpSession.answers=Object.fromEntries(Object.entries(wpSession.answers).filter(([key,r])=>{const ref=wpRef(key),q=EXAMS[ref.examId]?.questions.find(q=>q.id===ref.id);return wpSession.ids.includes(key)&&r&&Array.isArray(r.selected)&&r.selected.every(i=>Number.isInteger(i)&&i>=0&&i<q.options.length);}));
 wpAt=Math.max(0,wpSession.ids.findIndex(key=>!wpSession.answers[key]));wpDraft=[];wpReturnToResult=returnToResult;wpOriginExam=mockExam;
 if(currentExam)save();currentExam=null;closeDrawer();document.body.classList.remove('home-view');
 for(const id of ['landing','appScreen','mockScreen','zipReview'])el(id).hidden=true;
 el('wrongPractice').hidden=false;el('homeButton').hidden=true;el('topStat').hidden=true;
 el('appSubtitle').textContent='Ôn tất cả câu sai · Chấm sau mỗi câu';wpSave();wpRender();window.scrollTo(0,0);
}
function wpQuestion(){const ref=wpRef(wpSession.ids[wpAt]);return EXAMS[ref.examId].questions.find(q=>q.id===ref.id);}
function wpChoose(index){
 const q=wpQuestion();if(wpSession.answers[wpSession.ids[wpAt]]||index<0||index>=q.options.length)return;
 if(q.multiple){wpDraft=wpDraft.includes(index)?wpDraft.filter(i=>i!==index):[...wpDraft,index];wpRender();}else wpGrade([index]);
}
function wpGrade(selected){
 const q=wpQuestion();if(wpSession.answers[wpSession.ids[wpAt]]||!selected.length)return;
 const ok=isCorrect(q,selected),at=Date.now(),ref=wpRef(wpSession.ids[wpAt]),s=loadState(ref.examId);
 wpSession.answers[wpSession.ids[wpAt]]={selected:[...selected],ok,at};
 s.responses[q.id]={selected:[...selected],ok,at};
 if(!ok)recordMistake(s,q.id,selected,'Ôn câu sai sau thi');
 try{savePracticeState(ref.examId,s);}catch(e){toast('Chưa lưu được tiến độ trên thiết bị.');}
 wpSave();wpRender();
}
function wpRender(){
 if(!wpSession)return;const q=wpQuestion(),answer=wpSession.answers[wpSession.ids[wpAt]],rows=Object.values(wpSession.answers),done=rows.length,good=rows.filter(r=>r.ok).length;
 el('wpTitle').textContent=wpSession.examId==='all'?'Ôn tất cả câu sai':EXAMS[wpSession.examId].title;
 el('wpScope').textContent=(wpSession.scope==='last'?'Câu sai và bỏ trống của lần thi vừa nộp':'Gom từ '+new Set(wpSession.ids.map(key=>wpRef(key).examId)).size+' đề')+' · '+wpSession.ids.length+' câu';
 el('wpProgress').textContent='Đã ôn '+done+'/'+wpSession.ids.length+' · Đúng '+good+' · Cần ôn lại '+rows.filter(r=>!r.ok).length+' · Chưa làm '+(wpSession.ids.length-done);
 el('wpLabel').textContent=EXAMS[wpRef(wpSession.ids[wpAt]).examId].title+' · '+(q.sourceLabel||('CÂU GỐC '+q.id))+' · '+(wpAt+1)+'/'+wpSession.ids.length;
 el('wpTopic').textContent=q.topic;renderKeywordHint('wpStem','wpKeywordHint',q,wpSession.ids[wpAt]);
 el('wpCard').hidden=!!wpSession.finishedAt;el('wpSummary').hidden=!wpSession.finishedAt;
 const palette=el('wpPalette');palette.innerHTML='';
 wpSession.ids.forEach((id,i)=>{const r=wpSession.answers[id],b=document.createElement('button');b.type='button';b.textContent=i+1;b.title=EXAMS[wpRef(id).examId].title+' · Câu '+wpRef(id).id;b.className='mock-num'+(i===wpAt?' current':'')+(r?(r.ok?' correct':' wrong'):'');b.setAttribute('aria-label',b.title+(r?(r.ok?', đã đúng':', vẫn sai'):', chưa làm'));b.onclick=()=>{wpAt=i;wpDraft=[];wpSession.finishedAt=null;wpSave();wpRender();};palette.appendChild(b);});
 const box=el('wpOptions');box.innerHTML='';
 q.options.forEach((opt,i)=>{const b=document.createElement('button');b.type='button';const selected=answer?answer.selected:wpDraft;b.className='mock-opt'+(selected.includes(i)?' selected':'');if(answer&&q.correct.includes(i))b.className+=' wp-correct';if(answer&&answer.selected.includes(i)&&!q.correct.includes(i))b.className+=' wp-wrong';b.disabled=!!answer;b.setAttribute('aria-pressed',String(selected.includes(i)));b.innerHTML='<b>'+LETTERS[i]+'.</b><span>'+escapeHTML(opt)+'</span>';b.onclick=()=>wpChoose(i);box.appendChild(b);});
 el('wpMulti').hidden=!q.multiple||!!answer;el('wpSubmitMulti').disabled=!wpDraft.length;
 const fb=el('wpFeedback');fb.hidden=!answer;fb.innerHTML='';
 if(answer)fb.innerHTML='<p class="'+(answer.ok?'mock-green':'mock-red')+'"><b>'+(answer.ok?'✓ Đúng! Câu này đã được giải quyết.':'✕ Chưa đúng. Hãy xem lý do và thử lại ở lượt tiếp theo.')+'</b></p><p><b>Đáp án: </b>'+q.correct.map(i=>LETTERS[i]+'. '+escapeHTML(q.options[i])).join('; ')+'</p><p>'+escapeHTML(q.detail)+'</p>'+optionReasons(q)+'<p><b>💡 Trick nhớ: </b>'+escapeHTML(q.trick)+'</p>'+(q.caution?'<p class="notice">'+escapeHTML(q.caution)+'</p>':'')+'<p class="mock-note">'+escapeHTML(q.reference)+'</p><details><summary>Xem ảnh đề gốc</summary><img loading="lazy" style="width:100%;height:auto" src="'+q.image+'" alt="Ảnh gốc câu '+q.id+'"></details>';
 el('wpPrev').disabled=wpAt===0;el('wpNext').textContent=wpAt===wpSession.ids.length-1?'Hoàn thành lượt ôn':'Câu tiếp →';
 if(wpSession.finishedAt){const left=wpSession.ids.length-good;el('wpSummaryText').textContent='Bạn đã trả lời đúng '+good+'/'+wpSession.ids.length+' câu. '+(left?left+' câu sai hoặc chưa làm cần ôn tiếp.':'Đã ôn đúng toàn bộ bộ câu này.');el('wpRetry').hidden=!left;}
}
function wpFinish(){const missing=wpSession.ids.filter(id=>!wpSession.answers[id]).length;if(missing&&!confirm('Còn '+missing+' câu chưa ôn. Kết thúc lượt này và để các câu đó vào lượt ôn tiếp?'))return;wpSession.finishedAt=Date.now();wpSave();wpRender();window.scrollTo(0,0);}
function wpExit(){if(!wpSession)return;wpSave();el('wrongPractice').hidden=true;if(wpReturnToResult&&mockExam===wpOriginExam&&mockSubmitted){el('mockScreen').hidden=false;mockPanel='results';el('appSubtitle').textContent='Kết quả thi thử';mockRender();}else{mockExam=null;showHome();}window.scrollTo(0,0);}
function wpRestart(onlyWrong){const ids=onlyWrong?wpSession.ids.filter(id=>!wpSession.answers[id]?.ok):[...wpSession.ids],id=wpSession.examId,back=wpReturnToResult;if(!ids.length)return;startWrongPractice(id,'retry',back,ids);}
el('wpBack').onclick=wpExit;el('wpSummaryBack').onclick=wpExit;
el('wpPrev').onclick=()=>{wpAt=Math.max(0,wpAt-1);wpDraft=[];wpRender();window.scrollTo(0,0);};
el('wpNext').onclick=()=>{if(wpAt===wpSession.ids.length-1)wpFinish();else{wpAt++;wpDraft=[];wpRender();window.scrollTo(0,0);}};
el('wpSubmitMulti').onclick=()=>wpGrade(wpDraft);
el('wpRetry').onclick=()=>wpRestart(true);el('wpAgain').onclick=()=>wpRestart(false);
el('mockReviewWrong').onclick=()=>startWrongPractice(mockExam,'last',true);
el('mockRetakeWrong').onclick=()=>startWrongPractice('all','saved',true);
el('mockShowWrongAnswers').onclick=()=>{mockPanel='wrong';mockRender();window.scrollTo(0,0);};
el('homeWrongAll').onclick=()=>startWrongPractice('all','saved:'+currentSubject,false,wrongPracticeAll().filter(key=>currentSubject==='all'||EXAMS[wpRef(key).examId].subject===currentSubject));

const SUBJECTS={mln131:{code:'MLN131',name:'Chủ nghĩa xã hội khoa học'},dta301:{code:'DTA301',name:'Phân tích dữ liệu'},bps301:{code:'BPS301',name:'Quy trình nghiệp vụ'}};
function studyNoteHTML(q){
 const n=q.studyNote;if(!n||!Array.isArray(n.rows)||!n.rows.length)return '';
 return '<section class="study-note"><h4>'+escapeHTML(n.title)+'</h4><div class="study-note-scroll"><table><thead><tr>'+n.columns.map(x=>'<th scope="col">'+escapeHTML(x)+'</th>').join('')+'</tr></thead><tbody>'+n.rows.map(row=>'<tr>'+row.map((x,i)=>i===0?'<th scope="row">'+escapeHTML(x)+'</th>':'<td>'+escapeHTML(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div><p>'+escapeHTML(n.caption)+'</p></section>';
}
function migrateMlnProgress(){
 const changed=[];
 for(const [id,exam]of Object.entries(EXAMS).filter(([,e])=>e.subject==='mln131')){
  const current=loadState(id),incoming={responses:{},bookmarks:[],order:exam.questions.map(q=>q.id),mistakes:{},resetAt:current.resetAt||0};
  for(const q of exam.questions){
   const original=cloudObject(q.sourceKey)||cloudObject(q.sourceLegacyKey);if(!original)continue;
   const resetAt=Math.max(Number(original.resetAt)||0,Number(current.resetAt)||0),r=original.responses?.[q.sourceId];
   if(r&&Array.isArray(r.selected)&&Number(r.at||0)>=resetAt){const selected=[...new Set(r.selected)].filter(i=>Number.isInteger(i)&&i>=0&&i<q.options.length);incoming.responses[q.id]={selected,ok:isCorrect(q,selected),at:Number(r.at)||0};}
   if(Number(original.resetAt||0)>=Number(current.resetAt||0)&&original.bookmarks?.includes(q.sourceId))incoming.bookmarks.push(q.id);
   const past=original.mistakes?.[q.sourceId];if(Array.isArray(past))incoming.mistakes[q.id]=past.filter(x=>x&&Array.isArray(x.selected)&&Number(x.at||0)>=resetAt);
  }
  const merged=cloudMerge(exam.storageKey,current,incoming),before=JSON.stringify(current),after=JSON.stringify(merged);
  if(before!==after){localStorage.setItem(exam.storageKey,after);changed.push(exam.storageKey);}
 }
 return changed;
}
function subjectExams(){return Object.entries(EXAMS).filter(([id,e])=>currentSubject==='all'||e.subject===currentSubject)}
function practiceResponses(id){
 const ids=new Set(EXAMS[id].questions.map(q=>q.id));
 return Object.entries(loadState(id).responses||{}).filter(([n])=>ids.has(Number(n)));
}
function updateUnresolvedList(){
 const items=(window.STUDY_UNRESOLVED||[]).filter(item=>currentSubject==='all'||item.subject===currentSubject);
 el('unresolvedSection').hidden=!items.length;el('unresolvedHeading').textContent='Câu cần xác minh · '+items.length;
 el('unresolvedSummary').textContent='Xem danh sách · '+items.length+' câu';
 el('unresolvedList').innerHTML=items.map(item=>{
  const q=item.question,label=SUBJECTS[item.subject].code+' · '+(q.sourceLabel||item.examTitle+' · Câu gốc '+q.id);
  return '<article class="unresolved-item"><p class="unresolved-source">'+escapeHTML(label)+'</p><h4>'+escapeHTML(q.stem)+'</h4><p class="notice">'+(q.verifiedCorrect?.length?'Đáp án đã xác nhận: '+q.verifiedCorrect.map(i=>LETTERS[i]).join(', ')+'. ':'')+escapeHTML(q.caution||'Chưa đủ căn cứ để chốt đáp án.')+'</p><details><summary>Xem phương án và phân tích</summary><ol type="A">'+q.options.map(option=>'<li>'+escapeHTML(option)+'</li>').join('')+'</ol><p>'+escapeHTML(q.detail)+'</p>'+studyNoteHTML(q)+'<p class="mock-note">'+escapeHTML(q.reference)+'</p>'+(q.image?'<details><summary>Xem ảnh đề gốc</summary><img loading="lazy" src="'+escapeHTML(q.image)+'" alt="'+escapeHTML('Ảnh gốc: '+label)+'"></details>':'')+'</details></article>';
 }).join('');
}
function updateLanding(){
 let allDone=0;
 for(const [id,info] of Object.entries(EXAMS)){
  const total=info.questions.length,rows=practiceResponses(id),done=rows.length,good=rows.filter(([,v])=>v.ok).length;
  el('homeProgress_'+id).style.width=Math.min(100,done/total*100)+'%';el('homeStats_'+id).textContent=`${done}/${total} đã làm · ${good} đúng`;if(currentSubject==='all'||info.subject===currentSubject)allDone+=done;
 }
 const active=subjectExams(),unique=collectionQuestions(active),count=unique.length,pending=mergeUniqueKeys(active.flatMap(([id])=>wrongPracticePending(id).map(n=>wpKey(id,n)))).length;
 updateAllPracticeLanding(active);
 const mlnSets=Object.values(EXAMS).filter(e=>e.subject==='mln131'),mlnMocks=mlnSets.filter(e=>e.mockEnabled!==false).length,extraGood=mlnSets.filter(e=>e.mockEnabled===false).reduce((n,e)=>n+e.questions.length,0);
 el('hubTotal').textContent=count+' câu luyện · '+active.filter(([,e])=>e.mockEnabled!==false).length+' đề thi thử';el('hubDone').textContent=unique.filter(q=>loadState(q.originExam).responses[q.originId]).length+' câu đã làm';
 for(const [subject,info] of Object.entries(SUBJECTS)){
  const sets=Object.entries(EXAMS).filter(([,e])=>e.subject===subject),done=collectionQuestions(sets).filter(q=>loadState(q.originExam).responses[q.originId]).length,wrong=mergeUniqueKeys(sets.flatMap(([id])=>wrongPracticePending(id).map(n=>wpKey(id,n)))).length;
  el('subjectStats_'+subject).textContent=done+' đã làm · '+wrong+' cần ôn lại';
 }
 document.querySelectorAll('[data-subject-card]').forEach(c=>c.hidden=currentSubject!=='all'&&c.dataset.subjectCard!==currentSubject);
 document.querySelectorAll('[data-subject]').forEach(b=>{b.classList.toggle('active',b.dataset.subject===currentSubject);b.setAttribute('aria-pressed',String(b.dataset.subject===currentSubject))});
 el('hubHeading').textContent=currentSubject==='all'?'Ba môn. Một nơi để ôn.':SUBJECTS[currentSubject].code+' · '+SUBJECTS[currentSubject].name;
 el('hubDescription').textContent=currentSubject==='all'?'Chọn môn, luyện theo đề và quay lại những câu còn sai. Chỉ luyện các câu đã có đáp án; câu chưa rõ được giữ trong danh sách riêng.':currentSubject==='mln131'?`${mlnMocks} đề, mỗi đề 60 câu; còn ${extraGood} câu có đáp án cho đề tiếp theo. Các câu chưa chốt đáp án nằm trong Câu cần xác minh. Mỗi câu giữ số gốc, giải thích và trang giáo trình để tra lại.`:'Chỉ luyện các câu đã có đáp án. Các câu chưa rõ được giữ trong Câu cần xác minh để tra cứu riêng.';
 el('wrongHeading').textContent=currentSubject==='all'?'Câu sai của cả 3 môn':'Câu sai · '+SUBJECTS[currentSubject].code;
 el('homeWrongStats').textContent=pending+' câu sai hoặc bỏ trống cần ôn lại, gom từ '+active.length+' bộ đề.';el('homeWrongAll').textContent='Ôn '+pending+' câu sai →';el('homeWrongAll').disabled=pending===0;
 el('examHeading').textContent=currentSubject==='all'?'Các nhóm câu hỏi hiện có':currentSubject==='mln131'?'MLN131 · Đề ôn tập và câu bổ sung':'Bộ đề '+SUBJECTS[currentSubject].code;
 updateUnresolvedList();
}
function showHome(){
 if(currentExam)save();currentExam=null;
 for(const id of ['wrongPractice','mockScreen','appScreen','zipReview'])el(id).hidden=true;
 closeDrawer();document.body.classList.add('home-view');el('landing').hidden=false;el('homeButton').hidden=true;el('topStat').hidden=true;
 el('appSubtitle').textContent=currentSubject==='all'?'MLN131 · DTA301 · BPS301':SUBJECTS[currentSubject].name;
 document.title=currentSubject==='all'?'Góc ôn tập · MLN131 · DTA301 · BPS301':SUBJECTS[currentSubject].code+' · Góc ôn tập';
 updateLanding();window.scrollTo({top:0,behavior:'instant'});
}
function hubSelect(subject){
 if(subject!=='all'&&!SUBJECTS[subject])return;
 if(mockExam&&!mockSubmitted)mockSave();if(wpSession)wpSave();mockExam=null;currentSubject=subject;
 history.replaceState(null,'',subject==='all'?location.pathname:location.pathname+'?mon='+subject);showHome();
}
function hubBackup(){
 if(currentExam)save();if(mockExam&&!mockSubmitted)mockSave();if(wpSession)wpSave();
 const data={};for(const k of CLOUD_ALLOWED()){const v=cloudObject(k);if(v)data[k]=v}
 downloadText('Goc_On_Tap_3_Mon_Tien_Do.json',JSON.stringify({app:'StudyHub_3_Mon',version:1,exportedAt:new Date().toISOString(),data},null,2));toast('Đã xuất tiến độ 3 môn, không bao gồm thông tin đăng nhập.');
}
function importCleanPractice(incoming,exam){
 const allQuestions=[...exam.questions,...(exam.mergedQuestions||[])],ids=allQuestions.map(q=>q.id),s={responses:{},bookmarks:[],order:exam.questions.map(q=>q.id),mistakes:{}};
 if(!incoming||typeof incoming!=='object')throw Error('Dữ liệu đề không hợp lệ');
 if(Array.isArray(incoming.order))s.order=[...new Set([...incoming.order.filter(n=>ids.includes(n)),...ids])];
 for(const [n,r]of Object.entries(incoming.responses||{})){
  const q=allQuestions.find(q=>q.id===Number(n));if(!q||!r||!Array.isArray(r.selected))continue;
  const selected=[...new Set(r.selected)].filter(i=>Number.isInteger(i)&&i>=0&&i<q.options.length);
  s.responses[n]={selected,ok:isCorrect(q,selected),at:Number(r.at)||Date.now()};
 }
 s.bookmarks=Array.isArray(incoming.bookmarks)?incoming.bookmarks.filter(n=>ids.includes(n)):[];
 for(const [n,entries]of Object.entries(incoming.mistakes||{})){if(ids.includes(Number(n))&&Array.isArray(entries))s.mistakes[n]=entries.filter(x=>x&&Array.isArray(x.selected)).map(x=>({selected:x.selected.filter(Number.isInteger),at:Number(x.at)||Date.now(),source:String(x.source||'Nhập bản sao lưu')}))}
 return s;
}
function hubImportPayload(p){
 let entries={};
 if(p.app==='StudyHub_3_Mon'&&p.version===1&&p.data&&typeof p.data==='object'){
  for(const [k,v]of Object.entries(p.data)){if(!cloudAllowedKey(k)||!v||typeof v!=='object')continue;const pair=Object.entries(EXAMS).find(([,e])=>e.storageKey===k);entries[k]=pair?importCleanPractice(v,pair[1]):v}
 }else if(['DTA301_Quiz_Mobile','BPS301_Quiz_Mobile','MLN131_Quiz_Mobile'].includes(p.app)){
  const subj=p.app.split('_')[0].toLowerCase(),pair=Object.entries({...EXAMS,...window.STUDY_MLN_LEGACY}).find(([id,e])=>e.subject===subj&&(id===p.exam||e.legacyExamId===p.exam));
  if(!pair)throw Error('Không tìm thấy đề tương ứng');entries[pair[1].storageKey]=importCleanPractice(p.state,pair[1]);
 }else if(p.version===1&&p.wrong&&p.sessions){
  const e=window.STUDY_MLN_LEGACY.mln131_01,s=importCleanPractice({responses:{}},e),answered={...p.sessions.practice?.answers,...(p.sessions.exam?.submitted?p.sessions.exam.answers:{})};
  for(const [key,value]of Object.entries(answered)){const n=Number(key.replace('mln131-q','')),q=e.questions.find(q=>q.id===n);if(q&&Number.isInteger(value)&&q.options[value]!==undefined)s.responses[n]={selected:[value],ok:q.correct.includes(value),at:Date.now()}}
  for(const key of Object.keys(p.wrong)){const n=Number(key.replace('mln131-q',''));if(e.questions.some(q=>q.id===n))s.responses[n]={selected:[],ok:false,at:Date.now()}}
  entries[e.storageKey]=s;
 }else throw Error('Không nhận diện được file tiến độ');
 if(!Object.keys(entries).length)throw Error('Không có dữ liệu ôn tập phù hợp');
 if(!confirm('Nhập '+Object.keys(entries).length+' mục tiến độ? Dữ liệu sẽ được gộp theo thời điểm trả lời; các môn khác vẫn được giữ.'))return false;
 for(const [k,v]of Object.entries(entries)){const merged=cloudMerge(k,cloudObject(k),v);localStorage.setItem(k,JSON.stringify(merged));cloudSchedule(k)}
 for(const key of migrateMlnProgress())cloudSchedule(key);
 showHome();toast('Đã nhập và gộp tiến độ.');return true;
}
function hubInit(){
 for(const key of migrateMlnProgress())cloudSchedule(key);
 document.querySelectorAll('[data-subject]').forEach(b=>b.onclick=()=>hubSelect(b.dataset.subject));el('hubHome').onclick=()=>hubSelect('all');
 el('hubBackup').onclick=hubBackup;el('hubRestore').onclick=()=>el('hubRestoreFile').click();
 el('hubRestoreFile').onchange=async e=>{try{if(e.target.files[0])hubImportPayload(JSON.parse(await e.target.files[0].text()))}catch(err){toast('Không thể nhập: '+err.message)}e.target.value=''};
 const subject=new URLSearchParams(location.search).get('mon');if(SUBJECTS[subject])currentSubject=subject;
 collectionInit();
 showHome();
}

function keywordRanges(stem,keywords){
 const lower=stem.toLocaleLowerCase(),word=ch=>!!ch&&/[\p{L}\p{N}_]/u.test(ch),found=[];
 for(const term of keywords||[]){
  if(typeof term!=='string'||!term.length)continue;
  const needle=term.toLocaleLowerCase();let from=0,at;
  while((at=lower.indexOf(needle,from))!==-1){
   const end=at+term.length;from=end;
   if(word(term[0])&&word(stem[at-1]))continue;
   if(word(term[term.length-1])&&word(stem[end]))continue;
   found.push([at,end]);
  }
 }
 const merged=[];
 for(const range of found.sort((a,b)=>a[0]-b[0]||b[1]-a[1])){
  const last=merged[merged.length-1];
  if(last&&range[0]<last[1])last[1]=Math.max(last[1],range[1]);else merged.push([...range]);
 }
 return merged;
}
function renderKeywordHint(stemId,buttonId,q,key){
 const target=el(stemId),button=el(buttonId),ranges=keywordRanges(q.stem,q.keywords);
 if(target.dataset.keywordQuestion!==key){target.dataset.keywordQuestion=key;button.setAttribute('aria-pressed','false');}
 target.classList.add('keyword-stem');button.disabled=!ranges.length;
 const paint=shown=>{
  const fragment=document.createDocumentFragment();let end=0;
  if(shown)for(const [start,stop]of ranges){
   fragment.appendChild(document.createTextNode(q.stem.slice(end,start)));
   const bold=document.createElement('strong');bold.className='question-keyword';bold.textContent=q.stem.slice(start,stop);fragment.appendChild(bold);end=stop;
  }
  fragment.appendChild(document.createTextNode(q.stem.slice(end)));target.replaceChildren(fragment);
  button.setAttribute('aria-pressed',String(shown));button.textContent=shown?'Ẩn gợi ý':'Gợi ý';
  button.title=shown?'Ẩn các từ khóa in đậm':'In đậm từ khóa trong câu hỏi';
 };
 button.onclick=()=>paint(button.getAttribute('aria-pressed')!=='true');
 paint(button.getAttribute('aria-pressed')==='true');
}
function resetKeywordHints(){
 for(const [stemId,buttonId]of [['prompt','keywordHint'],['mockStem','mockKeywordHint'],['wpStem','wpKeywordHint']]){
  const target=el(stemId),button=el(buttonId);if(!target||!button)continue;
  delete target.dataset.keywordQuestion;target.textContent=target.textContent;button.setAttribute('aria-pressed','false');button.textContent='Gợi ý';
 }
}

/* One logical question may appear in several original exams. Keep each exam's
   numbering, while translating choices and sharing practice progress by group. */
function mergeRefKey(examId,id){return examId+':'+id;}
function mergeGroup(examId,id){return (window.STUDY_MERGE_GROUPS||[]).find(g=>g.members.some(m=>m.examId===examId&&m.id===Number(id)));}
function mergeQuestion(examId,id){const e=EXAMS[examId];return [...(e?.questions||[]),...(e?.mergedQuestions||[])].find(q=>q.id===Number(id));}
function mergeCanonicalKey(examId,id){return mergeGroup(examId,id)?.canonicalKey||mergeRefKey(examId,id);}
function mergeTranslate(selected,from,to){
 const group=mergeGroup(from.examId,from.id);if(!group||from.examId===to.examId&&from.id===to.id)return [...selected];
 const source=group.members.find(m=>m.examId===from.examId&&m.id===Number(from.id)),target=group.members.find(m=>m.examId===to.examId&&m.id===Number(to.id));
 return selected.map(i=>target.toCanonical.indexOf(source.toCanonical[i])).filter(i=>i>=0).sort((a,b)=>a-b);
}
function mergeEntry(entry,from,to){return {...entry,selected:mergeTranslate(entry.selected||[],from,to)};}
function loadState(examId){
 if(COLLECTIONS[examId])return collectionLoadState(examId);
 const result=loadStoredState(examId),cache=new Map([[examId,result]]);
 const read=id=>{if(!cache.has(id))cache.set(id,loadStoredState(id));return cache.get(id);};
 for(const group of window.STUDY_MERGE_GROUPS||[]){
  const target=group.members.find(m=>m.examId===examId);if(!target)continue;
  const resetAt=Math.max(...group.members.map(m=>Number(read(m.examId).resetAt)||0));
  const responses=group.members.map(m=>({member:m,response:read(m.examId).responses[m.id]})).filter(x=>x.response&&Number(x.response.at||0)>=resetAt).sort((a,b)=>Number(b.response.at||0)-Number(a.response.at||0));
  if(responses.length){const x=responses[0],r=mergeEntry(x.response,x.member,target);r.ok=isCorrect(mergeQuestion(examId,target.id),r.selected);result.responses[target.id]=r;}else delete result.responses[target.id];
  const bookmarked=group.members.some(m=>read(m.examId).bookmarks.includes(m.id));
  result.bookmarks=bookmarked?[...new Set([...result.bookmarks,target.id])]:result.bookmarks.filter(n=>n!==target.id);
  const history=new Map();
  for(const m of group.members)for(const entry of read(m.examId).mistakes?.[m.id]||[])if(Number(entry.at||0)>=resetAt){const r=mergeEntry(entry,m,target);history.set(JSON.stringify([r.at,r.selected,r.source]),r);}
  result.mistakes[target.id]=[...history.values()].sort((a,b)=>Number(a.at||0)-Number(b.at||0));
  if(resetAt){result.questionResetAt=result.questionResetAt||{};result.questionResetAt[target.id]=resetAt;}
 }
 return result;
}
function savePracticeState(examId,value){
 const before=loadState(examId),states=new Map([[examId,value]]),changed=new Set([examId]);
 const read=id=>{if(!states.has(id))states.set(id,loadStoredState(id));return states.get(id);};
 for(const group of window.STUDY_MERGE_GROUPS||[]){
  const source=group.members.find(m=>m.examId===examId);if(!source)continue;
  const next=value.responses[source.id],previous=before.responses[source.id];
  const responseChanged=JSON.stringify(next)!==JSON.stringify(previous),bookmarkChanged=value.bookmarks.includes(source.id)!==before.bookmarks.includes(source.id),historyChanged=JSON.stringify(value.mistakes?.[source.id]||[])!==JSON.stringify(before.mistakes?.[source.id]||[]),resetting=Number(value.resetAt||0)>Number(before.resetAt||0);
  for(const target of group.members){
   if(target.examId===examId)continue;const s=read(target.examId);
   if(responseChanged||resetting){
    if(next&&Number(next.at||0)>=Number(s.responses[target.id]?.at||0))s.responses[target.id]=mergeEntry(next,source,target);
    else if(!next&&Number(s.responses[target.id]?.at||0)<=Math.max(Number(previous?.at)||0,Number(value.resetAt)||0))delete s.responses[target.id];
    changed.add(target.examId);
   }
   if(bookmarkChanged||resetting){s.bookmarks=value.bookmarks.includes(source.id)?[...new Set([...s.bookmarks,target.id])]:s.bookmarks.filter(n=>n!==target.id);changed.add(target.examId);}
   if(historyChanged||resetting){s.mistakes=s.mistakes||{};s.mistakes[target.id]=(value.mistakes?.[source.id]||[]).map(r=>mergeEntry(r,source,target));changed.add(target.examId);}
  }
 }
 for(const id of changed){const key=EXAMS[id].storageKey;localStorage.setItem(key,JSON.stringify(states.get(id)));if(typeof cloudSchedule==='function')cloudSchedule(key);}
}
function mergeUniqueKeys(keys){const seen=new Set();return keys.filter(key=>{const r=wpRef(key),canonical=mergeCanonicalKey(r.examId,r.id);if(seen.has(canonical))return false;seen.add(canonical);return true;});}
function collectionQuestions(sources){
 const questions=[],seen=new Set();
 for(const [eid,e]of sources)for(const original of e.questions){
  if(original.gradable===false||!original.correct?.length)continue;
  const key=mergeCanonicalKey(eid,original.id);if(seen.has(key))continue;seen.add(key);
  const group=mergeGroup(eid,original.id),origins=group?.members||[{examId:eid,id:original.id}],labels=origins.map(m=>(EXAMS[m.examId].short||EXAMS[m.examId].title)+' · Câu '+m.id);
  questions.push({...original,id:questions.length+1,originExam:eid,originId:original.id,canonicalKey:key,origins,sourceLabel:group?labels.join(' / '):original.sourceLabel||(e.short||e.title)+' · Câu gốc '+original.id});
 }
 return questions;
}

const COLLECTIONS={};
const collectionSnapshots={};
function practiceInfo(id){return COLLECTIONS[id]||EXAMS[id];}
function collectionQuestionKey(q){return q.canonicalKey||mergeCanonicalKey(q.originExam,q.originId);}
function collectionOrderKey(scope){return 'studyhub_mock_v2_collection_'+scope;}
function updateAllPracticeLanding(active){
 const questions=collectionQuestions(active),progress=new Map(active.map(([id])=>[id,loadState(id)])),total=questions.length,done=questions.filter(q=>progress.get(q.originExam).responses[q.originId]).length;
 el('allPracticeHeading').textContent=currentSubject==='all'?'Ôn chung cả 3 môn':'Ôn chung '+SUBJECTS[currentSubject].code;
 el('allPracticeStats').textContent=total+' câu có đáp án · '+done+' câu đã làm · Câu trùng đã gộp, tiến độ dùng chung';
 el('allPracticeOpen').textContent='Ôn tất cả '+total+' câu →';
}
function openAllPractice(scope=currentSubject){
 if(scope!=='all'&&!SUBJECTS[scope])return;
 if(currentExam)save();currentExam=null;
 const sources=Object.entries(EXAMS).filter(([,e])=>scope==='all'||e.subject===scope),questions=collectionQuestions(sources);
 const id='collection_'+scope,label=scope==='all'?'cả 3 môn':SUBJECTS[scope].code;
 COLLECTIONS[id]={isCollection:true,scope,subject:scope,legacyExamId:id,short:scope==='all'?'3 môn · Ôn chung':SUBJECTS[scope].code+' · Ôn chung',title:'Ôn chung '+label+' · '+questions.length+' câu',notice:'Toàn bộ câu đã có đáp án trong '+label+'. Lọc theo chủ đề, tìm kiếm hoặc trộn câu để ôn. Câu trả lời, đánh dấu và lịch sử sai dùng chung với từng bộ đề; câu chưa rõ được giữ ở danh sách riêng.',sourceExams:sources.map(([eid])=>eid),questions};
 openExam(id);
}
function collectionLoadState(id){
 const info=COLLECTIONS[id],sourceStates=new Map(info.sourceExams.map(eid=>[eid,loadState(eid)]));
 const result={responses:{},bookmarks:[],order:[],mistakes:{},resetAt:0},byKey=new Map(info.questions.map(q=>[collectionQuestionKey(q),q.id]));
 for(const q of info.questions){
  const source=sourceStates.get(q.originExam),r=source.responses[q.originId],history=source.mistakes?.[q.originId];
  if(r)result.responses[q.id]=JSON.parse(JSON.stringify(r));
  if(source.bookmarks.includes(q.originId))result.bookmarks.push(q.id);
  if(Array.isArray(history))result.mistakes[q.id]=JSON.parse(JSON.stringify(history));
 }
 const saved=cloudObject(collectionOrderKey(info.scope));
 const translateKey=key=>{const [eid,n]=String(key).split(':');return mergeCanonicalKey(eid,Number(n));};
 const keys=[...new Set([...(Array.isArray(saved?.order)?saved.order:[]).map(translateKey),...byKey.keys()])].filter(key=>byKey.has(key));
 result.order=keys.map(key=>byKey.get(key));
 collectionSnapshots[id]=JSON.parse(JSON.stringify(result));return result;
}
function saveCollection(){
 const info=COLLECTIONS[currentExam],before=collectionSnapshots[currentExam]||{responses:{},bookmarks:[],mistakes:{}},sourceStates=new Map(),changed=new Set();
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),get=eid=>{if(!sourceStates.has(eid))sourceStates.set(eid,loadState(eid));return sourceStates.get(eid);};
 const resetting=Number(state.resetAt||0)>Number(before.resetAt||0);
 if(resetting)for(const eid of info.sourceExams){sourceStates.set(eid,{responses:{},bookmarks:[],order:EXAMS[eid].questions.map(q=>q.id),mistakes:{},resetAt:state.resetAt});changed.add(eid);}
 if(!resetting)for(const q of info.questions){
  const previous=before.responses[q.id],next=state.responses[q.id];
  if(!same(previous,next)){
   const target=get(q.originExam),existing=target.responses[q.originId];
   if(next&&Number(next.at||0)>=Number(target.resetAt||0)&&Number(next.at||0)>=Number(existing?.at||0)){target.responses[q.originId]=JSON.parse(JSON.stringify(next));changed.add(q.originExam);}
   else if(!next&&same(existing,previous)){delete target.responses[q.originId];changed.add(q.originExam);}
  }
  const was=before.bookmarks.includes(q.id),now=state.bookmarks.includes(q.id);
  if(was!==now){const target=get(q.originExam);target.bookmarks=now?[...new Set([...target.bookmarks,q.originId])]:target.bookmarks.filter(n=>n!==q.originId);changed.add(q.originExam);}
  const oldHistory=before.mistakes[q.id]||[],newHistory=state.mistakes[q.id]||[];
  if(!same(oldHistory,newHistory)){
   const target=get(q.originExam),known=new Map((target.mistakes[q.originId]||[]).map(entry=>[JSON.stringify(entry),entry]));
   for(const entry of newHistory)if(Number(entry.at||0)>=Number(target.resetAt||0))known.set(JSON.stringify(entry),entry);
   target.mistakes[q.originId]=[...known.values()].sort((a,b)=>(a.at||0)-(b.at||0));changed.add(q.originExam);
  }
 }
 for(const eid of changed)savePracticeState(eid,sourceStates.get(eid));
 const qMap=new Map(info.questions.map(q=>[q.id,q])),order=state.order.map(n=>qMap.get(n)).filter(Boolean).map(collectionQuestionKey);
 const key=collectionOrderKey(info.scope),saved=cloudObject(key);
 if(!same(saved?.order,order)){localStorage.setItem(key,JSON.stringify({version:1,at:Date.now(),order}));cloudSchedule(key);}
 state=collectionLoadState(currentExam);
}
function collectionResetMessage(){
 const info=COLLECTIONS[currentExam];
 return info?'Xóa tiến độ luyện tập, đánh dấu và lịch sử sai của toàn bộ '+(info.scope==='all'?'3 môn':SUBJECTS[info.scope].code)+'? Thao tác này cũng đặt lại tiến độ trong các bộ đề tương ứng.':'Xóa tiến độ của '+EXAMS[currentExam].title+'? Các câu trùng dùng chung tiến độ trong những bộ đề liên quan.';
}
function collectionPracticeLabels(){
 const info=practiceInfo(currentExam),combined=!!info?.isCollection;
 el('appSubtitle').textContent=info.short+(combined?' · Tiến độ dùng chung':info.subject==='bps301'?' · Câu trùng dùng chung tiến độ':' · Tiến độ độc lập');
 el('backupProgress').textContent=combined?'↓ Sao lưu tiến độ 3 môn':'↓ Sao lưu tiến độ';
 el('restoreProgress').textContent=combined?'↑ Nhập bản sao lưu':'↑ Khôi phục tiến độ';
}
function collectionInit(){
 el('allPracticeOpen').onclick=()=>openAllPractice();
 const backup=el('backupProgress').onclick,restore=el('restoreProgress').onclick;
 el('backupProgress').onclick=()=>COLLECTIONS[currentExam]?hubBackup():backup();
 el('restoreProgress').onclick=()=>COLLECTIONS[currentExam]?el('hubRestoreFile').click():restore();
}

hubInit();
