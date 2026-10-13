import assert from "node:assert/strict"
import test from "node:test"
import {
  formatAnswers,
  notifyLine,
  prepareCall,
} from "../packages/pi-extensions/extensions/clef-format.mjs"

test("bool, choice, and score answers stay readable", () => {
  const questions = [
    { id: "destructive", type: "bool", instructions: "Does it destroy data?" },
    {
      id: "allowed",
      type: "choice",
      instructions: "Run it?",
      options: ["allow", "hold"],
    },
    {
      id: "severity",
      type: "score",
      instructions: "How bad?",
      options: ["none", "bad"],
    },
  ]
  const text = formatAnswers(questions, {
    destructive: { type: "bool", probability: 0.008 },
    allowed: {
      type: "choice",
      choice: "allow",
      probabilities: { allow: 0.97, hold: 0.03 },
    },
    severity: { type: "score", score: 0.2 },
  })
  assert.match(text, /destructive: no  P\(yes\)=0.008/)
  assert.match(text, /allowed: allow/)
  assert.match(text, /severity: 0.20 none/)
  assert.match(notifyLine(text), /^destructive: no/)
})

test("oversized state and duplicate ids are refused before a request", () => {
  assert.throws(
    () =>
      prepareCall("x".repeat(8001), [
        { id: "a", type: "bool", instructions: "Yes?" },
      ]),
    /8000/,
  )
  assert.throws(
    () =>
      prepareCall("ok", [
        { id: "a", type: "bool", instructions: "Yes?" },
        { id: "a", type: "bool", instructions: "Again?" },
      ]),
    /unique id/,
  )
})
