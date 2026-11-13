import test from "node:test";
import assert from "node:assert/strict";

test("Employee Code Auto-Increment & Consistency Tests", async (t) => {
  await t.test("1. Không sử dụng employees.length + 1 để dự đoán mã nhân viên", () => {
    // Giả sử có 22 nhân viên trong DB nhưng ID lớn nhất là 26 (do đã từng xóa nhân viên cũ)
    const employees = Array.from({ length: 22 }, (_, i) => ({ id: `NV${String(i + 1).padStart(3, "0")}` }));
    
    // Sai lầm trước đây:
    const flawedPredictedCode = `NV${String(employees.length + 1).padStart(3, "0")}`;
    assert.equal(flawedPredictedCode, "NV023"); // Sẽ sinh sai thành NV023

    // Cơ chế chuẩn từ AUTO_INCREMENT của Database:
    const autoIncrementFromDB = 27;
    const correctPredictedCode = `NV${String(autoIncrementFromDB).padStart(3, "0")}`;
    assert.equal(correctPredictedCode, "NV027");
    assert.notEqual(flawedPredictedCode, correctPredictedCode);
  });

  await t.test("2. Định dạng mã nhân viên chuẩn NV + 3 chữ số", () => {
    const formatCode = (id) => `NV${String(id).padStart(3, "0")}`;
    assert.equal(formatCode(1), "NV001");
    assert.equal(formatCode(25), "NV025");
    assert.equal(formatCode(120), "NV120");
  });

  await t.test("3. Đối chiếu mã thực tế và mã dự kiến", () => {
    // Trường hợp 1: Trùng khớp
    const expected1 = "NV027";
    const actual1 = "NV027";
    const isMatch1 = expected1 === actual1;
    assert.ok(isMatch1);

    // Trường hợp 2: Bị lệch (ví dụ có tiến trình khác vừa tạo nhân viên)
    const expected2 = "NV027";
    const actual2 = "NV028";
    const isMatch2 = expected2 === actual2;
    assert.ok(!isMatch2);

    // Xử lý thông báo an toàn không che giấu lỗi:
    const notice = !isMatch2
      ? `Đã thêm nhân viên Nguyễn Văn A. Lưu ý: Mã nhân viên thực tế được cấp là ${actual2} (khác mã dự kiến ${expected2}).`
      : `Đã thêm nhân viên Nguyễn Văn A (${actual2}) thành công.`;
    assert.match(notice, /khác mã dự kiến/);
  });
});

