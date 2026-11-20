'use strict';
const AUTH_ORIGIN="https://phamnkkrlhxlymermxdj.supabase.co",AUTH_PUBLIC_KEY="sb_publishable_Wsi3nWCxX2nZht7EmnDolg_72Yp0PvS";
let recoveryToken='';
const node=id=>document.getElementById(id);
function status(text,error=false){node('message').textContent=text;node('message').classList.toggle('error',error);}
async function acceptRecoveryLink(value){
 recoveryToken='';node('passwordForm').hidden=true;
 let url;try{url=new URL(value,location.origin);}catch(e){status('Địa chỉ không hợp lệ. Hãy sao chép đầy đủ địa chỉ sau khi bấm link trong email.',true);return false;}
 const allowed=new Set([location.hostname,'localhost','127.0.0.1','dat-study-hub.vercel.app','bps301-exam-practice.vercel.app',new URL(AUTH_ORIGIN).hostname]);
 if(!['https:','http:'].includes(url.protocol)||!allowed.has(url.hostname)){status('Chỉ dùng địa chỉ khôi phục của web ôn tập hoặc trang localhost được mở từ email.',true);return false;}
 const params=new URLSearchParams(url.hash.slice(1));
 if(params.get('error')||params.get('error_description')){status('Link không hợp lệ hoặc đã hết hạn. Hãy yêu cầu email đặt lại mật khẩu mới.',true);return false;}
 let token=params.get('access_token');
 const original=url.origin===AUTH_ORIGIN&&url.pathname==='/auth/v1/verify'&&url.searchParams.get('type')==='recovery';
 const hash=original&&(url.searchParams.get('token_hash')||url.searchParams.get('token'));
 if(!token&&!hash){status('Địa chỉ chưa có mã khôi phục. Hãy sao chép đường liên kết của nút Reset Password trong email mới nhất, hoặc toàn bộ địa chỉ localhost sau khi bấm nút đó, rồi dán vào ô dưới.',true);return false;}
 node('useRecoveryLink').disabled=true;node('recoveryLink').value='';status('Đang kiểm tra link khôi phục…');
 try{
  if(!token){
   const response=await fetch(AUTH_ORIGIN+'/auth/v1/verify',{method:'POST',headers:{apikey:AUTH_PUBLIC_KEY,'Content-Type':'application/json'},body:JSON.stringify({token_hash:hash,type:'recovery'}),cache:'no-store',referrerPolicy:'no-referrer'});
   const session=await response.json().catch(()=>({}));
   if(!response.ok||!session.access_token)throw Error('Link đã hết hạn hoặc đã được sử dụng. Hãy dùng địa chỉ đầy đủ của trang localhost đã mở, hoặc yêu cầu email mới.');
   token=session.access_token;
  }
  const response=await fetch(AUTH_ORIGIN+'/auth/v1/user',{headers:{apikey:AUTH_PUBLIC_KEY,Authorization:'Bearer '+token},cache:'no-store',referrerPolicy:'no-referrer'});
  const user=await response.json().catch(()=>({}));
  if(!response.ok||!user.id||!user.email)throw Error('Phiên đăng nhập đã hết hạn hoặc địa chỉ bị thiếu. Hãy lấy link đặt lại mật khẩu mới.');
  recoveryToken=token;node('passwordForm').hidden=false;node('linkHelp').hidden=true;
  node('intro').textContent='Đặt mật khẩu mới cho tài khoản '+user.email+'.';status('Đã xác minh phiên. Nhập mật khẩu mới bên dưới.');return true;
 }catch(error){status(error.message||'Không kết nối được hệ thống đăng nhập. Hãy thử lại.',true);return false;}
 finally{node('useRecoveryLink').disabled=false;}
}
const initialAddress=location.href;
history.replaceState(null,'',location.pathname);
if(location.protocol==='https:'){
 if(new URL(initialAddress).hash||new URL(initialAddress).search)acceptRecoveryLink(initialAddress);
 else status('Mở link đặt lại mật khẩu trong email. Nếu link chuyển về localhost, dùng phần hướng dẫn bên dưới.');
}
else status('Hãy mở trang khôi phục qua HTTPS trên web ôn tập.',true);
node('useRecoveryLink').onclick=()=>acceptRecoveryLink(node('recoveryLink').value.trim());
node('passwordForm').onsubmit=async event=>{
 event.preventDefault();const password=node('newPassword').value,confirm=node('confirmPassword').value;
 if(!recoveryToken){status('Hãy mở link khôi phục trong email trước.',true);return;}
 if(password.length<8){status('Mật khẩu mới cần tối thiểu 8 ký tự.',true);return;}
 if(password!==confirm){status('Hai ô mật khẩu chưa giống nhau.',true);return;}
 node('submitPassword').disabled=true;status('Đang cập nhật mật khẩu…');
 try{
  const response=await fetch(AUTH_ORIGIN+'/auth/v1/user',{method:'PUT',headers:{apikey:AUTH_PUBLIC_KEY,Authorization:'Bearer '+recoveryToken,'Content-Type':'application/json'},body:JSON.stringify({password}),cache:'no-store',referrerPolicy:'no-referrer'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.msg||data.message||data.error_description||'Link hết hạn hoặc không cập nhật được mật khẩu. Hãy yêu cầu link mới.');
  recoveryToken='';node('newPassword').value='';node('confirmPassword').value='';node('passwordForm').hidden=true;node('heading').textContent='Đã đổi mật khẩu';node('intro').textContent='Dùng mật khẩu mới để đăng nhập và đồng bộ tiến độ học.';node('success').hidden=false;status('Mật khẩu mới đã được lưu.');
 }catch(error){status('Chưa đổi được mật khẩu: '+error.message,true);}
 finally{node('submitPassword').disabled=false;}
};
