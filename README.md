# HR CV Screener

Ứng dụng sàng lọc CV không cần cơ sở dữ liệu và không trích xuất text/OCR tại backend. Gemini nhận trực tiếp file PDF gốc để đọc cả nội dung lẫn bố cục CV/JD.

## Luồng hoạt động

`HR tải JD PDF + tối đa 5 CV PDF` → `Backend mã hoá buffer thành base64` → `một request Gemini` → `JSON xếp hạng` → `Frontend hiển thị kết quả`.

Kết quả chỉ nằm trong state của trình duyệt sau khi quét; ứng dụng không lưu CV hay JD.

## Sử dụng

1. Tải một JD PDF (hoặc dán mô tả công việc) và tối đa 5 CV PDF, mỗi tệp không quá 5 MB.
2. Nhập yêu cầu bổ sung của HR nếu cần.
3. Chọn ngưỡng điểm và số lượng cần trả về.
4. Bấm **Bắt đầu quét bằng AI**. Gemini chấm tất cả CV trong cùng một request rồi trả danh sách đã xếp hạng.

## Chạy dự án

1. Cài Node.js 20+.
2. Sao chép `.env.example` thành `apps/api/.env`, sau đó điền `GEMINI_API_KEY`.
3. Chạy:

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`. API chạy tại `http://localhost:3001`.
