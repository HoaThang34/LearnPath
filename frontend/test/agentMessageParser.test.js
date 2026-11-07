import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAssistantMessage } from '../src/lib/agentMessageParser.js'

test('agentMessageParser: parses simple string without sections', () => {
  const result = parseAssistantMessage('Chào bạn, mình là trợ lý AI.')
  assert.equal(result.thinking, '')
  assert.equal(result.analysis, null)
  assert.equal(result.answer, 'Chào bạn, mình là trợ lý AI.')
  assert.equal(result.isThinkingStreaming, false)
})

test('agentMessageParser: parses <think> tag and answer', () => {
  const raw = `<think>
Kiểm tra điểm học bạ của bạn... Điểm Toán 8.5
</think>
Dưới đây là câu trả lời của tôi.`
  const result = parseAssistantMessage(raw)
  assert.equal(result.thinking, 'Kiểm tra điểm học bạ của bạn... Điểm Toán 8.5')
  assert.equal(result.answer, 'Dưới đây là câu trả lời của tôi.')
  assert.equal(result.isThinkingStreaming, false)
  assert.equal(result.hasStructuredSections, true)
})

test('agentMessageParser: parses streaming unclosed <think> tag', () => {
  const raw = `<think>
Đang suy nghĩ tiếp...`
  const result = parseAssistantMessage(raw)
  assert.equal(result.thinking, 'Đang suy nghĩ tiếp...')
  assert.equal(result.answer, '')
  assert.equal(result.isThinkingStreaming, true)
})

test('agentMessageParser: parses markdown analysis and answer sections', () => {
  const raw = `Chào bạn!

### 📊 Phân tích
- Điểm học bạ của bạn đạt 25.5 điểm khối A00.
- Độ phù hợp ngành CNTT là 88%.

### 💡 Câu trả lời & Lời khuyên
Bạn có cơ hội rất tốt để ứng tuyển vào Đại học Bách Khoa hoặc ĐHQG.`

  const result = parseAssistantMessage(raw)
  assert.equal(result.intro, 'Chào bạn!')
  assert.ok(result.analysis.includes('Điểm học bạ của bạn'))
  assert.ok(result.answer.includes('Bạn có cơ hội rất tốt'))
  assert.equal(result.hasStructuredSections, true)
})

test('agentMessageParser: parses <think>, analysis, and answer simultaneously', () => {
  const raw = `<think>
Phân tích dữ liệu học sinh...
</think>

### 📊 Phân tích
Phân tích học lực...

### 💡 Câu trả lời & Lời khuyên
Lời khuyên chi tiết...`

  const result = parseAssistantMessage(raw)
  assert.equal(result.thinking, 'Phân tích dữ liệu học sinh...')
  assert.equal(result.analysis, 'Phân tích học lực...')
  assert.equal(result.answer, 'Lời khuyên chi tiết...')
  assert.equal(result.hasStructuredSections, true)
})

test('agentMessageParser: handles empty input gracefully', () => {
  const res1 = parseAssistantMessage('')
  assert.equal(res1.raw, '')
  assert.equal(res1.thinking, '')
  assert.equal(res1.analysis, null)
  assert.equal(res1.answer, '')

  const res2 = parseAssistantMessage(null)
  assert.equal(res2.raw, '')
  assert.equal(res2.thinking, '')
  assert.equal(res2.analysis, null)
  assert.equal(res2.answer, '')
})
