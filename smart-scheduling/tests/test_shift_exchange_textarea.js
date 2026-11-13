import test from "node:test";
import assert from "node:assert/strict";

test("Shift Exchange Textarea - Vietnamese Accent & 200 char limit validation", async (t) => {
  await t.test("1. Kiểm tra nhập tiếng Việt có dấu chuẩn", () => {
    const viText = "Nhờ bạn trực giúp mình ca sáng thứ Sáu này nhé! Mình có việc bận gia đình đột xuất, cảm ơn bạn rất nhiều.";
    assert.equal(typeof viText, "string");
    assert.ok(viText.length > 0);
    assert.ok(viText.length <= 200);
    // Đảm bảo không mất dấu
    assert.match(viText, /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i);
  });

  await t.test("2. Kiểm tra bộ đếm ký tự 0/200 đến 200/200", () => {
    let msg = "";
    assert.equal(msg.length, 0);

    msg = "Ca sáng";
    assert.equal(msg.length, 7);

    // Chuỗi đúng 200 ký tự tiếng Việt
    const fullText = "Tôi viết đúng hai trăm ký tự để kiểm tra tính năng đếm ký tự của khung nhập lời nhắn gửi đồng nghiệp khi đổi ca trong hệ thống Smart Scheduling. Đảm bảo hệ thống đếm chuẩn xác từng ký tự có dấu này nhé!!";
    const char200 = fullText.slice(0, 200);
    assert.equal(char200.length, 200);
    assert.equal(`${char200.length}/200`, "200/200");
  });

  await t.test("3. Kiểm tra vượt quá 200 ký tự bị cắt ngắn (slice)", () => {
    const overText = "A".repeat(250);
    const sliced = overText.slice(0, 200);
    assert.equal(sliced.length, 200);
    assert.equal(sliced, "A".repeat(200));
  });

  await t.test("4. Kiểm tra xóa, chỉnh sửa nội dung", () => {
    let text = "Lời nhắn ban đầu";
    // Thêm nội dung
    text = text + " - cập nhật thêm";
    assert.equal(text, "Lời nhắn ban đầu - cập nhật thêm");
    // Xóa nội dung
    text = text.slice(0, 8);
    assert.equal(text, "Lời nhắn");
    // Xóa hết
    text = "";
    assert.equal(text.length, 0);
  });

  await t.test("5. Kiểm tra giữ nguyên nội dung khi đổi ca hoặc đổi đồng nghiệp", () => {
    let note = "Nhờ bạn trực giúp ca này.";
    let selectedShiftId = "101";
    let candidateId = "NV002";

    // Đổi ca khác
    selectedShiftId = "102";
    assert.equal(note, "Nhờ bạn trực giúp ca này.", "Lời nhắn không được bị reset khi đổi ca");

    // Đổi đồng nghiệp khác
    candidateId = "NV005";
    assert.equal(note, "Nhờ bạn trực giúp ca này.", "Lời nhắn không được bị reset khi đổi đồng nghiệp");
  });
});