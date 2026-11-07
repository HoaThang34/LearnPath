/**
 * Parses raw assistant text into structured segments:
 * - thinking: internal reasoning process (from <think>...</think> or thinking heading)
 * - isThinkingStreaming: true if <think> tag is open without closing tag yet
 * - intro: introductory greeting/sentence before any formal sections
 * - analysis: detailed analysis section (from ### Phân tích or <analysis>)
 * - answer: final answer & advice section (from ### Câu trả lời or <answer> or remaining)
 * - hasStructuredSections: true if thinking, analysis, or structured answer was detected
 */
export function parseAssistantMessage(rawContent = '') {
  if (!rawContent || typeof rawContent !== 'string') {
    return {
      raw: '',
      intro: '',
      thinking: '',
      isThinkingStreaming: false,
      analysis: null,
      answer: '',
      hasStructuredSections: false,
    }
  }

  let text = rawContent
  let thinking = ''
  let isThinkingStreaming = false

  // 1. Extract <think>...</think> tags (DeepSeek R1, Ollama reasoning models, etc.)
  const thinkStart = text.indexOf('<think>')
  if (thinkStart !== -1) {
    const thinkEnd = text.indexOf('</think>', thinkStart + 7)
    if (thinkEnd !== -1) {
      thinking = text.substring(thinkStart + 7, thinkEnd).trim()
      text = (text.substring(0, thinkStart) + '\n' + text.substring(thinkEnd + 8)).trim()
    } else {
      // Still streaming inside <think>
      thinking = text.substring(thinkStart + 7).trim()
      text = text.substring(0, thinkStart).trim()
      isThinkingStreaming = true
    }
  }

  // 2. Extract <analysis>...</analysis> and <answer>...</answer> tags if present
  let analysis = null
  let answer = ''
  let intro = ''

  const analysisTagMatch = text.match(/<analysis>([\s\S]*?)<\/analysis>/i)
  const answerTagMatch = text.match(/<answer>([\s\S]*?)<\/answer>/i)

  if (analysisTagMatch || answerTagMatch) {
    if (analysisTagMatch) {
      analysis = analysisTagMatch[1].trim()
      text = text.replace(analysisTagMatch[0], '').trim()
    }
    if (answerTagMatch) {
      answer = answerTagMatch[1].trim()
      text = text.replace(answerTagMatch[0], '').trim()
    }
    intro = text.trim()
    if (!answer && intro) {
      answer = intro
      intro = ''
    }
  } else {
    // 3. Fallback: Parse Markdown headings
    // Detect thinking heading if not extracted from <think>
    if (!thinking) {
      const thinkHeadingRegex = /(?:^|\n)(?:###?|##|\*\*)\s*(?:🧠\s*)?(?:Quá trình suy nghĩ|Suy nghĩ|Tư duy|Thinking)[:\s]*\n?([\s\S]*?)(?=(?:\n(?:###?|##|\*\*)\s*(?:📊|💡|Phân tích|Câu trả lời|Lời khuyên|Định hướng))|$)/i
      const thinkMatch = text.match(thinkHeadingRegex)
      if (thinkMatch) {
        thinking = thinkMatch[1].trim()
        text = text.replace(thinkMatch[0], '').trim()
      }
    }

    // Detect Analysis and Answer headings
    // Analysis heading matches: "### 📊 Phân tích", "### Phân tích", "## Phân tích", "**Phân tích:**", "### 1. Phân tích", etc.
    const analysisHeaderRegex = /(?:^|\n)(#{2,4}\s*(?:📊\s*)?(?:Phân tích|Đánh giá)(?:[^\n]*)\n|\*\*(?:[0-9]+\.\s*)?Phân tích(?:\s+chi tiết)?\*\*[:\s]*\n)/i
    // Answer heading matches: "### 💡 Câu trả lời", "### Câu trả lời & Lời khuyên", "### Lời khuyên", "### Định hướng", etc.
    const answerHeaderRegex = /(?:^|\n)(#{2,4}\s*(?:💡\s*)?(?:Câu trả lời|Lời khuyên|Định hướng|Kết luận|Khuyến nghị)(?:[^\n]*)\n|\*\*(?:[0-9]+\.\s*)?(?:Câu trả lời|Lời khuyên|Kết luận)\*\*[:\s]*\n)/i

    const analysisMatch = text.match(analysisHeaderRegex)
    const answerMatch = text.match(answerHeaderRegex)

    if (analysisMatch && answerMatch) {
      const aIdx = analysisMatch.index + (analysisMatch[0].startsWith('\n') ? 1 : 0)
      const ansIdx = answerMatch.index + (answerMatch[0].startsWith('\n') ? 1 : 0)

      if (aIdx < ansIdx) {
        intro = text.substring(0, aIdx).trim()
        const afterAnalysisHeader = aIdx + analysisMatch[1].length
        analysis = text.substring(afterAnalysisHeader, ansIdx).trim()
        const afterAnswerHeader = ansIdx + answerMatch[1].length
        answer = text.substring(afterAnswerHeader).trim()
      } else {
        intro = text.substring(0, ansIdx).trim()
        const afterAnswerHeader = ansIdx + answerMatch[1].length
        answer = text.substring(afterAnswerHeader, aIdx).trim()
        const afterAnalysisHeader = aIdx + analysisMatch[1].length
        analysis = text.substring(afterAnalysisHeader).trim()
      }
    } else if (analysisMatch) {
      const aIdx = analysisMatch.index + (analysisMatch[0].startsWith('\n') ? 1 : 0)
      intro = text.substring(0, aIdx).trim()
      const afterAnalysisHeader = aIdx + analysisMatch[1].length
      analysis = text.substring(afterAnalysisHeader).trim()
      answer = ''
    } else if (answerMatch) {
      const ansIdx = answerMatch.index + (answerMatch[0].startsWith('\n') ? 1 : 0)
      intro = text.substring(0, ansIdx).trim()
      const afterAnswerHeader = ansIdx + answerMatch[1].length
      answer = text.substring(afterAnswerHeader).trim()
    } else {
      answer = text.trim()
    }
  }

  const hasStructuredSections = Boolean(
    thinking ||
    analysis ||
    (answer && (intro || thinking || analysis))
  )

  return {
    raw: rawContent,
    intro,
    thinking,
    isThinkingStreaming,
    analysis,
    answer,
    hasStructuredSections,
  }
}
