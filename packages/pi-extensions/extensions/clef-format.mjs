const MAX_STATE_CHARS = 8000
const MAX_QUESTIONS = 8

export function prepareCall(state, questions) {
  if (typeof state !== "string" || !state.trim()) {
    throw new Error("state must be non-empty text")
  }
  if (state.length > MAX_STATE_CHARS) {
    throw new Error(`state is ${state.length} characters; keep it under ${MAX_STATE_CHARS}`)
  }
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > MAX_QUESTIONS) {
    throw new Error(`ask 1 to ${MAX_QUESTIONS} questions`)
  }
  const seen = new Set()
  const classifierQuestions = {}
  for (const question of questions) {
    const id = question?.id
    if (typeof id !== "string" || !id.trim() || seen.has(id)) {
      throw new Error("each question needs a unique id")
    }
    seen.add(id)
    classifierQuestions[id] = toQuestion(question)
  }
  return { state: { text: state }, questions: classifierQuestions }
}

function toQuestion(question) {
  const instructions = question.instructions
  if (typeof instructions !== "string" || !instructions.trim()) {
    throw new Error(`${question.id}: instructions are required`)
  }
  if (question.type === "bool") {
    return {
      type: "bool",
      instructions,
      criteria: { true: "Yes", false: "No" },
    }
  }
  const options = question.options
  if (!Array.isArray(options) || options.length < 2 || options.some((option) => typeof option !== "string" || !option)) {
    throw new Error(`${question.id}: ${question.type} needs at least two options`)
  }
  if (question.type === "choice") {
    return {
      type: "choice",
      instructions,
      criteria: Object.fromEntries(options.map((option) => [option, option])),
    }
  }
  if (question.type === "score") {
    return { type: "score", instructions, criteria: options }
  }
  throw new Error(`${question.id}: type must be bool, choice, or score`)
}

export function formatCall(questions) {
  return questions
    .map((question) => {
      const options = question.options?.length ? ` [${question.options.join(" | ")}]` : ""
      return `${question.id} (${question.type})${options}\n  ${question.instructions}`
    })
    .join("\n")
}

export function formatAnswers(questions, answers) {
  return questions
    .map((question) => {
      const answer = answers?.[question.id]
      if (!answer) return `${question.id}: no answer\n  ${question.instructions}`
      if (answer.type === "bool") {
        const yes = answer.probability >= 0.5
        return `${question.id}: ${yes ? "yes" : "no"}  P(yes)=${Number(answer.probability).toFixed(3)}\n  ${question.instructions}`
      }
      if (answer.type === "choice") {
        const probs = Object.entries(answer.probabilities)
          .map(([label, probability]) => `${label} ${Number(probability).toFixed(3)}`)
          .join("  ")
        return `${question.id}: ${answer.choice}\n  ${probs}\n  ${question.instructions}`
      }
      if (answer.type === "score") {
        const level = question.options?.[Math.round(answer.score)] ?? ""
        return `${question.id}: ${Number(answer.score).toFixed(2)}${level ? ` ${level}` : ""}\n  ${question.instructions}`
      }
      return `${question.id}: unrecognized answer\n  ${question.instructions}`
    })
    .join("\n")
}

export function notifyLine(text) {
  const line = text
    .split("\n")
    .filter((part) => part && !part.startsWith("  "))
    .join("; ")
  return line.length > 180 ? `${line.slice(0, 177)}...` : line
}
