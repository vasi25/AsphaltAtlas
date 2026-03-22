import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Answer {
  id: string
  question_id: string
  user_id: string
  body: string
  created_at: string
  profiles: { username: string; avatar_url: string | null } | null
}

interface Question {
  id: string
  route_id: string
  user_id: string
  body: string
  created_at: string
  profiles: { username: string; avatar_url: string | null } | null
  question_answers: Answer[]
}

interface Props {
  routeId: string
  routeAuthorId: string
  onCountChange?: (count: number) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Avatar({ username }: { username?: string | null }) {
  return (
    <div className="w-7 h-7 text-xs rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold flex-shrink-0">
      {username?.[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

function AuthorBadge() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-600 text-white leading-none">
      Author
    </span>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function QASection({ routeId, routeAuthorId, onCountChange }: Props) {
  const { user } = useAuth()

  const [questions, setQuestions] = useState<Question[]>([])
  const [questionText, setQuestionText] = useState('')
  const [submittingQuestion, setSubmittingQuestion] = useState(false)

  const [answeringId, setAnsweringId] = useState<string | null>(null)
  const [answerTexts, setAnswerTexts] = useState<Record<string, string>>({})
  const [submittingAnswer, setSubmittingAnswer] = useState(false)

  // ── Fetch ───────────────────────────────────────────────────────────────────

  async function fetchQuestions() {
    const { data, error } = await supabase
      .from('questions')
      .select(`
        *,
        profiles!questions_user_id_fkey(username, avatar_url),
        question_answers(
          *,
          profiles!question_answers_user_id_fkey(username, avatar_url)
        )
      `)
      .eq('route_id', routeId)
      .order('created_at', { ascending: true })

    if (error) { console.error('Failed to fetch questions:', error); return }

    const list = (data ?? []) as unknown as Question[]
    setQuestions(list)
    onCountChange?.(list.length)
  }

  useEffect(() => {
    fetchQuestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId])

  // ── Post question ───────────────────────────────────────────────────────────

  async function submitQuestion(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !questionText.trim()) return
    setSubmittingQuestion(true)

    const { error } = await supabase.from('questions').insert({
      route_id: routeId,
      user_id: user.id,
      body: questionText.trim(),
    })

    if (error) { console.error('Failed to post question:', error); setSubmittingQuestion(false); return }

    setQuestionText('')
    await fetchQuestions()
    setSubmittingQuestion(false)
  }

  // ── Post answer ─────────────────────────────────────────────────────────────

  async function submitAnswer(questionId: string) {
    if (!user) return
    const body = answerTexts[questionId]?.trim()
    if (!body) return
    setSubmittingAnswer(true)

    const { error } = await supabase.from('question_answers').insert({
      question_id: questionId,
      user_id: user.id,
      body,
    })

    if (error) { console.error('Failed to post answer:', error); setSubmittingAnswer(false); return }

    setAnswerTexts((prev) => ({ ...prev, [questionId]: '' }))
    setAnsweringId(null)
    await fetchQuestions()
    setSubmittingAnswer(false)
  }

  // ── Delete question ─────────────────────────────────────────────────────────

  async function deleteQuestion(questionId: string) {
    if (!user) return
    const { error } = await supabase.from('questions').delete().eq('id', questionId).eq('user_id', user.id)
    if (error) { console.error('Failed to delete question:', error); return }
    await fetchQuestions()
  }

  // ── Delete answer ───────────────────────────────────────────────────────────

  async function deleteAnswer(answerId: string) {
    if (!user) return
    const { error } = await supabase.from('question_answers').delete().eq('id', answerId).eq('user_id', user.id)
    if (error) { console.error('Failed to delete answer:', error); return }
    await fetchQuestions()
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Ask a question form */}
      {user ? (
        <form onSubmit={submitQuestion} className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Ask a question</h3>
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Ask a question about this route…"
            rows={3}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
          <button
            type="submit"
            disabled={!questionText.trim() || submittingQuestion}
            className="mt-3 px-5 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submittingQuestion ? 'Posting…' : 'Post Question'}
          </button>
        </form>
      ) : (
        <p className="text-sm text-gray-500 mb-6">
          <Link to="/login" className="text-brand-600 hover:underline font-medium">Sign in</Link> to ask a question.
        </p>
      )}

      {/* Questions list */}
      {questions.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-2xl mb-2">🙋</p>
          <p className="font-medium text-gray-500">No questions yet</p>
          <p className="text-sm mt-1">Be the first to ask something about this route.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {questions.map((question) => (
            <div key={question.id} className="bg-white border border-gray-200 rounded-xl p-5">
              {/* Question header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Avatar username={question.profiles?.username} />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-gray-800">
                        {question.profiles?.username ?? 'Unknown'}
                      </span>
                      {question.user_id === routeAuthorId && <AuthorBadge />}
                    </div>
                    <p className="text-xs text-gray-400">{formatDate(question.created_at)}</p>
                  </div>
                </div>
                {user && question.user_id === user.id && (
                  <button
                    onClick={() => deleteQuestion(question.id)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                  >
                    Delete
                  </button>
                )}
              </div>

              {/* Question body */}
              <p className="mt-3 text-sm text-gray-700 leading-relaxed">{question.body}</p>

              {/* Answers */}
              <div className="mt-4 pl-4 border-l-2 border-brand-200 space-y-3">
                {question.question_answers.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No answers yet — be the first!</p>
                ) : (
                  question.question_answers.map((answer) => (
                    <div key={answer.id} className="flex items-start gap-2.5">
                      <Avatar username={answer.profiles?.username} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-gray-800">
                              {answer.profiles?.username ?? 'Unknown'}
                            </span>
                            {answer.user_id === routeAuthorId && <AuthorBadge />}
                            <span className="text-xs text-gray-400">{formatDate(answer.created_at)}</span>
                          </div>
                          {user && answer.user_id === user.id && (
                            <button
                              onClick={() => deleteAnswer(answer.id)}
                              className="text-xs text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-gray-600 leading-relaxed">{answer.body}</p>
                      </div>
                    </div>
                  ))
                )}

                {/* Answer toggle */}
                {user && (
                  <div className="mt-2">
                    {answeringId === question.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={answerTexts[question.id] ?? ''}
                          onChange={(e) => setAnswerTexts((prev) => ({ ...prev, [question.id]: e.target.value }))}
                          placeholder="Write your answer…"
                          rows={2}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => submitAnswer(question.id)}
                            disabled={!answerTexts[question.id]?.trim() || submittingAnswer}
                            className="px-4 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {submittingAnswer ? 'Posting…' : 'Post Answer'}
                          </button>
                          <button
                            onClick={() => setAnsweringId(null)}
                            className="px-4 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAnsweringId(question.id)}
                        className="text-xs text-brand-600 hover:text-brand-800 font-medium transition-colors"
                      >
                        Answer
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
