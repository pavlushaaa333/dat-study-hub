# Đạt Study Hub — Góc ôn tập 3 môn

Ứng dụng ôn tập MLN131, DTA301 và BPS301: luyện từng câu, thi thử, giải thích đáp án, gợi ý từ khóa, đánh dấu câu hỏi và ôn lại các câu sai. Có lưu tiến độ trên trình duyệt, sao lưu/nhập tiến độ và đăng nhập để đồng bộ qua Supabase.

Web đang dùng: https://dat-study-hub.vercel.app/

## Chạy tại máy

Đây là web tĩnh HTML/CSS/JavaScript, không có bước cài npm hoặc build.

```bash
git clone https://github.com/pavlushaaa333/dat-study-hub.git
cd dat-study-hub
python -m http.server 8080
```

Trên máy dùng lệnh `python3`, thay `python` bằng `python3`. Mở http://localhost:8080 để sử dụng. Nên chạy bằng HTTP server để đường dẫn ảnh và các chức năng trình duyệt hoạt động nhất quán.

## Các phần chính

| Đường dẫn | Nội dung |
| --- | --- |
| `index.html` | Giao diện và CSS |
| `app.js` | Luyện tập, thi thử, tiến độ, đồng bộ và đăng nhập |
| `data/` | Ngân hàng câu hỏi và ánh xạ giữa các bộ đề |
| `source/` | Dữ liệu đối chiếu, ghi chú nguồn và các câu cần xác minh |
| `password-reset.html`, `password-reset.js` | Khôi phục mật khẩu |
| `auth-callback.js` | Xử lý callback đăng nhập |
| `vercel.json` | Cấu hình deploy web tĩnh |
| `README.txt` | Nhật ký nội dung và cập nhật các phiên bản trước |

Các ảnh câu hỏi được giữ ở đúng đường dẫn tương đối trong mã nguồn. Khi di chuyển hoặc sửa bộ đề, cần giữ nguyên liên kết ảnh và ID câu hỏi nếu muốn tiếp tục dùng tiến độ cũ.

## Thử nghiệm độc lập và Supabase

Luyện tập và lưu tiến độ trên trình duyệt có thể dùng mà không đăng nhập. Nên thử bằng một browser profile riêng để tách tiến độ thử nghiệm khỏi tài khoản đang học.

Bản source này giữ nguyên cấu hình Supabase của ứng dụng đang chạy. Các khóa `sb_publishable_...` trong frontend là khóa công khai dành cho trình duyệt; chúng không phải khóa quản trị. Không đưa khóa `service_role`, `sb_secret_...`, mật khẩu hoặc access token vào repo.

Để chạy một bản độc lập có đăng nhập/đồng bộ:

1. Tạo dự án Supabase riêng.
2. Thay `CLOUD_ORIGIN` và `CLOUD_KEY` trong `app.js`.
3. Thay `AUTH_ORIGIN` và `AUTH_PUBLIC_KEY` trong `password-reset.js`.
4. Cấu hình Supabase Auth Site URL và Redirect URLs cho localhost/domain của bản riêng; rà soát URL `redirect_to` trong hàm đăng ký ở `app.js`.
5. Cấu hình bảng `bps301_user_state` và Row Level Security cho phép mỗi tài khoản chỉ đọc/ghi dữ liệu thuộc `auth.uid()` của mình. Client hiện dùng các trường `user_id`, `state_key`, `payload`, `updated_at` và upsert theo cặp `user_id,state_key`.

Bản ZIP gốc chưa kèm SQL migration hoặc bản xuất database. Repo này chứa mã nguồn ứng dụng và dữ liệu câu hỏi tĩnh, không chứa tài khoản, mật khẩu, phiên đăng nhập hay tiến độ người dùng trong database. Việc mở bản clone và đăng nhập với cấu hình mặc định vẫn kết nối tới Supabase hiện có; hãy đổi sang dự án riêng trước khi thử sửa chức năng đồng bộ.

## Deploy Vercel

Import repository vào Vercel, dùng thư mục gốc chứa `index.html`, chọn framework **Other**, để trống Build Command và Output Directory. File `vercel.json` đã có trong repo. Sau khi deploy bản riêng, cập nhật URL chuyển hướng của Supabase nếu dùng đăng nhập.

## Nội dung học tập

Đáp án và giải thích phục vụ ôn tập, không phải đáp án chính thức của trường. Các câu còn thiếu hình hoặc chưa đủ căn cứ được giữ trong danh sách cần xác minh. Quyền sử dụng sách, slide và ảnh câu hỏi gốc thuộc các chủ sở hữu tương ứng; repo không tự cấp quyền sử dụng lại những tài liệu đó.

Source ban đầu: `Goc_On_Tap_3_Mon_Vercel.zip`, phiên bản lưu ngày 20/11/2026. Lần chuẩn bị repo này bổ sung hướng dẫn và `.gitignore`, giữ nguyên mã ứng dụng cùng dữ liệu câu hỏi.
