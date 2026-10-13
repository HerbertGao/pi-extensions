import { Type } from "@earendil-works/pi-ai"
import { Text } from "@earendil-works/pi-tui"
import {
  formatAnswers,
  formatCall,
  notifyLine,
  prepareCall,
} from "./clef-format.mjs"

const PROVIDER = "cloudflare-workers-ai"
const MODEL_ID = "@cf/cloudflare/clef-flash"

const question = Type.Object({
  id: Type.String({ description: "Short unique id, shown to the user" }),
  type: Type.Union([
    Type.Literal("bool"),
    Type.Literal("choice"),
    Type.Literal("score"),
  ]),
  instructions: Type.String({
    description: "One checkable question about state.text",
  }),
  options: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "Choice labels, or score levels from lowest to highest. Omit for bool.",
    }),
  ),
})

const parameters = Type.Object({
  state: Type.String({
    description:
      "Text to judge. Sent as JSON { text }. Keep it under 8000 characters.",
  }),
  questions: Type.Array(question, {
    minItems: 1,
    maxItems: 8,
    description:
      "1 to 8 independent judgments. The user sees every question and answer.",
  }),
})

function render(text) {
  return new Text(text, 0, 0)
}

export default function clefExtension(pi) {
  pi.registerTool({
    name: "clef",
    label: "Clef",
    description:
      "Ask Cloudflare Clef-flash a narrow yes/no, choice, or score about supplied text, and show the questions and answers to the user. Use only when a probability is the decision. Do not use it to write code, and do not call it before every command or edit.",
    promptSnippet:
      "Ask Clef-flash a typed judgment; the user sees the questions and answers",
    annotations: { readOnlyHint: true, openWorldHint: true },
    parameters,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const prepared = prepareCall(params.state, params.questions)
      const model = ctx.modelRegistry.findOfType(
        "classifier",
        PROVIDER,
        MODEL_ID,
      )
      if (!model) {
        throw new Error(
          "Clef-flash is not in this Pi catalog. Update Pi, then /login cloudflare-workers-ai.",
        )
      }
      const result = await ctx.modelRegistry.classify(model, prepared, {
        signal,
      })
      if (result.stopReason !== "stop") {
        throw new Error(
          result.errorMessage || `Clef failed: ${result.stopReason}`,
        )
      }
      const shown = formatAnswers(params.questions, result.answers)
      ctx.ui.notify(`Clef: ${notifyLine(shown)}`, "info")
      return {
        content: [{ type: "text", text: shown }],
        details: {
          questions: params.questions,
          answers: result.answers,
          model: result.model,
          inputTokens: result.usage?.input,
        },
        ...(result.usage ? { usage: result.usage } : {}),
      }
    },
    renderCall(args) {
      const questions = Array.isArray(args?.questions) ? args.questions : []
      const body = questions.length
        ? formatCall(questions)
        : "waiting for questions"
      return render(`Clef-flash\n${body}`)
    },
    renderResult(result, options) {
      if (options.isPartial) return render("Clef-flash is judging…")
      const details = result.details
      if (!details?.questions) {
        const text =
          result.content?.find((block) => block.type === "text")?.text ??
          "Clef returned no visible answer"
        return render(text)
      }
      return render(
        `Clef-flash\n${formatAnswers(details.questions, details.answers)}`,
      )
    },
  })
}
