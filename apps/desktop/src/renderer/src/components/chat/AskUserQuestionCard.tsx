import { useState } from 'react'
import { InteractionDetails } from './InteractionDetails.js'
import { InteractionCardShell } from './InteractionCardShell.js'
import type {
  JsonObject,
  PermissionCard,
  PermissionRespondPayload,
} from '../../domain/displayTypes.js'

type AskQuestionOption = {
  label: string
  description: string
  preview?: string
}

type AskQuestion = {
  question: string
  header: string
  options: AskQuestionOption[]
  multiSelect: boolean
}

type AnswerMap = Record<string, string>
type NoteMap = Record<string, string>

export function AskUserQuestionCard(props: {
  permission: PermissionCard
  onRespond: (
    permissionRequestId: string,
    behavior: 'allow' | 'deny',
    payload?: PermissionRespondPayload,
  ) => Promise<void>
}) {
  const permission = props.permission
  const questions = parseQuestions(permission.input)
  const [answers, setAnswers] = useState<AnswerMap>(() =>
    getExistingAnswers(permission.input),
  )
  const [notes, setNotes] = useState<NoteMap>({})
  const [submitting, setSubmitting] = useState(false)
  const disabled = permission.status !== 'pending' || submitting
  const allAnswered = questions.every(question =>
    getAnswerForSubmit(question, answers, notes),
  )

  async function submitAnswers(): Promise<void> {
    if (!allAnswered || disabled) {
      return
    }

    const answersToSubmit: AnswerMap = {}
    const annotations: JsonObject = {}
    for (const question of questions) {
      const answer = getAnswerForSubmit(question, answers, notes)
      if (!answer) {
        continue
      }
      answersToSubmit[question.question] = answer

      const note = notes[question.question]?.trim()
      const selectedOption = findSelectedOption(question, answer)
      const preview = selectedOption?.preview
      if (note || preview) {
        annotations[question.question] = {
          ...(preview ? { preview } : {}),
          ...(note ? { notes: note } : {}),
        }
      }
    }

    setSubmitting(true)
    try {
      await props.onRespond(permission.permissionRequestId, 'allow', {
        updatedInput: {
          ...permission.input,
          answers: answersToSubmit,
          ...(Object.keys(annotations).length > 0 ? { annotations } : {}),
        },
        message: 'Desktop user answered questions.',
        toolUseID: permission.toolUseId,
        decisionClassification: 'user_temporary',
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function denyQuestion(): Promise<void> {
    if (disabled) {
      return
    }

    setSubmitting(true)
    try {
      await props.onRespond(permission.permissionRequestId, 'deny', {
        message: 'Desktop user declined to answer questions.',
        interrupt: false,
        toolUseID: permission.toolUseId,
        decisionClassification: 'user_reject',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (questions.length === 0) {
    return (
      <InteractionCardShell
        actions={
          <PermissionActions
            disabled={disabled}
            onDeny={denyQuestion}
            onSubmit={submitAnswers}
            submitDisabled
          />
        }
        className="ask-user-question-card"
        status={permission.status}
        title="无法解析问题结构"
        typeLabel="用户提问"
      >
        <p className="ask-question-hint">
          这条 AskUserQuestion 权限请求缺少有效 questions，先按原始详情处理。
        </p>
        <InteractionDetails value={permission.input} />
      </InteractionCardShell>
    )
  }

  return (
    <InteractionCardShell
      actions={
        <PermissionActions
          disabled={disabled}
          onDeny={denyQuestion}
          onSubmit={submitAnswers}
          submitDisabled={!allAnswered || disabled}
        />
      }
      className="ask-user-question-card"
      meta={permission.toolUseId ? `关联工具：${permission.toolUseId}` : null}
      status={formatPermissionStatus(permission.status, submitting)}
      title={permission.description ?? '模型需要你补充信息'}
      typeLabel="用户提问"
    >
      <div className="ask-question-list">
        {questions.map((question, index) => (
          <QuestionBlock
            answer={answers[question.question] ?? ''}
            disabled={disabled}
            index={index}
            key={`${index}:${question.question}`}
            note={notes[question.question] ?? ''}
            question={question}
            onChangeAnswer={nextAnswer =>
              setAnswers(current => ({
                ...current,
                [question.question]: nextAnswer,
              }))
            }
            onChangeNote={nextNote =>
              setNotes(current => ({
                ...current,
                [question.question]: nextNote,
              }))
            }
          />
        ))}
      </div>

      <InteractionDetails value={permission.input} />
    </InteractionCardShell>
  )
}

function QuestionBlock(props: {
  answer: string
  disabled: boolean
  index: number
  note: string
  question: AskQuestion
  onChangeAnswer: (answer: string) => void
  onChangeNote: (note: string) => void
}) {
  const selectedLabels = props.answer
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
  const selectedPreview = props.question.options.find(
    option => option.label === props.answer,
  )?.preview

  function toggleOption(option: AskQuestionOption): void {
    if (props.disabled) {
      return
    }

    if (!props.question.multiSelect) {
      props.onChangeAnswer(option.label)
      return
    }

    const nextLabels = new Set(selectedLabels)
    if (nextLabels.has(option.label)) {
      nextLabels.delete(option.label)
    } else {
      nextLabels.add(option.label)
    }
    props.onChangeAnswer(Array.from(nextLabels).join(', '))
  }

  return (
    <section className="ask-question-block">
      <div className="ask-question-title">
        <span>{props.question.header || `问题 ${props.index + 1}`}</span>
        <strong>{props.question.question}</strong>
        {props.question.multiSelect ? <em>可多选</em> : null}
      </div>

      <div className="ask-question-options">
        {props.question.options.map(option => {
          const selected = props.question.multiSelect
            ? selectedLabels.includes(option.label)
            : props.answer === option.label
          return (
            <button
              aria-pressed={selected}
              className={selected ? 'selected' : ''}
              disabled={props.disabled}
              key={`${props.index}:${option.label}`}
              onClick={() => toggleOption(option)}
              type="button"
            >
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </button>
          )
        })}
      </div>

      {selectedPreview ? (
        <pre className="ask-question-preview">{selectedPreview}</pre>
      ) : null}

      <label className="ask-question-note">
        <span>自定义答案 / 补充说明（可选）</span>
        <textarea
          disabled={props.disabled}
          onChange={event => props.onChangeNote(event.currentTarget.value)}
          placeholder="如果上面的选项不完全合适，可以在这里补充。未选择选项时，这里会作为答案提交。"
          rows={2}
          value={props.note}
        />
      </label>
    </section>
  )
}

function PermissionActions(props: {
  disabled: boolean
  submitDisabled: boolean
  onDeny: () => Promise<void>
  onSubmit: () => Promise<void>
}) {
  return (
    <>
      <button
        disabled={props.submitDisabled}
        onClick={() => void props.onSubmit()}
        type="button"
      >
        提交答案
      </button>
      <button
        className="danger"
        disabled={props.disabled}
        onClick={() => void props.onDeny()}
        type="button"
      >
        拒绝回答
      </button>
    </>
  )
}

function parseQuestions(input: JsonObject): AskQuestion[] {
  const rawQuestions = Array.isArray(input.questions) ? input.questions : []
  return rawQuestions.flatMap((rawQuestion, index) => {
    if (!rawQuestion || typeof rawQuestion !== 'object') {
      return []
    }
    const object = rawQuestion as JsonObject
    const question = getString(object.question)
    if (!question) {
      return []
    }
    const options = parseOptions(object.options)
    if (options.length === 0) {
      return []
    }

    return [
      {
        question,
        header: getString(object.header) ?? `问题 ${index + 1}`,
        options,
        multiSelect: object.multiSelect === true,
      },
    ]
  })
}

function parseOptions(value: unknown): AskQuestionOption[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap(rawOption => {
    if (!rawOption || typeof rawOption !== 'object') {
      return []
    }
    const object = rawOption as JsonObject
    const label = getString(object.label)
    if (!label) {
      return []
    }
    return [
      {
        label,
        description: getString(object.description) ?? '',
        preview: getString(object.preview),
      },
    ]
  })
}

function getExistingAnswers(input: JsonObject): AnswerMap {
  const rawAnswers = input.answers
  if (!rawAnswers || typeof rawAnswers !== 'object') {
    return {}
  }
  return Object.fromEntries(
    Object.entries(rawAnswers as JsonObject).flatMap(([question, answer]) =>
      typeof answer === 'string' ? [[question, answer]] : [],
    ),
  )
}

function getAnswerForSubmit(
  question: AskQuestion,
  answers: AnswerMap,
  notes: NoteMap,
): string | null {
  const answer = answers[question.question]?.trim()
  if (answer) {
    return answer
  }
  const note = notes[question.question]?.trim()
  return note || null
}

function findSelectedOption(
  question: AskQuestion,
  answer: string,
): AskQuestionOption | undefined {
  if (question.multiSelect) {
    return undefined
  }
  return question.options.find(option => option.label === answer)
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function formatPermissionStatus(
  status: PermissionCard['status'],
  submitting: boolean,
): string {
  if (submitting) {
    return '提交中'
  }
  if (status === 'pending') {
    return '等待回答'
  }
  if (status === 'allowed') {
    return '已提交'
  }
  if (status === 'denied') {
    return '已拒绝'
  }
  return '已取消'
}
