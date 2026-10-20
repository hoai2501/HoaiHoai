# Tuition Payment Backend

Hai service Node.js/Express độc lập, dùng dữ liệu in-memory để mô phỏng thanh
toán học phí và ngân hàng.

## Chạy

Yêu cầu Node.js 18 trở lên. Tại thư mục `Backend`:

```sh
npm install
npm run bank
```

Mở terminal thứ hai:

```sh
npm run fee
```

- Fee Service: `http://localhost:4001`
- Bank Service: `http://localhost:4002`

Đặt cùng `WEBHOOK_SECRET` trong môi trường của cả hai service khi chạy ngoài
môi trường demo. Dữ liệu sẽ được khởi tạo lại khi service khởi động lại.

## API

### Fee Service

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `GET` | `/health` | Kiểm tra service |
| `GET` | `/students/:id/fees` | Xem công nợ (sinh viên `1`: 50.000.000 VND; `2`: 3.200.000 VND) |
| `POST` | `/students/:id/payments` | Tạo thanh toán |
| `GET` | `/payments/:paymentId` | Tra cứu trạng thái thanh toán |
| `POST` | `/webhooks/bank` | Nhận webhook nội bộ từ Bank Service |

Ví dụ:

```sh
curl -i -X POST http://localhost:4001/students/1/payments \
  -H 'Content-Type: application/json' \
  -d '{"amount":10000}'
```

Giao dịch thành công trả `201` và `PAID`; ngân hàng từ chối trả `402` và
`FAILED`; ngân hàng không khả dụng hoặc không thể kết nối trả `503` và `FAILED`;
timeout hoặc kết quả chưa rõ trả `504` và `PENDING` để đối soát. Khi giao dịch
ở `PENDING`, công nợ chưa bị giảm.

### Bank Service

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `GET` | `/health` | Kiểm tra service và chế độ mô phỏng |
| `POST` | `/charges` | Tiếp nhận yêu cầu thu tiền từ Fee Service |
| `GET` | `/charges/:reference` | Tra cứu giao dịch ngân hàng |

Khi thu tiền thành công, Bank Service trả `201` cùng `chargeId`, `reference`,
`amount` và trạng thái `SUCCESS`, đồng thời gửi webhook xác nhận đến Fee
Service. Có thể mô phỏng kết quả bằng
`BANK_MODE`: `success` (mặc định), `decline`, `unavailable` hoặc `timeout`.
Các biến cấu hình khác: `FEE_PORT`, `BANK_PORT`, `BANK_URL`, `FEE_WEBHOOK_URL`,
`BANK_TIMEOUT_MS`, `WEBHOOK_TIMEOUT_MS`, `BANK_CALLBACK_DELAY_MS`,
`BANK_TIMEOUT_DELAY_MS`, và `WEBHOOK_SECRET`.

## Kiểm thử

```sh
npm test
```
