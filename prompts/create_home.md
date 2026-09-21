# Prompt tạo video mở đầu cho LearnPath

## Thông tin dự án
- **Tên**: LearnPath
- **Loại**: Website tư vấn hướng nghiệp, tra cứu dữ liệu tuyển sinh đại học Việt Nam
- **Đối tượng**: Học sinh THPT, phụ huynh
- **Phong cách**: Hiện đại, thân thiện, đáng tin cậy

## Prompt (English - dùng cho AI video generators)

```
Create a 15-20 second cinematic intro video for "LearnPath", a Vietnamese career guidance website for high school students.

STYLE:
- Modern, clean, minimal design
- Soft gradient background: deep blue (#1e3a5f) to teal (#0d9488)
- Smooth camera movements, no harsh cuts
- Professional but friendly tone

SCENE BREAKDOWN:

Scene 1 (0-4s): A glowing path of light curves through a dark space, forming the silhouette of a winding road leading toward a bright horizon. Small particles float upward like stars.

Scene 2 (4-8s): The path transforms into a network of interconnected nodes — each node represents a university (small building icons). Text appears: "245 Khối thi" with a subtle pulse animation.

Scene 3 (8-12s): Camera zooms through the network. New nodes light up with graduation cap icons. Text transitions: "260+ Trường đại học" fading in with soft glow.

Scene 4 (12-16s): The nodes converge into a single bright point that expands into the LearnPath logo (a graduation cap with a winding path). Text: "Tìm con đường của bạn" appears below.

Scene 5 (16-20s): Logo settles in center. Subtle particle effects fade out. URL "learnpath.vn" fades in at bottom.

MOTION:
- Ease-in-out transitions
- Subtle parallax depth
- Floating particles throughout
- Gentle scale animations on text

COLOR PALETTE:
- Primary: #1e3a5f (deep blue)
- Accent: #0d9488 (teal)
- Highlight: #f59e0b (amber/gold)
- Text: #ffffff (white)
- Background: #0f172a (dark navy)

AUDIO (optional):
- Soft ambient electronic music
- Subtle whoosh on text reveals
- Gentle chime on logo reveal

OUTPUT: 1920x1080, 30fps, MP4 format
```

## Prompt tiếng Việt (nếu cần)

```
Tạo video mở đầu 15-20 giây cho "LearnPath" - website tư vấn hướng nghiệp cho học sinh Việt Nam.

PHONG CÁCH:
- Hiện đại, sạch sẽ, tối giản
- Gradient mềm: xanh đậm (#1e3a5f) sang xanh ngọc (#0d9488)
- Chuyển cảnh mượt, không cắt giật
- Chuyên nghiệp nhưng thân thiện

CẢNH:

Cảnh 1 (0-4s): Đường ánh sáng phát sáng uốn lượn trong không gian tối, tạo thành con đường leading đến đường chân trời xa. Các hạt sáng bay lên như vì sao.

Cảnh 2 (4-8s): Con đường biến thành mạng lưới các nút kết nối — mỗi nút là một trường đại học (icon tòa nhà nhỏ). Xuất hiện text: "245 Khối thi" với hiệu ứng pulse nhẹ.

Cảnh 3 (8-12s): Camera zoom qua mạng lưới. Các nút mới sáng lên với icon mũ tốt nghiệp. Text chuyển: "260+ Trường đại học" với hiệu ứng phát sáng mềm.

Cảnh 4 (12-16s): Các nút hội tụ thành điểm sáng duy nhất, mở rộng thành logo LearnPath (mũ tốt nghiệp với con đường uốn lượn). Text: "Tìm con đường của bạn" xuất hiện bên dưới.

Cảnh 5 (16-20s): Logo cố định giữa màn. Hạt sáng dần tắt. URL "learnpath.vn" xuất hiện ở dưới.

MÀU SẮC:
- Chính: #1e3a5f (xanh đậm)
- Phụ: #0d9488 (xanh ngọc)
- Highlight: #f59e0b (vàng đồng)
- Text: #ffffff (trắng)
- Nền: #0f172a (xanh navy đậm)

ĐỘ PHÂN GIẢI: 1920x1080, 30fps, MP4
```

## Gợi ý công cụ tạo video
- **Runway ML** - gen-3 alpha
- **Pika Labs** - pika 1.0
- **Kling AI** - kling 1.6
- **Sora** (OpenAI)
- **Vidu** - vidu 2.0

## Lưu ý khi dùng prompt
1. Mỗi tool có format prompt riêng, có thể cần điều chỉnh
2. Nên tạo từng scene riêng rồi ghép nếu tool không hỗ trợ prompt dài
3. Thêm logo LearnPath bằng video editor sau khi render xong
4. Thêm nhạc nền separately rồi mix
