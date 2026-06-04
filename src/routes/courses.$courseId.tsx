import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import React, { useState, useMemo } from 'react';
import { getCourse } from '@/lib/courseContent';
import { useCourseProgress, completeLesson, saveNote, saveQuizScore, trackEvent } from '@/lib/progress';

export const Route = createFileRoute('/courses/$courseId')({
  head: ({ params }) => ({
    meta: [
      { title: `${params.courseId} — NetSem Courses` },
      { name: 'description', content: 'Interactive networking course with lessons, notes and quizzes' },
    ],
  }),
  component: CourseReader,
});

function renderBody(md: string) {
  // Tiny markdown renderer: headings, bold, code blocks, lists.
  const lines = md.split('\n');
  const out: React.ReactNode[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  let listBuf: string[] = [];
  const flushList = () => {
    if (listBuf.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="list-disc list-inside space-y-1 my-3 text-sm text-foreground/90">
          {listBuf.map((li, i) => <li key={i} dangerouslySetInnerHTML={{ __html: inline(li) }} />)}
        </ul>
      );
      listBuf = [];
    }
  };
  const inline = (s: string) =>
    s.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-secondary text-terminal text-[11px]">$1</code>')
     .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-foreground">$1</strong>');
  for (const raw of lines) {
    if (raw.startsWith('```')) {
      if (inCode) {
        out.push(<pre key={`code-${out.length}`} className="my-3 p-3 rounded bg-black/40 border border-border overflow-x-auto text-[11px] font-mono text-terminal">{codeBuf.join('\n')}</pre>);
        codeBuf = []; inCode = false;
      } else { flushList(); inCode = true; }
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }
    if (raw.startsWith('# ')) { flushList(); out.push(<h1 key={out.length} className="text-2xl font-display text-terminal mt-4 mb-3 tracking-wider">{raw.slice(2)}</h1>); continue; }
    if (raw.startsWith('## ')) { flushList(); out.push(<h2 key={out.length} className="text-lg font-display text-foreground mt-4 mb-2">{raw.slice(3)}</h2>); continue; }
    if (raw.startsWith('- ')) { listBuf.push(raw.slice(2)); continue; }
    if (raw.match(/^\d+\.\s/)) { listBuf.push(raw.replace(/^\d+\.\s/, '')); continue; }
    flushList();
    if (raw.trim() === '') { out.push(<div key={out.length} className="h-2" />); continue; }
    out.push(<p key={out.length} className="text-sm text-foreground/90 my-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: inline(raw) }} />);
  }
  flushList();
  return out;
}

function CourseReader() {
  const { courseId } = Route.useParams();
  const navigate = useNavigate();
  const course = useMemo(() => getCourse(courseId), [courseId]);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(course?.lessons[0]?.id || null);
  const [view, setView] = useState<'lessons' | 'notes' | 'quiz'>('lessons');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const cp = useCourseProgress(courseId, course?.lessons.length || 0);
  const [noteDraft, setNoteDraft] = useState(cp.note);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean } | null>(null);

  if (!course) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Course not found.</p>
        <Link to="/courses" className="text-terminal text-sm">← Back to courses</Link>
      </div>
    );
  }

  const activeLesson = course.lessons.find(l => l.id === activeLessonId) || course.lessons[0];

  const markComplete = () => {
    completeLesson(courseId, activeLesson.id);
    // Auto-advance
    const idx = course.lessons.findIndex(l => l.id === activeLesson.id);
    if (idx >= 0 && idx < course.lessons.length - 1) {
      setActiveLessonId(course.lessons[idx + 1].id);
    }
  };

  const submitQuiz = () => {
    let correct = 0;
    for (const q of course.quiz) {
      if (quizAnswers[q.id] === q.answer) correct++;
    }
    const score = Math.round((correct / course.quiz.length) * 100);
    const passed = score >= 70;
    saveQuizScore(courseId, 'final', score, passed);
    setQuizResult({ score, passed });
    if (passed && cp.completed === course.lessons.length) {
      trackEvent('course_complete', { courseId });
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-64 border-r border-border bg-card/40 overflow-y-auto flex-shrink-0`}>
        <div className="p-4 border-b border-border">
          <Link to="/courses" className="text-[10px] text-muted-foreground hover:text-terminal">← All courses</Link>
          <h2 className="text-sm font-display text-terminal mt-2 tracking-wider">{course.title}</h2>
          <div className="mt-2 h-1 bg-secondary rounded overflow-hidden">
            <div className="h-full bg-terminal transition-all" style={{ width: `${cp.percent}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">{cp.completed}/{cp.total} lessons</p>
        </div>
        <nav className="p-2 space-y-0.5">
          {course.lessons.map((l, i) => {
            const done = cp.isDone(l.id);
            const active = l.id === activeLesson.id && view === 'lessons';
            return (
              <button
                key={l.id}
                onClick={() => { setActiveLessonId(l.id); setView('lessons'); setSidebarOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded text-xs flex items-center gap-2 ${
                  active ? 'bg-terminal/10 text-terminal border border-terminal/30' : 'text-foreground/80 hover:bg-accent'
                }`}
              >
                <span className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center border ${done ? 'bg-terminal text-background border-terminal' : 'border-border'}`}>{done ? '✓' : i + 1}</span>
                <span className="truncate">{l.title}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-2 border-t border-border space-y-0.5">
          <button onClick={() => { setView('notes'); setSidebarOpen(false); }} className={`w-full text-left px-3 py-2 rounded text-xs ${view === 'notes' ? 'bg-terminal/10 text-terminal' : 'text-foreground/80 hover:bg-accent'}`}>📝 My Notes</button>
          <button onClick={() => { setView('quiz'); setSidebarOpen(false); }} className={`w-full text-left px-3 py-2 rounded text-xs ${view === 'quiz' ? 'bg-terminal/10 text-terminal' : 'text-foreground/80 hover:bg-accent'}`}>🎯 Final Quiz</button>
          {cp.percent === 100 && (
            <div className="mt-3 px-3 py-2 rounded border border-terminal/40 bg-terminal/10 text-[10px] text-terminal text-center">
              🏆 Course Complete!
            </div>
          )}
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="md:hidden p-3 border-b border-border">
          <button onClick={() => setSidebarOpen(o => !o)} className="text-xs px-3 py-1 border border-border rounded">☰ Lessons</button>
        </div>
        <div className="max-w-3xl mx-auto p-6 md:p-10">
          {view === 'lessons' && (
            <>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Lesson {course.lessons.findIndex(l => l.id === activeLesson.id) + 1} of {course.lessons.length}</div>
              <article>{renderBody(activeLesson.body)}</article>
              <div className="mt-8 flex justify-between items-center border-t border-border pt-4">
                <button
                  disabled={course.lessons.findIndex(l => l.id === activeLesson.id) === 0}
                  onClick={() => {
                    const i = course.lessons.findIndex(l => l.id === activeLesson.id);
                    if (i > 0) setActiveLessonId(course.lessons[i - 1].id);
                  }}
                  className="text-xs px-3 py-2 rounded border border-border text-muted-foreground hover:border-terminal/30 disabled:opacity-30"
                >← Previous</button>
                {cp.isDone(activeLesson.id) ? (
                  <span className="text-xs text-terminal">✓ Completed</span>
                ) : (
                  <button onClick={markComplete} className="text-xs px-4 py-2 rounded bg-primary text-primary-foreground font-display tracking-wider">
                    MARK COMPLETE & NEXT
                  </button>
                )}
                <button
                  disabled={course.lessons.findIndex(l => l.id === activeLesson.id) === course.lessons.length - 1}
                  onClick={() => {
                    const i = course.lessons.findIndex(l => l.id === activeLesson.id);
                    if (i < course.lessons.length - 1) setActiveLessonId(course.lessons[i + 1].id);
                  }}
                  className="text-xs px-3 py-2 rounded border border-border text-muted-foreground hover:border-terminal/30 disabled:opacity-30"
                >Next →</button>
              </div>
            </>
          )}
          {view === 'notes' && (
            <>
              <h1 className="text-2xl font-display text-terminal mb-4 tracking-wider">MY NOTES</h1>
              <p className="text-xs text-muted-foreground mb-3">Your private notes for this course (saved locally).</p>
              <textarea
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value)}
                onBlur={() => saveNote(courseId, noteDraft)}
                placeholder="Write your notes here..."
                className="w-full h-96 p-4 bg-secondary/40 border border-border rounded text-sm font-mono text-foreground outline-none focus:border-terminal/50 resize-none"
              />
              <button onClick={() => saveNote(courseId, noteDraft)} className="mt-3 px-4 py-2 rounded bg-primary text-primary-foreground text-xs">Save Notes</button>
            </>
          )}
          {view === 'quiz' && (
            <>
              <h1 className="text-2xl font-display text-terminal mb-4 tracking-wider">FINAL QUIZ</h1>
              <p className="text-xs text-muted-foreground mb-6">Score 70% or higher to pass.</p>
              <div className="space-y-6">
                {course.quiz.map((q, i) => (
                  <div key={q.id} className="border border-border rounded-lg p-4 bg-card/40">
                    <p className="text-sm font-semibold text-foreground mb-3">{i + 1}. {q.question}</p>
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => {
                        const isChosen = quizAnswers[q.id] === oi;
                        const isCorrect = quizResult && oi === q.answer;
                        const isWrong = quizResult && isChosen && oi !== q.answer;
                        return (
                          <label key={oi} className={`flex items-center gap-3 p-2 rounded border cursor-pointer transition-colors ${
                            isCorrect ? 'border-terminal bg-terminal/10' :
                            isWrong ? 'border-noc-red bg-noc-red/10' :
                            isChosen ? 'border-terminal/50 bg-terminal/5' : 'border-border hover:border-terminal/30'
                          }`}>
                            <input
                              type="radio" name={q.id} checked={isChosen}
                              onChange={() => setQuizAnswers({ ...quizAnswers, [q.id]: oi })}
                              disabled={!!quizResult}
                              className="accent-terminal"
                            />
                            <span className="text-sm text-foreground">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {!quizResult ? (
                <button onClick={submitQuiz} className="mt-6 px-6 py-3 rounded bg-primary text-primary-foreground text-sm font-display tracking-wider">SUBMIT QUIZ</button>
              ) : (
                <div className={`mt-6 p-4 rounded border ${quizResult.passed ? 'border-terminal bg-terminal/10' : 'border-noc-red bg-noc-red/10'}`}>
                  <p className={`text-lg font-display ${quizResult.passed ? 'text-terminal' : 'text-noc-red'}`}>
                    {quizResult.passed ? '🎓 PASSED' : '✗ TRY AGAIN'} — {quizResult.score}%
                  </p>
                  <button onClick={() => { setQuizResult(null); setQuizAnswers({}); }} className="mt-3 text-xs underline text-muted-foreground">Retake quiz</button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}